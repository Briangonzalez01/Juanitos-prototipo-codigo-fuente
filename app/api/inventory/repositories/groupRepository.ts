import { env } from "../../env";

function database(db?: any) {
  if (db) return db;
  if (!env.DB) throw new Error("La base de datos no está disponible.");
  return env.DB;
}

export async function findGroupById(id: number, db?: any) {
  const d = database(db);
  return d.prepare("SELECT * FROM count_groups WHERE id = ?").bind(id).first();
}

export async function listGroups() {
  const db = database();
  return db.prepare("SELECT * FROM count_groups ORDER BY sector, name COLLATE NOCASE").all();
}
