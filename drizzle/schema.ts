import { pgTable, foreignKey, unique, timestamp, text, integer, boolean, real, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const imageEditFunction = pgEnum("image_edit_function", ['stylization_all', 'stylization_local', 'description_edit', 'description_edit_with_mask', 'remove_watermark', 'expand', 'super_resolution', 'colorization', 'doodle', 'control_cartoon_feature'])
export const taskStatus = pgEnum("task_status", ['pending', 'running', 'succeeded', 'failed'])
export const type = pgEnum("type", ['image', 'video'])


export const session = pgTable("session", {
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	id: text().primaryKey().notNull(),
	ipAddress: text("ip_address"),
	token: text().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const twoFactor = pgTable("two_factor", {
	backupCodes: text("backup_codes").notNull(),
	id: text().primaryKey().notNull(),
	secret: text().notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "two_factor_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const account = pgTable("account", {
	accessToken: text("access_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	accountId: text("account_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	id: text().primaryKey().notNull(),
	idToken: text("id_token"),
	password: text(),
	providerId: text("provider_id").notNull(),
	refreshToken: text("refresh_token"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	createdAt: timestamp("created_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	value: text().notNull(),
});

export const user = pgTable("user", {
	age: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").notNull(),
	firstName: text("first_name"),
	id: text().primaryKey().notNull(),
	image: text(),
	lastName: text("last_name"),
	name: text().notNull(),
	twoFactorEnabled: boolean("two_factor_enabled"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const uploads = pgTable("uploads", {
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	id: text().primaryKey().notNull(),
	key: text().notNull(),
	type: type().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	url: text().notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "uploads_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const polarSubscription = pgTable("polar_subscription", {
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	id: text().primaryKey().notNull(),
	customerId: text("customer_id").notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	userId: text("user_id").notNull(),
	productId: text("product_id").notNull(),
	status: text().notNull(),
	subscriptionId: text("subscription_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "polar_subscription_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("polar_subscription_subscription_id_unique").on(table.subscriptionId),
]);

export const polarCustomer = pgTable("polar_customer", {
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	customerId: text("customer_id").notNull(),
	id: text().primaryKey().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "polar_customer_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("polar_customer_customer_id_unique").on(table.customerId),
]);

export const imageEditTasks = pgTable("image_edit_tasks", {
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	editFunction: imageEditFunction("edit_function").notNull(),
	errorMessage: text("error_message"),
	id: text().primaryKey().notNull(),
	imageCount: integer("image_count").default(1).notNull(),
	maskImageUrl: text("mask_image_url"),
	originalImageId: text("original_image_id"),
	prompt: text().notNull(),
	status: taskStatus().default('pending').notNull(),
	strength: real(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").notNull(),
	wanxTaskId: text("wanx_task_id").notNull(),
	originalImageUrl: text("original_image_url"),
}, (table) => [
	foreignKey({
			columns: [table.originalImageId],
			foreignColumns: [uploads.id],
			name: "image_edit_tasks_original_image_id_uploads_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "image_edit_tasks_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const imageEditResults = pgTable("image_edit_results", {
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	id: text().primaryKey().notNull(),
	resultImageUrl: text("result_image_url").notNull(),
	savedImageId: text("saved_image_id"),
	taskId: text("task_id").notNull(),
	liveportraitCompatible: boolean("liveportrait_compatible"),
	liveportraitDetectedAt: timestamp("liveportrait_detected_at", { mode: 'string' }),
	liveportraitMessage: text("liveportrait_message"),
	liveportraitRequestId: text("liveportrait_request_id"),
}, (table) => [
	foreignKey({
			columns: [table.savedImageId],
			foreignColumns: [uploads.id],
			name: "image_edit_results_saved_image_id_uploads_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [imageEditTasks.id],
			name: "image_edit_results_task_id_image_edit_tasks_id_fk"
		}).onDelete("cascade"),
]);
