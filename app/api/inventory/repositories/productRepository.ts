import { env } from "../../env";

function database(db?: any) {
  if (db) return db;
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}

export async function findProductById(id: number, db?: any) {
  const d = database(db);
  return d
    .prepare("SELECT p.*, COALESCE(i.current_quantity, 0) AS current_quantity FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = ?")
    .bind(id)
    .first();
}

export async function listProducts(db?: any, areas?: string[]) {
  const d = database(db);
  if (!areas || !areas.length) {
    return d.prepare("SELECT p.*, COALESCE(i.current_quantity, 0) AS current_quantity FROM products p LEFT JOIN inventory i ON i.product_id = p.id ORDER BY p.area, p.name COLLATE NOCASE").all();
  }
  // Build placeholders for the IN clause
  const placeholders = areas.map(() => "?").join(",");
  const sql = `SELECT p.*, COALESCE(i.current_quantity, 0) AS current_quantity FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.area IN (${placeholders}) ORDER BY p.area, p.name COLLATE NOCASE`;
  return d.prepare(sql).bind(...areas).all();
}

export async function createProduct(data: {
  name: string;
  area: string;
  unit: string;
  internalCode?: string | null;
  provider?: string | null;
  idealStock?: number | null;
  imageUrl?: string | null;
  categoryId?: number | null;
  groupId?: number | null;
  createdAt: string;
  updatedAt: string;
}) {
  const db = database((data as any).__db);
  const res = await db
    .prepare("INSERT INTO products (name, area, unit, internal_code, provider, ideal_stock, image_url, category_id, group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(data.name, data.area, data.unit, data.internalCode ?? null, data.provider ?? null, data.idealStock ?? null, data.imageUrl ?? null, data.categoryId ?? null, data.groupId ?? null, data.createdAt, data.updatedAt)
    .run();
  return (res as any).lastInsertRowid ?? null;
}

export async function updateProduct(data: {
  id: number;
  name: string;
  area: string;
  unit: string;
  internalCode?: string | null;
  provider?: string | null;
  idealStock?: number | null;
  imageUrl?: string | null;
  categoryId?: number | null;
  groupId?: number | null;
  updatedAt: string;
}) {
  const db = database((data as any).__db);
  return db
    .prepare("UPDATE products SET name = ?, area = ?, unit = ?, internal_code = ?, provider = ?, ideal_stock = ?, image_url = ?, category_id = ?, group_id = ?, updated_at = ? WHERE id = ?")
    .bind(data.name, data.area, data.unit, data.internalCode ?? null, data.provider ?? null, data.idealStock ?? null, data.imageUrl ?? null, data.categoryId ?? null, data.groupId ?? null, data.updatedAt, data.id)
    .run();
}
