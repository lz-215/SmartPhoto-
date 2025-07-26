import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type { imageEditResultsTable, imageEditTasksTable } from "./tables";

// 图像编辑功能类型
export type ImageEditFunction =
  | "colorization"
  | "control_cartoon_feature"
  | "description_edit"
  | "description_edit_with_mask"
  | "doodle"
  | "expand"
  | "remove_watermark"
  | "stylization_all"
  | "stylization_local"
  | "super_resolution";
// 图像编辑请求类型
export interface ImageEditRequest {
  editFunction: ImageEditFunction;
  imageCount?: number;
  maskImageUrl?: string;
  originalImageUrl: string;
  prompt: string;
  scaleFactor?: number; // 图像超分的放大倍数
  strength?: number;
}

// 图像编辑响应类型
export interface ImageEditResponse {
  errorMessage?: string;
  results?: {
    id: string;
    resultImageUrl: string;
    savedImageId?: string;
  }[];
  status: TaskStatus;
  taskId: string;
}
// 图像编辑结果类型
export type ImageEditResult = InferSelectModel<typeof imageEditResultsTable>;

// 图像编辑任务类型
export type ImageEditTask = InferSelectModel<typeof imageEditTasksTable>;

export type NewImageEditResult = InferInsertModel<typeof imageEditResultsTable>;

export type NewImageEditTask = InferInsertModel<typeof imageEditTasksTable>;

// 任务状态类型
export type TaskStatus = "failed" | "pending" | "running" | "succeeded";
