import { env } from "../../env";

function database(db?: any) {
  if (db) return db;
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}

export async function insertMovement(params: {
  productId: number;
  productName: string;
  area: string;
  responsible: string;
  type: string;
  previousQuantity: number;
  informedQuantity: number;
  difference: number | null;
  newQuantity: number;
  note?: string | null;
  groupName?: string | null;
  createdAt: string;
}) {
  const db = database((params as any).__db);
  return db
    .prepare(`INSERT INTO movements (product_id, product_name, area, responsible, type, previous_quantity, informed_quantity, difference, new_quantity, note, group_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      params.productId,
      params.productName,
      params.area,
      params.responsible,
      params.type,
      params.previousQuantity,
      params.informedQuantity,
      params.difference,
      params.newQuantity,
      params.note || null,
      params.groupName || null,
      params.createdAt,
    )
    .run();
}
