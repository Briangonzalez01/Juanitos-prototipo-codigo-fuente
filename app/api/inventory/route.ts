import { env } from "../env";

type Area = "Cocina" | "Barra";

type ProductRow = {
  id: number;
  name: string;
  area: Area;
  unit: string;
  internal_code?: string | null;
  provider?: string | null;
  ideal_stock?: number | null;
  image_url?: string | null;
  category_id?: number | null;
  current_quantity: number;
  created_at: string;
  updated_at: string;
};

type RequestRow = {
  id: number;
  status: "Abierta" | "Cerrada";
  created_at: string;
  closed_at: string | null;
};

const seedProducts = [
  ["Harina", "Cocina", "Bolsa", 3],
  ["Queso muzzarella", "Cocina", "Kg", 5],
  ["Salsa de tomate", "Cocina", "Lata", 8],
  ["Coca-Cola 1,5 L", "Barra", "Botella", 12],
  ["Cerveza rubia", "Barra", "Botella", 24],
  ["Servilletas", "Barra", "Paquete", 6],
  ["Hamburguesa vegana", "Cocina", "Unidad", 0],
  ["Nuggets", "Cocina", "Bolsa", 0],
  ["Crispy", "Cocina", "Caja", 0],
  ["Patitas de pollo", "Cocina", "Bolsa", 0],
  ["Aros de cebolla", "Cocina", "Bolsa", 0],
  ["Papas fritas", "Cocina", "Bolsa", 0],
  ["Pan hamburguesa", "Cocina", "Unidad", 0],
  ["Pan de lomo", "Cocina", "Unidad", 0],
  ["Pan artesanal", "Cocina", "Bolsa", 0],
  ["Ketchup", "Barra", "Caja", 0],
] as const;

function database() {
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}

async function ensureDatabase() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area TEXT NOT NULL,
      unit TEXT NOT NULL,
      internal_code TEXT,
      provider TEXT,
      ideal_stock REAL,
      image_url TEXT,
      category_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      current_quantity REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      closed_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      area TEXT NOT NULL,
      responsible TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      area TEXT NOT NULL,
      responsible TEXT NOT NULL,
      type TEXT NOT NULL,
      previous_quantity REAL NOT NULL,
      informed_quantity REAL NOT NULL,
      difference REAL,
      new_quantity REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_products_area_name ON products(area, name)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_purchase_items_request_id ON purchase_items(request_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_movements_area_created_at ON movements(area, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_movements_product_id ON movements(product_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id)"),
  ]);

  // Ensure `status` column exists (for migrations from earlier versions)
  try {
    await db.prepare("ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'Activo'").run();
  } catch (e) {
    // ignore if column already exists or DB doesn't support alter in this context
  }
  // Ensure `category_id` column exists
  try {
    await db.prepare("ALTER TABLE products ADD COLUMN category_id INTEGER").run();
  } catch (e) {
    // ignore if already exists
  }
  // Ensure `internal_code`, `provider`, `ideal_stock`, `image_url` columns exist
  try {
    await db.prepare("ALTER TABLE products ADD COLUMN internal_code TEXT").run();
  } catch (e) {}
  try {
    await db.prepare("ALTER TABLE products ADD COLUMN provider TEXT").run();
  } catch (e) {}
  try {
    await db.prepare("ALTER TABLE products ADD COLUMN ideal_stock REAL").run();
  } catch (e) {}
  try {
    await db.prepare("ALTER TABLE products ADD COLUMN image_url TEXT").run();
  } catch (e) {}
  // Ensure `group_id` column exists on products
  try {
    await db.prepare("ALTER TABLE products ADD COLUMN group_id INTEGER").run();
  } catch (e) {}
  // Ensure `group_name` column exists on movements
  try {
    await db.prepare("ALTER TABLE movements ADD COLUMN group_name TEXT").run();
  } catch (e) {}
  // Ensure `areas` table exists
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run();
  } catch (e) {}
  // Create count_groups table if missing
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS count_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run();
  } catch (e) {}

  const existingProducts = await db.prepare("SELECT name, area FROM products").all<Pick<ProductRow, "name" | "area">>();
  const existingProductKeys = new Set(existingProducts.results.map((product) => `${product.area}:${product.name}`));
  const missingSeedProducts = seedProducts.filter(([name, area]) => !existingProductKeys.has(`${area}:${name}`));
  if (missingSeedProducts.length) {
    const now = new Date().toISOString();
    for (const [name, area, unit, quantity] of missingSeedProducts) {
      const result = await db
        .prepare("INSERT INTO products (name, area, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(name, area, unit, now, now)
        .run();
      const lastId = (result as any).lastInsertRowid ?? null;
      if (lastId) {
        await db.prepare("INSERT INTO inventory (product_id, current_quantity, updated_at) VALUES (?, ?, ?)").bind(lastId, quantity, now).run();
      }
    }
  }

  const requestCount = await db.prepare("SELECT COUNT(*) AS count FROM purchase_requests").first<{ count: number }>();
  if (!requestCount?.count) {
    await db
      .prepare("INSERT INTO purchase_requests (status, created_at) VALUES ('Abierta', ?)")
      .bind(new Date().toISOString())
      .run();
  }

  // Populate areas from distinct product areas if areas table is empty
  try {
    const areaCount = await db.prepare("SELECT COUNT(*) AS count FROM areas").first<{ count: number }>();
    if (areaCount && areaCount.count === 0) {
      const distinct = await db.prepare("SELECT DISTINCT area FROM products WHERE area IS NOT NULL").all<{ area: string }>();
      const now = new Date().toISOString();
      for (const d of distinct.results) {
        await db.prepare("INSERT INTO areas (name, emoji, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(d.area, null, 1, now, now).run();
      }
    }
  } catch (e) {}
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function textValue(value: unknown, field: string) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new Error(`${field} es obligatorio.`);
  return result;
}

function positiveNumber(value: unknown, field: string, allowZero = false) {
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
    throw new Error(`${field} debe ser ${allowZero ? "cero o mayor" : "mayor que cero"}.`);
  }
  return number;
}

