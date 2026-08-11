import test from 'node:test';
import assert from 'node:assert/strict';

class MockDB {
  constructor() {
    this.products = [];
    this.inventory = [];
    this.areas = [];
    this.categories = [];
    this.count_groups = [];
    this.purchase_requests = [];
    this.purchase_items = [];
    this.movements = [];
    this._ids = { products: 1, inventory: 1, areas: 1, categories: 1, purchase_requests: 1, purchase_items: 1, movements: 1 };
  }

  prepare(sql) {
    const self = this;
    const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    return {
      bind(...params) { this._bind = params; return this; },
      async run() {
        const b = this._bind || [];
        if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX') || normalized.startsWith('ALTER TABLE')) return {};
        if (normalized.includes('INSERT INTO PRODUCTS')) {
          const now = b[b.length - 1] ?? new Date().toISOString();
          const id = self._ids.products++;
          const p = { id, name: b[0] ?? null, area: b[1] ?? null, unit: b[2] ?? null, internal_code: b[3] ?? null, provider: b[4] ?? null, ideal_stock: b[5] ?? null, image_url: b[6] ?? null, category_id: b[7] ?? null, group_id: b[8] ?? null, created_at: b[b.length - 2] ?? now, updated_at: b[b.length - 1] ?? now, status: 'Activo' };
          self.products.push(p);
          return { lastInsertRowid: id };
        }
        if (/INSERT(?: OR IGNORE)? INTO INVENTORY/.test(normalized)) {
          const id = self._ids.inventory++;
          self.inventory.push({ id, product_id: b[0], current_quantity: Number(b[1]) ?? 0, updated_at: b[2] });
          return { lastInsertRowid: id };
        }
        if (normalized.includes('INSERT INTO AREAS')) {
          const id = self._ids.areas++;
          self.areas.push({ id, name: b[0], emoji: b[1] ?? null, active: Number(b[2]) ?? 1, created_at: b[3], updated_at: b[4] });
          return { lastInsertRowid: id };
        }
        if (normalized.includes('INSERT INTO MOVEMENTS')) {
          const id = self._ids.movements++;
          // bind order: product_id, product_name, area, responsible, type, previous_quantity, informed_quantity, difference, new_quantity, note, group_name, created_at
          self.movements.push({ id, product_id: b[0], product_name: b[1], area: b[2], responsible: b[3], type: b[4], previous_quantity: Number(b[5]), informed_quantity: Number(b[6]), difference: Number(b[7]), new_quantity: Number(b[8]), note: b[9] || null, group_name: b[10] || null, created_at: b[11] });
          return { lastInsertRowid: id };
        }
        if (normalized.startsWith('UPDATE INVENTORY')) {
          const quantity = Number(b[0]);
          const updated_at = b[1];
          const product_id = b[2];
          const row = self.inventory.find(r => r.product_id === product_id);
          if (row) { row.current_quantity = quantity; row.updated_at = updated_at; }
          return {};
        }
        if (normalized.startsWith('UPDATE AREAS')) {
          const id = b[4];
          const row = self.areas.find(r => r.id === id);
          if (row) { row.name = b[0]; row.emoji = b[1]; row.active = b[2]; row.updated_at = b[3]; }
          return {};
        }
        if (normalized.startsWith('DELETE FROM')) {
          const id = b[0];
          if (normalized.includes('FROM PRODUCTS')) self.products = self.products.filter(p => p.id !== id);
          if (normalized.includes('FROM INVENTORY')) self.inventory = self.inventory.filter(i => i.product_id !== id);
          if (normalized.includes('FROM PURCHASE_ITEMS')) self.purchase_items = self.purchase_items.filter(pi => pi.product_id !== id);
          return {};
        }
        return {};
      },
      async all() {
        if (normalized.includes('SELECT NAME, AREA FROM PRODUCTS')) return { results: self.products.map(p => ({ name: p.name, area: p.area })) };
        if (normalized.includes('SELECT P.*, COALESCE(I.CURRENT_QUANTITY')) {
          const rows = self.products.map(p => { const inv = self.inventory.find(i => i.product_id === p.id); return { ...p, current_quantity: inv ? inv.current_quantity : 0 }; });
          return { results: rows };
        }
        if (normalized.includes('SELECT * FROM AREAS')) return { results: [...self.areas] };
        if (normalized.includes('SELECT * FROM MOVEMENTS')) return { results: [...self.movements] };
        if (normalized.includes('SELECT * FROM PURCHASE_ITEMS')) {
          const request_id = this._bind ? this._bind[0] : undefined;
          return { results: self.purchase_items.filter(pi => pi.request_id === request_id) };
        }
        if (normalized.includes('SELECT ID, NAME FROM PRODUCTS')) return { results: self.products.map(p => ({ id: p.id, name: p.name })) };
        return { results: [] };
      },
      async first() {
        if (normalized.includes("SELECT COUNT(*) AS COUNT FROM PURCHASE_REQUESTS")) return { count: self.purchase_requests.length };
        if (normalized.includes("SELECT ID FROM PURCHASE_REQUESTS WHERE STATUS = 'ABIERTA'")) {
          const open = [...self.purchase_requests].reverse().find(r => r.status === 'Abierta');
          return open ? { id: open.id } : undefined;
        }
        if (normalized.includes('SELECT * FROM PURCHASE_REQUESTS WHERE STATUS =')) {
          const statusMatch = /WHERE STATUS = '([^']+)'/i.exec(sql);
          const status = statusMatch ? statusMatch[1] : null;
          return [...self.purchase_requests].reverse().find(r => r.status === status);
        }
        if (normalized.includes('SELECT 1 FROM MOVEMENTS WHERE PRODUCT_ID = ? LIMIT 1')) {
          const pid = this._bind ? this._bind[0] : undefined;
          const found = self.movements.find(m => m.product_id === pid);
          return found ? { 1: 1 } : undefined;
        }
        if (normalized.includes('SELECT P.*, COALESCE(I.CURRENT_QUANTITY')) {
          const id = this._bind ? this._bind[0] : undefined;
          const p = self.products.find(x => x.id === id);
          if (!p) return undefined;
          const inv = self.inventory.find(i => i.product_id === id);
          return { ...p, current_quantity: inv ? inv.current_quantity : 0 };
        }
        return undefined;
      }
    };
  }

  async batch(stmts) { for (const s of stmts) { try { await s.run(); } catch(e) {} } }
}

