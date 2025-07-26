"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { useIsMobile } from "~/hooks/use-mobile";
import { FileUploader } from "~/ui/components/file-uploader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/ui/primitives/accordion";
import { Alert, AlertDescription } from "~/ui/primitives/alert";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/ui/primitives/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/ui/primitives/select";
import { Slider } from "~/ui/primitives/slider";
import { Switch } from "~/ui/primitives/switch";

// 图片接口
interface CompatibleImage {
  detectedAt: string;
  imageId: string;
  imageUrl: string;
  message: string;
}

// 表单数据接口
interface LivePortraitFormData {
  audio_url: string;
  eye_move_freq: number;
  head_move_strength: number;
  image_id: string;
  image_url: string;
  mouth_move_strength: number;
  paste_back: boolean;
  template_id: "active" | "calm" | "normal";
  video_fps: number;
}

// 任务响应接口
interface TaskResponse {
  output: {
    code?: string;
    message?: string;
    results?: {
      video_url: string;
    };
    task_id: string;
    task_status: "FAILED" | "PENDING" | "RUNNING" | "SUCCEEDED";
  };
  request_id?: string;
  usage?: {
    video_duration: number;
    video_ratio: string;
  };
}

export default function LivePortraitPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const imageId = searchParams.get("imageId");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<null | string>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [audioUploadSuccess, setAudioUploadSuccess] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [compatibleImages, setCompatibleImages] = useState<CompatibleImage[]>(
    [],
  );
  const [selectedImage, setSelectedImage] = useState<CompatibleImage | null>(
    null,
  );
  const [resultVideo, setResultVideo] = useState<null | string>(null);
  const [taskId, setTaskId] = useState<null | string>(null);
  const [taskStatus, setTaskStatus] = useState<null | string>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null,
  );

  const form = useForm<LivePortraitFormData>({
    defaultValues: {
      audio_url: "",
      eye_move_freq: 0.5,
      head_move_strength: 0.7,
      image_id: "",
      image_url: "",
      mouth_move_strength: 1.0,
      paste_back: true,
      template_id: "normal",
      video_fps: 24,
    },
  });

  // 加载兼容图片
  const loadCompatibleImages = useCallback(async () => {
    try {
      const response = await fetch("/api/liveportrait-compatible?limit=50");
      if (!response.ok) {
        throw new Error("获取兼容图片失败");
      }

      const data = await response.json();
      if (data.success && data.data) {
        setCompatibleImages(data.data);

        // 如果URL中有imageId参数，则选中对应图片
        if (imageId) {
          const matchedImage = data.data.find(
            (img: CompatibleImage) => img.imageId === imageId,
          );
          if (matchedImage) {
            setSelectedImage(matchedImage);
            form.setValue("image_id", matchedImage.imageId);
            form.setValue("image_url", matchedImage.imageUrl);
          }
        }
      }
    } catch (error) {
      console.error("加载兼容图片失败:", error);
      setErrorMessage("加载兼容图片失败");
    }
  }, [form, imageId]);

  // 处理音频文件上传
  const handleFilesChange = (files: File[]) => {
    setUploadedFiles(files);
  };

  // 处理上传完成
  const handleUploadComplete = (results: { key: string; url: string }[]) => {
    if (results.length > 0) {
      setAudioUrl(results[0].url);
      form.setValue("audio_url", results[0].url);
      setAudioUploadSuccess(true);
    }
  };

  // 轮询任务状态
  const pollTaskStatus = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/liveportrait/${id}`);
        if (!response.ok) {
          throw new Error("获取任务状态失败");
        }

        const data = await response.json();
        if (data.success && data.data) {
          const taskResponse = data.data as TaskResponse;
          setTaskStatus(taskResponse.output.task_status);

          // 如果任务完成或失败，停止轮询
          if (taskResponse.output.task_status === "SUCCEEDED") {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            setLoading(false);

            // 设置视频结果
            if (taskResponse.output.results?.video_url) {
              setResultVideo(taskResponse.output.results.video_url);
            }
          } else if (taskResponse.output.task_status === "FAILED") {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            setErrorMessage(taskResponse.output.message || "视频生成失败");
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("轮询任务状态失败:", error);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setErrorMessage("获取任务状态失败");
        setLoading(false);
      }
    },
    [pollingInterval],
  );

  // 提交表单
  const onSubmit = async (data: LivePortraitFormData) => {
    if (!data.image_url || !data.audio_url) {
      setErrorMessage("请选择图片和上传音频");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResultVideo(null);

    try {
      const response = await fetch("/api/liveportrait", {
        body: JSON.stringify({
          audio_url: data.audio_url,
          eye_move_freq: data.eye_move_freq,
          head_move_strength: data.head_move_strength,
          image_url: data.image_url,
          mouth_move_strength: data.mouth_move_strength,
          paste_back: data.paste_back,
          template_id: data.template_id,
          video_fps: data.video_fps,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error ||
          errorData?.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`创建视频生成任务失败: ${errorMessage}`);
      }

      const responseData = await response.json();
      if (!responseData.success || !responseData.data) {
        const errorMessage =
          responseData.error || responseData.message || "未知错误";
        throw new Error(`创建任务失败: ${errorMessage}`);
      }

      const id = responseData.data.taskId;
      setTaskId(id);
      setTaskStatus("PENDING");

      // 开始轮询任务状态
      const interval = setInterval(() => pollTaskStatus(id), 3000); // 每3秒轮询一次
      setPollingInterval(interval);
    } catch (error) {
      console.error("生成失败:", error);
      let errorMsg = "创建任务失败";
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === "string") {
        errorMsg = error;
      }
      setErrorMessage(errorMsg);
      setLoading(false);
    }
  };

  // 页面加载时获取兼容图片
  useEffect(() => {
    loadCompatibleImages();
  }, [loadCompatibleImages]);

  // 清理轮询间隔
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // 获取任务状态显示文本
  const getTaskStatusText = () => {
    switch (taskStatus) {
      case "PENDING":
        return "等待处理中...";
      case "RUNNING":
        return "正在生成视频...";
      default:
        return "生成中...";
    }
  };

  const handleImageSelect = (image: CompatibleImage) => {
    setSelectedImage(image);
    form.setValue("image_id", image.imageId);
    form.setValue("image_url", image.imageUrl);
  };

  return (
    <div
      className={
        isMobile
          ? "min-h-screen bg-background"
          : `h-screen overflow-auto bg-background`
      }
    >
      <div
        className={`
        mx-auto max-w-7xl px-4 py-6 pb-24
        sm:px-6
        lg:px-8
      `}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold">灵动人像视频生成</h1>
          <p className="text-muted-foreground">
            基于人物肖像图片和人声音频文件，快速生成人像动态视频
          </p>
        </div>

        <div
          className={`
          grid gap-6
          md:grid-cols-2
        `}
        >
          {/* 左侧表单区域 */}
          <div className="md:max-h-[80vh] md:overflow-auto">
            <Card>
              <CardHeader>
                <CardTitle>生成设置</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    className="space-y-6"
                    onSubmit={form.handleSubmit(onSubmit)}
                  >
                    {/* 选择图片部分 */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">选择人物图片</h3>

                      {compatibleImages.length === 0 ? (
                        <div
                          className={`
                            flex h-[150px] items-center justify-center
                            rounded-lg border border-dashed
                          `}
                        >
                          <p className="text-center text-muted-foreground">
                            没有找到兼容的图片
                            <br />
                            请先在生成页面创建并检测图片
                          </p>
                        </div>
                      ) : (
                        <div
                          className={`
                            grid grid-cols-3 gap-2
                            sm:grid-cols-4
                            md:grid-cols-3
                            lg:grid-cols-4
                          `}
                        >
                          {compatibleImages.map((image) => (
                            <div
                              className={`
                                group relative aspect-square cursor-pointer
                                overflow-hidden rounded-lg border
                                ${
                                  selectedImage?.imageId === image.imageId
                                    ? `ring-2 ring-primary`
                                    : ""
                                }
                              `}
                              key={image.imageId}
                              onClick={() => handleImageSelect(image)}
                            >
                              <img
                                alt="兼容的人物图片"
                                className={`
                                  h-full w-full object-cover
                                  transition-transform
                                  group-hover:scale-105
                                `}
                                src={image.imageUrl}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 上传音频部分 */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium">上传音频</h3>
                      <p className="text-xs text-muted-foreground">
                        支持mp3、wav格式，时长1秒到5分钟，文件小于15MB
                      </p>

                      {!audioUploadSuccess && (
                        <FileUploader
                          accept={{
                            "audio/*": [".mp3", ".wav"],
                          }}
                          maxFiles={1}
                          maxSize={15 * 1024 * 1024} // 15MB
                          onFilesChange={handleFilesChange}
                          onUploadComplete={handleUploadComplete}
                          value={uploadedFiles}
                        />
                      )}

                      {audioUploadSuccess && (
                        <div
                          className={`
                            flex items-center justify-between rounded-lg border
                            p-3
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-xl">🔊</div>
                            <span className="text-sm">已上传音频文件</span>
                          </div>
                          <Button
                            onClick={() => {
                              setAudioUploadSuccess(false);
                              setAudioUrl("");
                              form.setValue("audio_url", "");
                              setUploadedFiles([]);
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            更换
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* 高级设置部分 */}
                    <Accordion
                      className="space-y-4"
                      collapsible
                      defaultValue="item-1"
                      type="single"
                    >
                      <AccordionItem className="border-none" value="item-1">
                        <AccordionTrigger className="py-0">
                          <h3 className="text-sm font-medium">高级设置</h3>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                          <div className="space-y-4">
                            {/* 动作模板 */}
                            <FormField
                              control={form.control}
                              name="template_id"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>动作模板</FormLabel>
                                  <Select
                                    defaultValue={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="normal">
                                        标准（默认动作，头部动作幅度适中）
                                      </SelectItem>
                                      <SelectItem value="calm">
                                        平静（头部动作幅度较小，适用于严肃场景）
                                      </SelectItem>
                                      <SelectItem value="active">
                                        活跃（头部动作幅度较大，适用于活泼场景）
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    选择预设的动作模板控制人物头部运动姿态和幅度
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            {/* 眨眼频率 */}
                            <FormField
                              control={form.control}
                              name="eye_move_freq"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex justify-between">
                                    <FormLabel>眨眼频率</FormLabel>
                                    <span
                                      className={`text-sm text-muted-foreground`}
                                    >
                                      {field.value.toFixed(1)}
                                    </span>
                                  </div>
                                  <FormControl>
                                    <Slider
                                      max={1}
                                      min={0}
                                      onValueChange={(values) =>
                                        field.onChange(values[0])
                                      }
                                      step={0.1}
                                      value={[field.value]}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    调整每秒眨眼次数，值越大眨眼频率越高
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            {/* 嘴部动作幅度 */}
                            <FormField
                              control={form.control}
                              name="mouth_move_strength"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex justify-between">
                                    <FormLabel>嘴部幅度</FormLabel>
                                    <span
                                      className={`text-sm text-muted-foreground`}
                                    >
                                      {field.value.toFixed(1)}
                                    </span>
                                  </div>
                                  <FormControl>
                                    <Slider
                                      max={1.5}
                                      min={0}
                                      onValueChange={(values) =>
                                        field.onChange(values[0])
                                      }
                                      step={0.1}
                                      value={[field.value]}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    调整嘴部动作的幅度，值越大嘴型越大，设为0则嘴部无动作
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            {/* 头部动作幅度 */}
                            <FormField
                              control={form.control}
                              name="head_move_strength"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex justify-between">
                                    <FormLabel>头部幅度</FormLabel>
                                    <span
                                      className={`text-sm text-muted-foreground`}
                                    >
                                      {field.value.toFixed(1)}
                                    </span>
                                  </div>
                                  <FormControl>
                                    <Slider
                                      max={1}
                                      min={0}
                                      onValueChange={(values) =>
                                        field.onChange(values[0])
                                      }
                                      step={0.1}
                                      value={[field.value]}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    调整头部动作幅度，值越大头部动作幅度越大
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            {/* 视频帧率 */}
                            <FormField
                              control={form.control}
                              name="video_fps"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex justify-between">
                                    <FormLabel>视频帧率</FormLabel>
                                    <span
                                      className={`text-sm text-muted-foreground`}
                                    >
                                      {field.value} FPS
                                    </span>
                                  </div>
                                  <FormControl>
                                    <Slider
                                      max={30}
                                      min={15}
                                      onValueChange={(values) =>
                                        field.onChange(values[0])
                                      }
                                      step={1}
                                      value={[field.value]}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    调整输出视频帧率，可选15-30帧
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            {/* 贴回原图选项 */}
                            <FormField
                              control={form.control}
                              name="paste_back"
                              render={({ field }) => (
                                <FormItem
                                  className={`
                                    flex flex-row items-center justify-between
                                    rounded-lg border p-3
                                  `}
                                >
                                  <div className="space-y-0.5">
                                    <FormLabel>贴回原图</FormLabel>
                                    <FormDescription>
                                      生成的人脸是否贴回原图，关闭则仅输出生成的人脸，忽略人物身体
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

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
                      disabled={
                        loading || !selectedImage || !audioUploadSuccess
                      }
                      size="lg"
                      type="submit"
                    >
                      {loading ? getTaskStatusText() : "生成视频"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* 右侧结果区域 */}
          <div className="md:max-h-[80vh] md:overflow-auto">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>生成结果</CardTitle>
              </CardHeader>
              <CardContent>
                {resultVideo ? (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-lg border">
                      <video className="w-full" controls src={resultVideo}>
                        <track kind="captions" label="中文" src="" />
                        你的浏览器不支持视频标签
                      </video>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = resultVideo;
                          link.download = `liveportrait-${Date.now()}.mp4`;
                          link.click();
                        }}
                        variant="outline"
                      >
                        下载视频
                      </Button>
                      <Button
                        onClick={() => {
                          setResultVideo(null);
                          form.reset({
                            audio_url: "",
                            eye_move_freq: 0.5,
                            head_move_strength: 0.7,
                            image_id: selectedImage?.imageId || "",
                            image_url: selectedImage?.imageUrl || "",
                            mouth_move_strength: 1.0,
                            paste_back: true,
                            template_id: "normal",
                            video_fps: 24,
                          });
                          setAudioUploadSuccess(false);
                          setUploadedFiles([]);
                        }}
                        variant="default"
                      >
                        重新生成
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`
                      flex h-[400px] flex-col items-center justify-center
                    `}
                  >
                    <div className="text-center">
                      <div className="mb-4 text-6xl opacity-20">🎬</div>
                      <p className="text-lg font-medium text-muted-foreground">
                        视频生成结果将在这里显示
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        在左侧选择图片、上传音频并调整参数开始生成
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
