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
  /** Derived 1:1 from the universe (W-1 backfill id). */
  activeWorldId: string;
  /** Resolved internally, not surfaced in the header (book handling → /write). */
  activeBookId: string;
}

/**
 * Resolve the active scope from the URL universe param, validated against the
 * tree so a stale or unknown id falls back to the default universe (never a
 * broken empty page).
 *
 * - activeWorldId is ALWAYS `world-${activeUniverseId}` (the 1:1 W-1 mapping).
 * - activeBookId defaults to DEFAULT_BOOK_ID (full canon) — the wiki header no
 *   longer picks a book, but loadWorldSnapshot still needs an as-of-N book.
 */
export function resolveWikiScope(
  tree: WorldUniverseNode[],
  uParam: string | undefined,
): WikiScope {
  const universe =
    tree.find((x) => x.id === uParam) ??
    tree.find((x) => x.id === DEFAULT_UNIVERSE_ID) ??
    tree[0];
  const activeUniverseId = universe?.id ?? DEFAULT_UNIVERSE_ID;
  return {
    activeUniverseId,
    activeWorldId: `world-${activeUniverseId}`,
    activeBookId: DEFAULT_BOOK_ID,
  };
}
