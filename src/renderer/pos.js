// Casa de marcat (PC): vanzare, meniu, mese, raport, date
const P = {
  state: null,
  cur: null,
  cat: 'top',
  search: '',
  pane: 'board',
  display: { kind: 'idle', at: 0 },
  qr: null,
  adminPin: null,
  lastInteract: 0,
  rankSnap: null,
  pendingMenu: false,
  editCat: null,
  meSearch: '',
  reportDay: null,
};
const QUICK_NOTES = ['fără ceapă', 'picant', 'la pachet', 'fără gheață', 'extra sos', 'bine făcut', 'fără zahăr', 'urgent'];
const CAT_COLORS = ['#d8b36e', '#c8955a', '#c8735a', '#d9824b', '#d68fb0', '#a98fd6', '#5aa9c8', '#5ac8a6', '#7fbf6a', '#e0c068'];

// ---------- utilitare ----------
function money(b) {
  const v = (b || 0) / 100;
  const s = v.toLocaleString('ro-RO', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${s} ${P.state?.settings.currency || 'lei'}`;
}
function parseMoney(str) {
  const n = parseFloat(String(str || '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
const minutesSince = (iso) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
const ago = (iso) => { const m = minutesSince(iso); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const localDayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const imgUrl = (id) => `http://127.0.0.1:8787/img/${id}`;
const catOf = (id) => P.state.menu.categories.find((c) => c.id === id);
const curOrder = () => P.state?.orders.find((o) => o.id === P.cur) || null;
function prodVisual(p, cls = '') {
  if (p.image_id) return `<img src="${imgUrl(p.image_id)}" alt="" loading="lazy">`;
  return productIcon(p.icon || guessProductIcon(p.name) || 'gift', cls);
}

async function rpc(method, params = {}, admin = false) {
  try {
    return await ag.pos(method, admin ? { ...params, pin: P.adminPin } : params);
  } catch (e) {
    toast(e.message, 'err');
    throw e;
  }
}

// ---------- ferestre modale ----------
let modalResolve = null;
function openModal(html, cls = '') {
  const card = $('#modalCard');
  card.className = `overlay-card modal-card ${cls}`;
  card.innerHTML = html;
  hydrateIcons(card);
  $('#modal').hidden = false;
  return card;
}
function closeModal(value) {
  $('#modal').hidden = true;
  $('#modalCard').innerHTML = '';
  document.removeEventListener('keydown', modalKeys, true);
  const r = modalResolve; modalResolve = null;
  if (r) r(value);
}
let modalKeyHandler = null;
function modalKeys(e) {
  if ($('#modal').hidden) return;
  if (e.key === 'Escape') { e.stopPropagation(); closeModal(null); return; }
  modalKeyHandler?.(e);
}
function modalPromise(keyHandler) {
  modalKeyHandler = keyHandler || null;
  document.addEventListener('keydown', modalKeys, true);
  return new Promise((r) => { modalResolve = r; });
}
function confirmBox(title, text, ok = 'Da', danger = false) {
  const card = openModal(`<h2>${esc(title)}</h2><p class="muted" style="margin-top:8px">${esc(text)}</p>
    <div class="modal-actions"><button class="btn ghost" data-x>Renunță</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button></div>`, 'slim');
  card.querySelector('[data-x]').onclick = () => closeModal(false);
  card.querySelector('[data-ok]').onclick = () => closeModal(true);
  return modalPromise((e) => { if (e.key === 'Enter') closeModal(true); });
}
function promptBox(title, { value = '', placeholder = '', chips = [], type = 'text' } = {}) {
  const card = openModal(`<h2>${esc(title)}</h2>
    <div class="field" style="margin-top:14px"><input id="pbInput" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${type === 'password' ? 'inputmode="numeric"' : ''}></div>
    ${chips.length ? `<div class="quick" style="margin-top:12px">${chips.map((c) => `<button data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="modal-actions"><button class="btn ghost" data-x>Renunță</button><button class="btn" data-ok>Salvează</button></div>`, 'slim');
  const input = card.querySelector('#pbInput');
  setTimeout(() => input.focus(), 30);
  card.querySelectorAll('[data-chip]').forEach((b) => (b.onclick = () => {
    input.value = input.value ? `${input.value}, ${b.dataset.chip}` : b.dataset.chip;
    input.focus();
  }));
  card.querySelector('[data-x]').onclick = () => closeModal(null);
  card.querySelector('[data-ok]').onclick = () => closeModal(input.value);
  return modalPromise((e) => { if (e.key === 'Enter') closeModal(input.value); });
}
async function ensureAdmin() {
  if (!P.state.settings.hasPin || P.adminPin) return true;
  const pin = await promptBox('PIN administrator', { type: 'password', placeholder: 'Introdu PIN-ul' });
  if (pin === null) return false;
  if (await ag.pos('admin.check', { pin })) { P.adminPin = pin; return true; }
  toast('PIN greșit.', 'err');
  return false;
}

// ---------- stare + sincronizare ----------
function snapRanks() {
  P.rankSnap = new Map(P.state.menu.products.map((p) => [p.id, (p.pinned ? -1e6 : 0) + p.rank]));
  P.pendingMenu = false;
}
async function loadPos(evType) {
  P.state = await ag.pos('state');
  if (!P.rankSnap || evType === 'reload') snapRanks();
  else if (evType === 'menu') {
    if (Date.now() - P.lastInteract < 15000) P.pendingMenu = true; else snapRanks();
  }
  if (P.cur && !curOrder()) P.cur = null;
  renderPos();
  updateHomeCasa();
}
let posTimer = null;
let posEvType = null;
ag.on('pos:event', (ev) => {
  if (ev.type === 'display') { onDisplay(ev); return; }
  if (ev.type === 'reload') posEvType = 'reload';
  else if (ev.type === 'menu' && posEvType !== 'reload') posEvType = 'menu';
  clearTimeout(posTimer);
  posTimer = setTimeout(() => { const t = posEvType; posEvType = null; loadPos(t); }, 120);
});
setInterval(() => {
  if (P.pendingMenu && Date.now() - P.lastInteract > 15000) { snapRanks(); renderSale(); }
  if (P.state && currentView === 'casa' && P.pane === 'sale') renderStrip();
  if (P.state && currentView === 'casa' && P.pane === 'board') renderBoard();
}, 20000);

function renderPos() {
  if (!P.state) return;
  if (P.pane === 'board') renderBoard();
  if (P.pane === 'sale') renderSale();
  if (P.pane === 'menu') renderMenuEditor();
  if (P.pane === 'tables') renderTables();
  if (P.pane === 'report') renderReport();
  if (P.pane === 'data') renderData();
}

// ---------- taburi ----------
$$('.pos-tab').forEach((b) => (b.onclick = async () => {
  if (b.hasAttribute('data-admin') && !(await ensureAdmin())) return;
  P.pane = b.dataset.pane;
  $$('.pos-tab').forEach((t) => t.classList.toggle('on', t === b));
  $$('.pos-pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === P.pane));
  if (P.pane === 'report') P.reportDay = localDayStr();
  renderPos();
}));
window.posOnShow = () => { if (!P.state) loadPos('reload'); else renderPos(); };

// ---------- PANOU (ecranul casei: cecuri active + plata live de pe telefon) ----------
function boardBackground() {
  const bg = $('#boardBg');
  if (bg.dataset.ready) return;
  const ids = ['coffee', 'wine', 'pizza', 'cocktail', 'salad', 'beer', 'cake', 'soup', 'latte', 'steak', 'fish', 'icecream'];
  const spots = [[6, 14], [22, 70], [38, 28], [52, 82], [64, 18], [78, 58], [90, 22], [12, 48], [46, 56], [70, 88], [86, 84], [30, 92]];
  bg.innerHTML = spots.map(([x, y], i) => `<span style="left:${x}%;top:${y}%;transform:rotate(${(i * 37) % 50 - 25}deg) scale(${1 + (i % 3) * 0.35})">${productIcon(ids[i % ids.length])}</span>`).join('');
  bg.dataset.ready = '1';
}

function renderBoard() {
  boardBackground();
  const now = new Date();
  $('#bClock').textContent = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  $('#bDate').textContent = now.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  const orders = [...P.state.orders].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const openTotal = orders.reduce((s, o) => s + o.total, 0);
  $('#bOpen').textContent = orders.length ? `${orders.length} · ${money(openTotal)}` : '0';
  ag.pos('report.day', { day: localDayStr() }).then((r) => {
    $('#bToday').textContent = money(r.total);
    $('#bCount').textContent = r.orders;
  }).catch(() => {});

  if (!orders.length) {
    $('#bChecks').innerHTML = `<div class="board-empty">${icon('receipt')}<h2>Niciun cec activ</h2>
      <p class="muted">Comenzile se iau de pe telefon: Mese → alege masa → produse.<br>Cecurile deschise apar aici, mare.</p></div>`;
  } else {
    $('#bChecks').innerHTML = orders.map((o) => {
      const count = o.items.reduce((s, i) => s + i.qty, 0);
      const fresh = Date.now() - Date.parse(o.updated_at) < 20000;
      return `<div role="button" tabindex="0" class="bcard ${fresh ? 'fresh' : ''} ${minutesSince(o.created_at) > 60 ? 'old' : ''}" data-oid="${o.id}">
        <div class="bc-top"><b>${esc(o.table_name || 'Fără masă')}</b><span>#${o.number}</span></div>
        <div class="bc-total">${money(o.total)}</div>
        <ul>${o.items.slice(0, 4).map((it) => `<li><em>${it.qty}×</em> ${esc(it.name)}</li>`).join('')}${o.items.length > 4 ? `<li class="more">+ încă ${o.items.length - 4}</li>` : ''}${!o.items.length ? '<li class="more">cec gol</li>' : ''}</ul>
        <div class="bc-foot">${icon('phone')}<span>${esc(o.waiter || '—')}</span><span>${count} produse · ${ago(o.created_at)}</span></div>
      </div>`;
    }).join('');
    $$('#bChecks [data-oid]').forEach((b) => (b.onclick = () => {
      P.cur = +b.dataset.oid;
      $('.pos-tab[data-pane="sale"]').click();
    }));
  }
  renderPayPanel();
}

function onDisplay(ev) {
  P.display = { ...ev, at: Date.now() };
  if (currentView === 'casa' && P.pane === 'board') renderPayPanel();
  // dupa o plata de pe telefon, ecranul casei se deschide singur pe panou
  if (ev.kind === 'paid' || ev.kind === 'paying') {
    if (currentView === 'home') { show('casa'); $('.pos-tab[data-pane="board"]').click(); }
  }
}
setInterval(() => {
  const d = P.display;
  const ttl = d.kind === 'paid' ? 90e3 : 60e3;
  if (d.kind !== 'idle' && Date.now() - d.at > ttl) { P.display = { kind: 'idle', at: Date.now() }; if (P.pane === 'board') renderPayPanel(); }
  if (currentView === 'casa' && P.pane === 'board' && P.state) {
    $('#bClock').textContent = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }
}, 5000);

async function renderPayPanel() {
  const d = P.display;
  const box = $('#bPay');
  const restBlock = (paid, total) => {
    if (paid === null || paid === undefined) return `<div class="bp-rest wait"><span>Rest</span><b>—</b><small>se așteaptă suma primită</small></div>`;
    const rest = paid - total;
    return rest < 0
      ? `<div class="bp-rest short"><span>Lipsesc</span><b>${money(-rest)}</b></div>`
      : `<div class="bp-rest"><span>Rest de dat</span><b>${money(rest)}</b></div>`;
  };
  if (d.kind === 'paying' || d.kind === 'calc') {
    box.className = 'board-pay live';
    box.innerHTML = `<p class="bp-label"><i class="live-dot"></i>${d.kind === 'calc' ? 'Calculator pe telefon' : 'Se încasează pe telefon'}</p>
      <h2>${d.kind === 'calc' ? `${d.lines || 0} sume adunate` : `${esc(d.table)}${d.number ? ` · Cec #${d.number}` : ''}`}<span class="muted" style="font-size:15px;font-weight:400"> · ${esc(d.waiter || '')}</span></h2>
      <div class="bp-pair"><div class="bp-line"><span>Total</span><b>${money(d.total)}</b></div>
      <div class="bp-line"><span>Primit</span><b>${d.paid !== null && d.paid !== undefined ? money(d.paid) : '—'}</b></div></div>
      ${restBlock(d.paid, d.total)}`;
    return;
  }
  if (d.kind === 'paid') {
    box.className = 'board-pay done';
    box.innerHTML = `<p class="bp-label ok">${icon('check')}Încasat${d.method === 'card' ? ' cu cardul' : ''}</p>
      <h2>${esc(d.table)} · Cec #${d.number}<span class="muted" style="font-size:15px;font-weight:400"> · ${esc(d.waiter || '')} · ${new Date(d.at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span></h2>
      ${d.method === 'card' ? `<div class="bp-line"><span>Total</span><b>${money(d.total)}</b></div><div class="bp-rest card"><span>Card</span><b>${icon('card')}Plătit</b></div>` : `
      <div class="bp-pair"><div class="bp-line"><span>Total</span><b>${money(d.total)}</b></div>
      <div class="bp-line"><span>Primit</span><b>${money(d.paid)}</b></div></div>
      <div class="bp-rest"><span>Rest de dat</span><b>${money(d.change)}</b></div>`}`;
    return;
  }
  box.className = 'board-pay idle';
  if (!P.qr) { try { P.qr = await ag.remoteInfo(); } catch { /* */ } }
  if (P.display.kind !== 'idle') return;
  box.innerHTML = `<p class="bp-label">${icon('phone')}Încasare de pe telefon</p>
    <h2>Totalul și restul apar aici</h2>
    <p class="muted">Pe telefon: deschide cecul → Încasează → scrie suma primită. Restul se vede imediat pe acest ecran.</p>
    <div class="bp-qr">${P.qr ? P.qr.qr : ''}<small>Scanează pentru a conecta un telefon</small></div>`;
}

// ---------- VANZARE ----------
function sortedProducts(list) {
  const r = (p) => (P.rankSnap?.get(p.id) ?? p.rank);
  return [...list].sort((a, b) => r(a) - r(b) || a.id - b.id);
}
function visibleProducts() {
  const all = sortedProducts(P.state.menu.products.filter((p) => p.active));
  const q = P.search.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (q) return all.filter((p) => p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
  if (P.cat === 'all') return all;
  if (P.cat === 'top') {
    const used = all.filter((p) => p.order_count > 0 || p.pinned);
    return (used.length ? used : all).slice(0, 18);
  }
  return all.filter((p) => p.category_id === P.cat);
}

function renderSale() {
  renderStrip();
  renderCats();
  renderGrid();
  renderTicket();
}

function renderStrip() {
  const orders = P.state.orders;
  $('#checksStrip').innerHTML = orders.map((o) => `
    <button class="chk ${o.id === P.cur ? 'on' : ''}" data-oid="${o.id}">
      <b>${esc(o.table_name || `Cec #${o.number}`)}</b>
      <small>${money(o.total)} · ${ago(o.created_at)}${o.waiter && o.waiter !== 'Casa' ? ` · ${esc(o.waiter)}` : ''}</small>
    </button>`).join('') + `<button class="chk new" id="chkNew">${icon('plus')}Cec nou</button>`;
  $$('#checksStrip [data-oid]').forEach((b) => (b.onclick = () => { P.cur = +b.dataset.oid; renderSale(); }));
  $('#chkNew').onclick = () => pickTable({ forNew: true });
}

function renderCats() {
  const prods = P.state.menu.products.filter((p) => p.active);
  const cats = P.state.menu.categories.filter((c) => c.active);
  const item = (key, label, iconHtml, color, count) => `
    <button class="cat ${P.cat === key && !P.search ? 'on' : ''}" data-cat="${key}" style="--c:${color || 'var(--gold)'}">${iconHtml}<span>${esc(label)}</span>${count !== undefined ? `<span class="cnt">${count}</span>` : ''}</button>`;
  $('#catList').innerHTML =
    item('top', 'Populare', icon('sparkle', 'pico'), '#f0d39a') +
    item('all', 'Toate', icon('receipt', 'pico'), '#9d9384', prods.length) +
    cats.map((c) => item(c.id, c.name, productIcon(c.icon || 'gift'), c.color, prods.filter((p) => p.category_id === c.id).length)).join('');
  $$('#catList [data-cat]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.cat;
    P.cat = k === 'top' || k === 'all' ? k : +k;
    P.search = '';
    $('#prodSearch').value = '';
    renderCats();
    renderGrid();
  }));
}

function renderGrid() {
  const list = visibleProducts();
  const order = curOrder();
  const inCart = new Map();
  order?.items.forEach((it) => inCart.set(it.product_id, (inCart.get(it.product_id) || 0) + it.qty));
  if (!P.state.menu.products.length) {
    $('#prodGrid').innerHTML = `<div class="empty-big">${icon('edit')}<div><h3 style="justify-content:center">Meniul este gol</h3><p class="muted">Adaugă produsele și prețurile în tabul „Meniu”.</p></div><button class="btn" id="goMenu">${icon('plus')}Adaugă produse</button></div>`;
    $('#goMenu').onclick = () => $('.pos-tab[data-pane="menu"]').click();
    return;
  }
  $('#prodGrid').innerHTML = list.length ? list.map((p, i) => {
    const c = catOf(p.category_id);
    const n = inCart.get(p.id);
    return `<button class="prod" data-pid="${p.id}" style="--c:${c?.color || 'var(--gold)'}">
      ${P.cat === 'top' && !P.search ? `<span class="rank">${i + 1}</span>` : ''}
      ${n ? `<span class="in-cart">${n}</span>` : ''}
      ${prodVisual(p)}<b>${esc(p.name)}</b><small>${money(p.price)}</small></button>`;
  }).join('') : `<div class="empty-big">${icon('search')}<p>Niciun produs găsit.</p></div>`;
  $$('#prodGrid [data-pid]').forEach((b) => (b.onclick = () => addProduct(+b.dataset.pid, b)));
}

function putOrder(o) {
  const i = P.state.orders.findIndex((x) => x.id === o.id);
  if (o.status !== 'open') { if (i >= 0) P.state.orders.splice(i, 1); return; }
  if (i >= 0) P.state.orders[i] = o; else P.state.orders.push(o);
}

async function addProduct(pid, el) {
  P.lastInteract = Date.now();
  el?.classList.remove('flash'); void el?.offsetWidth; el?.classList.add('flash');
  try {
    if (!curOrder()) {
      const o = await rpc('order.create', { waiter: 'Casa' });
      putOrder(o);
      P.cur = o.id;
    }
    putOrder(await rpc('order.addItem', { order_id: P.cur, product_id: pid, by: 'Casa' }));
    renderStrip(); renderGrid(); renderTicket();
  } catch { /* afisat deja */ }
}

function renderTicket() {
  const o = curOrder();
  const t = $('#ticket');
  if (!o) {
    t.innerHTML = `<div class="tk-head"><button class="tk-table" id="tkTable">${icon('table')}<div><b>Alege masa</b><small>sau atinge direct un produs</small></div></button></div>
      <div class="tk-items"><div class="tk-empty">${icon('receipt')}<p>Niciun cec selectat.<br>Atinge un produs pentru un cec nou.</p></div></div>`;
    $('#tkTable').onclick = () => pickTable({ forNew: true });
    return;
  }
  t.innerHTML = `
    <div class="tk-head">
      <button class="tk-table" id="tkTable">${icon('table')}<div><b>${esc(o.table_name || 'Fără masă')}</b><small>${o.waiter ? esc(o.waiter) + ' · ' : ''}deschis de ${ago(o.created_at)} · schimbă</small></div></button>
      <div class="tk-num">Cec<b>#${o.number}</b></div>
    </div>
    <div class="tk-items">${o.items.length ? o.items.map((it) => `
      <div class="tk-item">
        <div><div class="nm">${esc(it.name)}</div><div class="sub">${it.qty} × ${money(it.price)}</div></div>
        <div class="lt">${money(it.qty * it.price)}</div>
        ${it.note ? `<div class="nt">✎ ${esc(it.note)}</div>` : ''}
        <div class="qty" style="grid-column:1/-1">
          <button class="qbtn note" data-note="${it.id}" title="Notă">${icon('edit')}</button>
          <button class="qbtn" data-dec="${it.id}" data-q="${it.qty}">${icon('minus')}</button>
          <span class="qn">${it.qty}</span>
          <button class="qbtn" data-inc="${it.id}" data-q="${it.qty}">${icon('plus')}</button>
        </div>
      </div>`).join('') : `<div class="tk-empty">${icon('receipt')}<p>Cecul e gol.<br>Atinge produsele din stânga.</p></div>`}</div>
    <div class="tk-foot">
      <div class="tk-total"><span>Total</span><b>${money(o.total)}</b></div>
      <div class="tk-actions">
        <button class="btn pay" id="tkPay" ${o.items.length ? '' : 'disabled'}>${icon('cash')}Încasează</button>
        <button class="btn ghost" id="tkCard" ${o.items.length ? '' : 'disabled'}>${icon('card')}Card</button>
        <button class="btn danger" id="tkCancel">${icon('trash')}Anulează</button>
      </div>
    </div>`;
  $('#tkTable').onclick = () => pickTable({ forNew: false });
  $$('#ticket [data-inc]').forEach((b) => (b.onclick = () => setQty(+b.dataset.inc, +b.dataset.q + 1)));
  $$('#ticket [data-dec]').forEach((b) => (b.onclick = () => setQty(+b.dataset.dec, +b.dataset.q - 1)));
  $$('#ticket [data-note]').forEach((b) => (b.onclick = async () => {
    const it = o.items.find((x) => x.id === +b.dataset.note);
    const note = await promptBox(`Notă: ${it.name}`, { value: it.note || '', placeholder: 'ex. fără ceapă', chips: QUICK_NOTES });
    if (note === null) return;
    putOrder(await rpc('order.itemNote', { item_id: it.id, note }));
    renderTicket();
  }));
  $('#tkPay').onclick = () => payModal(o);
  $('#tkCard').onclick = () => payCard(o);
  $('#tkCancel').onclick = async () => {
    if (o.items.length && !(await confirmBox('Anulezi cecul?', `${o.table_name || 'Cec #' + o.number} · ${money(o.total)}. Cecul anulat rămâne în istoric.`, 'Anulează cecul', true))) return;
    await rpc('order.cancel', { order_id: o.id });
    P.state.orders = P.state.orders.filter((x) => x.id !== o.id);
    P.cur = null;
    renderSale();
  };
}

async function setQty(itemId, qty) {
  P.lastInteract = Date.now();
  try { putOrder(await rpc('order.setQty', { item_id: itemId, qty })); renderTicket(); renderGrid(); renderStrip(); } catch { /* */ }
}

function pickTable({ forNew }) {
  const tables = P.state.tables.filter((t) => t.active);
  const busy = new Map();
  P.state.orders.forEach((o) => { if (o.table_id) busy.set(o.table_id, [...(busy.get(o.table_id) || []), o]); });
  const zones = [...new Set(tables.map((t) => t.zone || 'Mese'))];
  const card = openModal(`
    <div class="card-head"><div><h2>${forNew ? 'Cec nou — alege masa' : 'Mută cecul la masa'}</h2><p class="muted">Mesele aurii au deja un cec deschis.</p></div>
      <button class="icon-btn" data-x>${icon('close')}</button></div>
    ${zones.map((z) => `<div class="zone-title">${esc(z)}</div><div class="tables-grid">${tables.filter((t) => (t.zone || 'Mese') === z).map((t) => {
      const os = busy.get(t.id) || [];
      return `<button class="tbl ${os.length ? 'busy' : ''}" data-tid="${t.id}"><b>${esc(t.name)}</b><small>${os.length ? `${money(os.reduce((s, o) => s + o.total, 0))} · ${ago(os[0].created_at)}` : 'liberă'}</small></button>`;
    }).join('')}</div>`).join('')}
    <div class="modal-actions"><button class="btn ghost" data-none>${icon('receipt')}Fără masă</button></div>`, 'wide');
  card.querySelector('[data-x]').onclick = () => closeModal(null);
  const choose = async (tid) => {
    closeModal(null);
    if (forNew) {
      const existing = tid && busy.get(tid);
      if (existing?.length) { P.cur = existing[0].id; renderSale(); return; }
      const o = await rpc('order.create', { table_id: tid, waiter: 'Casa' });
      putOrder(o); P.cur = o.id;
    } else {
      putOrder(await rpc('order.update', { order_id: P.cur, table_id: tid }));
    }
    renderSale();
  };
  card.querySelectorAll('[data-tid]').forEach((b) => (b.onclick = () => choose(+b.dataset.tid)));
  card.querySelector('[data-none]').onclick = () => choose(null);
  return modalPromise();
}

function cashSuggestions(total) {
  const lei = total / 100;
  const out = new Set();
  for (const step of [10, 50, 100, 200, 500, 1000]) {
    const v = Math.ceil(lei / step) * step;
    if (v > lei) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 5);
}

function payModal(o) {
  let typed = '';
  const card = openModal(`
    <div class="card-head"><div><p class="eyebrow">Încasare numerar</p><h2>${esc(o.table_name || 'Fără masă')} · Cec #${o.number}</h2></div><button class="icon-btn" data-x>${icon('close')}</button></div>
    <div class="pay-box">
      <div class="pay-sum">
        <div class="pay-line"><span>De plată</span><b>${money(o.total)}</b></div>
        <div class="pay-line given"><span>Primit</span><b id="pGiven">—</b></div>
        <div class="pay-line rest" id="pRestBox"><span>Rest de dat</span><b id="pRest">—</b></div>
        <div class="quick">
          <button class="exact" data-amt="${o.total / 100}">Fix ${money(o.total)}</button>
          ${cashSuggestions(o.total).map((v) => `<button data-amt="${v}">${v} ${esc(P.state.settings.currency)}</button>`).join('')}
        </div>
      </div>
      <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" data-card>${icon('card')}Plată cu cardul</button>
      <button class="btn" id="pOk" disabled>${icon('check')}Încasat</button>
    </div>`, 'wide');
  const update = () => {
    const given = typed ? parseMoney(typed) : NaN;
    $('#pGiven').textContent = typed ? money(given) : '—';
    const box = $('#pRestBox');
    if (!typed) { $('#pRest').textContent = '—'; box.classList.remove('short'); $('#pOk').disabled = true; return; }
    const rest = given - o.total;
    box.classList.toggle('short', rest < 0);
    $('#pRest').textContent = rest < 0 ? `Lipsesc ${money(-rest)}` : money(rest);
    $('#pOk').disabled = !(rest >= 0);
  };
  const key = (k) => {
    if (k === '⌫') typed = typed.slice(0, -1);
    else if (k === ',' || k === '.') { if (!typed.includes(',')) typed = (typed || '0') + ','; }
    else if (/^\d$/.test(k)) {
      const dec = typed.split(',')[1];
      if (dec !== undefined && dec.length >= 2) return;
      if (typed.replace(',', '').length < 7) typed = typed === '0' ? k : typed + k;
    }
    update();
  };
  card.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => key(b.dataset.k)));
  card.querySelectorAll('[data-amt]').forEach((b) => (b.onclick = () => { typed = String(b.dataset.amt).replace('.', ','); update(); }));
  card.querySelector('[data-x]').onclick = () => closeModal(null);
  card.querySelector('[data-card]').onclick = () => { closeModal(null); payCard(o, true); };
  const confirmPay = async () => {
    const given = parseMoney(typed);
    if (!(given >= o.total)) return;
    closeModal(null);
    try {
      const paid = await rpc('order.pay', { order_id: o.id, method: 'cash', paid: given });
      putOrder(paid);
      P.cur = null;
      renderSale();
      restNotice(paid);
    } catch { /* */ }
  };
  $('#pOk').onclick = confirmPay;
  update();
  return modalPromise((e) => {
    if (/^[\d,.]$/.test(e.key)) { e.preventDefault(); key(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); key('⌫'); }
    else if (e.key === 'Enter') { e.preventDefault(); confirmPay(); }
  });
}

async function payCard(o, skipConfirm = false) {
  if (!skipConfirm && !(await confirmBox('Plată cu cardul', `${o.table_name || 'Cec #' + o.number}: ${money(o.total)}. Confirmi după ce terminalul a aprobat plata.`, 'Plătit cu cardul'))) return;
  try {
    putOrder(await rpc('order.pay', { order_id: o.id, method: 'card' }));
    P.cur = null;
    renderSale();
    toast(`Plată cu cardul înregistrată: ${money(o.total)}`, 'ok');
  } catch { /* */ }
}

function restNotice(paid) {
  const card = openModal(`<div style="text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center">
      <p class="eyebrow">Cec #${paid.number} încasat</p>
      <p class="muted">Primit ${money(paid.paid)} · Total ${money(paid.total)}</p>
      <div class="pay-line rest" style="width:100%"><span>Rest de dat</span><b>${money(paid.change)}</b></div>
      <button class="btn big" data-ok style="margin-top:8px">${icon('check')}Gata</button></div>`, 'slim');
  card.querySelector('[data-ok]').onclick = () => closeModal(null);
  setTimeout(() => card.querySelector('[data-ok]')?.focus(), 30);
  return modalPromise((e) => { if (e.key === 'Enter') closeModal(null); });
}

// cautare rapida: tastezi direct pe ecranul de vanzare
$('#prodSearch').addEventListener('input', (e) => { P.search = e.target.value; renderCats(); renderGrid(); });
$('#prodSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const list = visibleProducts();
    if (list.length >= 1 && P.search) { addProduct(list[0].id); e.target.select(); }
  }
  if (e.key === 'Escape') { e.target.value = ''; P.search = ''; renderCats(); renderGrid(); e.target.blur(); }
});
document.addEventListener('keydown', (e) => {
  if (currentView !== 'casa' || P.pane !== 'sale' || !$('#modal').hidden) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;
  if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  $('#prodSearch').focus();
});

// ---------- MENIU ----------
function renderMenuEditor() {
  const cats = P.state.menu.categories;
  if (P.editCat === null || (P.editCat !== 'none' && !cats.find((c) => c.id === P.editCat))) P.editCat = cats[0]?.id ?? 'none';
  const prods = P.state.menu.products;
  const hasOrphans = prods.some((p) => !p.category_id);
  $('#meCatList').innerHTML = cats.map((c, i) => `
    <div class="me-cat ${P.editCat === c.id ? 'on' : ''}" data-cid="${c.id}" style="--c:${c.color || 'var(--gold)'}${c.active ? '' : ';opacity:.5'}">
      ${productIcon(c.icon || 'gift')}<b>${esc(c.name)}</b><span class="muted small">${prods.filter((p) => p.category_id === c.id).length}</span>
      <button class="icon-btn" data-up="${c.id}" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
      <button class="icon-btn" data-dn="${c.id}" ${i === cats.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
      <button class="icon-btn" data-ced="${c.id}">${icon('edit')}</button>
    </div>`).join('') + (hasOrphans ? `<div class="me-cat ${P.editCat === 'none' ? 'on' : ''}" data-cid="none">${productIcon('gift')}<b>Fără categorie</b></div>` : '');
  $$('#meCatList [data-cid]').forEach((el) => (el.onclick = (e) => {
    if (e.target.closest('button')) return;
    P.editCat = el.dataset.cid === 'none' ? 'none' : +el.dataset.cid;
    renderMenuEditor();
  }));
  $$('#meCatList [data-up]').forEach((b) => (b.onclick = () => rpc('menu.moveCategory', { id: +b.dataset.up, dir: -1 }, true)));
  $$('#meCatList [data-dn]').forEach((b) => (b.onclick = () => rpc('menu.moveCategory', { id: +b.dataset.dn, dir: 1 }, true)));
  $$('#meCatList [data-ced]').forEach((b) => (b.onclick = () => categoryModal(cats.find((c) => c.id === +b.dataset.ced))));

  const s = P.state.settings;
  $$('#autoSortToggle [data-sort]').forEach((b) => b.classList.toggle('on', b.dataset.sort === s.autoSort));
  $('#resortEveryRow').hidden = s.autoSort !== 'orders';
  $('#resortEvery').value = s.resortEvery;
  $('#lastResort').textContent = s.lastResort ? `Ultima reordonare: ${new Date(s.lastResort).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}` : 'Încă nu s-a reordonat.';

  const q = P.meSearch.trim().toLowerCase();
  const list = q ? prods.filter((p) => p.name.toLowerCase().includes(q))
    : prods.filter((p) => (P.editCat === 'none' ? !p.category_id : p.category_id === P.editCat));
  const cat = catOf(P.editCat);
  $('#meProdTitle').textContent = q ? `Rezultate „${P.meSearch}”` : (cat ? cat.name : 'Fără categorie');
  $('#meProdList').innerHTML = list.length ? sortedProducts(list).map((p) => {
    const c = catOf(p.category_id);
    return `<button class="me-prod ${p.active ? '' : 'off'}" data-pid="${p.id}" style="--c:${c?.color || 'var(--gold)'}">${prodVisual(p)}
      <div><b>${p.pinned ? '📌 ' : ''}${esc(p.name)}</b><small>${money(p.price)}</small><em>în ${p.order_count} cecuri${p.active ? '' : ' · ascuns'}</em></div></button>`;
  }).join('') : `<p class="empty-note">Niciun produs aici. Apasă „Produs nou”.</p>`;
  $$('#meProdList [data-pid]').forEach((b) => (b.onclick = () => productModal(prods.find((p) => p.id === +b.dataset.pid))));
}
$('#meSearch').addEventListener('input', (e) => { P.meSearch = e.target.value; renderMenuEditor(); });
$('#catAdd').onclick = () => categoryModal(null);
$('#prodAdd').onclick = () => productModal(null);
$$('#autoSortToggle [data-sort]').forEach((b) => (b.onclick = () => rpc('settings.save', { settings: { autoSort: b.dataset.sort } }, true)));
$('#resortEvery').onchange = (e) => rpc('settings.save', { settings: { resortEvery: +e.target.value } }, true);
$('#resortNow').onclick = async () => { await rpc('menu.resort', {}, true); P.lastInteract = 0; toast('Produsele au fost reordonate după popularitate.', 'ok'); };

function iconPickerHtml(selected) {
  return `<div class="prod-search sm" style="width:100%;margin-bottom:8px">${icon('search')}<input id="icSearch" placeholder="Caută imagine: cafea, bere, pizza…" spellcheck="false"></div>
    <div class="icon-pick" id="icPick">${PRODUCT_ICONS.map((ic) => `<button type="button" data-ic="${ic.id}" class="${ic.id === selected ? 'on' : ''}">${productIcon(ic.id)}${esc(ic.label)}</button>`).join('')}</div>`;
}
function bindIconPicker(card, onPick) {
  const pick = card.querySelector('#icPick');
  pick.querySelectorAll('[data-ic]').forEach((b) => (b.onclick = () => {
    pick.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    onPick(b.dataset.ic, true);
  }));
  card.querySelector('#icSearch').addEventListener('input', (e) => {
    const ids = new Set(searchProductIcons(e.target.value).map((i) => i.id));
    pick.querySelectorAll('[data-ic]').forEach((b) => { b.hidden = !ids.has(b.dataset.ic); });
  });
  return (id) => {
    pick.querySelectorAll('[data-ic]').forEach((b) => b.classList.toggle('on', b.dataset.ic === id));
    pick.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 320;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function productModal(p) {
  if (!(await ensureAdmin())) return;
  const isNew = !p;
  const d = p ? { ...p } : { name: '', price: 0, category_id: P.editCat === 'none' ? null : P.editCat, icon: null, image_id: null, active: 1, pinned: 0 };
  let iconTouched = !!d.icon;
  const cats = P.state.menu.categories;
  const card = openModal(`
    <div class="card-head"><div><p class="eyebrow">Meniu</p><h2>${isNew ? 'Produs nou' : 'Editează produsul'}</h2></div><button class="icon-btn" data-x>${icon('close')}</button></div>
    <div class="form">
      <label class="field"><span>Nume</span><input id="fName" value="${esc(d.name)}" placeholder="ex. Cappuccino"></label>
      <label class="field price"><span>Preț (${esc(P.state.settings.currency)})</span><input id="fPrice" inputmode="decimal" value="${d.price ? String(d.price / 100).replace('.', ',') : ''}" placeholder="0"></label>
      <label class="field"><span>Categorie</span><select id="fCat"><option value="">Fără categorie</option>${cats.map((c) => `<option value="${c.id}" ${c.id === d.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="field"><span>Poză (opțional — altfel se folosește imaginea de mai jos)</span>
        <div class="photo-row"><span id="fPhoto">${d.image_id ? `<img src="${imgUrl(d.image_id)}">` : ''}</span>
          <label class="btn ghost sm">${icon('image')}Alege poză<input type="file" id="fFile" accept="image/*" hidden></label>
          <button class="btn ghost sm" id="fNoPhoto" ${d.image_id ? '' : 'hidden'}>${icon('trash')}Fără poză</button></div></div>
      <div class="field full"><span>Imagine</span>${iconPickerHtml(d.icon || guessProductIcon(d.name))}</div>
      <label class="check-inline"><input type="checkbox" id="fPinned" ${d.pinned ? 'checked' : ''}> Fixat primul (nu se mută la reordonare)</label>
      <label class="check-inline"><input type="checkbox" id="fActive" ${d.active ? 'checked' : ''}> Vizibil pe casă și telefon</label>
    </div>
    <div class="modal-actions">${isNew ? '' : `<button class="btn danger" data-del style="margin-right:auto">${icon('trash')}Șterge</button>`}
      <button class="btn ghost" data-x2>Renunță</button><button class="btn" data-ok>${icon('check')}Salvează</button></div>`, 'wide');
  const setPicked = bindIconPicker(card, (id, manual) => { d.icon = id; if (manual) iconTouched = true; });
  if (!d.icon) d.icon = guessProductIcon(d.name);
  card.querySelector('#fName').addEventListener('input', (e) => {
    if (iconTouched) return;
    const g = guessProductIcon(e.target.value);
    if (g) { d.icon = g; setPicked(g); }
  });
  card.querySelector('#fFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = await resizeImage(f);
      d.image_id = await rpc('image.upload', { data, mime: 'image/jpeg' }, true);
      card.querySelector('#fPhoto').innerHTML = `<img src="${imgUrl(d.image_id)}">`;
      card.querySelector('#fNoPhoto').hidden = false;
    } catch { toast('Poza nu a putut fi încărcată.', 'err'); }
  };
  card.querySelector('#fNoPhoto').onclick = () => { d.image_id = null; card.querySelector('#fPhoto').innerHTML = ''; card.querySelector('#fNoPhoto').hidden = true; };
  const close = () => closeModal(null);
  card.querySelector('[data-x]').onclick = close;
  card.querySelector('[data-x2]').onclick = close;
  card.querySelector('[data-del]')?.addEventListener('click', async () => {
    closeModal(null);
    if (await confirmBox('Ștergi produsul?', `${d.name} dispare din meniu. Cecurile vechi rămân neschimbate.`, 'Șterge', true)) {
      await rpc('menu.deleteProduct', { id: d.id }, true);
    }
  });
  const save = async () => {
    const price = parseMoney(card.querySelector('#fPrice').value);
    const product = {
      id: d.id, name: card.querySelector('#fName').value, price: Number.isFinite(price) ? price : -1,
      category_id: +card.querySelector('#fCat').value || null, icon: d.icon, image_id: d.image_id,
      pinned: card.querySelector('#fPinned').checked, active: card.querySelector('#fActive').checked,
    };
    try {
      await rpc('menu.saveProduct', { product }, true);
      closeModal(null);
      toast(isNew ? 'Produs adăugat.' : 'Produs salvat.', 'ok');
    } catch { /* afisat */ }
  };
  card.querySelector('[data-ok]').onclick = save;
  setTimeout(() => card.querySelector('#fName').focus(), 30);
  return modalPromise((e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') save(); });
}

async function categoryModal(c) {
  if (!(await ensureAdmin())) return;
  const d = c ? { ...c } : { name: '', icon: 'gift', color: CAT_COLORS[0], active: 1 };
  const card = openModal(`
    <div class="card-head"><div><p class="eyebrow">Meniu</p><h2>${c ? 'Editează categoria' : 'Categorie nouă'}</h2></div><button class="icon-btn" data-x>${icon('close')}</button></div>
    <div class="form">
      <label class="field"><span>Nume</span><input id="cName" value="${esc(d.name)}" placeholder="ex. Băuturi calde"></label>
      <div class="field"><span>Culoare</span><div class="colors">${CAT_COLORS.map((col) => `<button type="button" data-col="${col}" style="--c:${col}" class="${col === d.color ? 'on' : ''}"></button>`).join('')}</div></div>
      <div class="field full"><span>Imagine</span>${iconPickerHtml(d.icon)}</div>
      <label class="check-inline"><input type="checkbox" id="cActive" ${d.active ? 'checked' : ''}> Vizibilă pe casă și telefon</label>
    </div>
    <div class="modal-actions">${c ? `<button class="btn danger" data-del style="margin-right:auto">${icon('trash')}Șterge</button>` : ''}
      <button class="btn ghost" data-x2>Renunță</button><button class="btn" data-ok>${icon('check')}Salvează</button></div>`, 'wide');
  bindIconPicker(card, (id) => { d.icon = id; });
  card.querySelectorAll('[data-col]').forEach((b) => (b.onclick = () => {
    d.color = b.dataset.col;
    card.querySelectorAll('[data-col]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  card.querySelector('[data-x]').onclick = () => closeModal(null);
  card.querySelector('[data-x2]').onclick = () => closeModal(null);
  card.querySelector('[data-del]')?.addEventListener('click', async () => {
    closeModal(null);
    if (await confirmBox('Ștergi categoria?', `Produsele din „${d.name}” rămân, dar fără categorie.`, 'Șterge', true)) await rpc('menu.deleteCategory', { id: d.id }, true);
  });
  const save = async () => {
    try {
      const id = await rpc('menu.saveCategory', { category: { ...d, name: card.querySelector('#cName').value, active: card.querySelector('#cActive').checked } }, true);
      P.editCat = id;
      closeModal(null);
    } catch { /* */ }
  };
  card.querySelector('[data-ok]').onclick = save;
  setTimeout(() => card.querySelector('#cName').focus(), 30);
  return modalPromise((e) => { if (e.key === 'Enter' && e.target.id === 'cName') save(); });
}

// ---------- MESE ----------
function renderTables() {
  $('#tableList').innerHTML = P.state.tables.map((t) => `
    <div class="table-row" data-tid="${t.id}">
      <input data-f="name" value="${esc(t.name)}" placeholder="Nume masă">
      <input data-f="zone" value="${esc(t.zone || '')}" placeholder="Zonă (Sală, Terasă…)">
      <label class="check-inline"><input type="checkbox" data-f="active" ${t.active ? 'checked' : ''}> activă</label>
      <button class="icon-btn danger" data-del="${t.id}">${icon('trash')}</button>
    </div>`).join('');
  $$('#tableList .table-row').forEach((row) => {
    const save = () => rpc('tables.save', { table: {
      id: +row.dataset.tid,
      name: row.querySelector('[data-f="name"]').value,
      zone: row.querySelector('[data-f="zone"]').value,
      active: row.querySelector('[data-f="active"]').checked,
    } }, true);
    row.querySelectorAll('input').forEach((i) => i.addEventListener('change', save));
  });
  $$('#tableList [data-del]').forEach((b) => (b.onclick = async () => {
    if (await confirmBox('Ștergi masa?', 'Masa dispare de pe casă și telefoane.', 'Șterge', true)) rpc('tables.delete', { id: +b.dataset.del }, true);
  }));
}
$('#tableAdd').onclick = async () => {
  const n = P.state.tables.filter((t) => /^Masa \d+$/.test(t.name)).length + 1;
  await rpc('tables.save', { table: { name: `Masa ${n}`, zone: 'Sală' } }, true);
};

// ---------- RAPORT ----------
async function renderReport() {
  const day = P.reportDay || localDayStr();
  const r = await rpc('report.day', { day });
  const today = localDayStr();
  $('#repDay').textContent = day === today ? 'Azi' : new Date(`${day}T12:00`).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#repNext').disabled = day >= today;
  const maxTop = Math.max(1, ...r.top.map((t) => t.orders));
  const hours = Object.keys(r.hours).map(Number);
  const hFrom = Math.min(8, ...hours), hTo = Math.max(22, ...hours);
  const maxH = Math.max(1, ...Object.values(r.hours));
  $('#report').innerHTML = `
    <div class="rep-tiles">
      <div class="rep-tile main"><small>Total încasat</small><b>${money(r.total)}</b></div>
      <div class="rep-tile"><small>Numerar</small><b>${money(r.cash)}</b></div>
      <div class="rep-tile"><small>Card</small><b>${money(r.card)}</b></div>
      <div class="rep-tile"><small>Cecuri</small><b>${r.orders}</b></div>
      <div class="rep-tile"><small>Medie / cec</small><b>${money(r.orders ? Math.round(r.total / r.orders) : 0)}</b></div>
      <div class="rep-tile"><small>Deschise acum</small><b>${r.openCount} · ${money(r.openTotal)}</b></div>
    </div>
    <div class="rep-grid">
      <div class="card"><h3>Cele mai comandate</h3><p class="muted small" style="margin:4px 0 12px">după numărul de cecuri</p>
        <div class="bars">${r.top.length ? r.top.map((t) => `<div class="bar-row"><div class="bar"><i style="width:${(t.orders / maxTop) * 100}%"></i><span>${esc(t.name)} · ${t.orders} cecuri</span></div><em>${money(t.total)}</em></div>`).join('') : '<p class="muted">Încă nicio vânzare.</p>'}</div></div>
      <div class="card"><h3>Vânzări pe ore</h3>
        <div class="hours">${Array.from({ length: hTo - hFrom + 1 }, (_, k) => hFrom + k).map((h) => `<div title="${h}:00 · ${money(r.hours[h] || 0)}"><i style="height:${((r.hours[h] || 0) / maxH) * 100}%"></i><span>${h}</span></div>`).join('')}</div>
        <h3 style="margin-top:18px">Ultimele cecuri</h3>
        <div class="recent">${r.recent.length ? r.recent.map((o) => `<div><b>#${o.number}</b><span>${esc(o.table_name || 'Fără masă')} · ${new Date(o.closed_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span><span>${o.method === 'card' ? 'card' : 'numerar'}</span><b>${money(o.total)}</b></div>`).join('') : '<p class="muted">—</p>'}</div>
      </div>
    </div>`;
}
const shiftDay = (n) => { const d = new Date(`${P.reportDay || localDayStr()}T12:00`); d.setDate(d.getDate() + n); P.reportDay = localDayStr(d); renderReport(); };
$('#repPrev').onclick = () => shiftDay(-1);
$('#repNext').onclick = () => shiftDay(1);

// ---------- DATE ----------
async function renderData() {
  const info = await ag.posData.info();
  $('#dataDir').textContent = `${info.dir}   ·   a doua copie: ${info.mirror}`;
  $('#backupList').innerHTML = info.backups.length ? info.backups.map((b) => `
    <div class="backup-row">${icon('database')}<b>${new Date(b.time).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}</b>
      <span>${esc(b.name.split('_').pop().replace('.db', '').replace(/-/g, ' '))} · ${Math.round(b.size / 1024)} KB</span>
      <button class="btn ghost sm" data-restore="${esc(b.name)}">Restaurează</button></div>`).join('') : '<p class="empty-note">Nicio copie încă.</p>';
  $$('#backupList [data-restore]').forEach((b) => (b.onclick = async () => {
    try { if (await ag.posData.restore(b.dataset.restore)) toast('Copia a fost restaurată.', 'ok'); } catch (e) { toast(e.message.replace(/^.*Error: /, ''), 'err'); }
    renderData();
  }));
}
$('#dataOpen').onclick = () => ag.posData.openFolder();
$('#dataBackup').onclick = async () => { await ag.posData.backupNow(); toast('Copie de rezervă creată.', 'ok'); renderData(); };
$('#dataExport').onclick = async () => {
  const file = await ag.posData.export();
  if (file) toast(`Exportat: ${file}`, 'ok');
};
$('#dataImport').onclick = async () => {
  try {
    const r = await ag.posData.import();
    if (r) toast(`Import reușit: ${r.products} produse, ${r.orders} cecuri.`, 'ok');
  } catch (e) { toast(e.message.replace(/^.*Error: /, ''), 'err'); }
  renderData();
};
$('#pinForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await rpc('settings.save', { settings: { adminPin: $('#pinNew').value } }, true);
    P.adminPin = $('#pinNew').value || null;
    $('#pinNew').value = '';
    toast(P.adminPin ? 'PIN salvat.' : 'PIN eliminat.', 'ok');
  } catch { /* */ }
};

// ---------- ecranul Acasa ----------
async function updateHomeCasa() {
  try {
    const r = await ag.pos('report.day', { day: localDayStr() });
    $('#statCasa').textContent = `${money(r.total)} · ${r.orders} cecuri`;
    $('#tileCasa').textContent = r.openCount ? `${r.openCount} cecuri deschise · ${money(r.openTotal)}` : 'Cecuri · total · rest';
  } catch { /* */ }
}

window.posInit = () => loadPos('reload');
window.posTunnelChanged = () => { P.qr = null; if (P.display.kind === 'idle' && P.pane === 'board' && P.state) renderPayPanel(); };