function areaValue(value: unknown): Area {
  if (value !== "Cocina" && value !== "Barra") throw new Error("Área inválida.");
  return value as Area;
}

async function findProduct(id: number) {
  return database()
    .prepare("SELECT p.*, COALESCE(i.current_quantity, 0) AS current_quantity FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = ?")
    .bind(id)
    .first<ProductRow>();
}

export async function GET() {
  try {
    await ensureDatabase();
    const auth = await import("../middleware/auth");
    const db = database();
    const [productsResult, categoriesResult, groupsResult, areasResult, openRequest, movementsResult, archivedResult] = await Promise.all([
      db.prepare("SELECT p.*, COALESCE(i.current_quantity, 0) AS current_quantity FROM products p LEFT JOIN inventory i ON i.product_id = p.id ORDER BY p.area, p.name COLLATE NOCASE").all<ProductRow>(),
      db.prepare("SELECT * FROM categories ORDER BY name COLLATE NOCASE").all(),
      db.prepare("SELECT * FROM count_groups ORDER BY sector, name COLLATE NOCASE").all(),
      db.prepare("SELECT * FROM areas ORDER BY name COLLATE NOCASE").all(),
      db.prepare("SELECT * FROM purchase_requests WHERE status = 'Abierta' ORDER BY id DESC LIMIT 1").first<RequestRow>(),
      db.prepare("SELECT * FROM movements ORDER BY created_at DESC, id DESC LIMIT 100").all(),
      db.prepare("SELECT COUNT(*) AS count FROM purchase_requests WHERE status = 'Cerrada'").first<{ count: number }>(),
    ]);

    const items = openRequest
      ? await db
          .prepare("SELECT * FROM purchase_items WHERE request_id = ? ORDER BY created_at DESC, id DESC")
          .bind(openRequest.id)
          .all()
      : { results: [] };

    // Apply area-based permission filtering (stub via headers)
    const user = auth.getUser();
    let filteredProducts = productsResult.results;
    let filteredAreas = areasResult.results;
    if (user.role !== "owner" && user.role !== "dev" && user.role !== "admin") {
      const allowed = user.allowedAreas ?? [];
      if (allowed.length) {
        filteredProducts = filteredProducts.filter((p: any) => allowed.includes(p.area));
        filteredAreas = filteredAreas.filter((a: any) => allowed.includes(a.name));
      } else {
        // If no allowed areas specified, return empty lists (no access)
        filteredProducts = [];
        filteredAreas = [];
      }
    }

    return Response.json({
      products: filteredProducts,
      categories: categoriesResult.results,
      groups: groupsResult.results,
      areas: filteredAreas,
      openRequest: openRequest ? { ...openRequest, items: items.results } : null,
      movements: movementsResult.results,
      archivedRequestCount: archivedResult?.count ?? 0,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo cargar la información.", 500);
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    const action = textValue(payload.action, "Acción");
    const db = database();
    const now = new Date().toISOString();
    const auth = await import("../middleware/auth");

    if (action === "createCategory") {
      auth.requireAdmin(request, payload);
      const name = textValue(payload.name, "Nombre");
      await db.prepare("INSERT INTO categories (name, created_at, updated_at) VALUES (?, ?, ?)").bind(name, now, now).run();
    } else if (action === "createCountGroup") {
      auth.requireAdmin(request, payload);
      const name = textValue(payload.name, "Nombre");
      const sector = textValue(payload.sector, "Sector");
      await db.prepare("INSERT INTO count_groups (name, sector, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(name, sector, now, now).run();
    } else if (action === "createProduct") {
      const controller = await import("./controllers/inventoryController");
      auth.requireAdmin(request, payload);
      await controller.handleCreateProduct(payload);
    } else if (action === "updateProduct") {
      const controller = await import("./controllers/inventoryController");
      auth.requireAdmin(request, payload);
      await controller.handleUpdateProduct(payload);
    } else if (action === "deleteProduct") {
      auth.requireAdmin(request, payload);
      const id = positiveNumber(payload.id, "Producto");
      await db.batch([
        db.prepare("DELETE FROM inventory WHERE product_id = ?").bind(id),
        db.prepare("DELETE FROM movements WHERE product_id = ?").bind(id),
        db.prepare("DELETE FROM purchase_items WHERE product_id = ?").bind(id),
        db.prepare("DELETE FROM products WHERE id = ?").bind(id),
      ]);
    } else if (action === "registerEntry") {
      const controller = await import("./controllers/inventoryController");
      auth.requireUser(request, payload);
      await controller.handleRegisterEntry(payload);
    } else if (action === "registerCount") {
      // delegate to controller
      const controller = await import("./controllers/inventoryController");
      auth.requireUser(request, payload);
      await controller.handleRegisterCount(payload);
    } else if (action === "registerCounts") {
      const controller = await import("./controllers/inventoryController");
      auth.requireUser(request, payload);
      await controller.handleRegisterCounts(payload);
    } else if (action === "addPurchaseItem") {
      auth.requireUser(request, payload);
      const controller = await import("./controllers/inventoryController");
      const res = await controller.handleAddPurchaseItem(payload);
      return Response.json(res);
    } else if (action === "closeRequest") {
      auth.requireAdmin(request, payload);
      const controller = await import("./controllers/inventoryController");
      const res = await controller.handleCloseRequest();
      return Response.json(res);
    } else if (action === "openRequest") {
      auth.requireUser(request, payload);
      const controller = await import("./controllers/inventoryController");
      const res = await controller.handleOpenRequest();
      return Response.json(res);
    }

    if (action === "createArea") {
      auth.requireAdmin(request, payload);
      const controller = await import("./controllers/inventoryController");
      const res = await controller.handleCreateArea(payload);
      return Response.json(res);
    }

    if (action === "updateArea") {
      auth.requireAdmin(request, payload);
      const controller = await import("./controllers/inventoryController");
      const res = await controller.handleUpdateArea(payload);
      return Response.json(res);
    }

    if (action === "toggleArea") {
      auth.requireAdmin(request, payload);
      const controller = await import("./controllers/inventoryController");
      const res = await controller.handleToggleArea(payload);
      return Response.json(res);
    }

    // custom maintenance actions
    if (action === "cleanupTestProducts") {
      const controller = await import("./controllers/inventoryController");
      const res = await controller.handleCleanupTestProducts();
      return Response.json(res);
    }

    if (action === "importRealCatalog") {
      const controller = await import("./controllers/inventoryController");
      const res = await controller.handleImportRealCatalog();
      return Response.json(res);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No se pudo completar la operación.");
  }
}
