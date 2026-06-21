import type {
  ImageGenerateParams,
  ImageGenerateResult,
  ImageProviderConfig,
  OpenAIImageRequest,
  OpenAIImageResponse,
} from "./types.js";

/**
 * 图片生成 API 错误。
 */
export class ImageApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "ImageApiError";
  }
}

/**
 * 调用图片生成 API。
 *
 * 当前支持 OpenAI Images API（DALL-E）。
 * 后续可扩展 Stability AI、Replicate 等。
 *
 * @param config Provider 配置（baseUrl, apiKey, imageApi 类型）
 * @param params 用户请求参数
 * @param signal 取消信号
 * @returns 图片生成结果
 */
export async function callImageApi(
  config: ImageProviderConfig,
  params: ImageGenerateParams,
  signal?: AbortSignal,
): Promise<ImageGenerateResult> {
  switch (config.imageApi) {
    case "openai-images":
      return callOpenAIImagesApi(config, params, signal);
    case "openai-responses":
      return callResponsesImageApi(config, params, signal);
    case "stability":
      throw new ImageApiError("Stability AI API 尚未实现", undefined, config.providerId);
    case "custom":
      return callOpenAIImagesApi(config, params, signal);
    default:
      throw new ImageApiError(`未知的图片 API 类型: ${config.imageApi}`, undefined, config.providerId);
  }
}

/**
 * 调用 OpenAI Images API。
 *
 * 端点: POST {baseUrl}/images/generations
 * 请求体: { model, prompt, n, size, quality, response_format }
 * 响应体: { data: [{ b64_json?, url?, revised_prompt? }] }
 *
 * 使用 b64_json 格式以避免二次下载。
 */
async function callOpenAIImagesApi(
  config: ImageProviderConfig,
  params: ImageGenerateParams,
  signal?: AbortSignal,
): Promise<ImageGenerateResult> {
  const model = params.model ?? config.models[0]?.id ?? "dall-e-3";
  const size = params.size ?? "1024x1024";
  const quality = params.quality ?? "standard";

  // 验证模型是否在配置中
  const modelConfig = config.models.find((m) => m.id === model);
  if (!modelConfig) {
    throw new ImageApiError(
      `模型 "${model}" 不在可用列表中。可用模型: ${config.models.map((m) => m.id).join(", ")}`,
      undefined,
      config.providerId,
    );
  }

  // 验证尺寸是否支持
  if (!modelConfig.sizes.includes(size)) {
    throw new ImageApiError(
      `模型 "${model}" 不支持尺寸 "${size}"。可用尺寸: ${modelConfig.sizes.join(", ")}`,
      undefined,
      config.providerId,
    );
  }

  // 构建请求体
  let bodyStr: string;

  if (config.requestTemplate) {
    // 自定义请求体模板：替换占位符
    bodyStr = config.requestTemplate
      .replace(/\{\{prompt\}\}/g, params.prompt)
      .replace(/\{\{model\}\}/g, model)
      .replace(/\{\{size\}\}/g, size)
      .replace(/\{\{quality\}\}/g, quality)
      .replace(/\{\{n\}\}/g, "1");
  } else {
    bodyStr = JSON.stringify({
      model,
      prompt: params.prompt,
      n: 1,
      size,
      quality: quality === "hd" ? "hd" : undefined,
      response_format: "b64_json",
    });
  }

  // 构建请求 URL
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const endpointPath = config.endpoint ?? "/images/generations";
  const url = `${baseUrl}${endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}`;

  // 发起 HTTP 请求
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: bodyStr,
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new ImageApiError(
      `图片生成 API 请求失败 (${response.status}): ${errorText}`,
      response.status,
      config.providerId,
    );
  }

  const responseBody: OpenAIImageResponse = await response.json();

  if (!responseBody.data?.length) {
    throw new ImageApiError(
      "图片生成 API 返回空数据",
      undefined,
      config.providerId,
    );
  }

  const imageEntry = responseBody.data[0];

  // 解码 base64 图片数据
  if (!imageEntry.b64_json) {
    // 如果返回的是 URL 而非 base64，需要下载
    if (imageEntry.url) {
      return downloadImageFromUrl(imageEntry.url, model, size, signal);
    }
    throw new ImageApiError(
      "图片生成 API 未返回图片数据（无 b64_json 或 url）",
      undefined,
      config.providerId,
    );
  }

  const imageData = Buffer.from(imageEntry.b64_json, "base64");

  // 从 PNG 数据中提取尺寸（PNG header 包含宽高信息）
  const { width, height } = parsePngDimensions(imageData) ?? parseSizeFromString(size);

  return {
    data: new Uint8Array(imageData),
    mimeType: "image/png",
    width,
    height,
    model,
    requestedSize: size,
  };
}

/**
 * 调用 OpenAI Responses API 生成图片（GPT-5.4 / GPT-5.5）。
 * 使用 /v1/responses 端点 + image_generation 工具 + SSE 流式响应。
 *
 * 参考文档: https://e-flowcode.cc/docs/setup/image-api
 */
