import { type NextRequest, NextResponse } from "next/server";

// 请求接口
interface LivePortraitRequest {
  audio_url: string;
  eye_move_freq: number;
  head_move_strength: number;
  image_url: string;
  mouth_move_strength: number;
  paste_back: boolean;
  template_id: "active" | "calm" | "normal";
  video_fps: number;
}

// 阿里云响应接口
interface LivePortraitResponse {
  output: {
    task_id: string;
    task_status: string;
  };
  request_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LivePortraitRequest;
    const {
      audio_url,
      eye_move_freq,
      head_move_strength,
      image_url,
      mouth_move_strength,
      paste_back,
      template_id,
      video_fps,
    } = body;

    // 验证必要参数
    if (!image_url || !audio_url) {
      return NextResponse.json(
        { error: "图片URL和音频URL是必须的" },
        { status: 400 },
      );
    }

    // 调用阿里云LivePortrait API
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis/",
      {
        body: JSON.stringify({
          input: {
            audio_url: audio_url,
            image_url: image_url,
          },
          model: "liveportrait",
          parameters: {
            eye_move_freq,
            head_move_strength,
            mouth_move_strength,
            paste_back,
            template_id,
            video_fps,
          },
        }),
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable", // 使用异步方式
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `LivePortrait API调用失败: ${response.statusText}, ${JSON.stringify(errorData)}`,
      );
    }

    const result = (await response.json()) as LivePortraitResponse;

    return NextResponse.json({
      data: {
        requestId: result.request_id,
        taskId: result.output.task_id,
        taskStatus: result.output.task_status,
      },
      success: true,
    });
  } catch (error) {
    console.error("LivePortrait视频生成错误:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "未知错误",
        error: "视频生成请求失败",
      },
      { status: 500 },
    );
  }
}
