// Arta Gustului Media - interfata
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SITES = {
  spotify: { url: 'https://open.spotify.com/', host: 'open.spotify.com' },
  youtube: { url: 'https://www.youtube.com/', host: 'youtube.com' },
};
const TITLES = { home: 'Acasă', casa: 'Casă',browser: 'Browser', phone: 'Telefon', guide: 'Ghid sistem LG', info: 'Info', settings: 'Setări' };

let settings = {};
let currentView = 'home';
const guides = {};

function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
}

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// ---------- Navigare ----------
function show(view, opts = {}) {
  currentView = view;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  $(`#view-${view}`).scrollTop = 0;
  $('#viewTitle').textContent = TITLES[view] || '';
  updateNavActive();
  if (view === 'browser' && !tabs.length) createTab(settings.homeUrl || 'https://www.google.com');
  if (view === 'phone') { loadBt(); loadRemote(); }
  if (view === 'casa') window.posOnShow?.();
  if (view === 'settings') { loadDevices(); loadExtensions(); }
  if (opts.scroll) setTimeout(() => $(`#sec-${opts.scroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function updateNavActive() {
  let key = currentView;
  if (currentView === 'browser' && activeTab) {
    const site = siteOf(activeTab.url);
    if (site) key = `site:${site}`;
  }
  $$('.nav-btn').forEach((b) => {
    const k = b.dataset.view || `site:${b.dataset.site}`;
    b.classList.toggle('active', k === key);
  });
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-view], [data-site]');
  if (!t) return;
  if (t.dataset.view) return show(t.dataset.view, { scroll: t.dataset.scroll });
  if (t.dataset.site) return openSite(t.dataset.site);
  if (t.dataset.url) return createTab(t.dataset.url);
  if (t.hasAttribute('data-close-overlay')) return t.closest('.overlay').hidden = true;
  if (t.hasAttribute('data-close-pop')) return t.closest('.popover').hidden = true;
  if (t.dataset.vol) return setVolume(+t.dataset.vol);
});

// ---------- Ceas ----------
function tickClock() {
  const now = new Date();
  $('#clock').textContent = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  const h = now.getHours();
  $('#greeting').textContent = h < 12 ? 'Bună dimineața' : h < 18 ? 'Bună ziua' : 'Bună seara';
  $('#heroDate').textContent = now.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------- Volum ----------
let volState = { level: 50, muted: false };
let volTimer = null;

function renderVolume() {
  const { level, muted } = volState;
  for (const id of ['#volSlider', '#bigVol']) {
    const s = $(id);
    if (document.activeElement !== s) s.value = level;
    s.style.setProperty('--p', `${level}%`);
  }
  $('#volVal').textContent = level;
  $('#bigVolVal').textContent = `${level}%`;
  for (const id of ['#volMute', '#bigMute']) {
    $(id).innerHTML = icon(muted ? 'mute' : 'volume');
    $(id).classList.toggle('on', muted);
  }
}
async function refreshVolume() {
  try { volState = await ag.helper('getVolume'); renderVolume(); } catch { /* helper indisponibil */ }
}
function setVolume(level) {
  volState.level = Math.max(0, Math.min(100, Math.round(level)));
  renderVolume();
  clearTimeout(volTimer);
  volTimer = setTimeout(async () => {
    try {
      volState = await ag.helper('setVolume', { level: volState.level });
      if (volState.muted && volState.level > 0) volState = await ag.helper('setMute', { muted: false });
      renderVolume();
    } catch (e) { toast(e.message, 'err'); }
  }, 60);
}
async function toggleMute() {
  try { volState = await ag.helper('setMute', { muted: !volState.muted }); renderVolume(); } catch (e) { toast(e.message, 'err'); }
}
for (const id of ['#volSlider', '#bigVol']) {
  $(id).addEventListener('input', (e) => setVolume(+e.target.value));
}
$('#volDown').onclick = () => setVolume(volState.level - 5);
$('#volUp').onclick = () => setVolume(volState.level + 5);
$('#volMute').onclick = toggleMute;
$('#bigMute').onclick = toggleMute;
ag.on('volume:changed', (v) => { volState = v; renderVolume(); });

// ---------- Dispozitive audio ----------
const VIRTUAL = /virtual|voicemeeter|vb-audio|cable (input|output)|steam streaming|broadcast|voice changer|vac|droidcam/i;
function deviceKind(name) {
  if (/headphone|căști|casti|headset/i.test(name)) return { icon: 'headphones', hint: 'Mufa 🎧 → sistemul LG' };
  if (/hdmi|display|nvidia|amd high|intel\(r\) display|monitor|tv/i.test(name)) return { icon: 'monitor', hint: 'Monitor / TV prin HDMI' };
  if (/bluetooth|hands-free|a2dp|airpods|buds/i.test(name)) return { icon: 'bluetooth', hint: 'Dispozitiv Bluetooth' };
  return { icon: 'speaker', hint: 'Difuzoare / mufa 🎧 → LG' };
}
let devicesCache = [];
async function loadDevices() {
  try {
    devicesCache = await ag.helper('devices');
  } catch (e) {
    $('#devices').innerHTML = `<p class="empty-note">Nu pot citi dispozitivele audio: ${esc(e.message)}</p>`;
    return;
  }
  renderDevices();
}
function renderDevices() {
  const showVirtual = $('#showVirtual').checked;
  const list = devicesCache.filter((d) => showVirtual || d.isDefault || !VIRTUAL.test(d.name));
  const def = devicesCache.find((d) => d.isDefault);
  $('#chipOutputName').textContent = def ? def.name : 'Fără ieșire audio';
  $('#tileOutput').textContent = def ? def.name : 'Alege difuzoarele';
  $('#devices').innerHTML = list.length ? list.map((d) => {
    const k = deviceKind(d.name);
    return `<button class="device ${d.isDefault ? 'active' : ''}" data-dev="${esc(d.id)}">${icon(k.icon)}<b>${esc(d.name)}</b><small>${k.hint}</small></button>`;
  }).join('') : '<p class="empty-note">Nu există dispozitive audio active.</p>';
  $$('#devices .device').forEach((b) => {
    b.onclick = async () => {
      try {
        await ag.helper('setDefault', { id: b.dataset.dev });
        toast('Ieșirea audio a fost schimbată.', 'ok');
        await loadDevices();
        refreshVolume();
      } catch (e) { toast(`Nu am putut schimba ieșirea: ${e.message}`, 'err'); }
    };
  });
}
$('#showVirtual').onchange = renderDevices;
$('#devRefresh').onclick = loadDevices;
$('#chipOutput').onclick = () => show('settings', { scroll: 'audio' });

$('#soundTest').onclick = () => {
  const ctx = new AudioContext();
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const t = ctx.currentTime + i * 0.18;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 1);
  });
  setTimeout(() => ctx.close(), 2000);
};

// ---------- Browser cu file ----------
const tabs = [];
let activeTab = null;
let tabSeq = 0;

function siteOf(url = '') {
  try {
    const h = new URL(url).hostname;
    return Object.keys(SITES).find((k) => h === SITES[k].host || h.endsWith(`.${SITES[k].host}`));
  } catch { return null; }
}
function normalizeUrl(input) {
  const v = input.trim();
  if (!v) return null;
  if (/^[a-z]+:\/\//i.test(v)) return v;
  if (!/\s/.test(v) && /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
}

function createTab(url, { activate = true } = {}) {
  const tab = { id: ++tabSeq, url, title: 'Se încarcă…', favicon: null, loading: true, playing: false, lastActive: Date.now() };

  const el = document.createElement('div');
  el.className = 'tab loading';
  el.innerHTML = `<span class="tab-fav"></span><span class="tab-title"></span>${icon('volume', 'tab-audio')}<button class="tab-x" title="Închide fila">${icon('close')}</button>`;
  el.onclick = (e) => { if (!e.target.closest('.tab-x')) activateTab(tab); };
  el.querySelector('.tab-x').onclick = () => closeTab(tab);
  el.onauxclick = (e) => { if (e.button === 1) closeTab(tab); };
  tab.el = el;

  tabs.push(tab);
  $('#tabList').appendChild(el);
  mountWebview(tab, url);
  $('#webEmpty').hidden = true;
  renderTab(tab);
  if (activate) activateTab(tab);
  return tab;
}

// Fila adormita: webview-ul e distrus (elibereaza memoria) si se recreeaza la revenire
function sleepTab(tab) {
  if (tab.sleeping || tab === activeTab || tab.playing) return;
  tab.sleeping = true;
  tab.wv.remove();
  tab.wv = null;
  tab.el.classList.add('sleeping');
}
function wakeTab(tab) {
  if (!tab.sleeping) return;
  tab.sleeping = false;
  tab.el.classList.remove('sleeping');
  mountWebview(tab, tab.url);
}
setInterval(() => {
  if (settings.tabSleep === false) return;
  const limit = (settings.lowPowerActive ? 5 : 10) * 60e3;
  tabs.forEach((t) => { if (t !== activeTab && !t.playing && Date.now() - t.lastActive > limit) sleepTab(t); });
}, 60e3);

function mountWebview(tab, url) {
  const wv = document.createElement('webview');
  wv.setAttribute('partition', 'persist:arta-web');
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('webpreferences', 'backgroundThrottling=yes, spellcheck=no');
  wv.setAttribute('src', url);
  tab.wv = wv;
  $('#webviews').appendChild(wv);

  wv.addEventListener('page-title-updated', (e) => { tab.title = e.title; renderTab(tab); });
  wv.addEventListener('page-favicon-updated', (e) => { tab.favicon = e.favicons?.[0] || null; renderTab(tab); });
  wv.addEventListener('did-start-loading', () => { tab.loading = true; renderTab(tab); syncToolbar(); });
  wv.addEventListener('did-stop-loading', () => { tab.loading = false; renderTab(tab); syncToolbar(); });
  const onNav = (e) => {
    if (e.isMainFrame === false) return;
    tab.url = e.url;
    renderTab(tab);
    syncToolbar();
    if (tab === activeTab) updateNavActive();
  };
  wv.addEventListener('did-navigate', onNav);
  wv.addEventListener('did-navigate-in-page', onNav);
  wv.addEventListener('media-started-playing', () => { tab.playing = true; renderTab(tab); });
  wv.addEventListener('media-paused', () => { tab.playing = false; renderTab(tab); });
  wv.addEventListener('enter-html-full-screen', () => {
    wv.classList.add('html-fullscreen');
    ag.fullscreen(true);
  });
  wv.addEventListener('leave-html-full-screen', () => wv.classList.remove('html-fullscreen'));
  wv.addEventListener('did-fail-load', (e) => {
    if (e.isMainFrame && e.errorCode !== -3) toast(`Pagina nu s-a putut încărca (${e.errorDescription || e.errorCode}). Verifică internetul.`, 'err');
  });
  if (tab === activeTab) wv.classList.add('active');
}

function renderTab(tab) {
  const fav = tab.el.querySelector('.tab-fav');
  const site = siteOf(tab.url);
  const fallback = site === 'spotify' ? 'spotify' : site === 'youtube' ? 'youtube' : 'globe';
  if (tab.favicon) {
    if (!fav.querySelector('img') || fav.querySelector('img').src !== tab.favicon) {
      fav.innerHTML = `<img src="${esc(tab.favicon)}" alt="">`;
      fav.querySelector('img').onerror = () => { tab.favicon = null; fav.innerHTML = icon(fallback, 'tab-ico'); };
    }
  } else {
    fav.innerHTML = icon(fallback, 'tab-ico');
  }
  tab.el.querySelector('.tab-title').textContent = tab.title || tab.url;
  tab.el.title = tab.title;
  tab.el.classList.toggle('loading', tab.loading);
  tab.el.classList.toggle('playing', tab.playing);
}

function activateTab(tab) {
  if (activeTab) activeTab.lastActive = Date.now();
  activeTab = tab;
  tab.lastActive = Date.now();
  wakeTab(tab);
  tabs.forEach((t) => {
    t.el.classList.toggle('active', t === tab);
    t.wv?.classList.toggle('active', t === tab);
  });
  syncToolbar();
  updateNavActive();
  tab.el.scrollIntoView({ block: 'nearest' });
}

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  if (i < 0) return;
  tabs.splice(i, 1);
  tab.el.remove();
  tab.wv?.remove();
  if (activeTab === tab) {
    activeTab = null;
    const next = tabs[i] || tabs[i - 1];
    if (next) activateTab(next);
  }
  if (!tabs.length) { $('#webEmpty').hidden = false; syncToolbar(); updateNavActive(); }
}

function syncToolbar() {
  const t = activeTab;
  const ready = t && t.wv?.isConnected && typeof t.wv.canGoBack === 'function';
  let canBack = false, canFwd = false;
  try { canBack = ready && t.wv.canGoBack(); canFwd = ready && t.wv.canGoForward(); } catch { /* webview inca neatasat */ }
  $('#navBack').disabled = !canBack;
  $('#navFwd').disabled = !canFwd;
  $('#navReload').innerHTML = icon(t && t.loading ? 'stop' : 'reload');
  if (document.activeElement !== $('#address')) $('#address').value = t ? t.url : '';
}

function openSite(name) {
  const site = SITES[name];
  if (!site) return;
  const existing = tabs.find((t) => siteOf(t.url) === name);
  if (existing) activateTab(existing);
  else createTab(site.url);
  show('browser');
}

$('#tabNew').onclick = () => { createTab(settings.homeUrl); $('#address').focus(); };
$('#navBack').onclick = () => activeTab?.wv.goBack();
$('#navFwd').onclick = () => activeTab?.wv.goForward();
$('#navReload').onclick = () => { if (!activeTab) return; activeTab.loading ? activeTab.wv.stop() : activeTab.wv.reload(); };
$('#navHome').onclick = () => { if (activeTab) activeTab.wv.loadURL(settings.homeUrl); else createTab(settings.homeUrl); };
$('#addressForm').onsubmit = (e) => {
  e.preventDefault();
  const url = normalizeUrl($('#address').value);
  if (!url) return;
  if (activeTab) activeTab.wv.loadURL(url); else createTab(url);
  $('#address').blur();
};
$('#address').addEventListener('focus', (e) => e.target.select());

function browserShortcut(key) {
  if (key === 't') { show('browser'); createTab(settings.homeUrl); $('#address').focus(); }
  if (key === 'w' && activeTab && currentView === 'browser') closeTab(activeTab);
  if (key === 'l' && currentView === 'browser') $('#address').focus();
  if (key === 'r' && activeTab && currentView === 'browser') activeTab.wv.reload();
}
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && ['t', 'w', 'l', 'r'].includes(e.key.toLowerCase())) { e.preventDefault(); browserShortcut(e.key.toLowerCase()); }
  if (e.key === 'Escape') $$('.overlay').forEach((o) => (o.hidden = true));
});
ag.on('browser:shortcut', browserShortcut);
ag.on('browser:open-tab', (url) => { createTab(url); show('browser'); });
ag.on('remote:navigate', (where) => (where === 'home' ? show('home') : openSite(where)));

// ---------- Extensii ----------
function extItem(e, removable) {
  return `<div class="ext-item">${icon('puzzle')}<div><b>${esc(e.name)}</b><small>v${esc(e.version)} · ${esc(e.description || e.id)}</small></div>${removable ? `<button class="btn ghost sm" data-ext-remove="${esc(e.id)}">${icon('trash')}Elimină</button>` : ''}</div>`;
}
async function loadExtensions() {
  const list = await ag.extList();
  const empty = '<p class="empty-note">Nicio extensie instalată încă.</p>';
  $('#extList').innerHTML = list.length ? list.map((e) => extItem(e, true)).join('') : empty;
  $('#extPopList').innerHTML = list.length ? list.map((e) => extItem(e, false)).join('') : empty;
  $$('[data-ext-remove]').forEach((b) => {
    b.onclick = async () => { await ag.extRemove(b.dataset.extRemove); toast('Extensia a fost eliminată.', 'ok'); loadExtensions(); };
  });
}
const openStore = () => { createTab('https://chromewebstore.google.com/'); show('browser'); $('#extPopover').hidden = true; };
$('#extStore').onclick = openStore;
$('#extStore2').onclick = openStore;
$('#extUnpacked').onclick = async () => {
  try { await ag.extLoadUnpacked(); loadExtensions(); } catch (e) { toast(`Extensia nu s-a putut încărca: ${e.message}`, 'err'); }
};
$('#btnExt').onclick = () => {
  const p = $('#extPopover');
  p.hidden = !p.hidden;
  if (!p.hidden) loadExtensions();
};

// ---------- Telefon ----------
async function loadBt() {
  const box = $('#btList');
  try {
    const list = await ag.helper('btList');
    const connected = list.filter((d) => d.state === 'opened' || d.state === 'connected');
    $('#statPhone').textContent = connected.length ? connected.map((d) => d.name).join(', ') : 'Neconectat';
    if (!list.length) {
      box.innerHTML = '<p class="empty-note">Niciun telefon asociat. Apasă „Setări Bluetooth” → Adaugă dispozitiv → Bluetooth și alege telefonul.</p>';
      return;
    }
    box.innerHTML = list.map((d) => {
      const on = d.state === 'opened' || d.state === 'connected';
      return `<div class="bt-item ${on ? 'connected' : ''}">${icon('phone')}<div><b>${esc(d.name)}</b><small>${on ? 'Conectat · redă muzica pe telefon' : 'Asociat · neconectat'}</small></div>
        <button class="btn ${on ? 'ghost' : ''} sm" data-bt="${esc(d.id)}" data-on="${on ? 1 : 0}">${on ? 'Deconectează' : 'Conectează'}</button></div>`;
    }).join('');
    $$('[data-bt]', box).forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        b.textContent = 'Se conectează…';
        try {
          await ag.helper(b.dataset.on === '1' ? 'btDisconnect' : 'btConnect', { id: b.dataset.bt });
          toast(b.dataset.on === '1' ? 'Telefon deconectat.' : 'Telefon conectat! Pornește muzica pe telefon.', 'ok');
        } catch (e) { toast(e.message, 'err'); }
        loadBt();
      };
    });
  } catch (e) {
    box.innerHTML = `<p class="empty-note">${esc(e.message)}</p>`;
  }
}
$('#btRefresh').onclick = loadBt;
$('#btSettings').onclick = () => ag.openExternal('ms-settings:bluetooth');

async function loadRemote(regenerate = false) {
  try {
    const r = await ag.remoteInfo(regenerate);
    settings.remoteToken = new URLSearchParams(new URL(r.url).hash.slice(1)).get('k') || settings.remoteToken;
    $('#qrBox').innerHTML = r.qr;
    $('#remoteUrl').textContent = r.url;
    $('#setGlobal').checked = !!r.globalAccess;
    const t = r.tunnel;
    const st = !r.globalAccess ? ['off', 'Doar pe Wi-Fi-ul restaurantului'] :
      t.status === 'online' ? ['on', 'Online de oriunde · date mobile și Wi-Fi'] :
      t.status === 'error' ? ['err', t.error || 'Eroare la conectare'] : ['wait', t.error || 'Se conectează la internet…'];
    $('#netStatus').className = `net-status ${st[0]}`;
    $('#netStatus').textContent = st[1];
    $('#statRemote').textContent = r.globalAccess && t.status === 'online' ? 'Online de oriunde' : `Wi-Fi ${r.ip}`;
  } catch (e) { $('#remoteUrl').textContent = e.message; }
}
$('#setGlobal').onchange = async (e) => { settings = await ag.setSettings({ globalAccess: e.target.checked }); loadRemote(); };
ag.on('tunnel:status', () => { loadRemote(); window.posTunnelChanged?.(); });
$('#remoteRegen').onclick = async () => { await loadRemote(true); toast('Cod nou generat. Scanează din nou QR-ul.', 'ok'); };

// ---------- Ghiduri ----------
function mountGuides() {
  const side = settings.laptopJackSide || 'left';
  guides.home = AGGuide.mount($('#homeGuide'), { compact: true, side });
  guides.full = AGGuide.mount($('#fullGuide'), { side });
}
function setSide(side) {
  settings.laptopJackSide = side;
  ag.setSettings({ laptopJackSide: side });
  Object.values(guides).forEach((g) => g.setSide(side));
  $$('[data-side]').forEach((b) => b.classList.toggle('on', b.dataset.side === side));
}
$$('[data-side]').forEach((b) => (b.onclick = () => setSide(b.dataset.side)));
$('#miniGuide').onclick = () => {
  $('#guideOverlay').hidden = false;
  if (!guides.overlay) guides.overlay = AGGuide.mount($('#overlayGuide'), { side: settings.laptopJackSide });
  else guides.overlay.restart();
};

// ---------- Setari aplicatie ----------
function bindSettings() {
  $('#setFullscreen').checked = !!settings.fullscreen;
  $('#setAutostart').checked = !!settings.autostart;
  $('#setHomeUrl').value = settings.homeUrl;
  $$('[data-side]').forEach((b) => b.classList.toggle('on', b.dataset.side === settings.laptopJackSide));
  $('#setFullscreen').onchange = (e) => ag.setSettings({ fullscreen: e.target.checked }).then((s) => (settings = s));
  $('#setAutostart').onchange = (e) => ag.setSettings({ autostart: e.target.checked }).then((s) => (settings = s));
  $('#homeUrlForm').onsubmit = async (e) => {
    e.preventDefault();
    const url = normalizeUrl($('#setHomeUrl').value) || 'https://www.google.com';
    settings = await ag.setSettings({ homeUrl: url });
    $('#setHomeUrl').value = url;
    toast('Pagina de start a fost salvată.', 'ok');
  };
  $('#setHomeUrl').onblur = () => $('#homeUrlForm').requestSubmit();

  // viteza
  const applyPerf = () => {
    document.body.classList.toggle('lite', !!settings.lowPowerActive);
    $$('#lowPowerToggle [data-lp]').forEach((b) => b.classList.toggle('on', b.dataset.lp === settings.lowPower));
    $('#setAdblock').checked = settings.adblock !== false;
    $('#setH264').checked = settings.h264 !== false;
    $('#setTabSleep').checked = settings.tabSleep !== false;
    $('#btnShield').classList.toggle('off', settings.adblock === false);
  };
  const savePerf = async (patch) => { settings = await ag.setSettings(patch); applyPerf(); };
  $$('#lowPowerToggle [data-lp]').forEach((b) => (b.onclick = () => savePerf({ lowPower: b.dataset.lp })));
  $('#setAdblock').onchange = (e) => savePerf({ adblock: e.target.checked });
  $('#setH264').onchange = (e) => savePerf({ h264: e.target.checked });
  $('#setTabSleep').onchange = (e) => savePerf({ tabSleep: e.target.checked });
  $('#btnShield').onclick = async () => {
    await savePerf({ adblock: settings.adblock === false });
    toast(settings.adblock ? 'Blocantul de reclame este pornit. Reîncarcă pagina.' : 'Blocantul de reclame este oprit.', 'ok');
  };
  ag.on('adblock:count', (n) => { $('#shieldCount').textContent = n > 999 ? `${Math.floor(n / 1000)}k` : n; });
  applyPerf();
  ag.perfInfo().then((p) => {
    $('#perfInfo').textContent = `Acest calculator: ${p.memGb} GB RAM, ${p.cpus} nuclee${p.weakPc ? ' — detectat ca slab, modul economic automat este activ' : ''}.`;
  });
}

async function loadAbout() {
  const [info, drm] = await Promise.all([ag.appInfo(), ag.drmStatus()]);
  const wv = Object.values(drm || {}).find((c) => /widevine/i.test(c.title || ''));
  $('#aboutText').textContent = `Arta Gustului Media v${info.version} · Chromium ${info.chrome} · Widevine (Spotify): ${wv ? `activ v${wv.version}` : 'indisponibil'}`;
}

// ---------- Fereastra ----------
function setFsIcon(isFs) { $('#btnFullscreen').innerHTML = icon(isFs ? 'shrink' : 'expand'); }
$('#btnFullscreen').onclick = async () => setFsIcon(await ag.fullscreen());
ag.on('window:fullscreen', setFsIcon);
const askQuit = () => { $('#quitOverlay').hidden = false; $('#quitYes').focus(); };
$('#btnQuit').onclick = askQuit;
$('#btnQuit2').onclick = askQuit;
$('#quitYes').onclick = () => ag.quit();
$('#btnMinimize').onclick = () => ag.minimize();

// ---------- Pornire ----------
(async function init() {
  hydrateIcons();
  settings = await ag.getSettings();
  setFsIcon(settings.fullscreen);
  bindSettings();
  mountGuides();
  tickClock();
  setInterval(tickClock, 10000);
  window.posInit?.();
  refreshVolume();
  setInterval(() => { if (!document.hidden) refreshVolume(); }, 8000);
  loadDevices();
  setInterval(() => { if (!document.hidden) loadDevices(); }, 60000);
  loadRemote();
  loadBt();
  loadAbout();
})();
