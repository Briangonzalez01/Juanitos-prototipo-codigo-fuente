import test from 'node:test';
import assert from 'node:assert/strict';

// Test helper: Minimal D1-like mock to satisfy the subset of SQL used by the app routes
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
        // handle create/alter statements silently
        if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX') || normalized.startsWith('ALTER TABLE')) {
          return {};
        }
        if (normalized.includes('INSERT INTO PRODUCTS')) {
          // handle multiple INSERT variants by position
          const b = this._bind || [];
          // detect long form with many columns (internal_code...)
          const now = b[b.length - 1] ?? new Date().toISOString();
          const id = self._ids.products++;
          const p = { id, name: b[0] ?? null, area: b[1] ?? null, unit: b[2] ?? null, internal_code: b[3] ?? null, provider: b[4] ?? null, ideal_stock: b[5] ?? null, image_url: b[6] ?? null, category_id: b[7] ?? null, group_id: b[8] ?? null, created_at: b[b.length - 2] ?? now, updated_at: b[b.length - 1] ?? now, status: 'Activo' };
          self.products.push(p);
          return { lastInsertRowid: id };
        }
        if (normalized.includes('INSERT INTO INVENTORY')) {
          const b = this._bind || [];
          const id = self._ids.inventory++;
          self.inventory.push({ id, product_id: b[0], current_quantity: Number(b[1]) ?? 0, updated_at: b[2] });
          return { lastInsertRowid: id };
        }
        if (normalized.includes('INSERT INTO AREAS')) {
          const b = this._bind || [];
          const id = self._ids.areas++;
          self.areas.push({ id, name: b[0], emoji: b[1] ?? null, active: Number(b[2]) ?? 1, created_at: b[3], updated_at: b[4] });
          return { lastInsertRowid: id };
        }
        if (normalized.startsWith('UPDATE AREAS')) {
          const b = this._bind || [];
          const name = b[0]; const emoji = b[1]; const active = b[2]; const updated_at = b[3]; const id = b[4];
          const row = self.areas.find((r) => r.id === id);
          if (row) { row.name = name; row.emoji = emoji; row.active = active; row.updated_at = updated_at; }
          return {};
        }
        if (normalized.startsWith('UPDATE INVENTORY') ) {
          const b = this._bind || [];
          const updated_at = b[1]; const product_id = b[2];
          const row = self.inventory.find((r) => r.product_id === product_id);
          if (row) row.current_quantity = Number(b[0]);
          return {};
        }
        if (normalized.startsWith('DELETE FROM')) {
          // simplistic delete by product id
          const b = this._bind || [];
          const id = b[0];
          if (normalized.includes('FROM PRODUCTS')) { self.products = self.products.filter(p => p.id !== id); }
          if (normalized.includes('FROM INVENTORY')) { self.inventory = self.inventory.filter(i => i.product_id !== id); }
          if (normalized.includes('FROM PURCHASE_ITEMS')) { self.purchase_items = self.purchase_items.filter(pi => pi.product_id !== id); }
          return {};
        }

        // fallback
        return {};
      },
      async all() {
        // SELECT queries
        if (normalized.includes('SELECT NAME, AREA FROM PRODUCTS')) {
          return { results: self.products.map(p => ({ name: p.name, area: p.area })) };
        }
        if (normalized.includes('SELECT DISTINCT AREA FROM PRODUCTS')) {
          const set = Array.from(new Set(self.products.map(p => p.area).filter(Boolean)));
          return { results: set.map(area => ({ area })) };
        }
        if (normalized.includes('SELECT P.*, COALESCE(I.CURRENT_QUANTITY')) {
          // return all products with current_quantity
          const rows = self.products.map(p => {
            const inv = self.inventory.find(i => i.product_id === p.id);
            return { ...p, current_quantity: inv ? inv.current_quantity : 0 };
          }).sort((a,b) => (String(a.area||'').localeCompare(String(b.area||'')) || String(a.name||'').localeCompare(String(b.name||''))));
          return { results: rows };
        }
        if (normalized.includes('SELECT * FROM AREAS')) {
          return { results: [...self.areas] };
        }
        if (normalized.includes("SELECT * FROM MOVEMENTS")) {
          const rows = [...self.movements].sort((a,b) => (b.created_at.localeCompare(a.created_at) || b.id - a.id)).slice(0,100);
          return { results: rows };
        }
        if (normalized.includes('SELECT * FROM PURCHASE_ITEMS')) {
          const b = this._bind || [];
          const request_id = b[0];
          return { results: self.purchase_items.filter(pi => pi.request_id === request_id) };
        }
        if (normalized.includes('SELECT ID, NAME FROM PRODUCTS')) {
          return { results: self.products.map(p => ({ id: p.id, name: p.name })) };
        }
        if (normalized.includes('SELECT ID, NAME, AREA FROM PRODUCTS')) {
          return { results: self.products.map(p => ({ id: p.id, name: p.name, area: p.area })) };
        }

        return { results: [] };
      },
      async first() {
        if (normalized.includes("SELECT COUNT(*) AS COUNT FROM PURCHASE_REQUESTS")) {
          return { count: self.purchase_requests.length };
        }
        if (normalized.includes("SELECT ID FROM PURCHASE_REQUESTS WHERE STATUS = 'ABIERTA'")) {
          const open = [...self.purchase_requests].reverse().find(r => r.status === 'Abierta');
          return open ? { id: open.id } : undefined;
        }
        if (normalized.includes('SELECT * FROM PURCHASE_REQUESTS WHERE STATUS =')) {
          const b = this._bind || [];
          const statusMatch = /WHERE STATUS = '([^']+)'/i.exec(sql);
          const status = statusMatch ? statusMatch[1] : null;
          const found = [...self.purchase_requests].reverse().find(r => r.status === status);
          return found ? found : undefined;
        }
        if (normalized.includes('SELECT 1 FROM MOVEMENTS WHERE PRODUCT_ID = ? LIMIT 1')) {
          const b = this._bind || [];
          const pid = b[0];
          const found = self.movements.find(m => m.product_id === pid);
          return found ? { 1: 1 } : undefined;
        }
        if (normalized.includes('SELECT 1 FROM PURCHASE_ITEMS WHERE PRODUCT_ID = ? LIMIT 1')) {
          const b = this._bind || [];
          const pid = b[0];
          const found = self.purchase_items.find(pi => pi.product_id === pid);
          return found ? { 1: 1 } : undefined;
        }
        if (normalized.includes('SELECT P.*, COALESCE(I.CURRENT_QUANTITY')) {
          const b = this._bind || [];
          const id = b[0];
          const p = self.products.find(x => x.id === id);
          if (!p) return undefined;
          const inv = self.inventory.find(i => i.product_id === id);
          return { ...p, current_quantity: inv ? inv.current_quantity : 0 };
        }
        if (normalized.includes('SELECT COUNT(*) AS COUNT FROM PURCHASE_REQUESTS WHERE STATUS =')) {
          const b = this._bind || [];
          const found = self.purchase_requests.filter(r => r.status === 'Cerrada').length;
          return { count: found };
        }
        return undefined;
      },
    };
  }

  async batch(stmts) {
    for (const s of stmts) {
      try {
        await s.run();
      } catch (e) {
        // ignore
      }
    }
  }
}

