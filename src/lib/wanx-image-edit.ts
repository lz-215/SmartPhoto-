// 通义万象图像编辑API服务

// 通义万象图像编辑功能类型
export type WanxImageEditFunction =
  | "colorization" // 图像上色
  | "control_cartoon_feature" // 垫图，当前仅支持卡通形象
  | "description_edit" // 指令编辑，通过指令即可编辑图像
  | "description_edit_with_mask" // 局部重绘，需要指定编辑区域
  | "doodle" // 线稿生图
  | "expand" // 扩图
  | "remove_watermark" // 去文字水印
  | "stylization_all" // 全局风格化，当前支持2种风格
  | "stylization_local" // 局部风格化，当前支持8种风格
  | "super_resolution"; // 图像超分

// 图像编辑请求参数
export interface WanxImageEditRequest {
  base_image_url: string;
  function: WanxImageEditFunction;
  mask_image_url?: string; // 仅在使用蒙版功能时需要
  n?: number; // 生成图片数量，默认1
  prompt: string;
  strength?: number; // 编辑强度 0.1-1.0
  upscale_factor?: number; // 图像超分的放大倍数 1-4
}

// 图像编辑响应
export interface WanxImageEditResponse {
  output: {
    results?: {
      url: string;
    }[];
    task_id: string;
    task_status: "FAILED" | "PENDING" | "RUNNING" | "SUCCEEDED";
  };
  request_id: string;
  usage?: {
    image_count: number;
  };
}

// 任务查询响应
export interface WanxTaskQueryResponse {
  output: {
    message?: string;
    results?: {
      url: string;
    }[];
    task_id: string;
    task_status: "FAILED" | "PENDING" | "RUNNING" | "SUCCEEDED";
  };
  request_id: string;
  usage?: {
    image_count: number;
  };
}

class WanxImageEditService {
  private apiKey: string;
  private baseUrl =
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis";
  private taskQueryUrl = "https://dashscope.aliyuncs.com/api/v1/tasks";

  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY!;
    if (!this.apiKey) {
      throw new Error("DASHSCOPE_API_KEY environment variable is required");
    }
  }

  /**
   * 创建图像编辑任务
   */
  async createEditTask(
    request: WanxImageEditRequest,
  ): Promise<WanxImageEditResponse> {
    const response = await fetch(this.baseUrl, {
      body: JSON.stringify({
        input: {
          base_image_url: request.base_image_url,
          function: request.function,
          prompt: request.prompt,
          ...(request.mask_image_url && {
            mask_image_url: request.mask_image_url,
          }),
        },
        model: "wanx2.1-imageedit",
        parameters: {
          n: request.n || 1,
          ...(request.strength && { strength: request.strength }),
          ...(request.upscale_factor && {
            upscale_factor: request.upscale_factor,
          }),
        },
      }),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable", // 启用异步模式
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`wanx api error: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as WanxImageEditResponse;
  }

  /**
   * 一键式图像编辑（创建任务并等待完成）
   */
  async editImage(request: WanxImageEditRequest): Promise<string[]> {
    // 创建任务
    const createResponse = await this.createEditTask(request);
    const taskId = createResponse.output.task_id;

    // 等待任务完成
    const result = await this.waitForTaskCompletion(taskId);

    // 返回生成的图片URL列表
    return result.output.results?.map((r) => r.url) || [];
  }

  /**
   * 查询任务状态和结果
   */
  async queryTask(taskId: string): Promise<WanxTaskQueryResponse> {
    const response = await fetch(`${this.taskQueryUrl}/${taskId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      method: "GET",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `wanx task query error: ${response.status} - ${errorText}`,
      );
    }

    return (await response.json()) as WanxTaskQueryResponse;
  }

  /**
   * 轮询等待任务完成
   */
  async waitForTaskCompletion(
    taskId: string,
    maxWaitTime = 300000, // 5分钟
    pollInterval = 3000, // 3秒
  ): Promise<WanxTaskQueryResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.queryTask(taskId);

      if (result.output.task_status === "SUCCEEDED") {
        return result;
      }

      if (result.output.task_status === "FAILED") {
        throw new Error(
          `task failed: ${result.output.message || "unknown error"}`,
        );
      }

      // 等待后继续轮询
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error("task timeout");
  }
}

// 导出单例实例
export const wanxImageEditService = new WanxImageEditService();

// 便捷函数
export async function editImageWithWanx(
  imageUrl: string,
  prompt: string,
  editFunction: WanxImageEditFunction = "description_edit",
  options?: {
    count?: number;
    maskUrl?: string;
    strength?: number;
  },
): Promise<string[]> {
  return await wanxImageEditService.editImage({
    base_image_url: imageUrl,
    function: editFunction,
    mask_image_url: options?.maskUrl,
    n: options?.count,
    prompt,
    strength: options?.strength,
  });
}
