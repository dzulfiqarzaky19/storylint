// T-NAV-SCOPE — PURE nav-href builder for the global header nav.
//
// The bug this fixes: active scope (world) lives ONLY in each surface's URL
// params (?u=/?w=), with no cookie/localStorage behind it. The header nav links
// were bare ("/wiki", "/research", "/write"), so switching world on /wiki and
// then clicking "write" dropped ?u=/?w= and the target surface fell back to its
// DEFAULT (first) world — the "active world is global across surfaces" intent
// silently broke on cross-surface navigation.
//
// Fix: carry the SHARED world axes (u, w) forward onto every nav target so the
// active world follows you across /wiki, /research, /write. The surface-specific
// axes (?book= on /write, ?thread= on /research) are intentionally NOT carried:
// a book id is meaningless to /research and a thread id is meaningless to /write,
// and each surface's resolver falls back to that world's first book/thread. So
// the world stays put; the sub-axis re-resolves per surface. Pure string math:
// unit-testable and mutation-provable without a running server.

/** The shared scope axes that identify the active world across every surface. */
export interface NavScope {
  u?: string;
  w?: string;
}

/**
 * Build the href for a nav target, carrying the active world (u, w) forward.
 *
 * - `href` is the bare surface path ("/wiki" | "/research" | "/write").
 * - Only `u`/`w` are propagated (the world identity shared by every surface);
 *   surface-specific axes like `book`/`thread` are deliberately dropped so they
 *   never leak an id that is invalid on the destination surface.
 * - When no world is active (both absent), the bare path is returned unchanged
 *   so the target resolves its own default — byte-identical to the old behavior.
 */
export function navHref(href: string, scope: NavScope): string {
  const params = new URLSearchParams();
  if (scope.u) params.set("u", scope.u);
  if (scope.w) params.set("w", scope.w);
  const qs = params.toString();
  return qs ? `${href}?${qs}` : href;
}
