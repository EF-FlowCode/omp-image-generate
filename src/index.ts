import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import type { ImageGenerateParams, ImageProviderConfig } from "./types.js";
import { callImageApi, ImageApiError } from "./api.js";
import { buildGenerateImageToolResult } from "./tool-result.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { Type } from "typebox";

const DEFAULT_IMAGE_SIZES = [
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1536",
  "1152x768",
  "1216x832",
  "1344x768",
  "1536x1024",
  "1792x1024",
  "1024x1792",
  "2048x1152",
  "2048x2048",
  "2160x3840",
  "3840x2160",
  "auto",
];
const DEFAULT_IMAGE_QUALITIES = ["standard", "hd", "auto", "low", "medium", "high"];

export default function imageGenerate(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("文生图扩展已加载", "info");
  });

  pi.registerTool({
    name: "generate_image",
    label: "生成图片",
    description:
      "调用图片模型生成图片。模型配置来自环境变量，图片会保存到本地文件，并通过 OMP 宿主内联显示。",
    parameters: Type.Object({
      prompt: Type.String({ description: "图片描述文本（中文或英文）" }),
      model: Type.Optional(Type.String({ description: "可选，覆盖环境变量中的默认模型 ID" })),
      size: Type.Optional(Type.String({ description: "图片尺寸，如 1024x1024、1536x1024、auto" })),
      quality: Type.Optional(Type.String({ description: "图片质量，如 standard、hd、auto、low、medium、high" })),
      output_path: Type.Optional(Type.String({ description: "自定义保存路径（可选，默认使用 ~/.omp/agent/generated_images/）" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      const imageParams: ImageGenerateParams = {
        prompt: params.prompt,
        model: params.model,
        size: params.size ?? "1024x1024",
        quality: params.quality ?? "standard",
        output_path: params.output_path,
      };

      try {
        onUpdate?.({
          content: [{ type: "text", text: "正在读取图片生成配置..." }],
          details: {},
        });

        const providerConfig = resolveImageProvider(imageParams.model);

        onUpdate?.({
          content: [
            {
              type: "text",
              text: `正在调用 ${providerConfig.providerId}/${imageParams.model ?? providerConfig.models[0]?.id ?? "default"} 生成图片...`,
            },
          ],
          details: {},
        });

        const result = await callImageApi(providerConfig, imageParams, signal);

        onUpdate?.({
          content: [{ type: "text", text: "图片已生成，正在保存..." }],
          details: {},
        });

        const saveResult = saveImage(result.data, result.mimeType, imageParams);
        return buildGenerateImageToolResult(result, saveResult);
      } catch (error) {
        if (signal?.aborted) {
          return {
            content: [{ type: "text", text: "图片生成已取消" }],
            isError: true,
            details: {},
          };
        }

        const message =
          error instanceof ImageApiError
            ? error.message
            : `图片生成失败: ${error instanceof Error ? error.message : String(error)}`;

        return {
          content: [{ type: "text", text: `❌ ${message}` }],
          isError: true,
          details: {
            error: message,
            statusCode: error instanceof ImageApiError ? error.statusCode : undefined,
          },
        };
      }
    },
  });
}

/**
 * 从环境变量解析图片生成 Provider。
 *
 * 必填：
 * - IMAGE_GENERATE_MODEL
 * - IMAGE_GENERATE_API_KEY
 * - IMAGE_GENERATE_BASE_URL
 *
 * 可选：
 * - IMAGE_GENERATE_ENDPOINT（默认 /images/generations）
 * - IMAGE_GENERATE_REQUEST_BODY_TEMPLATE
 */
function resolveImageProvider(modelOverride?: string): ImageProviderConfig {
  const configuredModelId = process.env.IMAGE_GENERATE_MODEL;
  const apiKey = process.env.IMAGE_GENERATE_API_KEY;
  const baseUrl = process.env.IMAGE_GENERATE_BASE_URL;

  const missing: string[] = [];
  if (!configuredModelId && !modelOverride) missing.push("IMAGE_GENERATE_MODEL");
  if (!apiKey) missing.push("IMAGE_GENERATE_API_KEY");
  if (!baseUrl) missing.push("IMAGE_GENERATE_BASE_URL");

  if (missing.length > 0) {
    throw new ImageApiError(`未找到图片生成配置，请设置以下环境变量：${missing.join("、")}`);
  }

  const modelId = modelOverride ?? configuredModelId!;
  const resolvedApiKey = apiKey!;
  const resolvedBaseUrl = baseUrl!;

  return {
    providerId: "custom",
    baseUrl: resolvedBaseUrl,
    apiKey: resolvedApiKey,
    imageApi: "openai-images",
    models: [
      {
        id: modelId,
        name: modelId,
        sizes: DEFAULT_IMAGE_SIZES,
        qualities: DEFAULT_IMAGE_QUALITIES,
      },
    ],
    endpoint: process.env.IMAGE_GENERATE_ENDPOINT ?? "/images/generations",
    requestTemplate: process.env.IMAGE_GENERATE_REQUEST_BODY_TEMPLATE,
  };
}

function saveImage(
  imageData: Uint8Array,
  mimeType: string,
  params: ImageGenerateParams,
): { filePath: string; fileSize: number } {
  const defaultDir = join(homedir(), ".omp", "agent", "generated_images");
  const saveDir = params.output_path ? join(params.output_path, "..") : defaultDir;

  mkdirSync(saveDir, { recursive: true });

  const ext = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "png";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const promptHash = createHash("sha256").update(params.prompt).digest("hex").slice(0, 8);
  const fileName = `${timestamp}_${promptHash}.${ext}`;
  const filePath = params.output_path
    ? params.output_path.endsWith(`.${ext}`)
      ? params.output_path
      : join(params.output_path, fileName)
    : join(saveDir, fileName);

  writeFileSync(filePath, imageData);

  return {
    filePath,
    fileSize: imageData.length,
  };
}
