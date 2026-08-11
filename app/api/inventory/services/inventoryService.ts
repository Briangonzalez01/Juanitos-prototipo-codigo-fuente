import * as productRepo from "../repositories/productRepository";
import * as inventoryRepo from "../repositories/inventoryRepository";
import * as movementRepo from "../repositories/movementRepository";
import * as groupRepo from "../repositories/groupRepository";

export async function registerCount(params: {
  productId: number;
  informed: number;
  responsible: string;
  note?: string | null;
  groupId?: number | null;
  __db?: any;
}) {
  const now = new Date().toISOString();
  const product = await productRepo.findProductById(params.productId, params.__db);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const previous = Number(product.current_quantity ?? 0);
  const informed = Number(params.informed);
  const difference = informed - previous;
  const type = difference > 0 ? "Ingreso por diferencia de conteo" : difference < 0 ? "Egreso por diferencia de conteo" : "Conteo sin variación";
  let groupName: string | null = null;
  if (params.groupId) {
    const g = await groupRepo.findGroupById(params.groupId, params.__db);
    groupName = g?.name ?? null;
  }

  // ensure inventory row exists
  await inventoryRepo.ensureInventoryRow(params.productId, now, params.__db);

  // perform update and insert movement
  await inventoryRepo.updateInventoryQuantity(params.productId, informed, now, params.__db);
  await movementRepo.insertMovement({
    productId: params.productId,
    productName: product.name,
    area: product.area,
    responsible: params.responsible,
    type,
    previousQuantity: previous,
    informedQuantity: informed,
    difference,
    newQuantity: informed,
    note: params.note || null,
    groupName,
    createdAt: now,
  });

  return { productId: params.productId, previous, informed, difference };
}

export async function registerCountsBatch(params: { counts: Array<{ productId: number; quantity: number; note?: string | null; groupId?: number | null }>; topGroupId?: number | null; responsible: string; __db?: any }) {
  const results: Array<any> = [];
  for (const item of params.counts) {
    try {
      const res = await registerCount({ productId: item.productId, informed: item.quantity, responsible: params.responsible, note: item.note ?? null, groupId: item.groupId ?? params.topGroupId ?? null });
      results.push({ ok: true, ...res });
    } catch (e) {
      results.push({ ok: false, error: (e instanceof Error ? e.message : String(e)), productId: item.productId });
    }
  }
  return results;
}

export async function registerEntry(params: { productId: number; quantity: number; responsible: string; note?: string | null; groupId?: number | null; __db?: any }) {
  const now = new Date().toISOString();
  const product = await productRepo.findProductById(params.productId, params.__db);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const previous = Number(product.current_quantity ?? 0);
  const informed = Number(params.quantity);
  if (!Number.isFinite(informed) || informed <= 0) throw new Error("INVALID_QUANTITY");
  const next = previous + informed;

  let groupName: string | null = null;
  if (params.groupId) {
    const g = await groupRepo.findGroupById(params.groupId, params.__db);
    groupName = g?.name ?? null;
  }

  await inventoryRepo.ensureInventoryRow(params.productId, now, params.__db);
  await inventoryRepo.updateInventoryQuantity(params.productId, next, now, params.__db);
  await movementRepo.insertMovement({
    productId: params.productId,
    productName: product.name,
    area: product.area,
    responsible: params.responsible,
    type: 'Ingreso de mercadería',
    previousQuantity: previous,
    informedQuantity: informed,
    difference: informed,
    newQuantity: next,
    note: params.note || null,
    groupName,
    createdAt: now,
  });

  return { productId: params.productId, previous, informed, next };
}

export async function createProduct(params: {
  name: string;
  area: string;
  unit: string;
  internalCode?: string | null;
  provider?: string | null;
  idealStock?: number | null;
  imageUrl?: string | null;
  categoryId?: number | null;
  groupId?: number | null;
  quantity?: number;
  __db?: any;
}) {
  const now = new Date().toISOString();
  const id = await productRepo.createProduct({
    name: params.name,
    area: params.area,
    unit: params.unit,
    internalCode: params.internalCode ?? null,
    provider: params.provider ?? null,
    idealStock: params.idealStock ?? null,
    imageUrl: params.imageUrl ?? null,
    categoryId: params.categoryId ?? null,
    groupId: params.groupId ?? null,
    createdAt: now,
    updatedAt: now,
    __db: params.__db,
  });
  if (!id) throw new Error("CREATE_FAILED");
  const qty = params.quantity ?? 0;
  await inventoryRepo.ensureInventoryRow(Number(id), now, params.__db);
  await inventoryRepo.updateInventoryQuantity(Number(id), qty, now, params.__db);
  return Number(id);
}

export async function updateProductService(params: {
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
  __db?: any;
}) {
  const now = new Date().toISOString();
  await productRepo.updateProduct({
    id: params.id,
    name: params.name,
    area: params.area,
    unit: params.unit,
    internalCode: params.internalCode ?? null,
    provider: params.provider ?? null,
    idealStock: params.idealStock ?? null,
    imageUrl: params.imageUrl ?? null,
    categoryId: params.categoryId ?? null,
    groupId: params.groupId ?? null,
    updatedAt: now,
    __db: params.__db,
  });
  return { ok: true };
}
