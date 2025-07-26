import { type NextRequest, NextResponse } from "next/server";

import {
  createImageEditTask,
  getTaskByResultId,
} from "~/api/image-edits/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> },
) {
  try {
    const { resultId } = await params;

    if (!resultId) {
      return NextResponse.json(
        { error: "resultId is required" },
        { status: 400 },
      );
    }

    // TODO: 从认证中获取用户ID，这里暂时使用固定值
    const userId = "temp-user-id";

    // 根据结果ID获取原始任务信息
    const originalTask = await getTaskByResultId(userId, resultId);

    if (!originalTask) {
      return NextResponse.json(
        { error: "原始任务未找到或无权限访问" },
        { status: 404 },
      );
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
    console.error("通过结果ID重试任务错误:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "未知错误",
        error: "重试任务失败",
      },
      { status: 500 },
    );
  }
}
