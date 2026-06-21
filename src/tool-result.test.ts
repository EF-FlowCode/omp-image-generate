import { describe, expect, test } from "bun:test";
import { buildGenerateImageToolResult } from "./tool-result.js";

describe("buildGenerateImageToolResult", () => {
  test("returns text summary plus inline image content for omp to render", () => {
    const imageData = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

    const result = buildGenerateImageToolResult(
      {
        data: imageData,
        mimeType: "image/png",
        width: 1024,
        height: 1024,
        model: "gpt-image-1",
        requestedSize: "1024x1024",
      },
      {
        filePath: "/tmp/generated/test.png",
        fileSize: imageData.length,
      },
    );

    expect(result.content).toEqual([
      {
        type: "text",
        text: [
          "✅ 图片已生成",
          "  模型: gpt-image-1",
          "  尺寸: 1024×1024px (1024x1024)",
          "  格式: image/png",
          "  文件大小: 0.0KB",
          "  保存路径: /tmp/generated/test.png",
          "  渲染方式: 由 OMP 宿主内联显示",
        ].join("\n"),
      },
      {
        type: "image",
        data: "iVBORw==",
        mimeType: "image/png",
      },
    ]);
  });

  test("keeps structured details for callers", () => {
    const imageData = Uint8Array.from([0xff, 0xd8, 0xff]);

    const result = buildGenerateImageToolResult(
      {
        data: imageData,
        mimeType: "image/jpeg",
        width: 640,
        height: 480,
        model: "gpt-image-1",
        requestedSize: "auto",
      },
      {
        filePath: "/tmp/generated/test.jpg",
        fileSize: imageData.length,
      },
    );

    expect(result.details).toEqual({
      imagePath: "/tmp/generated/test.jpg",
      fileSize: 3,
      model: "gpt-image-1",
      size: "auto",
      width: 640,
      height: 480,
      mimeType: "image/jpeg",
    });
  });
});
