import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";

import { db } from "~/db";
import {
  type ImageEditRequest,
  type ImageEditResponse,
  imageEditResultsTable,
  type ImageEditTask,
  imageEditTasksTable,
  type TaskStatus,
  uploadsTable,
} from "~/db/schema";
import { uploadToS3 } from "~/lib/s3";
import {
  type WanxImageEditFunction,
  wanxImageEditService,
} from "~/lib/wanx-image-edit";

/**
 * 创建图像编辑任务
 */
export async function createImageEditTask(
  userId: string,
  request: ImageEditRequest,
): Promise<ImageEditResponse> {
  try {
    // 直接使用传入的图片URL，不再需要验证数据库中的图片
    const originalImageUrl = request.originalImageUrl;

    // 调用通义万象API创建编辑任务
    const wanxResponse = await wanxImageEditService.createEditTask({
      base_image_url: originalImageUrl,
      function: request.editFunction as WanxImageEditFunction,
      mask_image_url: request.maskImageUrl,
      n: request.imageCount || 1,
      prompt: request.prompt,
      strength: request.strength,
      upscale_factor: request.scaleFactor,
    });

    // 保存任务到数据库
    const taskId = createId();
    await db.insert(imageEditTasksTable).values({
      editFunction: request.editFunction,
      id: taskId,
      imageCount: request.imageCount || 1,
      maskImageUrl: request.maskImageUrl,
      originalImageUrl: request.originalImageUrl,
      prompt: request.prompt,
      scaleFactor: request.scaleFactor,
      status: "pending",
      strength: request.strength,
      userId,
      wanxTaskId: wanxResponse.output.task_id,
    });

    return {
      status: "pending",
      taskId,
    };
  } catch (error) {
    console.error("create image edit task error:", error);
    throw new Error(
      `failed to create image edit task: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * 删除图像编辑任务
 */
export async function deleteImageEditTask(
  userId: string,
  taskId: string,
): Promise<void> {
  try {
    // 验证任务所有权
    const task = await db.query.imageEditTasksTable.findFirst({
      where: and(
        eq(imageEditTasksTable.id, taskId),
        eq(imageEditTasksTable.userId, userId),
      ),
    });

    if (!task) {
      throw new Error("task not found or access denied");
    }

    // 删除任务（级联删除结果）
    await db
      .delete(imageEditTasksTable)
      .where(eq(imageEditTasksTable.id, taskId));
  } catch (error) {
    console.error("delete image edit task error:", error);
    throw new Error(
      `failed to delete task: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * 查询任务状态
 */
export async function getImageEditTaskStatus(
  userId: string,
  taskId: string,
): Promise<ImageEditResponse> {
  try {
    // 查询任务信息
    const task = await db.query.imageEditTasksTable.findFirst({
      where: and(
        eq(imageEditTasksTable.id, taskId),
        eq(imageEditTasksTable.userId, userId),
      ),
      with: {
        results: true,
      },
    });

    if (!task) {
      throw new Error("task not found or access denied");
    }

    // 如果任务已完成，直接返回结果
    if (task.status === "succeeded" || task.status === "failed") {
      return {
        errorMessage: task.errorMessage || undefined,
        results: task.results.map((result) => ({
          id: result.id,
          // LivePortrait检测结果
          livePortraitCompatible: result.livePortraitCompatible,
          livePortraitDetectedAt: result.livePortraitDetectedAt,
          livePortraitMessage: result.livePortraitMessage,
          resultImageUrl: result.resultImageUrl,
          savedImageId: result.savedImageId || undefined,
        })),
        status: task.status,
        taskId: task.id,
      };
    }

    // 查询通义万象任务状态
    const wanxResult = await wanxImageEditService.queryTask(task.wanxTaskId);
    const newStatus = mapWanxStatusToTaskStatus(wanxResult.output.task_status);

    // 更新任务状态
    await db
      .update(imageEditTasksTable)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === "succeeded" && { completedAt: new Date() }),
        ...(newStatus === "failed" && {
          completedAt: new Date(),
          errorMessage: wanxResult.output.message || "unknown error",
        }),
      })
      .where(eq(imageEditTasksTable.id, taskId));

    // 如果任务成功完成，保存结果
    if (newStatus === "succeeded" && wanxResult.output.results) {
      const results = [];
      for (const result of wanxResult.output.results) {
        const resultId = createId();
        await db.insert(imageEditResultsTable).values({
          id: resultId,
          resultImageUrl: result.url,
          taskId,
        });

        results.push({
          id: resultId,
          // LivePortrait检测结果将通过异步调用更新
          livePortraitCompatible: null,
          livePortraitDetectedAt: null,
          livePortraitMessage: null,
          resultImageUrl: result.url,
        });
      }

      return {
        results,
        status: newStatus,
        taskId,
      };
    }

    return {
      errorMessage:
        newStatus === "failed" ? wanxResult.output.message : undefined,
      status: newStatus,
      taskId,
    };
  } catch (error) {
    console.error("get image edit task status error:", error);
    throw new Error(
      `failed to get task status: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * 根据结果ID获取任务信息（用于重试）
 */
export async function getTaskByResultId(
  userId: string,
  resultId: string,
): Promise<ImageEditTask | null> {
  try {
    const result = await db.query.imageEditResultsTable.findFirst({
      where: eq(imageEditResultsTable.id, resultId),
      with: {
        task: true,
      },
    });

    if (!result || result.task.userId !== userId) {
      return null;
    }

    return result.task;
  } catch (error) {
    console.error("get task by result id error:", error);
    throw new Error(
      `failed to get task by result id: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * 获取用户的图像编辑任务列表
 */
export async function getUserImageEditTasks(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<ImageEditTask[]> {
  try {
    return await db.query.imageEditTasksTable.findMany({
      limit,
      offset,
      orderBy: [desc(imageEditTasksTable.createdAt)],
      where: eq(imageEditTasksTable.userId, userId),
      with: {
        results: true,
      },
    });
  } catch (error) {
    console.error("get user image edit tasks error:", error);
    throw new Error(
      `failed to get tasks: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * 保存编辑结果到本地存储
 */
export async function saveEditResultToLocal(
  userId: string,
  resultId: string,
): Promise<{ savedImageId: string; url: string }> {
  try {
    // 查询编辑结果
    const result = await db.query.imageEditResultsTable.findFirst({
      where: eq(imageEditResultsTable.id, resultId),
      with: {
        task: true,
      },
    });

    if (!result || result.task.userId !== userId) {
      throw new Error("result not found or access denied");
    }

    if (result.savedImageId) {
      // 已经保存过，返回现有记录
      const savedImage = await db.query.uploadsTable.findFirst({
        where: eq(uploadsTable.id, result.savedImageId),
      });

      if (savedImage) {
        return {
          savedImageId: savedImage.id,
          url: savedImage.url,
        };
      }
    }

    // 下载图片并上传到本地存储
    const imageResponse = await fetch(result.resultImageUrl);
    if (!imageResponse.ok) {
      throw new Error("failed to download result image");
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageFile = new File([imageBuffer], `edited-${Date.now()}.png`, {
      type: "image/png",
    });

    // 上传到S3
    const uploadResult = await uploadToS3(imageFile, "smartphoto/edited");

    // 保存到uploads表
    const savedImageId = createId();
    await db.insert(uploadsTable).values({
      id: savedImageId,
      key: uploadResult.key,
      type: "image",
      url: uploadResult.url,
      userId,
    });

    // 更新编辑结果记录
    await db
      .update(imageEditResultsTable)
      .set({ savedImageId })
      .where(eq(imageEditResultsTable.id, resultId));

    return {
      savedImageId,
      url: uploadResult.url,
    };
  } catch (error) {
    console.error("save edit result to local error:", error);
    throw new Error(
      `failed to save result: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

// 辅助函数：映射通义万象状态到本地状态
function mapWanxStatusToTaskStatus(wanxStatus: string): TaskStatus {
  switch (wanxStatus) {
    case "FAILED":
      return "failed";
    case "PENDING":
      return "pending";
    case "RUNNING":
      return "running";
    case "SUCCEEDED":
      return "succeeded";
    default:
      return "pending";
  }
}
