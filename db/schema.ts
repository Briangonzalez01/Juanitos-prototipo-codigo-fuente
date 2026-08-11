import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    area: text("area").notNull(),
    unit: text("unit").notNull(),
    status: text("status").notNull().default("Activo"),
    internalCode: text("internal_code"),
    provider: text("provider"),
    idealStock: real("ideal_stock"),
    imageUrl: text("image_url"),
    categoryId: integer("category_id"),
    groupId: integer("group_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_products_area_name").on(table.area, table.name)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const inventory = sqliteTable(
  "inventory",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull(),
    currentQuantity: real("current_quantity").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_inventory_product_id").on(table.productId)],
);

export const countGroups = sqliteTable(
  "count_groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    sector: text("sector").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
);

export const purchaseRequests = sqliteTable(
  "purchase_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [index("idx_purchase_requests_status").on(table.status)],
);

export const purchaseItems = sqliteTable(
  "purchase_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id").notNull(),
    productId: integer("product_id"),
    productName: text("product_name").notNull(),
    quantity: real("quantity").notNull(),
    area: text("area").notNull(),
    responsible: text("responsible").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_purchase_items_request_id").on(table.requestId)],
);

export const movements = sqliteTable(
  "movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id"),
    productName: text("product_name").notNull(),
    area: text("area").notNull(),
    responsible: text("responsible").notNull(),
    type: text("type").notNull(),
    previousQuantity: real("previous_quantity").notNull(),
    informedQuantity: real("informed_quantity").notNull(),
    difference: real("difference"),
    newQuantity: real("new_quantity").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_movements_area_created_at").on(table.area, table.createdAt),
    index("idx_movements_product_id").on(table.productId),
  ],
);
