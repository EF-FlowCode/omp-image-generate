# omp-image-generate

为 OMP / oh-my-pi 注册 `generate_image` 工具，调用图片生成模型，把结果保存到本地并通过宿主内联显示。

## 功能

- 注册 `generate_image` 工具
- 根据提示词调用图片模型生成图片
- 将图片保存到本地文件
- 返回可供 OMP 宿主内联显示的结果

## 工具参数

- `prompt`：图片描述文本，必填
- `model`：可选，覆盖默认模型 ID
- `size`：可选，默认 `1024x1024`
- `quality`：可选，默认 `standard`
- `output_path`：可选，自定义保存路径

默认保存位置：

- `~/.omp/agent/generated_images/`

## 环境变量

必填：

- `IMAGE_GENERATE_MODEL`
- `IMAGE_GENERATE_API_KEY`
- `IMAGE_GENERATE_BASE_URL`

可选：

- `IMAGE_GENERATE_ENDPOINT`
- `IMAGE_GENERATE_REQUEST_BODY_TEMPLATE`

## 目录结构

```text
.
├── package.json
├── package-lock.json
├── bun.lock
├── tsconfig.json
├── README.md
└── src/
    ├── api.ts
    ├── index.ts
    ├── tool-result.ts
    ├── types.ts
    └── *.test.*
```

## 安装

### 推荐：通过 OMP 安装

```bash
omp install omp-image-generate
```

安装完成后建议执行：

```text
/reload-plugins
```

### 本地源码安装

```bash
npm install
npm run build

mkdir -p ~/.omp/extensions/omp-image-generate
cp package.json ~/.omp/extensions/omp-image-generate/
cp -R dist ~/.omp/extensions/omp-image-generate/
cd ~/.omp/extensions/omp-image-generate
npm install --omit=dev
```

## 开发

安装依赖：

```bash
npm install
```

类型检查：

```bash
npm run check
```

构建：

```bash
npm run build
```

## 发布

打包前会自动构建：

```bash
npm pack
```

发布前建议先更新 `package.json` 中的仓库地址：

- `repository.url`
- `homepage`
- `bugs.url`
