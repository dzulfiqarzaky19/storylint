// Barrel: preserves the "@/lib/actions/wiki" import path after the file was
// split into focused modules (T-ARCH-7). No caller import changed.
export * from "./entries";
export * from "./categories";
export * from "./trash";
export * from "./aiSuggest";
export * from "./worldStructure";
