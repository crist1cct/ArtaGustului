// Arta Gustului - aplicatia ospatarului (telefon). Se conecteaza la laptop prin Wi-Fi.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const I = {
    table: '<path d="M3.5 9h17"/><path d="M5 9l-1 10M19 9l1 10M8 9v6h8V9"/>',
    receipt: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.8" cy="17.5" r="2.3"/><circle cx="16.8" cy="15.5" r="2.3"/>',
    back: '<path d="M14.5 6 8.5 12l6 6"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    minus: '<path d="M6 12h12"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m15.5 15.5 4.5 4.5"/>',
    edit: '<path d="M4 20h4.5L19 9.5 14.5 5 4 15.5Z"/><path d="m13 6.5 4.5 4.5"/>',
    cash: '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.8"/>',
    card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 14.5h4"/>',
    trash: '<path d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12.5h8.4L17 7"/>',
    move: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    sparkle: '<path d="M12 3.5c.7 4.2 2.3 5.8 6.5 6.5-4.2.7-5.8 2.3-6.5 6.5-.7-4.2-2.3-5.8-6.5-6.5 4.2-.7 5.8-2.3 6.5-6.5Z"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    prev: '<path d="M18 6v12L9.5 12Z"/><path d="M6.5 6v12"/>',
    next: '<path d="M6 6v12l8.5-6Z"/><path d="M17.5 6v12"/>',
    play: '<path d="M6 5.5v13l8-6.5Z"/><path d="M16.5 6v12M20 6v12"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2"/>',
    spotify: '<circle cx="12" cy="12" r="8.5"/><path d="M7.5 9.6c3-1 6.4-.7 9 .8M8 12.6c2.5-.7 5.1-.4 7.2.8M8.6 15.4c1.9-.5 3.8-.3 5.4.6"/>',
    youtube: '<rect x="2.8" y="5.5" width="18.4" height="13" rx="4"/><path d="m10.2 9.3 4.6 2.7-4.6 2.7Z"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5.5 9.5V20h13V9.5"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="4" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
  };
  const ic = (n) => `<svg class="i" viewBox="0 0 24 24">${I[n] || ''}</svg>`;
  $$('[data-i]').forEach((el) => { el.innerHTML = ic(el.dataset.i); });

  const QUICK_NOTES = ['fără ceapă', 'picant', 'la pachet', 'fără gheață', 'extra sos', 'bine făcut', 'fără zahăr', 'urgent'];

  // ---------- cheie de acces + nume ----------
  const params = new URLSearchParams(location.search);
  const linkKey = new URLSearchParams(location.hash.slice(1)).get('k') || params.get('k');
  if (linkKey) { localStorage.setItem('ag_key', linkKey); history.replaceState(null, '', '/'); }
  const KEY = localStorage.getItem('ag_key');
  let waiter = localStorage.getItem('ag_waiter') || '';

  const S = { state: null, tab: 'tables', order: null, cat: 'top', search: '', rank: null };

  function money(b) {
    const v = (b || 0) / 100;
    return `${v.toLocaleString('ro-RO', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${S.state?.settings.currency || 'lei'}`;
  }
  const parseMoney = (s) => { const n = parseFloat(String(s || '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
  const ago = (iso) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; };
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch { /* */ } };

  let toastT;
  function toast(msg, type = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast ${type}`;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  async function api(method, p = {}) {
    let r;
    try {
      r = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ag-key': KEY }, body: JSON.stringify({ method, params: p }) });
    } catch {
      toast('Fără legătură cu laptopul. Verifică Wi-Fi-ul.', 'err');
      throw new Error('offline');
    }
    const j = await r.json();
    if (!j.ok) { toast(j.error, 'err'); throw new Error(j.error); }
    return j.result;
  }
  // trimite pe ecranul casei (fara mesaje de eroare; nu e critic)
  let dispT;
  function display(payload, delay = 180) {
    clearTimeout(dispT);
    dispT = setTimeout(() => {
      fetch('/api/rpc', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ag-key': KEY },
        body: JSON.stringify({ method: payload ? 'display.show' : 'display.clear', params: { ...(payload || {}), waiter } }),
      }).catch(() => {});
    }, delay);
  }

  // ---------- poarta: fara cheie -> scaneaza QR ----------
  if (!KEY) {
    $('#tabbar').hidden = true;
    $('#screen').innerHTML = `<div class="gate">${ic('qr')}<h2>Scanează codul QR</h2><p class="muted">Pe laptop: aplicația Arta Gustului → Casă (sau Telefon) → codul QR. Merge de pe date mobile sau Wi-Fi.</p></div>`;
    return;
  }

  // ---------- stare + sincronizare live ----------
  function snapRank() { S.rank = new Map(S.state.menu.products.map((p) => [p.id, (p.pinned ? -1e6 : 0) + p.rank])); }
  async function load() {
    try {
      const r = await fetch('/api/state', { headers: { 'x-ag-key': KEY } });
      const text = await r.text();
      if (text === S.raw) return; // nimic nou: nu redesenam (atingerile nu se pierd)
      const j = JSON.parse(text);
      if (!j.ok) { toast(j.error, 'err'); return; }
      S.raw = text;
      S.state = j.result;
      if (!S.rank || !S.order) snapRank();
      if (S.order) {
        const o = S.state.orders.find((x) => x.id === S.order.id);
        if (!o) { toast('Cecul a fost închis.', 'ok'); closeOrder(); } else S.order = o;
      }
      render();
    } catch { setConn(false); }
  }
  function setConn(on) { $('#conn').classList.toggle('on', on); }
  let es, loadT, pollT, pollV = null;
  // prin tunelul global (https) evenimentele live nu trec: verificam o versiune mica la 2,5 secunde
  function startPolling() {
    clearInterval(pollT);
    const tick = async () => {
      if (document.hidden) return;
      try {
        const j = await (await fetch('/api/version', { cache: 'no-store', headers: { 'x-ag-key': KEY } })).json();
        setConn(!!j.ok);
        if (j.ok && j.v !== pollV) { pollV = j.v; load(); }
      } catch { setConn(false); }
    };
    tick();
    pollT = setInterval(tick, 2500);
  }
  function connect() {
    if (location.protocol === 'https:') return startPolling();
    es?.close();
    es = new EventSource(`/api/events?k=${encodeURIComponent(KEY)}`);
    es.onopen = () => { setConn(true); load(); };
    es.onerror = () => setConn(false);
    es.onmessage = (e) => {
      try { if (JSON.parse(e.data).type === 'display') return; } catch { /* */ }
      clearTimeout(loadT); loadT = setTimeout(load, 150);
    };
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { connect(); } });

  // ---------- nume ospatar ----------
  function renderWho() { $('#who').textContent = waiter || 'Numele tău'; }
  $('#who').onclick = askName;
  function askName() {
    openSheet(`<h2>Cum te numești?</h2><p class="muted" style="margin-bottom:12px">Apare pe cecurile deschise de tine.</p>
      <label class="field"><span>Nume ospătar</span><input id="nm" value="${esc(waiter)}" placeholder="ex. Ana" autocomplete="off"></label>
      <button class="btn full" id="nmOk">${ic('check')}Salvează</button>`);
    const input = $('#nm');
    setTimeout(() => input.focus(), 50);
    const save = () => { waiter = input.value.trim().slice(0, 24); localStorage.setItem('ag_waiter', waiter); renderWho(); closeSheet(); };
    $('#nmOk').onclick = save;
    input.onkeydown = (e) => { if (e.key === 'Enter') save(); };
  }

  // ---------- foaia de jos ----------
  function openSheet(html) {
    $('#sheet').innerHTML = html;
    $('#sheet').hidden = false;
    $('#sheetBg').hidden = false;
    return $('#sheet');
  }
  function closeSheet() {
    if (S.paying) { S.paying = false; display(null, 0); }
    $('#sheet').hidden = true; $('#sheetBg').hidden = true; $('#sheet').innerHTML = '';
  }
  $('#sheetBg').onclick = closeSheet;

  // ---------- ecrane ----------
  $$('#tabbar [data-tab]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
  function render() {
    if (!S.state) return;
    $$('#tabbar [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
    const openCount = S.state.orders.length;
    $('#topSub').textContent = openCount ? `${openCount} cecuri deschise` : 'Ospătar';
    if (S.tab === 'tables') renderTables();
    if (S.tab === 'checks') renderChecks();
    if (S.tab === 'music' && !$('#screen .music')) renderMusic();
    if (S.tab === 'calc' && !$('#screen .calc')) renderCalc();
    if (S.order) renderOrder();
  }

  function busyMap() {
    const m = new Map();
    S.state.orders.forEach((o) => { if (o.table_id) m.set(o.table_id, [...(m.get(o.table_id) || []), o]); });
    return m;
  }
  function tablesHtml(onlyFree = false) {
    const busy = busyMap();
    const tables = S.state.tables.filter((t) => t.active);
    const zones = [...new Set(tables.map((t) => t.zone || 'Mese'))];
    return zones.map((z) => `<div class="sec-title">${esc(z)}</div><div class="tables">${tables.filter((t) => (t.zone || 'Mese') === z).map((t) => {
      const os = busy.get(t.id) || [];
      if (onlyFree === 'pick') return `<button class="tbl ${os.length ? 'busy' : ''}" data-tid="${t.id}"><b>${esc(t.name)}</b><small>${os.length ? money(os.reduce((s, o) => s + o.total, 0)) : 'liberă'}</small></button>`;
      const mine = os.some((o) => o.waiter === waiter && waiter);
      return `<button class="tbl ${os.length ? 'busy' : ''} ${mine ? 'mine' : ''}" data-tid="${t.id}"><b>${esc(t.name)}</b>
        <small>${os.length ? `${money(os.reduce((s, o) => s + o.total, 0))} · ${ago(os[0].created_at)}${os[0].waiter ? ' · ' + esc(os[0].waiter) : ''}` : 'liberă'}</small></button>`;
    }).join('')}</div>`).join('');
  }
  function renderTables() {
    $('#screen').innerHTML = tablesHtml();
    const busy = busyMap();
    $$('#screen [data-tid]').forEach((b) => (b.onclick = async () => {
      buzz();
      const tid = +b.dataset.tid;
      const os = busy.get(tid) || [];
      if (os.length === 1) return openOrder(os[0]);
      if (os.length > 1) return chooseCheck(os);
      try { openOrder(await api('order.create', { table_id: tid, waiter })); } catch { /* */ }
    }));
  }
  function chooseCheck(os) {
    const sh = openSheet(`<h2>Alege cecul</h2><div class="checks">${os.map((o) => `<button class="chk" data-oid="${o.id}">${ic('receipt')}<div><b>Cec #${o.number}</b><small>${esc(o.waiter || '')} · ${ago(o.created_at)}</small></div><em>${money(o.total)}</em></button>`).join('')}</div>`);
    $$('[data-oid]', sh).forEach((b) => (b.onclick = () => { closeSheet(); openOrder(S.state.orders.find((o) => o.id === +b.dataset.oid)); }));
  }
  function renderChecks() {
    const os = [...S.state.orders].sort((a, b) => (b.waiter === waiter) - (a.waiter === waiter) || Date.parse(a.created_at) - Date.parse(b.created_at));
    $('#screen').innerHTML = `<button class="btn full" id="newFree" style="margin-bottom:14px">${ic('plus')}Cec nou fără masă</button>
      ${os.length ? `<div class="checks">${os.map((o) => `<button class="chk" data-oid="${o.id}">${ic('receipt')}<div><b>${esc(o.table_name || 'Fără masă')} · #${o.number}</b><small>${o.items.reduce((s, i) => s + i.qty, 0)} produse · ${ago(o.created_at)}${o.waiter ? ' · ' + esc(o.waiter) : ''}</small></div><em>${money(o.total)}</em></button>`).join('')}</div>`
      : `<div class="empty">${ic('receipt')}<p>Niciun cec deschis.</p></div>`}`;
    $('#newFree').onclick = async () => { try { openOrder(await api('order.create', { waiter })); } catch { /* */ } };
    $$('#screen [data-oid]').forEach((b) => (b.onclick = () => openOrder(S.state.orders.find((o) => o.id === +b.dataset.oid))));
  }

  // ---------- comanda (cec) ----------
  function openOrder(o) {
    if (!o) return;
    S.order = o;
    S.cat = 'top';
    S.search = '';
    snapRank();
    $('#order').hidden = false;
    document.body.style.overflow = 'hidden';
    renderOrder(true);
  }
  function closeOrder() {
    S.order = null;
    $('#order').hidden = true;
    document.body.style.overflow = '';
    closeSheet();
    render();
  }
  const catOf = (id) => S.state.menu.categories.find((c) => c.id === id);
  const imgUrl = (id) => `/img/${id}`;
  function prodList() {
    const r = (p) => S.rank?.get(p.id) ?? p.rank;
    const all = S.state.menu.products.filter((p) => p.active).sort((a, b) => r(a) - r(b) || a.id - b.id);
    const q = norm(S.search).trim();
    if (q) return all.filter((p) => norm(p.name).includes(q));
    if (S.cat === 'all') return all;
    if (S.cat === 'top') { const used = all.filter((p) => p.order_count > 0 || p.pinned); return (used.length ? used : all).slice(0, 18); }
    return all.filter((p) => p.category_id === S.cat);
  }
  function renderOrder(full) {
    const o = S.order;
    const el = $('#order');
    if (full || !el.querySelector('.grid')) {
      const cats = S.state.menu.categories.filter((c) => c.active);
      el.innerHTML = `
        <div class="o-head"><button class="back" id="oBack">${ic('back')}</button>
          <button class="o-table" id="oTable"><b></b><small>atinge pentru a muta masa</small></button><span class="o-num"></span></div>
        <div class="o-search">${ic('search')}<input id="oSearch" placeholder="Caută produs" autocomplete="off"></div>
        <div class="chips" id="oChips">
          <button data-cat="top" style="--c:#f0d39a">${ic('sparkle')}Populare</button>
          ${cats.map((c) => `<button data-cat="${c.id}" style="--c:${c.color || 'var(--gold)'}">${productIcon(c.icon || 'gift')}${esc(c.name)}</button>`).join('')}
          <button data-cat="all">${ic('list')}Toate</button>
        </div>
        <div class="grid" id="oGrid"></div>
        <button class="o-bar" id="oBar"><div><small></small><b></b></div><span>${ic('receipt')}Cec</span></button>`;
      $('#oBack').onclick = closeOrder;
      $('#oTable').onclick = () => pickTable();
      $('#oBar').onclick = () => ticketSheet();
      $('#oSearch').oninput = (e) => { S.search = e.target.value; renderOrder(); };
      $$('#oChips [data-cat]').forEach((b) => (b.onclick = () => {
        const k = b.dataset.cat;
        S.cat = k === 'top' || k === 'all' ? k : +k;
        S.search = ''; $('#oSearch').value = '';
        renderOrder();
        $('#oGrid').scrollTop = 0;
      }));
    }
    el.querySelector('.o-table b').textContent = o.table_name || 'Fără masă';
    el.querySelector('.o-num').textContent = `#${o.number}`;
    $$('#oChips [data-cat]').forEach((b) => b.classList.toggle('on', !S.search && String(S.cat) === b.dataset.cat));
    const inCart = new Map();
    o.items.forEach((it) => inCart.set(it.product_id, (inCart.get(it.product_id) || 0) + it.qty));
    const list = prodList();
    $('#oGrid').innerHTML = list.length ? list.map((p) => {
      const c = catOf(p.category_id);
      const n = inCart.get(p.id);
      return `<button class="prod" data-pid="${p.id}" style="--c:${c?.color || 'var(--gold)'}">${n ? `<span class="n">${n}</span>` : ''}
        ${p.image_id ? `<img src="${imgUrl(p.image_id)}" alt="" loading="lazy">` : productIcon(p.icon || guessProductIcon(p.name) || 'gift')}
        <b>${esc(p.name)}</b><small>${money(p.price)}</small></button>`;
    }).join('') : `<div class="empty" style="grid-column:1/-1">${ic('search')}<p>${S.state.menu.products.length ? 'Niciun produs găsit.' : 'Meniul e gol. Se completează pe laptop: Casă → Meniu.'}</p></div>`;
    $$('#oGrid [data-pid]').forEach((b) => (b.onclick = () => add(+b.dataset.pid)));
    const count = o.items.reduce((s, i) => s + i.qty, 0);
    $('#oBar small').textContent = count ? `${count} produse` : 'Cec gol';
    $('#oBar b').textContent = money(o.total);
  }
  async function add(pid) {
    buzz();
    try {
      S.order = await api('order.addItem', { order_id: S.order.id, product_id: pid, by: waiter });
      renderOrder();
    } catch { /* */ }
  }

  function ticketSheet() {
    const o = S.order;
    const sh = openSheet(`<h2>${esc(o.table_name || 'Fără masă')} · Cec #${o.number}</h2>
      <div class="items">${o.items.length ? o.items.map((it) => `<div class="it">
        <div><b>${esc(it.name)}</b><div class="sub">${it.qty} × ${money(it.price)}</div></div><div class="lt">${money(it.qty * it.price)}</div>
        ${it.note ? `<div class="nt">✎ ${esc(it.note)}</div>` : ''}
        <div class="q"><button class="qb note" data-note="${it.id}">${ic('edit')}Notă</button>
          <button class="qb" data-q="${it.id}" data-v="${it.qty - 1}">${ic('minus')}</button><span class="qn">${it.qty}</span>
          <button class="qb" data-q="${it.id}" data-v="${it.qty + 1}">${ic('plus')}</button></div></div>`).join('') : '<p class="muted" style="padding:16px 0">Cecul e gol.</p>'}</div>
      <div class="total"><span>Total</span><b>${money(o.total)}</b></div>
      <div class="acts">
        <button class="btn wide" id="tPay" ${o.items.length ? '' : 'disabled'}>${ic('cash')}Încasează numerar</button>
        <button class="btn ghost" id="tCard" ${o.items.length ? '' : 'disabled'}>${ic('card')}Card</button>
        <button class="btn ghost" id="tMove">${ic('move')}Mută masa</button>
        <button class="btn danger" id="tCancel" style="grid-column:1/-1">${ic('trash')}Anulează cecul</button>
      </div>`);
    $$('[data-q]', sh).forEach((b) => (b.onclick = async () => {
      buzz();
      try { S.order = await api('order.setQty', { item_id: +b.dataset.q, qty: +b.dataset.v }); renderOrder(); ticketSheet(); } catch { /* */ }
    }));
    $$('[data-note]', sh).forEach((b) => (b.onclick = () => noteSheet(o.items.find((i) => i.id === +b.dataset.note))));
    $('#tPay').onclick = () => paySheet();
    $('#tCard').onclick = async () => {
      if (!confirm(`Plată cu cardul: ${money(o.total)}. Terminalul a aprobat?`)) return;
      try { await api('order.pay', { order_id: o.id, method: 'card', by: waiter }); toast('Plată cu cardul înregistrată.', 'ok'); closeOrder(); } catch { /* */ }
    };
    $('#tMove').onclick = () => pickTable();
    $('#tCancel').onclick = async () => {
      if (o.items.length && !confirm('Anulezi cecul? Rămâne în istoric ca anulat.')) return;
      try { await api('order.cancel', { order_id: o.id }); closeOrder(); } catch { /* */ }
    };
  }
  function noteSheet(it) {
    const sh = openSheet(`<h2>Notă · ${esc(it.name)}</h2>
      <label class="field"><span>Notă pentru bucătărie / bar</span><input id="nt" value="${esc(it.note || '')}" autocomplete="off"></label>
      <div class="notes">${QUICK_NOTES.map((n) => `<button data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <button class="btn full" id="ntOk">${ic('check')}Salvează nota</button>`);
    const input = $('#nt');
    $$('[data-n]', sh).forEach((b) => (b.onclick = () => { input.value = input.value ? `${input.value}, ${b.dataset.n}` : b.dataset.n; }));
    $('#ntOk').onclick = async () => {
      try { S.order = await api('order.itemNote', { item_id: it.id, note: input.value }); renderOrder(); ticketSheet(); } catch { /* */ }
    };
  }
  function pickTable() {
    const sh = openSheet(`<h2>Mută cecul la masa</h2>${tablesHtml('pick')}<div style="height:12px"></div><button class="btn ghost full" data-tid="0">Fără masă</button>`);
    $$('[data-tid]', sh).forEach((b) => (b.onclick = async () => {
      try { S.order = await api('order.update', { order_id: S.order.id, table_id: +b.dataset.tid || null }); closeSheet(); renderOrder(); } catch { /* */ }
    }));
  }
  function paySheet() {
    const o = S.order;
    let typed = '';
    const lei = o.total / 100;
    const sugg = [...new Set([10, 50, 100, 200, 500, 1000].map((s) => Math.ceil(lei / s) * s).filter((v) => v > lei))].sort((a, b) => a - b).slice(0, 4);
    const sh = openSheet(`<h2>Încasare · ${money(o.total)}</h2>
      <div class="pay-l"><span>Primit</span><b id="pg">—</b></div>
      <div class="pay-l rest" id="prb"><span>Rest</span><b id="pr">—</b></div>
      <div class="quick"><button class="ex" data-a="${lei}">Fix</button>${sugg.map((v) => `<button data-a="${v}">${v}</button>`).join('')}</div>
      <div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
      <button class="btn full" id="pOk" disabled>${ic('check')}Încasat</button>`);
    S.paying = true;
    const upd = () => {
      const g = parseMoney(typed);
      display({ kind: 'paying', table: o.table_name || 'Fără masă', number: o.number, total: o.total, paid: typed ? g : null });
      $('#pg').textContent = typed ? money(g) : '—';
      const rest = g - o.total;
      $('#prb').classList.toggle('short', typed && rest < 0);
      $('#pr').textContent = !typed ? '—' : rest < 0 ? `Lipsesc ${money(-rest)}` : money(rest);
      $('#pOk').disabled = !(typed && rest >= 0);
    };
    $$('[data-k]', sh).forEach((b) => (b.onclick = () => {
      const k = b.dataset.k;
      if (k === '⌫') typed = typed.slice(0, -1);
      else if (k === ',') { if (!typed.includes(',')) typed = (typed || '0') + ','; }
      else { const dec = typed.split(',')[1]; if (!(dec !== undefined && dec.length >= 2) && typed.length < 8) typed = typed === '0' ? k : typed + k; }
      upd();
    }));
    $$('[data-a]', sh).forEach((b) => (b.onclick = () => { typed = String(b.dataset.a).replace('.', ','); upd(); }));
    $('#pOk').onclick = async () => {
      try {
        clearTimeout(dispT);
        const paid = await api('order.pay', { order_id: o.id, method: 'cash', paid: parseMoney(typed), by: waiter });
        S.paying = false;
        closeOrder();
        const s2 = openSheet(`<div style="text-align:center"><p class="muted">Cec #${paid.number} încasat · primit ${money(paid.paid)}</p>
          <div class="pay-l rest" style="margin-top:12px"><span>Rest de dat</span><b>${money(paid.change)}</b></div>
          <button class="btn full" id="dOk" style="margin-top:8px">${ic('check')}Gata</button></div>`);
        $('#dOk', s2).onclick = closeSheet;
      } catch { /* */ }
    };
  }

  // ---------- calculator liber (sume rapide + rest, apare live pe ecranul casei) ----------
  const C = { lines: [], typed: '', given: '', mode: 'sum', sync: localStorage.getItem('ag_calc_sync') !== '0' };
  function renderCalc() {
    const sum = C.lines.reduce((s, v) => s + v, 0);
    const typedV = C.typed ? parseMoney(C.typed) : 0;
    const total = sum + (C.mode === 'sum' ? typedV : 0);
    const given = C.given ? parseMoney(C.given) : null;
    const rest = given === null ? null : given - total;
    $('#screen').innerHTML = `<div class="calc">
      <div class="calc-screen">
        <div class="calc-lines">${C.lines.length ? C.lines.map((v, i) => `<button data-del="${i}" title="Atinge pentru a șterge">${money(v)} ✕</button>`).join('') : '<span class="hint">Scrie o sumă și apasă „+ Adaugă”.</span>'}</div>
        ${C.mode === 'sum' ? `<div class="calc-row typed"><span>Suma</span><b>${C.typed ? money(typedV) : '—'}</b></div>` : ''}
        <div class="calc-row total"><span>Total</span><b>${money(total)}</b></div>
        <div class="calc-row"><span>Primit</span><b>${given === null ? '—' : money(given)}</b></div>
      </div>
      <div class="pay-l rest ${rest !== null && rest < 0 ? 'short' : ''}" style="margin:0"><span>Rest</span><b>${rest === null ? '—' : rest < 0 ? `Lipsesc ${money(-rest)}` : money(rest)}</b></div>
      <div class="calc-mode"><button data-mode="sum" class="${C.mode === 'sum' ? 'on' : ''}">Adun sume</button><button data-mode="given" class="${C.mode === 'given' ? 'on' : ''}">Suma primită</button></div>
      <div class="pad" style="margin:0">${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
      <div class="calc-acts">
        <button class="btn" id="cAdd" ${C.mode === 'sum' && C.typed ? '' : 'disabled'}>${ic('plus')}Adaugă</button>
        <button class="btn ghost" id="cClear">${ic('trash')}Golește</button>
      </div>
      <label class="sync"><input type="checkbox" id="cSync" ${C.sync ? 'checked' : ''}> Arată live pe ecranul casei</label>
    </div>`;
    const key = (k) => {
      const field = C.mode === 'sum' ? 'typed' : 'given';
      let v = C[field];
      if (k === '⌫') v = v.slice(0, -1);
      else if (k === ',') { if (!v.includes(',')) v = (v || '0') + ','; }
      else { const dec = v.split(',')[1]; if (!(dec !== undefined && dec.length >= 2) && v.length < 8) v = v === '0' ? k : v + k; }
      C[field] = v;
      buzz();
      renderCalc();
    };
    $$('#screen [data-k]').forEach((b) => (b.onclick = () => key(b.dataset.k)));
    $$('#screen [data-del]').forEach((b) => (b.onclick = () => { C.lines.splice(+b.dataset.del, 1); renderCalc(); }));
    $$('#screen [data-mode]').forEach((b) => (b.onclick = () => {
      if (b.dataset.mode === 'given' && C.typed) { C.lines.push(parseMoney(C.typed)); C.typed = ''; }
      C.mode = b.dataset.mode; renderCalc();
    }));
    $('#cAdd').onclick = () => { if (C.typed) { C.lines.push(parseMoney(C.typed)); C.typed = ''; buzz(); renderCalc(); } };
    $('#cClear').onclick = () => { C.lines = []; C.typed = ''; C.given = ''; C.mode = 'sum'; renderCalc(); if (C.sync) display(null, 0); };
    $('#cSync').onchange = (e) => { C.sync = e.target.checked; localStorage.setItem('ag_calc_sync', C.sync ? '1' : '0'); if (!C.sync) display(null, 0); else renderCalc(); };
    if (C.sync && total > 0) display({ kind: 'calc', total, paid: given, lines: C.lines.length + (C.mode === 'sum' && C.typed ? 1 : 0) });
  }

  // ---------- muzica (telecomanda) ----------
  let vol = { level: 50, muted: false }, volT;
  async function remote(action, value) {
    try { const r = await api('remote', { action, value }); if (r && typeof r.level === 'number') { vol = r; paintVol(); } } catch { /* */ }
  }
  function paintVol() {
    const s = $('#vSlider');
    if (!s) return;
    $('#vVal').textContent = vol.muted ? 'mut' : `${vol.level}%`;
    if (document.activeElement !== s) s.value = vol.level;
    s.style.setProperty('--p', `${vol.level}%`);
  }
  function renderMusic() {
    $('#screen').innerHTML = `<div class="music">
      <div class="transport"><button data-r="prev">${ic('prev')}</button><button class="play" data-r="playpause">${ic('play')}</button><button data-r="next">${ic('next')}</button></div>
      <div class="vol"><div class="vol-top"><span>Volum laptop</span><b id="vVal">–</b></div>
        <input type="range" id="vSlider" min="0" max="100">
        <div class="vol-btns"><button id="vDn">${ic('minus')}</button><button id="vMute">${ic('mute')}</button><button id="vUp">${ic('plus')}</button></div></div>
      <div class="sources"><button data-r="spotify">${ic('spotify')}Spotify</button><button data-r="youtube">${ic('youtube')}YouTube</button><button data-r="home">${ic('home')}Acasă</button></div>
      <p class="muted" style="text-align:center;font-size:13px">Volumul din sală se reglează din butonul VOLUME al sistemului LG.</p></div>`;
    $$('[data-r]').forEach((b) => (b.onclick = () => { buzz(); remote(b.dataset.r); }));
    const setL = (v) => { vol.level = Math.max(0, Math.min(100, v)); paintVol(); clearTimeout(volT); volT = setTimeout(() => remote('volume', vol.level), 80); };
    $('#vSlider').oninput = (e) => setL(+e.target.value);
    $('#vDn').onclick = () => setL(vol.level - 5);
    $('#vUp').onclick = () => setL(vol.level + 5);
    $('#vMute').onclick = () => remote('mute', !vol.muted);
    remote('status');
  }

  renderWho();
  connect();
  load();
  if (!waiter) setTimeout(askName, 400);
  setInterval(() => { if (!S.order && S.tab !== 'music' && !document.hidden) render(); }, 30000);
})();
