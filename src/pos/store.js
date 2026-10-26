// Casa de marcat: baza de date integrata (SQLite din Electron), copii de rezerva si transfer
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const APP_KEY = 'arta-gustului-casa';
const SCHEMA_VERSION = 1;
const KEEP_RECENT_BACKUPS = 30;
const KEEP_DAILY_BACKUPS_DAYS = 120;

const pad = (n) => String(n).padStart(2, '0');
function localDay(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function stamp(d = new Date()) { return `${localDay(d)}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`; }
const nowIso = () => new Date().toISOString();

const DEFAULT_CATEGORIES = [
  ['Cafea & ceai', 'coffee', '#c8955a'],
  ['Răcoritoare', 'soda', '#5aa9c8'],
  ['Bere & vin', 'beer', '#d8b36e'],
  ['Mic dejun', 'eggs', '#e0c068'],
  ['Feluri principale', 'steak', '#c8735a'],
  ['Pizza', 'pizza', '#d9824b'],
  ['Salate', 'salad', '#7fbf6a'],
  ['Supe', 'soup', '#c9a25a'],
  ['Garnituri', 'fries', '#d8b36e'],
  ['Desert', 'cake', '#d68fb0'],
];

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'casa.db');
    this.backupDir = path.join(dir, 'copii-de-rezerva');
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.changedSinceBackup = false;
    this.listeners = new Set();
    this.restoredFrom = null;
    if (!fs.existsSync(this.file)) {
      const latest = this.listBackups()[0];
      if (latest) { fs.copyFileSync(latest.path, this.file); this.restoredFrom = latest.name; }
    }
    this.open();
  }

  // ---------- conexiune si schema ----------
  open() {
    this.db = new DatabaseSync(this.file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
    this.migrate();
  }
  close() { try { this.db.close(); } catch { /* deja inchisa */ } }

  migrate() {
    const db = this.db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, icon TEXT, color TEXT,
        sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, icon TEXT, image_id INTEGER,
        active INTEGER NOT NULL DEFAULT 1, pinned INTEGER NOT NULL DEFAULT 0,
        rank INTEGER NOT NULL DEFAULT 0, order_count INTEGER NOT NULL DEFAULT 0, created_at TEXT);
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, zone TEXT,
        sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY, number INTEGER NOT NULL, day TEXT NOT NULL, table_id INTEGER,
        status TEXT NOT NULL DEFAULT 'open', waiter TEXT, note TEXT,
        total INTEGER NOT NULL DEFAULT 0, paid INTEGER, change INTEGER, method TEXT,
        created_at TEXT, updated_at TEXT, closed_at TEXT);
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER, name TEXT NOT NULL, price INTEGER NOT NULL, qty INTEGER NOT NULL DEFAULT 1,
        note TEXT, added_by TEXT, created_at TEXT);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_day ON orders(day);
      CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_items_product ON order_items(product_id);
    `);
    if (!this.getMeta('app')) {
      this.tx(() => {
        this.setMeta('app', APP_KEY);
        this.setMeta('schema', String(SCHEMA_VERSION));
        this.setMeta('created_at', nowIso());
        DEFAULT_CATEGORIES.forEach(([name, icon, color], i) =>
          db.prepare('INSERT INTO categories (name, icon, color, sort) VALUES (?, ?, ?, ?)').run(name, icon, color, i));
        for (let i = 1; i <= 10; i++) db.prepare('INSERT INTO tables (name, zone, sort) VALUES (?, ?, ?)').run(`Masa ${i}`, 'Sală', i);
        db.prepare('INSERT INTO tables (name, zone, sort) VALUES (?, ?, ?)').run('La pachet', 'Pachet', 100);
      });
    }
  }

  tx(fn) {
    this.db.exec('BEGIN');
    try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  getMeta(key) { return this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null; }
  setMeta(key, value) { this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value)); }

  // ---------- evenimente ----------
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type) {
    this.changedSinceBackup = true;
    for (const fn of this.listeners) { try { fn({ type, at: Date.now() }); } catch { /* client deconectat */ } }
  }

  // ---------- setari casa ----------
  settings() {
    return {
      currency: this.getMeta('currency') || 'lei',
      autoSort: this.getMeta('auto_sort') || 'daily',
      resortEvery: Number(this.getMeta('resort_every') || 30),
      hasPin: !!this.getMeta('admin_pin'),
      lastResort: this.getMeta('last_resort'),
    };
  }
  saveSettings(p) {
    if (p.currency !== undefined) this.setMeta('currency', String(p.currency).slice(0, 8));
    if (p.autoSort !== undefined) this.setMeta('auto_sort', ['daily', 'orders', 'off'].includes(p.autoSort) ? p.autoSort : 'daily');
    if (p.resortEvery !== undefined) this.setMeta('resort_every', Math.max(5, Math.min(500, Number(p.resortEvery) || 30)));
    if (p.adminPin !== undefined) this.setMeta('admin_pin', String(p.adminPin).replace(/\D/g, '').slice(0, 8));
    this.emit('settings');
    return this.settings();
  }
  checkPin(pin) {
    const real = this.getMeta('admin_pin');
    return !real || String(pin || '') === real;
  }

  // ---------- meniu ----------
  menu() {
    const categories = this.db.prepare('SELECT * FROM categories ORDER BY sort, id').all();
    const products = this.db.prepare('SELECT * FROM products ORDER BY pinned DESC, rank, id').all();
    return { categories, products };
  }
  saveCategory(c) {
    const name = String(c.name || '').trim();
    if (!name) throw new Error('Categoria are nevoie de un nume.');
    if (c.id) {
      this.db.prepare('UPDATE categories SET name = ?, icon = ?, color = ?, active = ? WHERE id = ?')
        .run(name, c.icon || null, c.color || null, c.active === false ? 0 : 1, c.id);
    } else {
      const sort = (this.db.prepare('SELECT MAX(sort) m FROM categories').get().m ?? -1) + 1;
      c.id = Number(this.db.prepare('INSERT INTO categories (name, icon, color, sort) VALUES (?, ?, ?, ?)').run(name, c.icon || null, c.color || null, sort).lastInsertRowid);
    }
    this.emit('menu');
    return c.id;
  }
  moveCategory(id, dir) {
    const list = this.db.prepare('SELECT id FROM categories ORDER BY sort, id').all().map((r) => r.id);
    const i = list.indexOf(id);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.tx(() => list.forEach((cid, k) => this.db.prepare('UPDATE categories SET sort = ? WHERE id = ?').run(k, cid)));
    this.emit('menu');
  }
  deleteCategory(id) {
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    this.emit('menu');
  }
  saveProduct(p) {
    const name = String(p.name || '').trim();
    if (!name) throw new Error('Produsul are nevoie de un nume.');
    const price = Math.round(Number(p.price));
    if (!Number.isFinite(price) || price < 0) throw new Error('Preț invalid.');
    const args = [p.category_id || null, name, price, p.icon || null, p.image_id || null, p.active === false ? 0 : 1, p.pinned ? 1 : 0];
    if (p.id) {
      this.db.prepare('UPDATE products SET category_id = ?, name = ?, price = ?, icon = ?, image_id = ?, active = ?, pinned = ? WHERE id = ?').run(...args, p.id);
    } else {
      const rank = (this.db.prepare('SELECT MAX(rank) m FROM products').get().m ?? -1) + 1;
      p.id = Number(this.db.prepare('INSERT INTO products (category_id, name, price, icon, image_id, active, pinned, rank, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...args, rank, nowIso()).lastInsertRowid);
    }
    this.emit('menu');
    return p.id;
  }
  deleteProduct(id) {
    this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
    this.emit('menu');
  }
  saveImage({ data, mime }) {
    const buf = Buffer.from(String(data || ''), 'base64');
    if (!buf.length || buf.length > 600 * 1024) throw new Error('Imaginea este prea mare.');
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new Error('Format de imagine nesuportat.');
    return Number(this.db.prepare('INSERT INTO images (mime, data) VALUES (?, ?)').run(mime, buf).lastInsertRowid);
  }
  image(id) { return this.db.prepare('SELECT mime, data FROM images WHERE id = ?').get(id); }

  // Ordonare dupa popularitate: numarul de comenzi in care apare produsul (nu cantitatea)
  resort({ silent = false } = {}) {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const rows = this.db.prepare(`
      SELECT p.id, p.pinned, p.order_count,
        (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id AND o.status = 'paid' AND o.closed_at >= ?) AS recent
      FROM products p`).all(since);
    const score = (r) => r.recent + 0.1 * r.order_count;
    rows.sort((a, b) => (b.pinned - a.pinned) || (score(b) - score(a)) || (a.id - b.id));
    this.tx(() => {
      rows.forEach((r, i) => this.db.prepare('UPDATE products SET rank = ? WHERE id = ?').run(i, r.id));
      this.setMeta('last_resort', nowIso());
      this.setMeta('orders_since_resort', 0);
    });
    if (!silent) this.emit('menu');
  }
  resortIfDue() {
    const s = this.settings();
    if (s.autoSort === 'off') return false;
    const last = s.lastResort ? Date.parse(s.lastResort) : 0;
    if (s.autoSort === 'daily' && Date.now() - last > 20 * 3600e3) { this.resort(); return true; }
    if (s.autoSort === 'orders' && Number(this.getMeta('orders_since_resort') || 0) >= s.resortEvery) { this.resort(); return true; }
    return false;
  }

  // ---------- mese ----------
  tables() { return this.db.prepare('SELECT * FROM tables ORDER BY sort, id').all(); }
  saveTable(t) {
    const name = String(t.name || '').trim();
    if (!name) throw new Error('Masa are nevoie de un nume.');
    if (t.id) {
      this.db.prepare('UPDATE tables SET name = ?, zone = ?, active = ? WHERE id = ?').run(name, t.zone || null, t.active === false ? 0 : 1, t.id);
    } else {
      const sort = (this.db.prepare('SELECT MAX(sort) m FROM tables WHERE sort < 100').get().m ?? 0) + 1;
      t.id = Number(this.db.prepare('INSERT INTO tables (name, zone, sort) VALUES (?, ?, ?)').run(name, t.zone || null, sort).lastInsertRowid);
    }
    this.emit('tables');
    return t.id;
  }
  deleteTable(id) {
    if (this.db.prepare("SELECT 1 FROM orders WHERE table_id = ? AND status = 'open'").get(id)) throw new Error('Masa are un cec deschis.');
    this.db.prepare('DELETE FROM tables WHERE id = ?').run(id);
    this.emit('tables');
  }

  // ---------- cecuri ----------
  order(id) {
    const o = this.db.prepare('SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN tables t ON t.id = o.table_id WHERE o.id = ?').get(id);
    if (!o) return null;
    o.items = this.db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id);
    return o;
  }
  openOrders() {
    const orders = this.db.prepare("SELECT o.*, t.name AS table_name FROM orders o LEFT JOIN tables t ON t.id = o.table_id WHERE o.status = 'open' ORDER BY o.created_at").all();
    const items = this.db.prepare("SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status = 'open' ORDER BY oi.id").all();
    const byOrder = new Map(orders.map((o) => [o.id, Object.assign(o, { items: [] })]));
    for (const it of items) byOrder.get(it.order_id)?.items.push(it);
    return orders;
  }
  recalc(orderId) {
    const total = this.db.prepare('SELECT COALESCE(SUM(price * qty), 0) t FROM order_items WHERE order_id = ?').get(orderId).t;
    this.db.prepare('UPDATE orders SET total = ?, updated_at = ? WHERE id = ?').run(total, nowIso(), orderId);
    return total;
  }
  assertOpen(orderId) {
    const o = this.db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    if (!o) throw new Error('Cecul nu există.');
    if (o.status !== 'open') throw new Error('Cecul este deja închis.');
  }
  createOrder({ table_id, waiter, note } = {}) {
    const day = localDay();
    const number = (this.db.prepare('SELECT MAX(number) m FROM orders WHERE day = ?').get(day).m ?? 0) + 1;
    const t = nowIso();
    const id = Number(this.db.prepare('INSERT INTO orders (number, day, table_id, waiter, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(number, day, table_id || null, waiter || null, note || null, t, t).lastInsertRowid);
    this.emit('orders');
    return this.order(id);
  }
  addItem({ order_id, product_id, qty = 1, note, by }) {
    this.assertOpen(order_id);
    const p = this.db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!p) throw new Error('Produsul nu există.');
    const n = Math.max(1, Math.min(999, Math.round(qty)));
    const same = this.db.prepare('SELECT id FROM order_items WHERE order_id = ? AND product_id = ? AND price = ? AND COALESCE(note, \'\') = ?')
      .get(order_id, product_id, p.price, note || '');
    this.tx(() => {
      if (same) this.db.prepare('UPDATE order_items SET qty = qty + ? WHERE id = ?').run(n, same.id);
      else this.db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty, note, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(order_id, product_id, p.name, p.price, n, note || null, by || null, nowIso());
      this.recalc(order_id);
    });
    this.emit('orders');
    return this.order(order_id);
  }
  setQty({ item_id, qty }) {
    const it = this.db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(item_id);
    if (!it) throw new Error('Poziția nu există.');
    this.assertOpen(it.order_id);
    this.tx(() => {
      if (qty <= 0) this.db.prepare('DELETE FROM order_items WHERE id = ?').run(item_id);
      else this.db.prepare('UPDATE order_items SET qty = ? WHERE id = ?').run(Math.min(999, Math.round(qty)), item_id);
      this.recalc(it.order_id);
    });
    this.emit('orders');
    return this.order(it.order_id);
  }
  setItemNote({ item_id, note }) {
    const it = this.db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(item_id);
    if (!it) throw new Error('Poziția nu există.');
    this.assertOpen(it.order_id);
    this.db.prepare('UPDATE order_items SET note = ? WHERE id = ?').run(String(note || '').slice(0, 120) || null, item_id);
    this.emit('orders');
    return this.order(it.order_id);
  }
  updateOrder({ order_id, table_id, note }) {
    this.assertOpen(order_id);
    if (table_id !== undefined) this.db.prepare('UPDATE orders SET table_id = ?, updated_at = ? WHERE id = ?').run(table_id || null, nowIso(), order_id);
    if (note !== undefined) this.db.prepare('UPDATE orders SET note = ?, updated_at = ? WHERE id = ?').run(String(note || '').slice(0, 200) || null, nowIso(), order_id);
    this.emit('orders');
    return this.order(order_id);
  }
  payOrder({ order_id, method = 'cash', paid }) {
    this.assertOpen(order_id);
    const total = this.recalc(order_id);
    const count = this.db.prepare('SELECT COUNT(*) c FROM order_items WHERE order_id = ?').get(order_id).c;
    if (!count) throw new Error('Cecul este gol.');
    const m = method === 'card' ? 'card' : 'cash';
    const given = m === 'cash' ? Math.round(Number(paid ?? total)) : total;
    if (given < total) throw new Error('Suma primită este mai mică decât totalul.');
    this.tx(() => {
      this.db.prepare("UPDATE orders SET status = 'paid', method = ?, paid = ?, change = ?, closed_at = ?, updated_at = ? WHERE id = ?")
        .run(m, given, given - total, nowIso(), nowIso(), order_id);
      this.db.prepare('UPDATE products SET order_count = order_count + 1 WHERE id IN (SELECT DISTINCT product_id FROM order_items WHERE order_id = ?)').run(order_id);
      this.setMeta('orders_since_resort', Number(this.getMeta('orders_since_resort') || 0) + 1);
    });
    this.emit('orders');
    if (this.settings().autoSort === 'orders') this.resortIfDue();
    return this.order(order_id);
  }
  cancelOrder({ order_id }) {
    this.assertOpen(order_id);
    const count = this.db.prepare('SELECT COUNT(*) c FROM order_items WHERE order_id = ?').get(order_id).c;
    if (count) this.db.prepare("UPDATE orders SET status = 'cancelled', closed_at = ?, updated_at = ? WHERE id = ?").run(nowIso(), nowIso(), order_id);
    else this.db.prepare('DELETE FROM orders WHERE id = ?').run(order_id);
    this.emit('orders');
  }

  // ---------- rapoarte ----------
  report(day = localDay()) {
    const sum = this.db.prepare(`SELECT
        COUNT(*) AS orders, COALESCE(SUM(total), 0) AS total,
        COALESCE(SUM(CASE WHEN method = 'cash' THEN total END), 0) AS cash,
        COALESCE(SUM(CASE WHEN method = 'card' THEN total END), 0) AS card
      FROM orders WHERE day = ? AND status = 'paid'`).get(day);
    const cancelled = this.db.prepare("SELECT COUNT(*) c FROM orders WHERE day = ? AND status = 'cancelled'").get(day).c;
    const open = this.db.prepare("SELECT COUNT(*) c, COALESCE(SUM(total), 0) t FROM orders WHERE status = 'open'").get();
    const top = this.db.prepare(`SELECT oi.name, COUNT(DISTINCT oi.order_id) AS orders, SUM(oi.qty) AS qty, SUM(oi.qty * oi.price) AS total
      FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.day = ? AND o.status = 'paid'
      GROUP BY oi.product_id, oi.name ORDER BY orders DESC, qty DESC LIMIT 10`).all(day);
    const hours = this.db.prepare(`SELECT closed_at, total FROM orders WHERE day = ? AND status = 'paid'`).all(day)
      .reduce((acc, o) => { const h = new Date(o.closed_at).getHours(); acc[h] = (acc[h] || 0) + o.total; return acc; }, {});
    const recent = this.db.prepare(`SELECT o.id, o.number, o.total, o.method, o.paid, o.change, o.closed_at, o.waiter, t.name AS table_name
      FROM orders o LEFT JOIN tables t ON t.id = o.table_id WHERE o.day = ? AND o.status = 'paid' ORDER BY o.closed_at DESC LIMIT 30`).all(day);
    return { day, ...sum, cancelled, openCount: open.c, openTotal: open.t, top, hours, recent };
  }

  state() {
    return { menu: this.menu(), tables: this.tables(), orders: this.openOrders(), settings: this.settings() };
  }

  // ---------- copii de rezerva ----------
  backup(reason = 'auto') {
    const file = path.join(this.backupDir, `casa_${stamp()}_${reason}.db`);
    this.db.prepare('VACUUM INTO ?').run(file);
    this.changedSinceBackup = false;
    this.pruneBackups();
    return path.basename(file);
  }
  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir)
      .filter((f) => /^casa_.*\.db$/.test(f))
      .map((name) => {
        const p = path.join(this.backupDir, name);
        const st = fs.statSync(p);
        return { name, path: p, size: st.size, time: st.mtimeMs };
      })
      .sort((a, b) => b.time - a.time);
  }
  pruneBackups() {
    const list = this.listBackups();
    const keep = new Set(list.slice(0, KEEP_RECENT_BACKUPS).map((b) => b.name));
    const seenDays = new Set();
    for (const b of list) {
      const day = localDay(new Date(b.time));
      if (Date.now() - b.time < KEEP_DAILY_BACKUPS_DAYS * 864e5 && !seenDays.has(day)) { seenDays.add(day); keep.add(b.name); }
      if (/_(inainte|manual|export)/.test(b.name)) keep.add(b.name);
    }
    for (const b of list) if (!keep.has(b.name)) { try { fs.unlinkSync(b.path); } catch { /* fisier blocat */ } }
  }
  exportTo(target) {
    if (fs.existsSync(target)) fs.unlinkSync(target);
    this.db.prepare('VACUUM INTO ?').run(target);
  }
  static validate(file) {
    let db;
    try {
      db = new DatabaseSync(file, { readOnly: true });
      const app = db.prepare("SELECT value FROM meta WHERE key = 'app'").get()?.value;
      if (app !== APP_KEY) throw new Error();
      const products = db.prepare('SELECT COUNT(*) c FROM products').get().c;
      const orders = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
      return { products, orders };
    } catch {
      throw new Error('Fișierul nu este o bază de date Arta Gustului.');
    } finally { try { db?.close(); } catch { /* */ } }
  }
  replaceWith(file) {
    const info = Store.validate(file);
    this.backup('inainte-de-import');
    this.close();
    for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(this.file + ext); } catch { /* nu exista */ } }
    fs.copyFileSync(file, this.file);
    this.open();
    this.emit('reload');
    return info;
  }
}

module.exports = { Store, localDay };
