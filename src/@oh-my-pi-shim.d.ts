/**
 * 本地类型 shim：将 @oh-my-pi/pi-coding-agent 映射到 @earendil-works/pi-coding-agent。
 * omp 运行时在加载插件时注入 @oh-my-pi 别名，本地开发需要此 shim 让 tsc 通过。
 */
declare module "@oh-my-pi/pi-coding-agent" {
  export type {
    ExtensionAPI,
    ExtensionContext,
    ExtensionCommandContext,
    ToolDefinition,
    ExtensionFactory,
  } from "@earendil-works/pi-coding-agent";
}