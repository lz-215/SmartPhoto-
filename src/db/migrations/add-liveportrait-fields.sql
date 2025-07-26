-- 为 image_edit_results 表添加 LivePortrait 检测相关字段
ALTER TABLE "image_edit_results" 
ADD COLUMN "liveportrait_compatible" boolean,
ADD COLUMN "liveportrait_detected_at" timestamp,
ADD COLUMN "liveportrait_message" text,
ADD COLUMN "liveportrait_request_id" text; 