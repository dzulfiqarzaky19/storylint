// Barrel: preserves the "./gazetteer-mutations" import path after the file was
// split into per-aggregate modules (T-ARCH-12). No caller import changed.
export * from "./facts";
export * from "./entries";
export * from "./ties";
export * from "./categories";
export * from "./membership";
export * from "./facets";