async function getWorker() {
  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

test('API inventory flow: GET seeds products and allows creating areas and products', async () => {
  const mock = new MockDB();
  // inject mock env for modules that import from ../app/api/env
  // Import the built server bundle and call its fetch handler, injecting our MockDB as env
  // ensure env shim reads our mock DB at module-eval time
  globalThis.__CF_ENV = { DB: mock };
  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  const { default: worker } = await import(workerUrl.href);
  const res1 = await worker.fetch(new Request('http://localhost/api/inventory'), {}, { waitUntil() {}, passThroughOnException() {} });
  if (res1.status !== 200) {
    const t = await res1.text();
    console.error('GET /api/inventory failed:', res1.status, t);
  }
  assert.equal(res1.status, 200);
  const json1 = await res1.json();
  assert.ok(Array.isArray(json1.products));
  assert.ok(json1.products.length > 0, 'Seeded products expected');

  // 2) create a new area as admin
  const createAreaReq = new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'createArea', name: 'Prueba' }) });
  const createAreaResp = await worker.fetch(createAreaReq, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(createAreaResp.status, 200);
  const createAreaJson = await createAreaResp.json();
  assert.ok(createAreaJson.ok === true);
  assert.ok(typeof createAreaJson.id === 'number');

  // 3) GET and check area present
  const res2 = await worker.fetch(new Request('http://localhost/api/inventory'), {}, { waitUntil() {}, passThroughOnException() {} });
  const json2 = await res2.json();
  const found = json2.areas.find(a => a.name === 'Prueba');
  assert.ok(found, 'New area should be present in GET response');

  // 4) create a product assigned to that area
  const createProdReq = new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'dev' }, body: JSON.stringify({ action: 'createProduct', name: 'Producto Prueba', area: 'Prueba', unit: 'Unidad', quantity: 7 }) });
  const createProdResp = await worker.fetch(createProdReq, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(createProdResp.status, 200);
  const createProdJson = await createProdResp.json();
  assert.ok(createProdJson.ok === true);

  // 5) GET and ensure product is present
  const res3 = await worker.fetch(new Request('http://localhost/api/inventory'), {}, { waitUntil() {}, passThroughOnException() {} });
  const json3 = await res3.json();
  const p = json3.products.find(p => p.name === 'Producto Prueba' && p.area === 'Prueba');
  assert.ok(p, 'Created product should be present');
});