async function bootWorkerWithMock(mock) {
  globalThis.__CF_ENV = { DB: mock };
  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  const { default: worker } = await import(workerUrl.href + `?t=${Date.now()}`);
  return { worker, mock };
}

// initialize a single worker + mock for all tests to avoid module-caching inconsistencies
const _boot = await bootWorkerWithMock(new MockDB());
const worker = _boot.worker;
const mock = _boot.mock;

test('registerCount - valid flow and error cases', async () => {

  // create product with initial stock 10
  const createResp = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'createProduct', name: 'TC Producto', area: 'Cocina', unit: 'Kg', quantity: 10 }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(createResp.status, 200);

  // find created product id
  const listResp = await worker.fetch(new Request('http://localhost/api/inventory'), {}, { waitUntil() {}, passThroughOnException() {} });
  const data = await listResp.json();
  // debug logs removed to keep test output clean
  const p = data.products.find(x => x.name === 'TC Producto');
  assert.ok(p, 'product created');
  const pid = p.id;

  // valid count: change to 7
  const rcResp = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'registerCount', productId: pid, quantity: 7, responsible: 'Tester' }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(rcResp.status, 200);
  // check inventory updated
  const invRow = mock.inventory.find(i => i.product_id === pid);
  assert.equal(invRow.current_quantity, 7);
  // check movement recorded
  // movements present; no verbose debug log
  const mv = mock.movements.find(m => m.product_id === pid && m.type && m.type.toLowerCase().includes('conteo'));
  assert.ok(mv, 'movement recorded');
  assert.equal(mv.previous_quantity, 10);
  assert.equal(mv.informed_quantity, 7);
  assert.equal(mv.difference, 7 - 10);
  assert.equal(mv.responsible, 'Tester');

  // product nonexistent
  const badResp = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'registerCount', productId: 9999, quantity: 2, responsible: 'X' }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const badJson = await badResp.json();
  assert.equal(badResp.status, 400);
  assert.equal(badJson.error, 'PRODUCT_NOT_FOUND');

  // invalid quantity
  const invalidResp = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'registerCount', productId: pid, quantity: 'nope', responsible: 'T' }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const invalidJson = await invalidResp.json();
  assert.equal(invalidResp.status, 400);
  assert.equal(invalidJson.error, 'INVALID_PAYLOAD');

  // missing fields
  const missResp = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'registerCount', quantity: 5 }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const missJson = await missResp.json();
  assert.equal(missResp.status, 400);
  assert.equal(missJson.error, 'INVALID_PAYLOAD');
});

test('registerEntry - valid flow and error cases', async () => {
  // create product with initial stock 5
  const createResp = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'createProduct', name: 'TE Producto', area: 'Barra', unit: 'Unidad', quantity: 5 }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(createResp.status, 200);
  const listResp = await worker.fetch(new Request('http://localhost/api/inventory'), {}, { waitUntil() {}, passThroughOnException() {} });
  const data = await listResp.json();
  // debug logs removed to keep test output clean
  const p = data.products.find(x => x.name === 'TE Producto');
  assert.ok(p);
  const pid = p.id;

  // valid entry +3
  const reResp = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'registerEntry', productId: pid, quantity: 3, responsible: 'Encargado' }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(reResp.status, 200);
  const invRow = mock.inventory.find(i => i.product_id === pid);
  assert.equal(invRow.current_quantity, 8);
  const mv = mock.movements.find(m => m.product_id === pid && m.type && m.type.toLowerCase().includes('ingreso'));
  assert.ok(mv);
  assert.equal(mv.previous_quantity, 5);
  assert.equal(mv.informed_quantity, 3);
  assert.equal(mv.difference, 3);
  assert.equal(mv.new_quantity, 8);
  assert.equal(mv.responsible, 'Encargado');

  // nonexistent product
  const bad = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'registerEntry', productId: 9999, quantity: 1, responsible: 'X' }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const badJ = await bad.json();
  assert.equal(bad.status, 400);
  // invalid quantity (zero)
  const zero = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'registerEntry', productId: pid, quantity: 0, responsible: 'X' }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const zeroJ = await zero.json();
  assert.equal(zero.status, 400);
  assert.equal(zeroJ.error, 'INVALID_PAYLOAD');

  // missing fields
  const miss = await worker.fetch(new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'registerEntry', quantity: 2 }) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const missJ = await miss.json();
  assert.equal(miss.status, 400);
  assert.equal(missJ.error, 'INVALID_PAYLOAD');
});
