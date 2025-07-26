# LivePortrait检测结果存储功能

## 概述

LivePortrait检测结果存储功能将阿里云LivePortrait人脸检测API的结果保存到数据库中，便于后续查询和使用。

## 数据库结构

在 `image_edit_results` 表中新增了以下字段：

- `liveportrait_compatible`: boolean - 是否兼容LivePortrait
- `liveportrait_detected_at`: timestamp - 检测时间
- `liveportrait_message`: text - 检测消息
- `liveportrait_request_id`: text - API请求ID

## API接口

### 1. 检测并存储结果

**POST** `/api/liveportrait-detect`

请求体：

```json
{
  "imageId": "图片编辑结果ID",
  "imageUrl": "图片URL"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "imageId": "图片ID",
    "isLivePortraitCompatible": true,
    "message": "检测消息",
    "requestId": "API请求ID"
  }
}
```

### 2. 查询检测结果

**GET** `/api/liveportrait-detect/[imageId]`

响应：

```json
{
  "success": true,
  "data": {
    "imageId": "图片ID",
    "imageUrl": "图片URL",
    "isLivePortraitCompatible": true,
    "message": "检测消息",
    "detectedAt": "2024-01-01T00:00:00.000Z",
    "requestId": "API请求ID"
  }
}
```

### 3. 获取兼容图片列表

**GET** `/api/liveportrait-compatible?limit=20`

响应：

```json
{
  "success": true,
  "total": 5,
  "data": [
    {
      "imageId": "图片ID",
      "imageUrl": "图片URL",
      "detectedAt": "2024-01-01T00:00:00.000Z",
      "message": "检测消息"
    }
  ]
}
```

## 服务函数

### `getLivePortraitDetectionResult(imageId: string)`

获取指定图片的LivePortrait检测结果。

### `updateLivePortraitDetectionResult(imageId: string, detection: object)`

更新图片的LivePortrait检测结果。

### `getLivePortraitCompatibleImages(limit: number)`

批量获取LivePortrait兼容的图片列表。

## 使用流程

1. **自动检测**: 图片生成成功后，系统会自动调用LivePortrait检测API
2. **结果存储**: 检测结果会自动保存到数据库
3. **结果查询**: 可通过API查询检测结果
4. **兼容筛选**: 可获取所有兼容LivePortrait的图片

## 错误处理

- 检测失败不会影响主图片生成流程
- 数据库保存失败会记录日志但不抛出错误
- 查询不存在的图片会返回404错误

## 注意事项

- LivePortrait检测是异步进行的，不影响图片生成速度
- 检测结果缓存在数据库中，避免重复检测
- API调用需要配置 `DASHSCOPE_API_KEY` 环境变量
