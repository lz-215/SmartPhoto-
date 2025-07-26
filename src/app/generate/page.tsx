"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import type { WanxImageEditFunction } from "~/lib/wanx-image-edit";

import { useIsMobile } from "~/hooks/use-mobile";
import { FileUploader } from "~/ui/components/file-uploader";
import { Alert, AlertDescription } from "~/ui/primitives/alert";
import { Button } from "~/ui/primitives/button";
import { Card } from "~/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/ui/primitives/form";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/ui/primitives/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/ui/primitives/select";
import { Textarea } from "~/ui/primitives/textarea";

interface GeneratedImage {
  createdAt: Date;
  id: string;
  imageUrl: string;
  livePortraitCompatible: boolean;
  prompt: string;
}

interface GenerateFormData {
  aspectRatio: string;
  height: number;
  model: WanxImageEditFunction;
  negativePrompt: string;
  prompt: string;
  quality: "1K" | "2K";
  scaleFactor?: number;
  width: number;
}

// 任务响应接口
interface TaskResponse {
  errorMessage?: string;
  results?: TaskResult[];
  status: TaskStatus;
  taskId: string;
}

// 任务结果接口
interface TaskResult {
  id: string;
  livePortraitCompatible: boolean;
  resultImageUrl: string;
  savedImageId?: string;
}

// 任务状态类型
type TaskStatus = "failed" | "pending" | "running" | "succeeded";

// 模型选项配置
const modelOptions = [
  {
    description: "黑白图片上色",
    label: "图像上色",
    value: "colorization" as WanxImageEditFunction,
  },
  {
    description: "通过指令编辑图像",
    label: "指令编辑",
    value: "description_edit" as WanxImageEditFunction,
  },
  {
    description: "局部区域风格化",
    label: "局部风格化",
    value: "stylization_local" as WanxImageEditFunction,
  },
  {
    description:
      "支持高清放大，能够将模糊或低分辨率图像转化为清晰、高分辨率的图像",
    label: "图像超分",
    value: "super_resolution" as WanxImageEditFunction,
  },
  {
    description: "扩展图像边界",
    label: "扩图",
    value: "expand" as WanxImageEditFunction,
  },
];

