import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import imageGenerate from "./index.ts";

function registerGenerateImageTool() {
  let tool;
  const pi = {
    on() {},
    registerTool(definition) {
      tool = definition;
    },
  };

  imageGenerate(pi);
  assert.ok(tool, "generate_image tool should be registered");
  return tool;
}

function withEnv(overrides, fn) {
  const keys = [
    "IMAGE_GENERATE_MODEL",
    "IMAGE_GENERATE_API_KEY",
    "IMAGE_GENERATE_BASE_URL",
    "IMAGE_GENERATE_ENDPOINT",
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const value = overrides[key];
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    } else {
      delete process.env[key];
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous) {
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test("generate_image reports missing required env vars", async () => {
  const tool = registerGenerateImageTool();

  const result = await withEnv({}, () =>
    tool.execute(
      "call-1",
      { prompt: "一只猫" },
      undefined,
      undefined,
      {
        modelRegistry: {
          getAll() {
            throw new Error("should not read model registry");
          },
        },
      },
    ),
  );

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /IMAGE_GENERATE_MODEL/);
  assert.match(result.content[0].text, /IMAGE_GENERATE_API_KEY/);
  assert.match(result.content[0].text, /IMAGE_GENERATE_BASE_URL/);
});

test("generate_image uses env config and posts model to /images/generations", async () => {
  const tool = registerGenerateImageTool();
  const outputDir = "/tmp/omp-image-generate-tests";
  const outputPath = join(outputDir, "result.png");
  mkdirSync(outputDir, { recursive: true });

  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          created: 1,
          data: [{ b64_json: "AQID" }],
        };
      },
      async text() {
        return JSON.stringify({ created: 1, data: [{ b64_json: "AQID" }] });
      },
    };
  };

  try {
    const result = await withEnv(
      {
        IMAGE_GENERATE_MODEL: "gpt-image-2",
        IMAGE_GENERATE_API_KEY: "sk-test",
        IMAGE_GENERATE_BASE_URL: "https://example.com/v1",
      },
      () =>
        tool.execute(
          "call-2",
          { prompt: "一只猫", output_path: outputPath },
          undefined,
          undefined,
          {
            modelRegistry: {
              getAll() {
                throw new Error("should not read model registry");
              },
            },
          },
        ),
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, "https://example.com/v1/images/generations");
    assert.equal(fetchCalls[0].options.method, "POST");
    assert.equal(fetchCalls[0].options.headers.Authorization, "Bearer sk-test");

    const body = JSON.parse(fetchCalls[0].options.body);
    assert.equal(body.model, "gpt-image-2");
    assert.equal(body.prompt, "一只猫");
    assert.equal(result.details.model, "gpt-image-2");
    assert.equal(result.details.imagePath, outputPath);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("generate_image lets request model override env default", async () => {
  const tool = registerGenerateImageTool();

  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          created: 1,
          data: [{ b64_json: "AQID" }],
        };
      },
      async text() {
        return JSON.stringify({ created: 1, data: [{ b64_json: "AQID" }] });
      },
    };
  };

  try {
    const result = await withEnv(
      {
        IMAGE_GENERATE_MODEL: "gpt-image-2",
        IMAGE_GENERATE_API_KEY: "sk-test",
        IMAGE_GENERATE_BASE_URL: "https://example.com/v1",
      },
      () =>
        tool.execute(
          "call-3",
          { prompt: "一只猫", model: "custom-image-model" },
          undefined,
          undefined,
          {},
        ),
    );

    assert.equal(fetchCalls.length, 1);
    const body = JSON.parse(fetchCalls[0].options.body);
    assert.equal(body.model, "custom-image-model");
    assert.equal(result.details.model, "custom-image-model");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
