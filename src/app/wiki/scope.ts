// TCK-017 (W-5 UI cut-over) — PURE scope resolution for the wiki page.
//
// Extracted from page.tsx so the active-world default and book fallback are
// unit-testable and mutation-provable without a running server (page.tsx is a
// server component with I/O). No I/O here: inputs -> derived scope strings.
//
// The wiki header now presents exactly Universe + World. Series and Book are no
// longer surfaced (book handling moved to /write). The active WORLD is derived
// 1:1 from the universe (`world-${universeId}`, the W-1 backfill id); the active
// BOOK is resolved internally (default DEFAULT_BOOK_ID = full canon) so
// loadWorldSnapshot's progressive as-of-N read still works, but the writer no
// longer picks a book from the wiki header.

import type { WorldUniverseNode } from "@/lib/db/queries";
import { DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID } from "@/lib/db/scope";

/** The scope the wiki header + snapshot read resolve to from the URL. */
export interface WikiScope {
  activeUniverseId: string;
  /**
   * TCK-022 (W-4a): resolved from the `?w=` param, validated against the active
   * universe's real worlds list; falls back to that universe's FIRST world when
   * `?w=` is absent or names a world outside the active universe. (Before W-4a
   * this was derived 1:1 as `world-${universeId}`.)
   */
  activeWorldId: string;
  /** Resolved internally, not surfaced in the header (book handling → /write). */
  activeBookId: string;
}

/**
 * Resolve the active scope from the URL universe (`?u=`) and world (`?w=`)
 * params, each validated against the tree so a stale or unknown id falls back to
 * a sensible default (never a broken empty page).
 *
 * - activeUniverseId: the `?u=` universe if it exists in the tree, else the
 *   default universe, else the first universe.
 * - activeWorldId (TCK-022): the `?w=` world IF it belongs to the ACTIVE
 *   universe's worlds; otherwise the active universe's FIRST world. A `?w=` that
 *   names a world in a DIFFERENT universe is rejected (never cross-scopes). When
 *   the universe has no worlds row at all (pre-backfill), it falls back to the
 *   legacy 1:1 id `world-${activeUniverseId}` so the page still renders.
 * - activeBookId defaults to DEFAULT_BOOK_ID (full canon) — the wiki header no
 *   longer picks a book, but loadWorldSnapshot still needs an as-of-N book.
 */
export function resolveWikiScope(
  tree: WorldUniverseNode[],
  uParam: string | undefined,
  wParam?: string | undefined,
): WikiScope {
  const universe =
    tree.find((x) => x.id === uParam) ??
    tree.find((x) => x.id === DEFAULT_UNIVERSE_ID) ??
    tree[0];
  const activeUniverseId = universe?.id ?? DEFAULT_UNIVERSE_ID;
  // Only worlds of the ACTIVE universe are selectable, so a `?w=` from a sibling
  // universe can never cross-scope. Default to the universe's first world; if it
  // has none (pre-backfill), the legacy 1:1 id keeps the page renderable.
  const worlds = universe?.worlds ?? [];
  const activeWorldId =
    worlds.find((w) => w.id === wParam)?.id ??
    worlds[0]?.id ??
    `world-${activeUniverseId}`;
  return {
    activeUniverseId,
    activeWorldId,
    activeBookId: DEFAULT_BOOK_ID,
  };
}
