import * as inventoryService from "../services/inventoryService";
import { env } from "../../env";

export async function handleRegisterCount(payload: Record<string, unknown>) {
  const productId = Number(payload.productId);
  const informed = Number(payload.quantity);
  const responsible = typeof payload.responsible === "string" ? payload.responsible : "";
  const note = typeof payload.note === "string" ? payload.note : null;
  const groupId = payload.groupId ? Number(payload.groupId) : null;
  if (!productId || Number.isNaN(informed)) throw new Error("INVALID_PAYLOAD");
  return inventoryService.registerCount({ productId, informed, responsible, note, groupId, __db: (payload as any).__db });
}

export async function handleRegisterCounts(payload: Record<string, unknown>) {
  const counts = Array.isArray(payload.counts) ? (payload.counts as Array<Record<string, unknown>>) : null;
  if (!counts) throw new Error("INVALID_PAYLOAD");
  const normalized = counts.map((c) => ({ productId: Number(c.productId), quantity: Number(c.quantity), note: typeof c.note === "string" ? c.note : null, groupId: c.groupId ? Number(c.groupId) : undefined }));
  const responsible = typeof payload.responsible === "string" ? payload.responsible : "";
  const topGroupId = payload.groupId ? Number(payload.groupId) : null;
  return inventoryService.registerCountsBatch({ counts: normalized, topGroupId, responsible, __db: (payload as any).__db });
}

