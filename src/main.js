// Arta Gustului Media - procesul principal
const { app, BrowserWindow, ipcMain, session, shell, dialog, components } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const QRCode = require('qrcode');
const { installChromeWebStore, uninstallExtension } = require('electron-chrome-web-store');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { Store } = require('./pos/store');

const WEB_PARTITION = 'persist:arta-web';
const REMOTE_PORT = 8787;

// Calculatoare slabe: rasterizare pe placa video, mai putina munca pe procesor
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
// modul de test: fereastra sta in afara ecranului, dar continua sa se deseneze pentru capturi
if (process.env.AG_SHOTS) app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let win = null;
let webSession = null;
let store = null;
let blocker = null;
let blockedCount = 0;

// ---------- Setari persistente ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaultSettings = {
  fullscreen: true,
  autostart: false,
  laptopJackSide: 'left',
  homeUrl: 'https://www.google.com',
  remoteToken: crypto.randomBytes(16).toString('base64url'),
  globalAccess: true,
  guideOnHome: true,
  lowPower: 'auto',
  adblock: true,
  tabSleep: true,
  h264: true,
};
const weakPc = () => os.totalmem() < 7 * 1024 ** 3 || os.cpus().length <= 4;
const lowPowerOn = () => settings.lowPower === 'on' || (settings.lowPower === 'auto' && weakPc());
let settings = { ...defaultSettings };
function loadSettings() {
  try { settings = { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { /* prima pornire */ }
  // accesul de pe internet cere o cheie lunga (cheile scurte din versiunea 1.0 se inlocuiesc)
  if (!settings.remoteToken || settings.remoteToken.length < 20) settings.remoteToken = crypto.randomBytes(16).toString('base64url');
  saveSettings();
}
function saveSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

// ---------- Helper Windows (PowerShell persistent) ----------
const helper = { proc: null, queue: new Map(), nextId: 1, buffer: '', ready: null };
function helperPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'helper', 'winaudio.ps1')
    : path.join(__dirname, '..', 'helper', 'winaudio.ps1');
}
function startHelper() {
  helper.ready = new Promise((resolve) => {
    const proc = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-File', helperPath()], {
      windowsHide: true,
    });
    helper.proc = proc;
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      helper.buffer += chunk;
      let idx;
      while ((idx = helper.buffer.indexOf('\n')) >= 0) {
        const line = helper.buffer.slice(0, idx).trim();
        helper.buffer = helper.buffer.slice(idx + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 0 && msg.result === 'ready') { resolve(msg); continue; }
        const pending = helper.queue.get(msg.id);
        if (!pending) continue;
        helper.queue.delete(msg.id);
        msg.ok ? pending.resolve(msg.result) : pending.reject(new Error(msg.error));
      }
    });
    proc.stderr.on('data', (d) => console.error('[helper]', d.toString()));
    proc.on('exit', () => {
      for (const p of helper.queue.values()) p.reject(new Error('Helper-ul audio s-a oprit.'));
      helper.queue.clear();
      helper.proc = null;
      if (!app.isQuitting) setTimeout(startHelper, 1500);
    });
  });
}
async function helperCall(cmd, args = {}) {
  await helper.ready;
  if (!helper.proc) throw new Error('Helper-ul audio nu rulează.');
  const id = helper.nextId++;
  return new Promise((resolve, reject) => {
    helper.queue.set(id, { resolve, reject });
    helper.proc.stdin.write(JSON.stringify({ id, cmd, args }) + '\n');
    setTimeout(() => {
      if (helper.queue.has(id)) { helper.queue.delete(id); reject(new Error('Timp depășit.')); }
    }, 30000);
  });
}

// ---------- Telecomanda de pe telefon (HTTP local) ----------
function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254')) return a.address;
    }
  }
  return '127.0.0.1';
}
// cheia sta dupa "#": nu ajunge in adresele cerute (nici la server, nici in jurnalele tunelului)
function remoteUrl() { return `http://${lanAddress()}:${REMOTE_PORT}/#k=${settings.remoteToken}`; }

async function remoteAction(action, value) {
  let result;
  if (['playpause', 'next', 'prev'].includes(action)) result = await helperCall('media', { key: action });
  else if (action === 'volume') result = await helperCall('setVolume', { level: Number(value) });
  else if (action === 'mute') result = await helperCall('setMute', { muted: !!value });
  else if (action === 'status') result = await helperCall('getVolume');
  else if (['spotify', 'youtube', 'home'].includes(action)) {
    win?.webContents.send('remote:navigate', action);
    result = 'ok';
  } else throw new Error('Acțiune necunoscută');
  if (action === 'volume' || action === 'mute') win?.webContents.send('volume:changed', result);
  return result;
}

