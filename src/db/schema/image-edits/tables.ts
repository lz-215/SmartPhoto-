import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { uploadsTable } from "../uploads/tables";
import { userTable } from "../users/tables";

// 图像编辑功能枚举
export const imageEditFunctionEnum = pgEnum("image_edit_function", [
  "stylization_all",
  "stylization_local",
  "description_edit",
  "description_edit_with_mask",
  "remove_watermark",
  "expand",
  "super_resolution",
  "colorization",
  "doodle",
  "control_cartoon_feature",
]);

// 任务状态枚举
export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

// 图像编辑任务表
export const imageEditTasksTable = pgTable("image_edit_tasks", {
  completedAt: timestamp("completed_at"), // 任务完成时间
  // 时间戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // 编辑参数
  editFunction: imageEditFunctionEnum("edit_function").notNull(),

  errorMessage: text("error_message"), // 错误信息
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  imageCount: integer("image_count").default(1).notNull(), // 生成图片数量
  maskImageUrl: text("mask_image_url"), // 蒙版图片URL（可选）
  originalImageId: text("original_image_id").references(() => uploadsTable.id, {
    onDelete: "cascade",
  }), // 改为可选
  originalImageUrl: text("original_image_url"), // 新增：直接使用图片URL

  prompt: text("prompt").notNull(),
  scaleFactor: integer("scale_factor"), // 图像超分的放大倍数
  status: taskStatusEnum("status").default("pending").notNull(),
  strength: real("strength"), // 编辑强度 0.1-1.0

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  // 任务状态
  wanxTaskId: text("wanx_task_id").notNull(), // 通义万象任务ID
});

// 编辑结果表
export const imageEditResultsTable = pgTable("image_edit_results", {
  // 时间戳
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  // LivePortrait检测相关字段
  livePortraitCompatible: boolean("liveportrait_compatible"), // 是否兼容LivePortrait
  livePortraitDetectedAt: timestamp("liveportrait_detected_at"), // 检测时间
  livePortraitMessage: text("liveportrait_message"), // 检测消息
  livePortraitRequestId: text("liveportrait_request_id"), // API请求ID

  // 结果图片信息
  resultImageUrl: text("result_image_url").notNull(), // 通义万象返回的图片URL
  savedImageId: text("saved_image_id").references(() => uploadsTable.id, {
    onDelete: "set null",
  }), // 保存到本地存储后的图片ID

  taskId: text("task_id")
    .notNull()
    .references(() => imageEditTasksTable.id, { onDelete: "cascade" }),
});
