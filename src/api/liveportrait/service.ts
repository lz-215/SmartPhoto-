import { eq } from "drizzle-orm";

import { db } from "~/db";
import { imageEditResultsTable } from "~/db/schema";

/**
 * 批量获取LivePortrait兼容的图片
 */
export async function getLivePortraitCompatibleImages(limit = 20) {
  try {
    const results = await db.query.imageEditResultsTable.findMany({
      columns: {
        id: true,
        livePortraitDetectedAt: true,
        livePortraitMessage: true,
        resultImageUrl: true,
      },
      limit,
      orderBy: (table, { desc }) => [desc(table.livePortraitDetectedAt)],
      where: eq(imageEditResultsTable.livePortraitCompatible, true),
    });

    return results;
  } catch (error) {
    console.error("获取LivePortrait兼容图片失败:", error);
    throw new Error(
      `failed to get compatible images: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * 获取图片的LivePortrait检测结果
 */
export async function getLivePortraitDetectionResult(imageId: string) {
  try {
    const result = await db.query.imageEditResultsTable.findFirst({
      columns: {
        id: true,
        livePortraitCompatible: true,
        livePortraitDetectedAt: true,
        livePortraitMessage: true,
        livePortraitRequestId: true,
        resultImageUrl: true,
      },
      where: eq(imageEditResultsTable.id, imageId),
    });

    return result;
  } catch (error) {
    console.error("获取LivePortrait检测结果失败:", error);
    throw new Error(
      `failed to get detection result: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * 更新图片的LivePortrait检测结果
 */
export async function updateLivePortraitDetectionResult(
  imageId: string,
  detection: {
    isCompatible: boolean;
    message?: string;
    requestId?: string;
  },
) {
  try {
    await db
      .update(imageEditResultsTable)
      .set({
        livePortraitCompatible: detection.isCompatible,
        livePortraitDetectedAt: new Date(),
        livePortraitMessage: detection.message,
        livePortraitRequestId: detection.requestId,
      })
      .where(eq(imageEditResultsTable.id, imageId));

    return { success: true };
  } catch (error) {
    console.error("更新LivePortrait检测结果失败:", error);
    throw new Error(
      `failed to update detection result: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
