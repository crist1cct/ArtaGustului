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

const WEB_PARTITION = 'persist:arta-web';
const REMOTE_PORT = 8787;

let win = null;
let webSession = null;

// ---------- Setari persistente ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaultSettings = {
  fullscreen: true,
  autostart: false,
  laptopJackSide: 'left',
  homeUrl: 'https://www.google.com',
  remoteToken: crypto.randomBytes(3).toString('hex'),
  guideOnHome: true,
};
let settings = { ...defaultSettings };
function loadSettings() {
  try { settings = { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { /* prima pornire */ }
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
function remoteUrl() { return `http://${lanAddress()}:${REMOTE_PORT}/?k=${settings.remoteToken}`; }

function startRemoteServer() {
  const page = fs.readFileSync(path.join(__dirname, 'remote', 'remote.html'), 'utf8');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('k') !== settings.remoteToken) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Cod de acces invalid. Scanează din nou codul QR din aplicație.');
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    if (url.pathname === '/api' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 2000) req.destroy(); });
      req.on('end', async () => {
        try {
          const { action, value } = JSON.parse(body || '{}');
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
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  server.on('error', (e) => console.error('[remote]', e.message));
  server.listen(REMOTE_PORT, '0.0.0.0');
}

// ---------- Sesiunea browserului integrat ----------
function chromeUserAgent(ua) {
  return ua.replace(/\sElectron\/\S+/i, '').replace(/\s[\w-]*arta[\w-]*\/\S+/i, '');
}

async function setupWebSession() {
  webSession = session.fromPartition(WEB_PARTITION);
  webSession.setUserAgent(chromeUserAgent(webSession.getUserAgent()));

  const allowed = new Set(['fullscreen', 'media', 'mediaKeySystem', 'clipboard-sanitized-write', 'pointerLock', 'speaker-selection']);
  webSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));

  try {
    await installChromeWebStore({ session: webSession, allowUnpackedExtensions: true });
  } catch (e) {
    console.error('[extensii]', e);
  }
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
  const shots = (process.env.AG_SHOTS_LIST || 'home,guide,phone,info,settings,browser').split(',');
  await wait(2500);
  for (const name of shots) {
    const [view, step] = name.split(':');
    const js = view === 'store'
      ? "createTab('https://chromewebstore.google.com/detail/ddkjiahejlhfcafbddmgiahcphecmpfh'); show('browser');"
      : view === 'quit' ? "show('home'); askQuit();"
      : `show('${view}'); ${step ? `guides.full.go(${step - 1}); guides.home.go(${step - 1});` : ''}`;
    await win.webContents.executeJavaScript(js);
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
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:set', (_e, patch) => {
    settings = { ...settings, ...patch };
    if ('autostart' in patch) app.setLoginItemSettings({ openAtLogin: !!patch.autostart });
    saveSettings();
    return settings;
  });
  ipcMain.handle('remote:info', async (_e, regenerate) => {
    if (regenerate) { settings.remoteToken = crypto.randomBytes(3).toString('hex'); saveSettings(); }
    const url = remoteUrl();
    const qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#f3e6cf', light: '#00000000' } });
    return { url, qr, ip: lanAddress(), port: REMOTE_PORT };
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
    startHelper();
    registerIpc();
    try { await components.whenReady(); } catch (e) { console.error('[widevine]', e); }
    await setupWebSession();
    startRemoteServer();
    createWindow();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    helper.proc?.kill();
  });
  app.on('window-all-closed', () => app.quit());
}