// ---------- Casa de marcat: operatii comune pentru PC si telefoane ----------
const ADMIN_METHODS = new Set([
  'menu.saveCategory', 'menu.deleteCategory', 'menu.moveCategory', 'menu.saveProduct', 'menu.deleteProduct',
  'menu.resort', 'tables.save', 'tables.delete', 'settings.save', 'image.upload',
]);
async function posRpc(method, p = {}, source = 'pc') {
  if (process.env.AG_SHOTS && !method.startsWith('display') && method !== 'state' && method !== 'report.day') console.log(`[rpc] ${new Date().toISOString()} ${source} ${method}`);
  if (ADMIN_METHODS.has(method) && !store.checkPin(p.pin)) throw new Error('PIN de administrator greșit.');
  switch (method) {
    case 'state': return store.state();
    case 'order.create': return store.createOrder(p);
    case 'order.get': return store.order(p.order_id);
    case 'order.addItem': return store.addItem(p);
    case 'order.setQty': return store.setQty(p);
    case 'order.itemNote': return store.setItemNote(p);
    case 'order.update': return store.updateOrder(p);
    case 'order.pay': {
      const o = store.payOrder(p);
      broadcast({
        type: 'display', kind: 'paid', table: o.table_name || 'Fără masă', number: o.number,
        total: o.total, paid: o.paid, change: o.change, method: o.method, waiter: p.by || o.waiter || '',
      });
      return o;
    }
    // ecranul casei: telefonul arata live totalul, suma primita si restul (nu se salveaza)
    case 'display.show': {
      const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
      broadcast({
        type: 'display', kind: p.kind === 'calc' ? 'calc' : 'paying',
        table: String(p.table || '').slice(0, 40), number: int(p.number), lines: int(p.lines),
        total: int(p.total) || 0, paid: int(p.paid), waiter: String(p.waiter || '').slice(0, 24),
      });
      return true;
    }
    case 'display.clear': broadcast({ type: 'display', kind: 'idle', waiter: String(p.waiter || '').slice(0, 24) }); return true;
    case 'order.cancel': return store.cancelOrder(p);
    case 'report.day': return store.report(p.day);
    case 'admin.check': return store.checkPin(p.pin);
    case 'menu.saveCategory': return store.saveCategory(p.category);
    case 'menu.deleteCategory': return store.deleteCategory(p.id);
    case 'menu.moveCategory': return store.moveCategory(p.id, p.dir);
    case 'menu.saveProduct': return store.saveProduct(p.product);
    case 'menu.deleteProduct': return store.deleteProduct(p.id);
    case 'menu.resort': return store.resort();
    case 'tables.save': return store.saveTable(p.table);
    case 'tables.delete': return store.deleteTable(p.id);
    case 'settings.save': return store.saveSettings(p.settings);
    case 'image.upload': return store.saveImage(p);
    case 'remote': return remoteAction(p.action, p.value);
    default: throw new Error(`Operație necunoscută: ${method}`);
  }
}

// ---------- Server local pentru telefoane (aplicatia web + API + sincronizare live) ----------
const STATIC = {
  '/': ['phone/index.html', 'text/html; charset=utf-8'],
  '/phone.css': ['phone/phone.css', 'text/css; charset=utf-8'],
  '/phone.js': ['phone/phone.js', 'text/javascript; charset=utf-8'],
  '/product-icons.js': ['renderer/product-icons.js', 'text/javascript; charset=utf-8'],
  '/icon.png': ['renderer/assets/icon.png', 'image/png'],
  '/manifest.webmanifest': ['phone/manifest.webmanifest', 'application/manifest+json'],
};
const sseClients = new Set();
const strikes = new Map(); // incercari cu cheie gresita, pe adresa IP

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; if (body.length > limit) { reject(new Error('Cerere prea mare.')); req.destroy(); } });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
let stateVersion = 1;
function broadcast(ev) {
  if (ev.type !== 'display') stateVersion++;
  win?.webContents.send('pos:event', ev);
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of sseClients) c.write(line);
}

function startRemoteServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const asset = STATIC[url.pathname];
    if (asset && req.method === 'GET') {
      fs.readFile(path.join(__dirname, asset[0]), (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-cache' });
        res.end(data);
      });
      return;
    }
    const viaTunnel = !!req.headers['cf-connecting-ip'];
    const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
    if (process.env.AG_SHOTS && !viaTunnel && url.pathname.startsWith('/__') && req.socket.remoteAddress.includes('127.0.0.1')) {
      try {
        if (url.pathname === '/__js') await win.webContents.executeJavaScript(`${url.searchParams.get('code')}; undefined`);
        if (url.pathname === '/__shot') {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(path.join(process.env.AG_SHOTS, `${url.searchParams.get('name') || 'shot'}.png`), img.toPNG());
        }
        if (url.pathname === '/__quit') setTimeout(() => app.quit(), 100);
        return sendJson(res, 200, { ok: true });
      } catch (e) { return sendJson(res, 500, { ok: false, error: e.message }); }
    }
    if (url.pathname.startsWith('/img/') && req.method === 'GET') {
      const img = store.image(Number(url.pathname.slice(5)));
      if (!img) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': img.mime, 'Cache-Control': 'max-age=86400' });
      return res.end(Buffer.from(img.data));
    }
    const key = req.headers['x-ag-key'] || url.searchParams.get('k');
    const strike = strikes.get(ip);
    if (strike && strike.until > Date.now()) return sendJson(res, 429, { ok: false, error: 'Prea multe încercări greșite. Încearcă peste câteva minute.' });
    if (key !== settings.remoteToken) {
      const s = strike && Date.now() - strike.first < 10 * 60e3 ? strike : { n: 0, first: Date.now(), until: 0 };
      if (++s.n >= 15) s.until = Date.now() + 10 * 60e3;
      strikes.set(ip, s);
      return sendJson(res, 403, { ok: false, error: 'Cod de acces invalid. Scanează din nou codul QR de pe laptop.' });
    }

    try {
      if (url.pathname === '/api/version') return sendJson(res, 200, { ok: true, v: stateVersion });
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write('retry: 2000\n\n');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }
      if (url.pathname === '/api/state') return sendJson(res, 200, { ok: true, result: store.state() });
      if (url.pathname === '/api/rpc' && req.method === 'POST') {
        const { method, params } = JSON.parse((await readBody(req, 900 * 1024)) || '{}');
        return sendJson(res, 200, { ok: true, result: await posRpc(method, params, `telefon ${req.socket.remoteAddress}`) });
      }
      if (url.pathname === '/api' && req.method === 'POST') {
        const { action, value } = JSON.parse((await readBody(req, 2000)) || '{}');
        return sendJson(res, 200, { ok: true, result: await remoteAction(action, value) });
      }
      res.writeHead(404); res.end();
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
  });
  server.on('error', (e) => console.error('[server]', e.message));
  server.listen(REMOTE_PORT, '0.0.0.0');
  setInterval(() => { for (const c of sseClients) c.write(': ping\n\n'); }, 25000);
}