async function callResponsesImageApi(
  config: ImageProviderConfig,
  params: ImageGenerateParams,
  signal?: AbortSignal,
): Promise<ImageGenerateResult> {
  const model = params.model ?? config.models[0]?.id ?? "gpt-5.4";
  const size = params.size ?? "auto";
  const quality = params.quality ?? "auto";

  // 前缀必须加，防止模型自己改写 prompt
  const prefixedPrompt = `Use the following text as the complete prompt. Do not rewrite it:\n${params.prompt}`;

  const requestBody: Record<string, unknown> = {
    model,
    input: prefixedPrompt,
    tools: [
      {
        type: "image_generation",
        action: "generate",
        size,
        output_format: "png",
        quality,
        partial_images: 3,
      },
    ],
    tool_choice: "required",
    stream: true,
  };

  // 构建请求 URL
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/responses`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new ImageApiError(
      `Responses API 请求失败 (${response.status}): ${errorText}`,
      response.status,
      config.providerId,
    );
  }

  // 解析 SSE 流
  const finalB64 = await parseSSEImageStream(response, signal);

  if (!finalB64) {
    throw new ImageApiError(
      "Responses API 未返回有效图片数据",
      undefined,
      config.providerId,
    );
  }

  const imageData = Buffer.from(finalB64, "base64");
  const { width, height } = parsePngDimensions(new Uint8Array(imageData)) ?? parseSizeFromString(size);

  return {
    data: new Uint8Array(imageData),
    mimeType: "image/png",
    width,
    height,
    model,
    requestedSize: size,
  };
}

/**
 * 从 SSE 流中解析图片 base64 数据。
 *
 * 关心的事件：
 * - response.output_item.done (item.type == "image_generation_call") → 最终图
 * - response.failed / error → 失败
 *
 * 返回最终图片的 base64 字符串，或 null。
 */
async function parseSSEImageStream(
  response: Response,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalB64: string | null = null;

  try {
    while (true) {
      // 检查取消
      if (signal?.aborted) return null;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按 \n\n 分割 SSE 事件
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? ""; // 最后一个可能不完整

      for (const event of events) {
        const trimmed = event.trim();
        if (!trimmed) continue;

        // 提取 data: 行
        const dataLine = trimmed
          .split("\n")
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice(6))
          .join("");

        if (!dataLine || dataLine === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataLine);

          // 检查失败事件
          if (parsed.type === "response.failed" || parsed.type === "error") {
            const msg =
              parsed.error?.message ??
              parsed.message ??
              "Responses API 返回错误";
            throw new Error(msg);
          }

          // 提取最终图片
          if (
            parsed.type === "response.output_item.done" &&
            parsed.item?.type === "image_generation_call" &&
            parsed.item?.result
          ) {
            finalB64 = parsed.item.result;
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "Responses API 返回错误") {
            // JSON 解析失败，跳过该事件
          } else {
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return finalB64;
}

/**
 * 从 URL 下载图片。
 */
async function downloadImageFromUrl(
  url: string,
  model: string,
  size: string,
  signal?: AbortSignal,
): Promise<ImageGenerateResult> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new ImageApiError(`下载图片失败 (${response.status})`, response.status);
  }

  const arrayBuffer = await response.arrayBuffer();
  const imageData = new Uint8Array(arrayBuffer);
  const mimeType = response.headers.get("content-type") ?? "image/png";

  // 尝试从数据中解析尺寸
  let width = 0;
  let height = 0;

  if (mimeType === "image/png") {
    const parsed = parsePngDimensions(imageData);
    if (parsed) {
      width = parsed.width;
      height = parsed.height;
    }
  }

  // 如果无法从数据解析，从请求尺寸推断
  if (width === 0 || height === 0) {
    const parsed = parseSizeFromString(size);
    width = parsed.width;
    height = parsed.height;
  }

  return {
    data: imageData,
    mimeType,
    width,
    height,
    model,
    requestedSize: size,
  };
}

/**
 * 从 PNG 文件头解析图片尺寸。
 *
 * PNG 文件头格式：
 * - 前 8 字节：PNG 签名 (89 50 4E 47 0D 0A 1A 0A)
 * - IHDR chunk 从第 16 字节开始
 *   - bytes 16-19: width (big-endian uint32)
 *   - bytes 20-23: height (big-endian uint32)
 */
function parsePngDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data.length < 24) return null;

  // 验证 PNG 签名
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== pngSignature[i]) return null;
  }

  const width = data[16]! * 0x1000000 + data[17]! * 0x10000 + data[18]! * 0x100 + data[19]!;
  const height = data[20]! * 0x1000000 + data[21]! * 0x10000 + data[22]! * 0x100 + data[23]!;

  return { width, height };
}

/**
 * 从尺寸字符串（如 "1024x1024"）解析宽高。
 */
function parseSizeFromString(size: string): { width: number; height: number } {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (match) {
    return { width: Number(match[1]), height: Number(match[2]) };
  }
  // 默认值
  return { width: 1024, height: 1024 };
}