export default function GeneratePage() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [promptLength, setPromptLength] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);

  // 任务状态相关状态
  const [taskStatus, setTaskStatus] = useState<null | TaskStatus>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [errorMessage, setErrorMessage] = useState<null | string>(null);

  const form = useForm<GenerateFormData>({
    defaultValues: {
      aspectRatio: "21:9",
      height: 566,
      model: "description_edit",
      negativePrompt: "",
      prompt: "",
      quality: "1K",
      scaleFactor: 2, // 默认2倍放大
      width: 1360,
    },
  });

  // 处理文件上传
  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files);
  };

  // 处理上传完成
  const handleUploadComplete = (
    results: { key: string; type: string; url: string }[],
  ) => {
    console.log("上传完成:", results);
    // 将上传成功的图片添加到已上传列表
    const newImages = results.map((result) => ({
      id: result.key, // 使用key作为id
      name: result.key.split("/").pop() || "未知文件",
      url: result.url,
    }));
    setUploadedImages((prev) => [...prev, ...newImages]);
  };

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch(`/api/image-edits/${taskId}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("获取任务状态失败");
      }

      const data = (await response.json()) as { data: TaskResponse };
      const taskResponse = data.data;

      setTaskStatus(taskResponse.status);

      // 如果任务完成或失败，停止轮询
      if (taskResponse.status === "succeeded") {
        // 先停止轮询
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // 重置loading状态
        setLoading(false);
        setTaskStatus(null);

        // 添加生成结果到列表（只添加一次）
        if (taskResponse.results && taskResponse.results.length > 0) {
          const newResults = taskResponse.results.map((result) => ({
            createdAt: new Date(),
            id: result.id,
            imageUrl: result.resultImageUrl,
            livePortraitCompatible: result.livePortraitCompatible,
            prompt: form.getValues("prompt"),
          }));

          setResults((prev) => {
            // 检查是否已经添加过这些结果，避免重复添加
            const existingIds = new Set(prev.map((r) => r.id));
            const filteredResults = newResults.filter(
              (r) => !existingIds.has(r.id),
            );

            return filteredResults.length > 0
              ? [...filteredResults, ...prev]
              : prev;
          });

          // 为新生成的图片异步调用LivePortrait检测
          const existingIds = new Set(results.map((r) => r.id));
          const filteredResults = newResults.filter(
            (r) => !existingIds.has(r.id),
          );

          if (filteredResults.length > 0) {
            Promise.all(
              filteredResults.map(async (result) => {
                try {
                  await fetch("/api/liveportrait-detect", {
                    body: JSON.stringify({
                      imageId: result.id,
                      imageUrl: result.imageUrl,
                    }),
                    headers: {
                      "Content-Type": "application/json",
                    },
                    method: "POST",
                  });
                } catch (error) {
                  console.error("LivePortrait检测失败:", error);
                }
              }),
            ).catch((error) => {
              console.error("批量LivePortrait检测失败:", error);
            });
          }
        }

        // 成功后重置表单但保留模型选择
        const currentModel = form.getValues("model");
        const currentScaleFactor = form.getValues("scaleFactor");
        form.reset({
          aspectRatio: "21:9",
          height: 566,
          model: currentModel, // 保留当前选择的模型
          negativePrompt: "",
          prompt: "",
          quality: "1K",
          scaleFactor: currentScaleFactor, // 保留放大倍数设置
          width: 1360,
        });

        // 清除上传的图片
        setUploadedImages([]);
        setUploadedFiles([]);
        setPromptLength(0);
      } else if (taskResponse.status === "failed") {
        // 先停止轮询
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        setErrorMessage(taskResponse.errorMessage || "任务处理失败");
        setTaskStatus(null);
        setLoading(false);
        return; // 提前返回，避免继续执行
      }
    } catch (error) {
      console.error("轮询任务状态失败:", error);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      setErrorMessage("获取任务状态失败");
      setTaskStatus(null);
      setLoading(false);
    }
  };

  // 从数据库加载历史生成结果
  const loadHistoryResults = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch("/api/image-edits?limit=20&offset=0");

      if (!response.ok) {
        throw new Error("获取历史记录失败");
      }

      const data = (await response.json()) as {
        data?: any[];
        success: boolean;
      };

      if (data.success && data.data) {
        // 转换数据库结果为页面所需格式
        const historyResults: GeneratedImage[] = [];

        for (const task of data.data) {
          if (task.results && task.results.length > 0) {
            for (const result of task.results) {
              historyResults.push({
                createdAt: new Date(result.createdAt),
                id: result.id,
                imageUrl: result.resultImageUrl,
                livePortraitCompatible: result.livePortraitCompatible,
                prompt: task.prompt,
              });
            }
          }
        }

        setResults(historyResults);
      }
    } catch (error) {
      console.error("加载历史记录失败:", error);
      setErrorMessage("加载历史记录失败");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // 页面加载时获取历史记录
  useEffect(() => {
    loadHistoryResults();
  }, [loadHistoryResults]);

  // 清理轮询间隔
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // 处理生成图片
  const handleGenerate = async (data: GenerateFormData) => {
    // 为图像超分设置默认提示词
    const promptToUse =
      data.model === "super_resolution" ? "图像超分" : data.prompt;

    if (!promptToUse) return;
    if (uploadedImages.length === 0) {
      setErrorMessage("请先上传一张图片");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // 调用图像编辑API创建任务，传递图片URL而不是ID
      const response = await fetch("/api/image-edits", {
        body: JSON.stringify({
          editFunction: data.model,
          imageCount: 1, // 默认生成1张图片
          originalImageUrl: uploadedImages[0].url, // 传递图片URL
          prompt: promptToUse, // 使用处理后的提示词
          ...(data.model === "super_resolution" && {
            scaleFactor: data.scaleFactor,
          }), // 只在图像超分时发送放大倍数
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as null | {
          error?: string;
          message?: string;
        };
        const errorMessage =
          errorData?.error ||
          errorData?.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`创建图像编辑任务失败: ${errorMessage}`);
      }

      const responseData = (await response.json()) as {
        data?: { taskId: string };
        error?: string;
        message?: string;
        success: boolean;
      };

      if (!responseData.success || !responseData.data) {
        const errorMessage =
          responseData.error || responseData.message || "未知错误";
        throw new Error(`创建任务失败: ${errorMessage}`);
      }

      const taskId = responseData.data.taskId;

      // 设置初始任务状态
      setTaskStatus("pending");

      // 开始轮询任务状态
      pollingIntervalRef.current = setInterval(
        () => pollTaskStatus(taskId),
        3000,
      ); // 每3秒轮询一次
    } catch (error) {
      console.error("生成失败:", error);
      let errorMessage = "创建任务失败";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      setErrorMessage(errorMessage);
      setLoading(false);
    }
  };

  // 处理图片点击放大
  const handleImageClick = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setDialogOpen(true);
  };

  // 获取任务状态显示文本
  const getTaskStatusText = () => {
    switch (taskStatus) {
      case "pending":
        return "等待处理中...";
      case "running":
        return "正在生成图片...";
      default:
        return "生成中...";
    }
  };

  return (
    <div
      className={
        isMobile ? "min-h-screen bg-background" : `h-screen bg-background`
      }
    >
      {isMobile ? (
        // 移动端垂直布局
        <div className="flex flex-col">
          {/* 移动端表单区域 */}
          <div className="border-b bg-muted/5">
            <div className="space-y-4 p-4">
              {/* 图片上传组件 */}
              <div className={isMobile ? "space-y-2" : "space-y-3"}>
                <h3 className="text-sm font-medium">上传图片</h3>

                {/* 只有在没有已上传图片时才显示拖拽框 */}
                {uploadedImages.length === 0 && (
                  <FileUploader
                    accept={{
                      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
                    }}
                    maxFiles={1}
                    maxSize={10 * 1024 * 1024} // 10MB
                    onFilesChange={handleFilesChange}
                    onUploadComplete={handleUploadComplete}
                    value={uploadedFiles}
                  />
                )}

                {/* 已上传成功的图片 */}
                {uploadedImages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      已上传成功：
                    </p>
                    <div className={isMobile ? "flex gap-2" : "space-y-2"}>
                      {uploadedImages.map((image) => (
                        <div
                          className={`
                            group relative aspect-square cursor-pointer
                            overflow-hidden rounded-lg border
                            ${isMobile ? "h-16 w-16" : "w-20"}
                          `}
                          key={image.id}
                          onClick={() => handleImageClick(image.url)}
                        >
                          <img
                            alt="已上传的图片"
                            className={`
                              h-full w-full object-cover transition-transform
                              group-hover:scale-110
                            `}
                            src={image.url}
                          />
                          <Button
                            className={`
                              absolute top-1 right-1 h-5 w-5 p-0 opacity-0
                              group-hover:opacity-100
                              ${isMobile ? "opacity-100" : ""}
                            `}
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedImages((prev) =>
                                prev.filter((img) => img.id !== image.id),
                              );
                            }}
                            size="sm"
                            variant="destructive"
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Form {...form}>
                <form
                  className={isMobile ? "space-y-4" : "space-y-6"}
                  onSubmit={form.handleSubmit(handleGenerate)}
                >
                  {/* 模型选择 */}
                  <div className={isMobile ? "space-y-2" : "space-y-3"}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">功能</h3>
                      {!isMobile && (
                        <Button
                          className="h-6 w-6 p-0"
                          size="sm"
                          variant="ghost"
                        >
                          <span className="text-xs">▲</span>
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              defaultValue={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger
                                  className={`
                                    h-12 border-muted bg-muted/20
                                    ${isMobile ? `h-14` : ""}
                                  `}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {modelOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`
                                          h-8 w-8 flex-shrink-0 rounded-lg
                                          bg-gradient-to-br from-purple-400
                                          to-pink-400
                                        `}
                                      />
                                      <div className={`flex flex-col`}>
                                        <div
                                          className={`leading-tight font-medium`}
                                        >
                                          {option.label}
                                        </div>
                                        <div
                                          className={`
                                            line-clamp-1 text-xs leading-tight
                                            text-muted-foreground
                                          `}
                                        >
                                          {option.description}
                                        </div>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* 清晰度选择 */}
                    {/*<div className="space-y-2">*/}
                    {/*  <p className="text-xs text-muted-foreground">*/}
                    {/*    选择清晰度：标清 1K*/}
                    {/*  </p>*/}
                    {/*  <FormField*/}
                    {/*    control={form.control}*/}
                    {/*    name="quality"*/}
                    {/*    render={({ field }) => (*/}
                    {/*      <FormItem>*/}
                    {/*        <FormControl>*/}
                    {/*          <div className="grid grid-cols-2 gap-2">*/}
                    {/*            <Button*/}
                    {/*              className="h-10"*/}
                    {/*              onClick={() => field.onChange("1K")}*/}
                    {/*              size="sm"*/}
                    {/*              type="button"*/}
                    {/*              variant={*/}
                    {/*                field.value === "1K" ? "default" : "outline"*/}
                    {/*              }*/}
                    {/*            >*/}
                    {/*              标清 1K*/}
                    {/*            </Button>*/}
                    {/*            <Button*/}
                    {/*              className="h-10"*/}
                    {/*              onClick={() => field.onChange("2K")}*/}
                    {/*              size="sm"*/}
                    {/*              type="button"*/}
                    {/*              variant={*/}
                    {/*                field.value === "2K" ? "default" : "outline"*/}
                    {/*              }*/}
                    {/*            >*/}
                    {/*              高清 2K ✨*/}
                    {/*            </Button>*/}
                    {/*          </div>*/}
                    {/*        </FormControl>*/}
                    {/*      </FormItem>*/}
                    {/*    )}*/}
                    {/*  />*/}
                    {/*</div>*/}
                  </div>
                  {/* 提示词输入 */}
                  {form.watch("model") !== "super_resolution" && (
                    <FormField
                      control={form.control}
                      name="prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <Textarea
                                className={`
                                  ${isMobile ? "min-h-[100px]" : "min-h-[120px]"}
                                  resize-none border-muted bg-muted/20 text-sm
                                  ${isMobile ? "text-base" : ""}
                                `}
                                maxLength={800}
                                placeholder="描述想要生成的图片"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  setPromptLength(e.target.value.length);
                                }}
                              />
                              <div
                                className={`
                                  absolute right-2 bottom-2 text-xs
                                  text-muted-foreground
                                `}
                              >
                                {promptLength}/800
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                      rules={{
                        required:
                          form.watch("model") !== "super_resolution"
                            ? "请输入提示词"
                            : false,
                      }}
                    />
                  )}

                  {/* 图像超分放大倍数选择 */}
                  {form.watch("model") === "super_resolution" && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium">放大倍数</h3>
                      <FormField
                        control={form.control}
                        name="scaleFactor"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="grid grid-cols-3 gap-2">
                                <Button
                                  className="h-10"
                                  onClick={() => field.onChange(2)}
                                  size="sm"
                                  type="button"
                                  variant={
                                    field.value === 2 ? "default" : "outline"
                                  }
                                >
                                  2倍
                                </Button>
                                <Button
                                  className="h-10"
                                  onClick={() => field.onChange(4)}
                                  size="sm"
                                  type="button"
                                  variant={
                                    field.value === 4 ? "default" : "outline"
                                  }
                                >
                                  4倍
                                </Button>
                                <Button
                                  className="h-10"
                                  onClick={() => field.onChange(8)}
                                  size="sm"
                                  type="button"
                                  variant={
                                    field.value === 8 ? "default" : "outline"
                                  }
                                >
                                  8倍
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        选择图像放大的倍数，倍数越高分辨率越高
                      </p>
                    </div>
                  )}

                  {/* 比例选择 */}
                  {/*<div className="space-y-3">*/}
                  {/*  <div className="flex items-center justify-between">*/}
                  {/*    <h3 className="text-sm font-medium">比例</h3>*/}
                  {/*    <Button className="h-6 w-6 p-0" size="sm" variant="ghost">*/}
                  {/*      <span className="text-xs">▲</span>*/}
                  {/*    </Button>*/}
                  {/*  </div>*/}

                  {/*  <div className="space-y-2">*/}
                  {/*    <p className="text-xs text-muted-foreground">图片比例</p>*/}
                  {/*    <FormField*/}
                  {/*      control={form.control}*/}
                  {/*      name="aspectRatio"*/}
                  {/*      render={({ field }) => (*/}
                  {/*        <FormItem>*/}
                  {/*          <FormControl>*/}
                  {/*            <div className="grid grid-cols-5 gap-2">*/}
                  {/*              {aspectRatios.map((ratio) => (*/}
                  {/*                <Button*/}
                  {/*                  className="h-16 flex-col gap-1"*/}
                  {/*                  key={ratio.value}*/}
                  {/*                  onClick={() =>*/}
                  {/*                    handleAspectRatioChange(ratio.value)*/}
                  {/*                  }*/}
                  {/*                  size="sm"*/}
                  {/*                  type="button"*/}
                  {/*                  variant={*/}
                  {/*                    field.value === ratio.value*/}
                  {/*                      ? "default"*/}
                  {/*                      : "outline"*/}
                  {/*                  }*/}
                  {/*                >*/}
                  {/*                  <div className="h-4 w-6 rounded-sm bg-muted" />*/}
                  {/*                  <span className="text-xs">*/}
                  {/*                    {ratio.value}*/}
                  {/*                  </span>*/}
                  {/*                </Button>*/}
                  {/*              ))}*/}
                  {/*            </div>*/}
                  {/*          </FormControl>*/}
                  {/*        </FormItem>*/}
                  {/*      )}*/}
                  {/*    />*/}
                  {/*  </div>*/}

                  {/*  /!* 图片尺寸 *!/*/}
                  {/*  <div className="space-y-2">*/}
                  {/*    <div className="flex items-center gap-2">*/}
                  {/*      <p className="text-xs text-muted-foreground">*/}
                  {/*        图片尺寸*/}
                  {/*      </p>*/}
                  {/*      <div*/}
                  {/*        className={`*/}
                  {/*          flex h-4 w-4 items-center justify-center*/}
                  {/*          rounded-full bg-muted*/}
                  {/*        `}*/}
                  {/*      >*/}
                  {/*        <span className="text-xs">i</span>*/}
                  {/*      </div>*/}
                  {/*    </div>*/}
                  {/*    <div className="grid grid-cols-3 items-center gap-2">*/}
                  {/*      <FormField*/}
                  {/*        control={form.control}*/}
                  {/*        name="width"*/}
                  {/*        render={({ field }) => (*/}
                  {/*          <FormItem>*/}
                  {/*            <FormControl>*/}
                  {/*              <div className="relative">*/}
                  {/*                <Input*/}
                  {/*                  className={`*/}
                  {/*                    border-muted bg-muted/20 text-center*/}
                  {/*                  `}*/}
                  {/*                  type="number"*/}
                  {/*                  {...field}*/}
                  {/*                  onChange={(e) =>*/}
                  {/*                    field.onChange(Number(e.target.value))*/}
                  {/*                  }*/}
                  {/*                />*/}
                  {/*                <span*/}
                  {/*                  className={`*/}
                  {/*                    absolute top-1/2 left-2 -translate-y-1/2*/}
                  {/*                    text-xs text-muted-foreground*/}
                  {/*                  `}*/}
                  {/*                >*/}
                  {/*                  W*/}
                  {/*                </span>*/}
                  {/*              </div>*/}
                  {/*            </FormControl>*/}
                  {/*          </FormItem>*/}
                  {/*        )}*/}
                  {/*      />*/}
                  {/*      <div className="flex items-center justify-center">*/}
                  {/*        <div*/}
                  {/*          className={`*/}
                  {/*            flex h-6 w-6 items-center justify-center*/}
                  {/*            rounded-full bg-muted*/}
                  {/*          `}*/}
                  {/*        >*/}
                  {/*          <span className="text-xs">🔗</span>*/}
                  {/*        </div>*/}
                  {/*      </div>*/}
                  {/*      <FormField*/}
                  {/*        control={form.control}*/}
                  {/*        name="height"*/}
                  {/*        render={({ field }) => (*/}
                  {/*          <FormItem>*/}
                  {/*            <FormControl>*/}
                  {/*              <div className="relative">*/}
                  {/*                <Input*/}
                  {/*                  className={`*/}
                  {/*                    border-muted bg-muted/20 text-center*/}
                  {/*                  `}*/}
                  {/*                  type="number"*/}
                  {/*                  {...field}*/}
                  {/*                  onChange={(e) =>*/}
                  {/*                    field.onChange(Number(e.target.value))*/}
                  {/*                  }*/}
                  {/*                />*/}
                  {/*                <span*/}
                  {/*                  className={`*/}
                  {/*                    absolute top-1/2 left-2 -translate-y-1/2*/}
                  {/*                    text-xs text-muted-foreground*/}
                  {/*                  `}*/}
                  {/*                >*/}
                  {/*                  H*/}
                  {/*                </span>*/}
                  {/*              </div>*/}
                  {/*            </FormControl>*/}
                  {/*          </FormItem>*/}
                  {/*        )}*/}
                  {/*      />*/}
                  {/*    </div>*/}
                  {/*  </div>*/}
                  {/*</div>*/}

                  {/* 错误信息显示 */}
                  {errorMessage && (
                    <Alert variant="destructive">
                      <AlertDescription className="font-medium text-red-700">
                        {errorMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* 生成按钮 */}
                  <Button
                    className={`
                      ${isMobile ? "h-14" : "h-12"}
                      w-full bg-gradient-to-r from-purple-500 to-pink-500
                      ${isMobile ? "text-lg" : "text-base"}
                      font-medium
                      hover:from-purple-600 hover:to-pink-600
                    `}
                    disabled={loading}
                    size="lg"
                    type="submit"
                  >
                    {loading ? getTaskStatusText() : "生成图片"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>

          {/* 移动端结果区域 */}
          <div className="flex-1 overflow-auto">
            <div className="p-4">
              <div className="mb-4">
                <h1 className="text-xl font-bold">生成结果</h1>
                <p className="text-sm text-muted-foreground">
                  共 {results.length} 张图片
                </p>
              </div>

              {loadingHistory ? (
                <div className="flex h-[300px] items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 text-4xl opacity-20">⏳</div>
                    <p className="text-base font-medium text-muted-foreground">
                      正在加载历史生成记录...
                    </p>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 text-4xl opacity-20">🎨</div>
                    <p className="text-base font-medium text-muted-foreground">
                      还没有生成任何图片
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      在上方表单中输入提示词开始生成
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={`
                    columns-2 gap-4
                    sm:columns-2
                    lg:columns-3
                    xl:columns-4
                  `}
                >
                  {results.map((result) => (
                    <Card
                      className={`
                        mb-4 break-inside-avoid overflow-hidden
                        transition-shadow
                        hover:shadow-lg
                      `}
                      key={result.id}
                    >
                      <div
                        className="group relative cursor-pointer"
                        onClick={() => handleImageClick(result.imageUrl)}
                      >
                        <img
                          alt={result.prompt}
                          className={`
                            w-full object-cover transition-transform
                            group-hover:scale-105
                          `}
                          src={result.imageUrl}
                        />
                        {/* LivePortrait动画按钮 */}
                        {result.livePortraitCompatible && (
                          <div className="absolute top-2 left-2 animate-pulse">
                            <Button
                              className={`
                                h-8 w-8 rounded-full bg-gradient-to-r
                                from-indigo-500 via-purple-500 to-pink-500 p-0
                                shadow-lg
                              `}
                              onClick={(e) => {
                                e.stopPropagation();
                                // 点击后执行动画逻辑
                                window.open(
                                  `/liveportrait?imageId=${result.id}`,
                                  "_blank",
                                );
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              <span className="text-white">🎬</span>
                            </Button>
                          </div>
                        )}
                        {/* 操作按钮 */}
                        <div
                          className={`
                            absolute top-2 right-2 flex gap-1 opacity-0
                            transition-opacity
                            group-hover:opacity-100
                          `}
                        >
                          <Button
                            className={`
                              h-8 w-8 bg-black/50 p-0
                              hover:bg-black/70
                            `}
                            onClick={(e) => {
                              e.stopPropagation();
                              // 下载功能
                              const link = document.createElement("a");
                              link.href = result.imageUrl;
                              link.download = `image-${result.id}.png`;
                              link.click();
                            }}
                            size="sm"
                            variant="secondary"
                          >
                            <span className="text-white">⬇</span>
                          </Button>
                          <Button
                            className={`
                              h-8 w-8 bg-red-500/80 p-0
                              hover:bg-red-600/90
                            `}
                            onClick={(e) => {
                              e.stopPropagation();
                              // 删除功能 - 从结果列表中移除
                              setResults((prev) =>
                                prev.filter((r) => r.id !== result.id),
                              );
                            }}
                            size="sm"
                            variant="destructive"
                          >
                            <X className="size-3 text-white" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="mb-2 line-clamp-2 text-base font-medium">
                          {result.prompt}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            {result.createdAt.toLocaleString("zh-CN", {
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              month: "short",
                            })}
                          </p>
                          <Button
                            className="h-8 px-3 text-sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                setLoading(true);
                                setErrorMessage(null);

                                // 调用重试API
                                const response = await fetch(
                                  `/api/image-edits/results/${result.id}/retry`,
                                  {
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    method: "POST",
                                  },
                                );

                                if (!response.ok) {
                                  const errorData = (await response
                                    .json()
                                    .catch(() => null)) as null | {
                                    error?: string;
                                    message?: string;
                                  };
                                  const errorMessage =
                                    errorData?.error ||
                                    errorData?.message ||
                                    `HTTP ${response.status}: ${response.statusText}`;
                                  throw new Error(`重试失败: ${errorMessage}`);
                                }

                                const responseData =
                                  (await response.json()) as {
                                    data?: { taskId: string };
                                    error?: string;
                                    message?: string;
                                    success: boolean;
                                  };

                                if (
                                  !responseData.success ||
                                  !responseData.data
                                ) {
                                  const errorMessage =
                                    responseData.error ||
                                    responseData.message ||
                                    "未知错误";
                                  throw new Error(`重试失败: ${errorMessage}`);
                                }

                                const taskId = responseData.data.taskId;

                                // 设置初始任务状态
                                setTaskStatus("pending");

                                // 开始轮询任务状态
                                pollingIntervalRef.current = setInterval(
                                  () => pollTaskStatus(taskId),
                                  3000,
                                ); // 每3秒轮询一次
                              } catch (error) {
                                console.error("重试失败:", error);
                                let errorMessage = "重试失败";

                                if (error instanceof Error) {
                                  errorMessage = error.message;
                                } else if (typeof error === "string") {
                                  errorMessage = error;
                                }

                                setErrorMessage(errorMessage);
                                setLoading(false);
                              }
                            }}
                            size="sm"
                            variant="outline"
                          >
                            重试
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // 桌面端水平布局
        <div className="mx-auto h-full max-w-7xl px-6">
          <ResizablePanelGroup className="h-full" direction="horizontal">
            {/* 左侧表单面板 */}
            <ResizablePanel defaultSize={30} maxSize={50} minSize={20}>
              <div className="h-full overflow-auto border-r bg-muted/5">
                <div className="space-y-6 p-4">
                  {/* 桌面端的表单内容保持原样 */}
                  {/* 图片上传组件 */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">上传图片</h3>

                    {/* 只有在没有已上传图片时才显示拖拽框 */}
                    {uploadedImages.length === 0 && (
                      <FileUploader
                        accept={{
                          "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
                        }}
                        maxFiles={1}
                        maxSize={10 * 1024 * 1024} // 10MB
                        onFilesChange={handleFilesChange}
                        onUploadComplete={handleUploadComplete}
                        value={uploadedFiles}
                      />
                    )}

                    {/* 已上传成功的图片 */}
                    {uploadedImages.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          已上传成功：
                        </p>
                        <div className="space-y-2">
                          {uploadedImages.map((image) => (
                            <div
                              className={`
                                group relative aspect-square w-20 cursor-pointer
                                overflow-hidden rounded-lg border
                              `}
                              key={image.id}
                              onClick={() => handleImageClick(image.url)}
                            >
                              <img
                                alt="已上传的图片"
                                className={`
                                  h-full w-full object-cover
                                  transition-transform
                                  group-hover:scale-110
                                `}
                                src={image.url}
                              />
                              <Button
                                className={`
                                  absolute top-1 right-1 h-6 w-6 p-0 opacity-0
                                  group-hover:opacity-100
                                `}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUploadedImages((prev) =>
                                    prev.filter((img) => img.id !== image.id),
                                  );
                                }}
                                size="sm"
                                variant="destructive"
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Form {...form}>
                    <form
                      className="space-y-6"
                      onSubmit={form.handleSubmit(handleGenerate)}
                    >
                      {/* 模型选择 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium">功能</h3>
                          <Button
                            className="h-6 w-6 p-0"
                            size="sm"
                            variant="ghost"
                          >
                            <span className="text-xs">▲</span>
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <FormField
                            control={form.control}
                            name="model"
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  defaultValue={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <FormControl>
                                    <SelectTrigger
                                      className={`h-12 border-muted bg-muted/20`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {modelOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div
                                            className={`
                                              h-8 w-8 flex-shrink-0 rounded-lg
                                              bg-gradient-to-br from-purple-400
                                              to-pink-400
                                            `}
                                          />
                                          <div className={`flex flex-col`}>
                                            <div
                                              className={`
                                                leading-tight font-medium
                                              `}
                                            >
                                              {option.label}
                                            </div>
                                            <div
                                              className={`
                                                line-clamp-1 text-xs
                                                leading-tight
                                                text-muted-foreground
                                              `}
                                            >
                                              {option.description}
                                            </div>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* 提示词输入 */}
                      {form.watch("model") !== "super_resolution" && (
                        <FormField
                          control={form.control}
                          name="prompt"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div className="relative">
                                  <Textarea
                                    className={`
                                      ${
                                        isMobile
                                          ? "min-h-[100px]"
                                          : `min-h-[120px]`
                                      }
                                      resize-none border-muted bg-muted/20
                                      text-sm
                                      ${isMobile ? "text-base" : ""}
                                    `}
                                    maxLength={800}
                                    placeholder="描述想要生成的图片"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setPromptLength(e.target.value.length);
                                    }}
                                  />
                                  <div
                                    className={`
                                      absolute right-2 bottom-2 text-xs
                                      text-muted-foreground
                                    `}
                                  >
                                    {promptLength}/800
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                          rules={{
                            required:
                              form.watch("model") !== "super_resolution"
                                ? "请输入提示词"
                                : false,
                          }}
                        />
                      )}

                      {/* 图像超分放大倍数选择 */}
                      {form.watch("model") === "super_resolution" && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium">放大倍数</h3>
                          <FormField
                            control={form.control}
                            name="scaleFactor"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <div className="grid grid-cols-3 gap-2">
                                    <Button
                                      className="h-10"
                                      onClick={() => field.onChange(2)}
                                      size="sm"
                                      type="button"
                                      variant={
                                        field.value === 2
                                          ? "default"
                                          : "outline"
                                      }
                                    >
                                      2倍
                                    </Button>
                                    <Button
                                      className="h-10"
                                      onClick={() => field.onChange(4)}
                                      size="sm"
                                      type="button"
                                      variant={
                                        field.value === 4
                                          ? "default"
                                          : "outline"
                                      }
                                    >
                                      4倍
                                    </Button>
                                    <Button
                                      className="h-10"
                                      onClick={() => field.onChange(8)}
                                      size="sm"
                                      type="button"
                                      variant={
                                        field.value === 8
                                          ? "default"
                                          : "outline"
                                      }
                                    >
                                      8倍
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <p className="text-xs text-muted-foreground">
                            选择图像放大的倍数，倍数越高分辨率越高
                          </p>
                        </div>
                      )}

                      {/* 错误信息显示 */}
                      {errorMessage && (
                        <Alert variant="destructive">
                          <AlertDescription className="font-medium text-red-700">
                            {errorMessage}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* 生成按钮 */}
                      <Button
                        className={`
                          h-12 w-full bg-gradient-to-r from-purple-500
                          to-pink-500 text-base font-medium
                          hover:from-purple-600 hover:to-pink-600
                        `}
                        disabled={loading}
                        size="lg"
                        type="submit"
                      >
                        {loading ? getTaskStatusText() : "生成图片"}
                      </Button>
                    </form>
                  </Form>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* 右侧结果面板 */}
            <ResizablePanel defaultSize={70}>
              <div className="h-full overflow-auto">
                <div className="p-6">
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold">生成结果</h1>
                    <p className="text-muted-foreground">
                      共 {results.length} 张图片
                    </p>
                  </div>

                  {loadingHistory ? (
                    <div className="flex h-[400px] items-center justify-center">
                      <div className="text-center">
                        <div className="mb-4 text-6xl opacity-20">⏳</div>
                        <p className="text-lg font-medium text-muted-foreground">
                          正在加载历史生成记录...
                        </p>
                      </div>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="flex h-[400px] items-center justify-center">
                      <div className="text-center">
                        <div className="mb-4 text-6xl opacity-20">🎨</div>
                        <p className="text-lg font-medium text-muted-foreground">
                          还没有生成任何图片
                        </p>
                        <p className="mt-2 text-muted-foreground">
                          在左侧表单中输入提示词开始生成
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`
                        columns-2 gap-4
                        sm:columns-2
                        lg:columns-3
                        xl:columns-4
                      `}
                    >
                      {results.map((result) => (
                        <Card
                          className={`
                            mb-4 break-inside-avoid overflow-hidden
                            transition-shadow
                            hover:shadow-lg
                          `}
                          key={result.id}
                        >
                          <div
                            className="group relative cursor-pointer"
                            onClick={() => handleImageClick(result.imageUrl)}
                          >
                            <img
                              alt={result.prompt}
                              className={`
                                w-full object-cover transition-transform
                                group-hover:scale-105
                              `}
                              src={result.imageUrl}
                            />
                            {/* LivePortrait动画按钮 */}
                            {result.livePortraitCompatible && (
                              <div
                                className={`
                                absolute top-2 left-2 animate-pulse
                              `}
                              >
                                <Button
                                  className={`
                                    h-8 w-8 rounded-full bg-gradient-to-r
                                    from-indigo-500 via-purple-500 to-pink-500
                                    p-0 shadow-lg
                                  `}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 点击后执行动画逻辑
                                    window.open(
                                      `/liveportrait?imageId=${result.id}`,
                                      "_blank",
                                    );
                                  }}
                                  size="sm"
                                  variant="secondary"
                                >
                                  <span className="text-white">🎬</span>
                                </Button>
                              </div>
                            )}
                            {/* 操作按钮 */}
                            <div
                              className={`
                                absolute top-2 right-2 flex gap-1 opacity-0
                                transition-opacity
                                group-hover:opacity-100
                              `}
                            >
                              <Button
                                className={`
                                  h-8 w-8 bg-black/50 p-0
                                  hover:bg-black/70
                                `}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 下载功能
                                  const link = document.createElement("a");
                                  link.href = result.imageUrl;
                                  link.download = `image-${result.id}.png`;
                                  link.click();
                                }}
                                size="sm"
                                variant="secondary"
                              >
                                <span className="text-white">⬇</span>
                              </Button>
                              <Button
                                className={`
                                  h-8 w-8 bg-red-500/80 p-0
                                  hover:bg-red-600/90
                                `}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 删除功能 - 从结果列表中移除
                                  setResults((prev) =>
                                    prev.filter((r) => r.id !== result.id),
                                  );
                                }}
                                size="sm"
                                variant="destructive"
                              >
                                <X className="size-3 text-white" />
                              </Button>
                            </div>
                          </div>
                          <div className="p-4">
                            <p
                              className={`
                                mb-2 line-clamp-2 text-base font-medium
                              `}
                            >
                              {result.prompt}
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground">
                                {result.createdAt.toLocaleString("zh-CN", {
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  month: "short",
                                })}
                              </p>
                              <Button
                                className="h-8 px-3 text-sm"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    setLoading(true);
                                    setErrorMessage(null);

                                    // 调用重试API
                                    const response = await fetch(
                                      `/api/image-edits/results/${result.id}/retry`,
                                      {
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        method: "POST",
                                      },
                                    );

                                    if (!response.ok) {
                                      const errorData = (await response
                                        .json()
                                        .catch(() => null)) as null | {
                                        error?: string;
                                        message?: string;
                                      };
                                      const errorMessage =
                                        errorData?.error ||
                                        errorData?.message ||
                                        `HTTP ${response.status}: ${response.statusText}`;
                                      throw new Error(
                                        `重试失败: ${errorMessage}`,
                                      );
                                    }

                                    const responseData =
                                      (await response.json()) as {
                                        data?: { taskId: string };
                                        error?: string;
                                        message?: string;
                                        success: boolean;
                                      };

                                    if (
                                      !responseData.success ||
                                      !responseData.data
                                    ) {
                                      const errorMessage =
                                        responseData.error ||
                                        responseData.message ||
                                        "未知错误";
                                      throw new Error(
                                        `重试失败: ${errorMessage}`,
                                      );
                                    }

                                    const taskId = responseData.data.taskId;

                                    // 设置初始任务状态
                                    setTaskStatus("pending");

                                    // 开始轮询任务状态
                                    pollingIntervalRef.current = setInterval(
                                      () => pollTaskStatus(taskId),
                                      3000,
                                    ); // 每3秒轮询一次
                                  } catch (error) {
                                    console.error("重试失败:", error);
                                    let errorMessage = "重试失败";

                                    if (error instanceof Error) {
                                      errorMessage = error.message;
                                    } else if (typeof error === "string") {
                                      errorMessage = error;
                                    }

                                    setErrorMessage(errorMessage);
                                    setLoading(false);
                                  }
                                }}
                                size="sm"
                                variant="outline"
                              >
                                重试
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      {/* 图片预览对话框 */}
      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent
          className={`
            max-h-[90vh] overflow-hidden
            sm:max-w-[90vw]
          `}
        >
          <DialogHeader>
            <DialogTitle>查看图片</DialogTitle>
          </DialogHeader>
          <div
            className={`
              flex max-h-[75vh] items-center justify-center overflow-hidden
            `}
          >
            <img
              alt="放大后的图片"
              className="max-h-full max-w-full object-contain"
              src={selectedImageUrl}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