// ---------- Acces de oriunde (date mobile): tunel Cloudflare gratuit, fara cont ----------
const tunnel = { proc: null, url: null, status: 'off', error: null, retries: 0 };
const tunnelInfo = () => ({ status: tunnel.status, url: tunnel.url, error: tunnel.error });
function cloudflaredPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'vendor', 'cloudflared.exe')
    : path.join(__dirname, '..', 'vendor', 'cloudflared.exe');
}
function setTunnel(patch) {
  Object.assign(tunnel, patch);
  win?.webContents.send('tunnel:status', tunnelInfo());
}
function startTunnel() {
  if (tunnel.proc || !settings.globalAccess || process.env.AG_NO_TUNNEL) return;
  const exe = cloudflaredPath();
  if (!fs.existsSync(exe)) return setTunnel({ status: 'error', error: 'Lipsește cloudflared.exe din instalare.' });
  setTunnel({ status: 'connecting', url: null, error: null });
  const proc = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${REMOTE_PORT}`], { windowsHide: true });
  tunnel.proc = proc;
  const onData = (d) => {
    const s = d.toString();
    const m = s.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/);
    if (m && m[0] !== tunnel.url) { console.log(`[tunel] ${m[0]}`); setTunnel({ url: m[0] }); }
    if (/Registered tunnel connection/i.test(s) && tunnel.url) { tunnel.retries = 0; setTunnel({ status: 'online', error: null }); }
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);
  proc.on('exit', () => {
    if (tunnel.proc === proc) tunnel.proc = null;
    if (app.isQuitting || !settings.globalAccess) return setTunnel({ status: 'off', url: null });
    tunnel.retries++;
    setTunnel({ status: 'connecting', url: null, error: 'Fără internet? Se reîncearcă automat…' });
    setTimeout(startTunnel, Math.min(60e3, 3e3 * tunnel.retries));
  });
}
function stopTunnel() {
  const p = tunnel.proc;
  tunnel.proc = null;
  p?.kill();
  setTunnel({ status: 'off', url: null, error: null });
}

// ---------- Date locale: baza de date + copii de rezerva ----------
const dataDir = () => process.env.AG_DATA || path.join(os.homedir(), 'Arta Gustului');
const mirrorDir = () => (process.env.AG_DATA
  ? path.join(process.env.AG_DATA, 'copie-documente')
  : path.join(app.getPath('documents'), 'Arta Gustului - copii de rezerva'));

function backupNow(reason) {
  const name = store.backup(reason);
  // a doua copie in Documente (daca Documentele sunt in OneDrive, ajunge si in cloud)
  try {
    const dir = mirrorDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(store.backupDir, name), path.join(dir, name));
    const old = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse().slice(10);
    old.forEach((f) => fs.unlinkSync(path.join(dir, f)));
  } catch (e) { console.error('[copie]', e.message); }
  return name;
}

function setupStore() {
  store = new Store(dataDir());
  store.onChange(broadcast);
  const last = store.listBackups()[0];
  if (!last || Date.now() - last.time > 6 * 3600e3) backupNow('pornire');
  store.resortIfDue();
  setInterval(() => {
    if (store.changedSinceBackup) backupNow('auto');
    if (!store.openOrders().length) store.resortIfDue();
  }, 3600e3);
}

// ---------- Sesiunea browserului integrat ----------
function chromeUserAgent(ua) {
  return ua.replace(/\sElectron\/\S+/i, '').replace(/\s[\w-]*arta[\w-]*\/\S+/i, '');
}

async function setupWebSession() {
  webSession = session.fromPartition(WEB_PARTITION);
  webSession.setUserAgent(chromeUserAgent(webSession.getUserAgent()));

  webSession.setSpellCheckerEnabled(false);

  const allowed = new Set(['fullscreen', 'media', 'mediaKeySystem', 'clipboard-sanitized-write', 'pointerLock', 'speaker-selection']);
  webSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));

  // YouTube in H.264: decodat de placa video, nu de procesor
  webSession.registerPreloadScript({ type: 'frame', id: 'ag-web-perf', filePath: path.join(__dirname, 'web-preload.js') });

  try {
    await installChromeWebStore({ session: webSession, allowUnpackedExtensions: true, autoUpdate: !lowPowerOn() });
  } catch (e) {
    console.error('[extensii]', e);
  }
  setupAdblock();
}

// Blocant de reclame integrat (extensiile MV3 de tip uBlock Lite nu functioneaza in Electron)
async function setupAdblock() {
  const cache = path.join(app.getPath('userData'), 'adblock-engine.bin');
  try {
    if (fs.existsSync(cache) && Date.now() - fs.statSync(cache).mtimeMs > 7 * 864e5) fs.unlinkSync(cache);
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: cache, read: fs.promises.readFile, write: fs.promises.writeFile,
    });
    let pending = null;
    blocker.on('request-blocked', () => {
      blockedCount++;
      if (!pending) pending = setTimeout(() => { pending = null; win?.webContents.send('adblock:count', blockedCount); }, 1000);
    });
    if (settings.adblock) blocker.enableBlockingInSession(webSession);
  } catch (e) {
    console.error('[adblock]', e.message);
    blocker = null;
    setTimeout(setupAdblock, 5 * 60e3);
  }
}
function setAdblock(on) {
  if (!blocker) return;
  const active = blocker.isBlockingEnabled(webSession);
  if (on && !active) blocker.enableBlockingInSession(webSession);
  if (!on && active) blocker.disableBlockingInSession(webSession);
}

function listExtensions() {
  return webSession.extensions.getAllExtensions().map((e) => ({
    id: e.id,
    name: e.name,
    version: e.version,
    description: e.manifest?.description || '',
    path: e.path,
  }));
}

// ---------- Fereastra ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    fullscreen: settings.fullscreen && !process.env.AG_SHOTS,
    // in modul de capturi fereastra nu fura focusul (tastele utilizatorului nu ajung in aplicatie)
    ...(process.env.AG_SHOTS ? { show: false, focusable: false, x: -20000, y: 0, skipTaskbar: true } : {}),
    backgroundColor: '#0c0b0a',
    autoHideMenuBar: true,
    title: 'Arta Gustului Media',
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });
  win.removeMenu();
  if (process.env.AG_SHOTS) win.showInactive();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools();
  });
  if (process.env.AG_SHOTS) win.webContents.once('did-finish-load', () => captureViews(process.env.AG_SHOTS));
  win.on('enter-full-screen', () => win.webContents.send('window:fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('window:fullscreen', false));
}

// Mod de verificare: AG_SHOTS=<folder> salveaza o captura pentru fiecare ecran, apoi inchide aplicatia
async function captureViews(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') console.error('[renderer]', e.message); });
  if (process.env.AG_SHOTS_LIST === 'manual') return; // capturi la cerere prin /__shot (doar in modul de test)
  // intrari separate prin "|"; "nume::cod js" ruleaza cod propriu inainte de captura
  // AG_SHOTS_FILE = JSON [{ name, js }] pentru scenarii cu cod propriu
  const shots = process.env.AG_SHOTS_FILE
    ? JSON.parse(fs.readFileSync(process.env.AG_SHOTS_FILE, 'utf8').replace(/^﻿/, '')).map((s) => `${s.name}::${s.js}`)
    : (process.env.AG_SHOTS_LIST || 'home|guide|phone|info|settings|browser').split('|');
  await wait(2500);
  for (const entry of shots) {
    const [name, custom] = entry.split('::');
    const [view, step] = name.split(':');
    const js = custom ? `${custom}; undefined` : view === 'store'
      ? "createTab('https://chromewebstore.google.com/detail/ddkjiahejlhfcafbddmgiahcphecmpfh'); show('browser');"
      : view === 'quit' ? "show('home'); askQuit();"
      : `show('${view}'); ${step ? `guides.full.go(${step - 1}); guides.home.go(${step - 1});` : ''}`;
    try { await win.webContents.executeJavaScript(js); } catch (e) { console.error(`[captura ${name}]`, e.message); }
    await wait(['browser', 'store'].includes(view) ? 9000 : 3800);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, `${name.replace(':', '-')}.png`), img.toPNG());
  }
  app.quit();
}

// Paginile din browser: ferestrele noi devin file noi; ferestrele de autentificare raman popup
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (disposition === 'new-window') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { parent: win, autoHideMenuBar: true, width: 520, height: 720, webPreferences: { partition: WEB_PARTITION } },
      };
    }
    win?.webContents.send('browser:open-tab', url);
    return { action: 'deny' };
  });
  contents.on('before-input-event', (ev, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') win?.setFullScreen(!win.isFullScreen());
    const key = input.key.toLowerCase();
    if (input.control && !input.alt && ['t', 'w', 'l'].includes(key)) {
      ev.preventDefault();
      win?.webContents.send('browser:shortcut', key);
    }
  });
});

// ---------- IPC ----------
function registerIpc() {
  ipcMain.handle('helper', (_e, cmd, args) => helperCall(cmd, args));
  ipcMain.handle('settings:get', () => ({ ...settings, lowPowerActive: lowPowerOn() }));
  ipcMain.handle('settings:set', (_e, patch) => {
    settings = { ...settings, ...patch };
    if ('autostart' in patch) app.setLoginItemSettings({ openAtLogin: !!patch.autostart });
    if ('adblock' in patch) setAdblock(!!patch.adblock);
    if ('globalAccess' in patch) { if (patch.globalAccess) startTunnel(); else stopTunnel(); }
    saveSettings();
    return { ...settings, lowPowerActive: lowPowerOn() };
  });
  ipcMain.handle('perf:info', () => ({
    lowPowerActive: lowPowerOn(), weakPc: weakPc(), adblockReady: !!blocker, blocked: blockedCount,
    memGb: Math.round(os.totalmem() / 1024 ** 3), cpus: os.cpus().length,
  }));
  ipcMain.on('web:flags', (e) => { e.returnValue = { h264: settings.h264 !== false }; });

  // ---------- casa ----------
  ipcMain.handle('pos:rpc', async (_e, method, params) => {
    try { return { ok: true, result: await posRpc(method, params) }; } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('pos:data-info', () => ({
    dir: store.dir,
    mirror: mirrorDir(),
    restoredFrom: store.restoredFrom,
    backups: store.listBackups().slice(0, 12).map(({ name, size, time }) => ({ name, size, time })),
  }));
  ipcMain.handle('pos:backup-now', () => backupNow('manual'));
  ipcMain.handle('pos:open-folder', () => shell.openPath(store.dir));
  ipcMain.handle('pos:export', async () => {
    const d = new Date();
    const r = await dialog.showSaveDialog(win, {
      title: 'Exportă baza de date (pentru alt calculator sau stick)',
      defaultPath: path.join(app.getPath('desktop'), `ArtaGustului-${d.toISOString().slice(0, 10)}.agdb`),
      filters: [{ name: 'Baza de date Arta Gustului', extensions: ['agdb'] }],
    });
    if (r.canceled || !r.filePath) return null;
    store.exportTo(r.filePath);
    return r.filePath;
  });
  const confirmReplace = async (title, info) => (await dialog.showMessageBox(win, {
    type: 'warning', buttons: ['Înlocuiește datele', 'Renunță'], defaultId: 1, cancelId: 1, title,
    message: `${title}?`,
    detail: `Fișierul conține ${info.products} produse și ${info.orders} cecuri. Datele actuale se păstrează automat într-o copie de rezervă.`,
  })).response === 0;
  ipcMain.handle('pos:import', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Importă baza de date', properties: ['openFile'],
      filters: [{ name: 'Baza de date Arta Gustului', extensions: ['agdb', 'db'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const info = Store.validate(r.filePaths[0]);
    if (!(await confirmReplace('Importă baza de date', info))) return null;
    return store.replaceWith(r.filePaths[0]);
  });
  ipcMain.handle('pos:restore', async (_e, name) => {
    const file = path.join(store.backupDir, path.basename(name));
    const info = Store.validate(file);
    if (!(await confirmReplace('Restaurează această copie', info))) return null;
    return store.replaceWith(file);
  });
  ipcMain.handle('remote:info', async (_e, regenerate) => {
    if (regenerate) { settings.remoteToken = crypto.randomBytes(16).toString('base64url'); saveSettings(); }
    // QR-ul foloseste adresa globala cand tunelul e pornit: merge si pe Wi-Fi, si pe date mobile
    const localUrl = remoteUrl();
    const url = tunnel.status === 'online' && tunnel.url ? `${tunnel.url}/#k=${settings.remoteToken}` : localUrl;
    const qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#f3e6cf', light: '#00000000' } });
    return { url, localUrl, qr, ip: lanAddress(), port: REMOTE_PORT, tunnel: tunnelInfo(), globalAccess: settings.globalAccess };
  });
  ipcMain.handle('ext:list', () => listExtensions());
  ipcMain.handle('ext:remove', async (_e, id) => {
    try { await uninstallExtension(id, { session: webSession }); } catch { webSession.extensions.removeExtension(id); }
    return listExtensions();
  });
  ipcMain.handle('ext:load-unpacked', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Alege folderul extensiei (cu manifest.json)', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return listExtensions();
    await webSession.extensions.loadExtension(r.filePaths[0], { allowFileAccess: true });
    return listExtensions();
  });
  ipcMain.handle('drm:status', () => {
    try { return components.status(); } catch { return {}; }
  });
  ipcMain.handle('open:external', (_e, url) => {
    if (/^(https?:|ms-settings:)/.test(url)) return shell.openExternal(url);
  });
  ipcMain.handle('window:fullscreen', (_e, value) => {
    win.setFullScreen(value === undefined ? !win.isFullScreen() : !!value);
    return win.isFullScreen();
  });
  ipcMain.handle('window:minimize', () => { win.setFullScreen(false); win.minimize(); });
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome }));
}

// ---------- Pornire ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    loadSettings();
    setupStore();
    startHelper();
    registerIpc();
    try { await components.whenReady(); } catch (e) { console.error('[widevine]', e); }
    await setupWebSession();
    startRemoteServer();
    createWindow();
    startTunnel();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    helper.proc?.kill();
    tunnel.proc?.kill();
    if (store) {
      try { if (store.changedSinceBackup) backupNow('inchidere'); } catch (e) { console.error('[copie]', e.message); }
      store.close();
    }
  });
  app.on('window-all-closed', () => app.quit());
}
