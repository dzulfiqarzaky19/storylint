// =============================================================================
// resolvePickerTarget — PURE. Maps the wiki-target picker modal's user choice to
// the exact arguments confirmCard already expects, so the modal REPLACES the
// confirmation strip without touching the write contract (product rule 1: the
// modal's confirm IS the only wiki-write gate).
//
// The modal drills category -> entry -> key/value. The single behavior-bearing
// decision it emits is ENRICH-vs-MINT, which is entirely carried by whether the
// writer landed on an EXISTING entry (entryId set) or is proposing a NEW one
// (entryId absent):
//
//   entryId set   -> ENRICH: confirmCard folds a fact {key, value} onto it
//                    (enrichEntryId = entryId; entry.name = factKey is the fact
//                    key, entry.summary = factValue is the fact value — the exact
//                    mapping confirmCard's enrich branch reads).
//   entryId absent -> MINT: confirmCard creates a new entry {name, kind, summary}
//                    linked to the active world (enrichEntryId = undefined).
//
// Producer-agnostic: the modal is fed a ResolvedTarget default (synthesized from
// a research proposition today, from a check Mark on /write later); this resolver
// only reads the writer's FINAL choice, never the producer.
// =============================================================================

import type { Kind } from "@/lib/domain/types";

const VALID_KINDS: readonly Kind[] = [
  "character",
  "world",
  "organization",
  "lore",
];

/**
 * The writer's final choice, collected by the modal. `entryId` is the ENRICH
 * signal (present = fold into that live entry; absent = mint a new one). Every
 * field is already the edited value — the modal is suggested-but-editable, so
 * these are what the writer confirmed, not the defaults they were shown.
 */
export interface PickerResult {
  /**
   * Picked category id (a live category / built-in kind). Drives a mint's kind.
   * Empty when the writer is minting a NEW category — `proposeCategoryName` then
   * carries the name and the caller resolves the real id via createCategory.
   */
  categoryId: string;
  /** Set -> mint a new category with this name first, then use its id as kind. */
  proposeCategoryName?: string;
  /** Set -> enrich this live entry. Absent -> mint a new entry. */
  entryId?: string;
  /** New entry's name (mint) OR the fact key written onto the enriched entry. */
  entryName: string;
  /** The key/value pair the writer confirmed. On a mint this is the seed fact. */
  factKey: string;
  factValue: string;
}

/** The subset of confirmCard's input this resolver fully determines. */
export interface ConfirmCardArgs {
  entry: { name: string; kind: Kind; summary: string };
  enrichEntryId?: string;
}

/**
 * Narrow a picked category id to the closed `Kind` union confirmCard's mint path
 * requires. Built-in category ids equal the Kind strings. Anything else (a user
 * category id, or the empty sentinel of a brand-new category) falls back to
 * `lore` so this pure resolver never crashes on an out-of-union kind. On the
 * new-category path this fallback is inert: the caller mints the real category
 * and passes its `{id, shelf}` to confirmCard, which uses the real id as the
 * entry kind and never reads this `lore`.
 */
function toKind(categoryId: string): Kind {
  return (VALID_KINDS as readonly string[]).includes(categoryId)
    ? (categoryId as Kind)
    : "lore";
}

/**
 * Map the modal's result to confirmCard's arguments. ENRICH vs MINT is decided
 * SOLELY by `entryId` presence — the whole picker collapses to that one bit plus
 * the edited fields.
 *
 * ENRICH: confirmCard reads `entry.name` as the fact KEY and `entry.summary` as
 * the fact VALUE, so we route factKey -> name and factValue -> summary. The
 * category/kind is irrelevant on the enrich branch (the target entry already has
 * its own kind), so we still pass a valid kind for type-safety but it is unused.
 *
 * MINT: confirmCard reads `entry.{name,kind,summary}` to create the entry, so we
 * route entryName -> name, the picked category -> kind, and factValue -> summary
 * (the new entry's summary seeds from the value the writer wrote).
 */
export function resolvePickerTarget(result: PickerResult): ConfirmCardArgs {
  if (result.entryId) {
    return {
      enrichEntryId: result.entryId,
      entry: {
        name: result.factKey,
        kind: toKind(result.categoryId),
        summary: result.factValue,
      },
    };
  }
  return {
    entry: {
      name: result.entryName,
      kind: toKind(result.categoryId),
      summary: result.factValue,
    },
  };
}
