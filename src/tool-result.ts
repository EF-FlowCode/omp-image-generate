import type { ImageGenerateResult, ImageSaveResult } from "./types.js";

type ImageToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

interface ImageToolResultDetails {
  imagePath: string;
  fileSize: number;
  model: string;
  size: string;
  width: number;
  height: number;
  mimeType: string;
}

export interface ImageToolResult {
  content: ImageToolContent[];
  details: ImageToolResultDetails;
}

export function buildGenerateImageToolResult(
  result: ImageGenerateResult,
  saveResult: ImageSaveResult,
): ImageToolResult {
  const sizeKB = (result.data.length / 1024).toFixed(1);
  const summary = [
    "✅ 图片已生成",
    `  模型: ${result.model}`,
    `  尺寸: ${result.width}×${result.height}px (${result.requestedSize})`,
    `  格式: ${result.mimeType}`,
    `  文件大小: ${sizeKB}KB`,
    `  保存路径: ${saveResult.filePath}`,
    "  渲染方式: 由 OMP 宿主内联显示",
  ].join("\n");

  return {
    content: [
      { type: "text", text: summary },
      {
        type: "image",
        data: Buffer.from(result.data).toString("base64"),
        mimeType: result.mimeType,
      },
    ],
    details: {
      imagePath: saveResult.filePath,
      fileSize: saveResult.fileSize,
      model: result.model,
      size: result.requestedSize,
      width: result.width,
      height: result.height,
      mimeType: result.mimeType,
    },
  };
}
