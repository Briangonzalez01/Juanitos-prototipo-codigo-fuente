import { env } from "../../env";

function database(db?: any) {
  if (db) return db;
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}

export async function updateInventoryQuantity(productId: number, quantity: number, now: string, db?: any) {
  const d = database(db);
  return d.prepare("UPDATE inventory SET current_quantity = ?, updated_at = ? WHERE product_id = ?").bind(quantity, now, productId).run();
}

export async function ensureInventoryRow(productId: number, now: string, db?: any) {
  const d = database(db);
  // insert row if missing
  await d.prepare("INSERT OR IGNORE INTO inventory (product_id, current_quantity, updated_at) VALUES (?, ?, ?)").bind(productId, 0, now).run();
}
