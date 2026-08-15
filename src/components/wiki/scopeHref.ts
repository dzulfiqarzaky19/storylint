// TCK-022 / TCK-E02 — the pure /wiki scope href builder, extracted from
// ScopePill so the nav target is unit-testable and mutation-provable without
// pulling in the client component's React / next-navigation / server-action
// imports.
//
// `w` is optional: omit it (picking a universe) and the server resolves that
// universe's first world; pass it (picking OR creating a specific world) to
// select that world. Omitted axes fall back on the server default
// (resolveWikiScope). TCK-E02: onNewWorld MUST pass the freshly-created world id
// here so the writer lands ON the new world instead of snapping back to
// worlds[0].
//
// T-RESEARCH-2: `basePath` lets the SAME pill drive a non-wiki surface. It
// defaults to "/wiki" so every existing caller is byte-identical; /research
// passes "/research" so a world switch re-scopes THAT surface instead of
// jumping to /wiki. Only the path prefix changes; the ?u=/?w= contract is
// shared (both surfaces resolve it with resolveWikiScope).
export function scopeHref(u: string, w?: string, basePath: string = "/wiki"): string {
  const params = new URLSearchParams({ u });
  if (w) params.set("w", w);
  return `${basePath}?${params.toString()}`;
}
