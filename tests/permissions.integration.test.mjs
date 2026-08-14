import test from 'node:test';
import assert from 'node:assert/strict';

// Reuse same MockDB shape as other tests
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
        if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX') || normalized.startsWith('ALTER TABLE')) return {};
        if (normalized.includes('INSERT INTO PRODUCTS')) {
          const b = this._bind || [];
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
        if (normalized.startsWith('UPDATE INVENTORY')) {
          const b = this._bind || [];
          const updated_at = b[1]; const product_id = b[2];
          const row = self.inventory.find((r) => r.product_id === product_id);
          if (row) row.current_quantity = Number(b[0]);
          return {};
        }
        return {};
      },
      async all() {
        if (normalized.includes('SELECT DISTINCT AREA FROM PRODUCTS')) {
          const set = Array.from(new Set(self.products.map(p => p.area).filter(Boolean)));
          return { results: set.map(area => ({ area })) };
        }
        if (normalized.includes('SELECT P.*, COALESCE(I.CURRENT_QUANTITY')) {
          const rows = self.products.map(p => { const inv = self.inventory.find(i => i.product_id === p.id); return { ...p, current_quantity: inv ? inv.current_quantity : 0 }; });
          return { results: rows };
        }
        if (normalized.includes('SELECT * FROM AREAS')) return { results: [...self.areas] };
        if (normalized.includes("SELECT * FROM MOVEMENTS")) return { results: [...self.movements] };
        return { results: [] };
      },
      async first() {
        if (normalized.includes('SELECT COUNT(*) AS COUNT FROM AREAS')) return { count: self.areas.length };
        if (normalized.includes('SELECT ID FROM PURCHASE_REQUESTS WHERE STATUS =')) return undefined;
        if (normalized.includes('SELECT P.*, COALESCE(I.CURRENT_QUANTITY')) {
          const b = this._bind || [];
          const id = b[0];
          const p = self.products.find(x => x.id === id);
          if (!p) return undefined;
          const inv = self.inventory.find(i => i.product_id === id);
          return { ...p, current_quantity: inv ? inv.current_quantity : 0 };
        }
        if (normalized.includes('SELECT * FROM PURCHASE_REQUESTS WHERE STATUS =')) return undefined;
        return undefined;
      },
    };
  }

  async batch(stmts) { for (const s of stmts) { try { await s.run(); } catch (e) {} } }
}

async function getWorker() {
  const workerUrl = new URL('../dist/server/index.js', import.meta.url);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

test('permissions: area-based access control', async () => {
  const mock = new MockDB();
  globalThis.__CF_ENV = { DB: mock };
  const worker = (await getWorker());

  // Initial GET as owner to fetch seeded products/areas
  const resAll = await worker.fetch(new Request('http://localhost/api/inventory'), {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(resAll.status, 200);
  const jsonAll = await resAll.json();
  const products = jsonAll.products;
  assert.ok(products.length > 0);

  // find a Cocina product and a Barra product
  const cocinaProd = products.find(p => p.area === 'Cocina');
  const barraProd = products.find(p => p.area === 'Barra');
  assert.ok(cocinaProd);
  assert.ok(barraProd);

  // Cocina-only user
  const reqC = new Request('http://localhost/api/inventory', { headers: { 'x-user-role': 'user', 'x-user-areas': 'Cocina' } });
  const resC = await worker.fetch(reqC, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(resC.status, 200);
  const jC = await resC.json();
  assert.ok(jC.products.every(p => p.area === 'Cocina'));

  // Barra-only user
  const reqB = new Request('http://localhost/api/inventory', { headers: { 'x-user-role': 'user', 'x-user-areas': 'Barra' } });
  const resB = await worker.fetch(reqB, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(resB.status, 200);
  const jB = await resB.json();
  assert.ok(jB.products.every(p => p.area === 'Barra'));

  // User with both areas
  const reqBoth = new Request('http://localhost/api/inventory', { headers: { 'x-user-role': 'user', 'x-user-areas': 'Cocina,Barra' } });
  const resBoth = await worker.fetch(reqBoth, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(resBoth.status, 200);
  const jBoth = await resBoth.json();
  const areasSeen = Array.from(new Set(jBoth.products.map(p => p.area)));
  assert.ok(areasSeen.includes('Cocina') && areasSeen.includes('Barra'));

  // Owner sees all
  const reqOwner = new Request('http://localhost/api/inventory', { headers: { 'x-user-role': 'owner' } });
  const resOwner = await worker.fetch(reqOwner, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(resOwner.status, 200);

  // Cocina user cannot register entry for a Barra product
  const entryReq = new Request('http://localhost/api/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'user', 'x-user-areas': 'Cocina' }, body: JSON.stringify({ action: 'registerEntry', productId: barraProd.id, quantity: 1, responsible: 'tester' }) });
  const entryRes = await worker.fetch(entryReq, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.notEqual(entryRes.status, 200);
  const entryJson = await entryRes.json();
  assert.ok(entryJson.error && entryJson.error.toUpperCase().includes('FORBIDDEN'));
});