export async function handleRegisterEntry(payload: Record<string, unknown>) {
  const productId = Number(payload.productId);
  const quantity = Number(payload.quantity);
  const responsible = typeof payload.responsible === "string" ? payload.responsible : "";
  const note = typeof payload.note === "string" ? payload.note : null;
  const groupId = payload.groupId ? Number(payload.groupId) : null;
  if (!productId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("INVALID_PAYLOAD");
  return inventoryService.registerEntry({ productId, quantity, responsible, note, groupId, __db: (payload as any).__db });
}

export async function handleCreateProduct(payload: Record<string, unknown>) {
  const name = typeof payload.name === "string" ? payload.name : null;
  const area = typeof payload.area === "string" ? payload.area : null;
  const unit = typeof payload.unit === "string" ? payload.unit : null;
  if (!name || !area || !unit) throw new Error("INVALID_PAYLOAD");
  const internalCode = typeof payload.internalCode === "string" ? payload.internalCode : null;
  const provider = typeof payload.provider === "string" ? payload.provider : null;
  const idealStock = payload.idealStock == null ? null : Number(payload.idealStock);
  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl : null;
  const categoryId = payload.categoryId ? Number(payload.categoryId) : null;
  const groupId = payload.groupId ? Number(payload.groupId) : null;
  const quantity = payload.quantity == null ? 0 : Number(payload.quantity);
  // ensure area exists and use canonical name
  const db = (payload as any).__db ?? env.DB;
  if (!db) throw new Error("La base de datos no está disponible.");
  const areaRow = await db.prepare("SELECT id, name FROM areas WHERE name = ?").bind(area).first();
  if (!areaRow) throw new Error("AREA_NOT_FOUND");
  return inventoryService.createProduct({ name, area: areaRow.name, unit, internalCode, provider, idealStock, imageUrl, categoryId, groupId, quantity, __db: (payload as any).__db });
}

export async function handleUpdateProduct(payload: Record<string, unknown>) {
  const id = payload.id ? Number(payload.id) : null;
  const name = typeof payload.name === "string" ? payload.name : null;
  const area = typeof payload.area === "string" ? payload.area : null;
  const unit = typeof payload.unit === "string" ? payload.unit : null;
  if (!id || !name || !area || !unit) throw new Error("INVALID_PAYLOAD");
  const internalCode = typeof payload.internalCode === "string" ? payload.internalCode : null;
  const provider = typeof payload.provider === "string" ? payload.provider : null;
  const idealStock = payload.idealStock == null ? null : Number(payload.idealStock);
  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl : null;
  const categoryId = payload.categoryId ? Number(payload.categoryId) : null;
  const groupId = payload.groupId ? Number(payload.groupId) : null;
  // ensure area exists
  const db = (payload as any).__db ?? env.DB;
  if (!db) throw new Error("La base de datos no está disponible.");
  const areaRow = await db.prepare("SELECT id, name FROM areas WHERE name = ?").bind(area).first();
  if (!areaRow) throw new Error("AREA_NOT_FOUND");
  return inventoryService.updateProductService({ id, name, area: areaRow.name, unit, internalCode, provider, idealStock, imageUrl, categoryId, groupId, __db: (payload as any).__db });
}

export async function handleCleanupTestProducts() {
  const db = (() => {
    if (!env.DB) throw new Error("La base de datos no está disponible.");
    return env.DB;
  })();
  const targets = ["queso muzzarella", "tomate", "salsa de tomate", "harina"];
  const allProducts = await db.prepare("SELECT id, name FROM products").all<{ id: number; name: string }>();
  const normalized = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const toDelete: number[] = [];
  const toDeactivate: number[] = [];
  for (const p of allProducts.results) {
    const n = normalized(p.name);
    if (targets.some((t) => n.includes(t))) {
      const hasMovement = await db.prepare("SELECT 1 FROM movements WHERE product_id = ? LIMIT 1").bind(p.id).first();
      const hasPurchaseItem = await db.prepare("SELECT 1 FROM purchase_items WHERE product_id = ? LIMIT 1").bind(p.id).first();
      if (hasMovement || hasPurchaseItem) {
        await db.prepare("UPDATE products SET status = 'Inactivo', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), p.id).run();
        toDeactivate.push(p.id);
      } else {
        await db.batch([
          db.prepare("DELETE FROM inventory WHERE product_id = ?").bind(p.id),
          db.prepare("DELETE FROM purchase_items WHERE product_id = ?").bind(p.id),
          db.prepare("DELETE FROM products WHERE id = ?").bind(p.id),
        ]);
        toDelete.push(p.id);
      }
    }
  }
  return { ok: true, deleted: toDelete, deactivated: toDeactivate };
}

export async function handleImportRealCatalog() {
  const db = (() => {
    if (!env.DB) throw new Error("La base de datos no está disponible.");
    return env.DB;
  })();
  const now = new Date().toISOString();
  const categories = {
    CARNES: ["Carne", "Lomos", "Bondiola cocinada", "Paleta", "Hamburguesas", "Hamburguesa vegana"],
    PANIFICADOS: ["Pan de lomo", "Pan artesanal", "Panes Khalis"],
    CONGELADOS: ["Nuggets", "Aros de cebolla", "Crispy"],
    LACTEOS: ["Cheddar en feta", "Queso", "Bacon"],
    VERDURAS: ["Cebolla", "Pepinillos", "Maní", "Huevos"],
    SALSAS: ["Ketchup", "Mayonesa", "Pouch de ketchup", "Pouch de barbacoa", "Pouch de mayonesa", "Pouch de mostaza", "Sobres de mostaza"],
    DESCARTABLES: ["Bobina de papel", "Sobres de sal", "Servilletas", "Sobres número 7", "Papel térmico aluminio", "Papel aluminio", "Papel higiénico", "Sorbetes", "Cuchillos"],
    LIMPIEZA: ["Lavandina", "Flowers limpiapisos", "Hot Plus", "Lavavajillas", "Desengrasante Rapid Plus"],
    EQUIPAMIENTO: ["Rack"],
    ACEITE: ["Aceite"],
  } as const;

  const existingCats = await db.prepare("SELECT id, name FROM categories").all<{ id: number; name: string }>();
  const existingNames = new Set(existingCats.results.map((c) => c.name.toLowerCase()));
  const categoryIds: Record<string, number> = {};
  for (const key of Object.keys(categories)) {
    for (const name of categories[key as keyof typeof categories]) {
      const lower = name.toLowerCase();
      if (!existingNames.has(lower)) {
        const res = await db.prepare("INSERT INTO categories (name, created_at, updated_at) VALUES (?, ?, ?)").bind(name, now, now).run();
        const id = (res as any).lastInsertRowid ?? null;
        if (id) categoryIds[lower] = id;
        existingNames.add(lower);
      }
    }
  }
  const updatedCats = await db.prepare("SELECT id, name FROM categories").all<{ id: number; name: string }>();
  for (const c of updatedCats.results) categoryIds[c.name.toLowerCase()] = c.id;

  const productsToCreate: Array<{ name: string; area: string; unit: string; category: string }> = [
    { name: "Cheddar en feta", area: "Cocina", unit: "Kg", category: "cheddar en feta" },
    { name: "Bacon", area: "Cocina", unit: "Kg", category: "bacon" },
    { name: "Bobina de papel", area: "Cocina", unit: "Rollo", category: "bobina de papel" },
    { name: "Carne", area: "Cocina", unit: "Kg", category: "carne" },
    { name: "Rack", area: "Cocina", unit: "Unidad", category: "rack" },
    { name: "Sobres de sal", area: "Barra", unit: "Paquete", category: "sobres de sal" },
    { name: "Servilletas", area: "Cocina", unit: "Paquete", category: "servilletas" },
    { name: "Lavandina", area: "Cocina", unit: "Litro", category: "lavandina" },
    { name: "Flowers limpiapisos", area: "Cocina", unit: "Litro", category: "flowers limpiapisos" },
    { name: "Hot Plus", area: "Cocina", unit: "Litro", category: "hot plus" },
    { name: "Lavavajillas", area: "Cocina", unit: "Litro", category: "lavavajillas" },
    { name: "Desengrasante Rapid Plus", area: "Cocina", unit: "Litro", category: "desengrasante rapid plus" },
    { name: "Papel higiénico", area: "Cocina", unit: "Paquete", category: "papel higiénico" },
    { name: "Sobres número 7", area: "Cocina", unit: "Paquete", category: "sobres número 7" },
    { name: "Papel térmico aluminio", area: "Cocina", unit: "Rollo", category: "papel térmico aluminio" },
    { name: "Papel aluminio", area: "Cocina", unit: "Rollo", category: "papel aluminio" },
    { name: "Cebolla", area: "Cocina", unit: "Kg", category: "cebolla" },
    { name: "Aceite", area: "Cocina", unit: "Litro", category: "aceite" },
    { name: "Maní", area: "Cocina", unit: "Kg", category: "maní" },
    { name: "Cuchillos", area: "Cocina", unit: "Unidad", category: "cuchillos" },
    { name: "Sorbetes", area: "Barra", unit: "Paquete", category: "sorbetes" },
    { name: "Ketchup", area: "Cocina", unit: "Litro", category: "ketchup" },
    { name: "Mayonesa", area: "Barra", unit: "Litro", category: "mayonesa" },
    { name: "Sobres de mostaza", area: "Barra", unit: "Paquete", category: "sobres de mostaza" },
    { name: "Lomos", area: "Cocina", unit: "Kg", category: "lomos" },
    { name: "Huevos", area: "Cocina", unit: "Caja", category: "huevos" },
    { name: "Hamburguesa vegana", area: "Cocina", unit: "Unidad", category: "hamburguesa vegana" },
    { name: "Nuggets", area: "Papas", unit: "Bolsa", category: "nuggets" },
    { name: "Aros de cebolla", area: "Papas", unit: "Bolsa", category: "aros de cebolla" },
    { name: "Crispy", area: "Papas", unit: "Bolsa", category: "crispy" },
    { name: "Bondiola cocinada", area: "Cocina", unit: "Kg", category: "bondiola cocinada" },
    { name: "Pepinillos", area: "Cocina", unit: "Paquete", category: "pepinillos" },
    { name: "Pan de lomo", area: "Panes", unit: "Unidad", category: "pan de lomo" },
    { name: "Pan artesanal", area: "Panes", unit: "Unidad", category: "pan artesanal" },
    { name: "Panes Khalis", area: "Panes", unit: "Paquete", category: "panes khalis" },
    { name: "Pouch de ketchup", area: "Cocina", unit: "Pouch", category: "pouch de ketchup" },
    { name: "Pouch de barbacoa", area: "Cocina", unit: "Pouch", category: "pouch de barbacoa" },
    { name: "Pouch de mayonesa", area: "Cocina", unit: "Pouch", category: "pouch de mayonesa" },
    { name: "Pouch de mostaza", area: "Cocina", unit: "Pouch", category: "pouch de mostaza" },
    { name: "Queso", area: "Cocina", unit: "Kg", category: "queso" },
    { name: "Paleta", area: "Cocina", unit: "Kg", category: "paleta" },
    { name: "Hamburguesas", area: "Cocina", unit: "Unidad", category: "hamburguesas" },
  ];

  const normalizedName = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const created: number[] = [];
  const duplicates: string[] = [];
  const existing = await db.prepare("SELECT id, name, area FROM products").all<{ id: number; name: string; area: string }>();
  const existingKeys = new Set(existing.results.map((p) => `${p.area}:${normalizedName(p.name)}`));

  for (const prod of productsToCreate) {
    const key = `${prod.area}:${normalizedName(prod.name)}`;
    if (existingKeys.has(key)) {
      duplicates.push(prod.name);
      continue;
    }
    const catId = categoryIds[prod.category.toLowerCase()] ?? null;
    const res = await db.prepare("INSERT INTO products (name, area, unit, category_id, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, ?, 'Activo')").bind(prod.name, prod.area, prod.unit, catId, now, now).run();
    const id = (res as any).lastInsertRowid ?? null;
    if (id) {
      await db.prepare("INSERT INTO inventory (product_id, current_quantity, updated_at) VALUES (?, ?, ?)").bind(id, 0, now).run();
      created.push(id);
    }
  }

  return { ok: true, createdCount: created.length, createdIds: created, duplicates };
}

export async function handleAddPurchaseItem(payload: Record<string, unknown>) {
  const db = (() => {
    if (!env.DB) throw new Error("La base de datos no está disponible.");
    return env.DB;
  })();
  const productId = payload.productId ? Number(payload.productId) : null;
  const quantity = payload.quantity ? Number(payload.quantity) : null;
  const responsible = typeof payload.responsible === "string" ? payload.responsible.trim() : null;
  const note = typeof payload.note === "string" ? payload.note.trim() : null;
  if (!productId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("INVALID_PAYLOAD");
  if (!responsible) throw new Error("INVALID_PAYLOAD");
  const product = await db.prepare("SELECT id, name, area FROM products WHERE id = ?").bind(productId).first<{ id: number; name: string; area: string }>();
  if (!product) throw new Error("El producto seleccionado ya no existe.");
  const openRequest = await db.prepare("SELECT id FROM purchase_requests WHERE status = 'Abierta' ORDER BY id DESC LIMIT 1").first<{ id: number }>();
  if (!openRequest) throw new Error("No hay una Solicitud de compra abierta.");
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO purchase_items
    (request_id, product_id, product_name, quantity, area, responsible, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(openRequest.id, product.id, product.name, quantity, product.area, responsible, note || null, now)
    .run();
  return { ok: true };
}

export async function handleCloseRequest() {
  const db = (() => {
    if (!env.DB) throw new Error("La base de datos no está disponible.");
    return env.DB;
  })();
  const openRequest = await db.prepare("SELECT id FROM purchase_requests WHERE status = 'Abierta' ORDER BY id DESC LIMIT 1").first<{ id: number }>();
  if (!openRequest) throw new Error("No hay una Solicitud de compra abierta.");
  const now = new Date().toISOString();
  await db.prepare("UPDATE purchase_requests SET status = 'Cerrada', closed_at = ? WHERE id = ?").bind(now, openRequest.id).run();
  return { ok: true };
}

export async function handleOpenRequest() {
  const db = (() => {
    if (!env.DB) throw new Error("La base de datos no está disponible.");
    return env.DB;
  })();
  const existing = await db.prepare("SELECT id FROM purchase_requests WHERE status = 'Abierta' LIMIT 1").first<{ id: number }>();
  if (existing) throw new Error("Ya existe una Solicitud de compra abierta.");
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO purchase_requests (status, created_at) VALUES ('Abierta', ?)").bind(now).run();
  return { ok: true };
}

export async function handleCreateArea(payload: Record<string, unknown>) {
  const db = (() => {
    if (!env.DB) throw new Error("La base de datos no está disponible.");
    return env.DB;
  })();
  const name = typeof payload.name === "string" ? payload.name.trim() : null;
  const emoji = typeof payload.emoji === "string" ? payload.emoji.trim() : null;
  if (!name) throw new Error("INVALID_PAYLOAD");
  const now = new Date().toISOString();
  const res = await db.prepare("INSERT INTO areas (name, emoji, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(name, emoji, 1, now, now).run();
  return { ok: true, id: (res as any).lastInsertRowid ?? null };
}

export async function handleUpdateArea(payload: Record<string, unknown>) {
  const db = (() => {
    if (!env.DB) throw new Error("La base de datos no está disponible.");
    return env.DB;
  })();
  const id = payload.id ? Number(payload.id) : null;
  const name = typeof payload.name === "string" ? payload.name.trim() : null;
  const emoji = typeof payload.emoji === "string" ? payload.emoji.trim() : null;
  const active = typeof payload.active === "boolean" ? (payload.active ? 1 : 0) : null;
  if (!id || !name) throw new Error("INVALID_PAYLOAD");
  const now = new Date().toISOString();
  await db.prepare("UPDATE areas SET name = ?, emoji = ?, active = ?, updated_at = ? WHERE id = ?").bind(name, emoji, active ?? 1, now, id).run();
  return { ok: true };
}

export async function handleToggleArea(payload: Record<string, unknown>) {
  const db = (() => {
    if (!env.DB) throw new Error("La base de datos no está disponible.");
    return env.DB;
  })();
  const id = payload.id ? Number(payload.id) : null;
  if (!id) throw new Error("INVALID_PAYLOAD");
  const row = await db.prepare("SELECT active FROM areas WHERE id = ?").bind(id).first<{ active: number }>();
  if (!row) throw new Error("NOT_FOUND");
  const now = new Date().toISOString();
  await db.prepare("UPDATE areas SET active = ?, updated_at = ? WHERE id = ?").bind(row.active ? 0 : 1, now, id).run();
  return { ok: true };
}
