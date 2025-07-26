import { type NextRequest, NextResponse } from "next/server";

import { getLivePortraitCompatibleImages } from "~/api/liveportrait/service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 20;

    const results = await getLivePortraitCompatibleImages(limit);

    return NextResponse.json({
      data: results.map((result) => ({
        detectedAt: result.livePortraitDetectedAt,
        imageId: result.id,
        imageUrl: result.resultImageUrl,
        message: result.livePortraitMessage,
      })),
      success: true,
      total: results.length,
    });
  } catch (error) {
    console.error("获取LivePortrait兼容图片错误:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "未知错误",
        error: "获取兼容图片失败",
      },
      { status: 500 },
    );
  }
}
