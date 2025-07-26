import { type NextRequest, NextResponse } from "next/server";

// 任务查询响应接口
interface TaskQueryResponse {
  output: {
    code?: string;
    message?: string;
    results?: {
      video_url: string;
    };
    task_id: string;
    task_status: "FAILED" | "PENDING" | "RUNNING" | "SUCCEEDED";
  };
  request_id: string;
  usage?: {
    video_duration: number;
    video_ratio: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
  try {
    const taskId = params.taskId;

    if (!taskId) {
      return NextResponse.json({ error: "任务ID是必须的" }, { status: 400 });
    }

    // 调用阿里云LivePortrait任务查询API
    const response = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        },
        method: "GET",
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `查询任务状态失败: ${response.statusText}, ${JSON.stringify(errorData)}`,
      );
    }

    const result = (await response.json()) as TaskQueryResponse;

    return NextResponse.json({
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("查询LivePortrait任务状态错误:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "未知错误",
        error: "查询任务状态失败",
      },
      { status: 500 },
    );
  }
}
