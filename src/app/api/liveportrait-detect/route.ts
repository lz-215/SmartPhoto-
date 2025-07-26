import { type NextRequest, NextResponse } from "next/server";

import { updateLivePortraitDetectionResult } from "~/api/liveportrait/service";

interface LivePortraitDetectRequest {
  imageId: string;
  imageUrl: string;
}

interface LivePortraitDetectResponse {
  output: {
    message: string;
    pass: boolean;
  };
  request_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LivePortraitDetectRequest;
    const { imageId, imageUrl } = body;

    if (!imageId || !imageUrl) {
      return NextResponse.json(
        { error: "imageId and imageUrl are required" },
        { status: 400 },
      );
    }

    // 调用阿里云LivePortrait检测API
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/face-detect",
      {
        body: JSON.stringify({
          input: {
            image_url: imageUrl,
          },
          model: "liveportrait-detect",
        }),
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error(`LivePortrait API调用失败: ${response.statusText}`);
    }

    const detectResult = (await response.json()) as LivePortraitDetectResponse;
    const isLivePortraitCompatible = detectResult.output?.pass || false;
    const detectMessage = detectResult.output?.message || "";
    const requestId = detectResult.request_id || "";

    // 存储检测结果到数据库
    try {
      await updateLivePortraitDetectionResult(imageId, {
        isCompatible: isLivePortraitCompatible,
        message: detectMessage,
        requestId,
      });

      console.log(
        `LivePortrait检测结果已存储 - 图片ID: ${imageId}, 兼容性: ${isLivePortraitCompatible}, 消息: ${detectMessage}`,
      );
    } catch (dbError) {
      console.error("保存LivePortrait检测结果失败:", dbError);
      // 不抛出错误，避免影响主流程
    }

    return NextResponse.json({
      data: {
        imageId,
        isLivePortraitCompatible,
        message: detectMessage,
        requestId,
      },
      success: true,
    });
  } catch (error) {
    console.error("LivePortrait检测错误:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "未知错误",
        error: "LivePortrait检测失败",
      },
      { status: 500 },
    );
  }
}
