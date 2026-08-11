CREATE TABLE `movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`area` text NOT NULL,
	`responsible` text NOT NULL,
	`type` text NOT NULL,
	`previous_quantity` real NOT NULL,
	`informed_quantity` real NOT NULL,
	`difference` real,
	`new_quantity` real NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_movements_area_created_at` ON `movements` (`area`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_movements_product_id` ON `movements` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`area` text NOT NULL,
	`unit` text NOT NULL,
	`current_quantity` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_products_area_name` ON `products` (`area`,`name`);--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`quantity` real NOT NULL,
	`area` text NOT NULL,
	`responsible` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_items_request_id` ON `purchase_items` (`request_id`);--> statement-breakpoint
CREATE TABLE `purchase_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_purchase_requests_status` ON `purchase_requests` (`status`);