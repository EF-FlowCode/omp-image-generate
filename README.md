# omp-image-generate

[![npm](https://img.shields.io/npm/v/omp-image-generate)](https://www.npmjs.com/package/omp-image-generate)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

OMP / [oh-my-pi](https://github.com/can1357/oh-my-pi) 文生图插件 — 注册 `generate_image` 工具，调用图片模型生成图片，结果保存到本地并通过宿主内联显示。

## 功能

- 注册 `generate_image` 工具
- 根据提示词调用图片模型生成图片
- 支持 OpenAI Images API / Responses API 两种后端
- 图片保存到本地文件，返回可供 OMP 宿主内联显示的结果

## 工具参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `prompt` | 是 | 图片描述文本（中文或英文） |
| `model` | 否 | 覆盖环境变量中的默认模型 ID |
| `size` | 否 | 图片尺寸，默认 `1024x1024` |
| `quality` | 否 | 图片质量，默认 `standard` |
| `output_path` | 否 | 自定义保存路径 |

默认保存位置：`~/.omp/agent/generated_images/`

## 环境变量

**必填：**

| 变量 | 说明 |
|------|------|
| `IMAGE_GENERATE_MODEL` | 默认图片模型 ID |
| `IMAGE_GENERATE_API_KEY` | API 密钥 |
| `IMAGE_GENERATE_BASE_URL` | API 基础地址 |

**可选：**

| 变量 | 说明 |
|------|------|
| `IMAGE_GENERATE_ENDPOINT` | 自定义 API 端点，默认 `/images/generations` |
| `IMAGE_GENERATE_REQUEST_BODY_TEMPLATE` | 自定义请求体模板 |

## 目录结构

```
omp-image-generate/
├── LICENSE
├── README.md
├── package.json
├── package-lock.json
├── bun.lock
├── tsconfig.json
├── .gitignore
└── src/
    ├── @oh-my-pi-shim.d.ts
    ├── api.ts
    ├── bun-test-shim.d.ts
    ├── index.ts
    ├── index.test.js
    ├── tool-result.ts
    ├── tool-result.test.ts
    └── types.ts
```

## 安装

### 通过 OMP 安装（推荐）

```bash
omp plugin install omp-image-generate
```

安装完成后在 OMP 里执行：

```text
/reload-plugins
```

### 从 npm 安装

```bash
npm install -g omp-image-generate
```

### 从源码本地安装

```bash
npm install
npm run build

mkdir -p ~/.omp/extensions/omp-image-generate
cp package.json ~/.omp/extensions/omp-image-generate/
cp -R dist ~/.omp/extensions/omp-image-generate/
cd ~/.omp/extensions/omp-image-generate
npm install --omit=dev
```

## 卸载

```bash
omp plugin uninstall omp-image-generate
```

卸载后运行 `/reload-plugins`。

## 开发

```bash
# 安装依赖
npm install

# 类型检查
npm run check

# 构建
npm run build
```

## License

[MIT](./LICENSE)
