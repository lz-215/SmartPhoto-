import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createImageEditTask,
  getUserImageEditTasks,
} from "~/api/image-edits/service";
import { auth } from "~/lib/auth";

// 图像编辑任务的请求schema
const createTaskSchema = z.object({
  editFunction: z.enum([
    "stylization_all",
    "stylization_local",
    "description_edit",
    "description_edit_with_mask",
    "remove_watermark",
    "expand",
    "super_resolution",
    "colorization",
    "doodle",
    "control_cartoon_feature",
  ]),
  imageCount: z.number().min(1).max(4).optional(),
  maskImageUrl: z.string().url().optional(),
  originalImageUrl: z.string().url("图片URL格式不正确"),
  prompt: z.string().min(1, "prompt is required").max(800, "prompt too long"),
  scaleFactor: z.number().min(2).max(8).optional(),
  strength: z.number().min(0.1).max(1.0).optional(),
});

// 获取用户的图像编辑任务列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") || "20"),
      50,
    );
    const offset = Math.max(
      Number.parseInt(searchParams.get("offset") || "0"),
      0,
    );

    // 获取任务列表
    const tasks = await getUserImageEditTasks(session.user.id, limit, offset);

    return NextResponse.json({
      data: tasks,
      success: true,
    });
  } catch (error) {
    console.error("get image edit tasks error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "internal server error",
      },
      { status: 500 },
    );
  }
}

// 创建图像编辑任务
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 解析请求体
    const body = (await request.json()) as unknown;
    const validatedData = createTaskSchema.parse(body);

    // 创建编辑任务
    const result = await createImageEditTask(session.user.id, validatedData);

    return NextResponse.json({
      data: result,
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "internal server error",
      },
      { status: 500 },
    );
  }
}
