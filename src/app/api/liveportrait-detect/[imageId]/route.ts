import { type NextRequest, NextResponse } from "next/server";

import { getLivePortraitDetectionResult } from "~/api/liveportrait/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await params;

    if (!imageId) {
      return NextResponse.json(
        { error: "imageId is required" },
        { status: 400 },
      );
    }

    const result = await getLivePortraitDetectionResult(imageId);

    if (!result) {
      return NextResponse.json({ error: "检测结果未找到" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        detectedAt: result.livePortraitDetectedAt,
        imageId: result.id,
        imageUrl: result.resultImageUrl,
        isLivePortraitCompatible: result.livePortraitCompatible,
        message: result.livePortraitMessage,
        requestId: result.livePortraitRequestId,
      },
      success: true,
    });
  } catch (error) {
    console.error("获取LivePortrait检测结果错误:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "未知错误",
        error: "获取检测结果失败",
      },
      { status: 500 },
    );
  }
}
