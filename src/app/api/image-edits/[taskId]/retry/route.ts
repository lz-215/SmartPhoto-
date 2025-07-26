import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { createImageEditTask } from "~/api/image-edits/service";
import { db } from "~/db";
import { imageEditTasksTable } from "~/db/schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 },
      );
    }

    // 查询原始任务参数
    const originalTask = await db.query.imageEditTasksTable.findFirst({
      where: eq(imageEditTasksTable.id, taskId),
    });

    if (!originalTask) {
      return NextResponse.json({ error: "原始任务未找到" }, { status: 404 });
    }

    // 使用原始任务参数创建新任务
    const retryResult = await createImageEditTask(originalTask.userId, {
      editFunction: originalTask.editFunction,
      imageCount: originalTask.imageCount,
      maskImageUrl: originalTask.maskImageUrl || undefined,
      originalImageUrl: originalTask.originalImageUrl!,
      prompt: originalTask.prompt,
      scaleFactor: originalTask.scaleFactor || undefined,
      strength: originalTask.strength || undefined,
    });

    return NextResponse.json({
      data: retryResult,
      success: true,
    });
  } catch (error) {
    console.error("重试任务错误:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "未知错误",
        error: "重试任务失败",
      },
      { status: 500 },
    );
  }
}
