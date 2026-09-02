// Barrel: preserves the "@/lib/actions/write" import path after the file was
// split into focused modules (T-ARCH-9). No caller import changed.
export * from "./manuscript";
export * from "./chapters";
export * from "./marks";
export * from "./ai";
