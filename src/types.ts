/** 图片生成 API 类型 */


/** 图片生成请求参数 */
export interface ImageGenerateParams {
  prompt: string;
  model?: string;
  /** 图片尺寸，如 "1024x1024"、"auto"，Responses API 支持任意合法尺寸 */
  size?: string;
  /** 图片质量：openai-images 支持 "standard"/"hd"，Responses API 支持 "auto"/"low"/"medium"/"high" */
  quality?: string;
  output_path?: string;
}

/** 图片生成 API 响应 */
export interface ImageGenerateResult {
  /** 图片二进制数据 */
  data: Uint8Array;
  /** MIME 类型 */
  mimeType: string;
  /** 图片像素宽度 */
  width: number;
  /** 图片像素高度 */
  height: number;
  /** 使用的模型 ID */
  model: string;
  /** 请求的尺寸 */
  requestedSize: string;
}

/** 图片保存结果 */
export interface ImageSaveResult {
  /** 本地文件绝对路径 */
  filePath: string;
  /** 文件大小（字节） */
  fileSize: number;
}

/** OpenAI Images API 请求体 */
export interface OpenAIImageRequest {
  model: string;
  prompt: string;
  n: number;
  size: string;
  quality?: string;
  response_format: "b64_json" | "url";
}

/** OpenAI Images API 响应体 */
export interface OpenAIImageResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}

/** 图片生成 Provider 配置（由环境变量解析） */
export interface ImageProviderConfig {
  /** Provider ID（如 custom） */
  providerId: string;
  /** API base URL */
  baseUrl: string;
  /** API key（已解析） */
  apiKey: string;
  /** 图片生成 API 类型 */
  imageApi: "openai-images" | "openai-responses" | "stability" | "custom";
  /** 可用模型列表 */
  models: ImageModelConfig[];
  /** 请求端点路径（默认 /images/generations） */
  endpoint?: string;
  /** 自定义请求体模板（JSON 字符串，用 {{prompt}}/{{model}}/{{size}}/{{quality}}/{{n}} 占位） */
  requestTemplate?: string;
}

/** 图片生成模型配置 */
export interface ImageModelConfig {
  /** 模型 ID */
  id: string;
  /** 模型名称 */
  name: string;
  /** 支持的尺寸 */
  sizes: string[];
  /** 支持的质量选项 */
  qualities: string[];
}