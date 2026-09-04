// =============================================================================
// The wiki-target picker's output contract (T-DEEP-2).
//
// Types only, and deliberately so: `writeConfirmedTarget` is a "use server"
// module, which may export nothing but async functions, so the shapes its
// callers construct have to live beside it rather than in it. The modal, both
// screens, and the write module all speak exactly these two types.
// =============================================================================

import type { Mark } from "@/lib/check";

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
   * carries the name and the write module mints the real row first.
   */
  categoryId: string;
  /** Set -> mint a new category with this name first, then use its id as kind. */
  proposeCategoryName?: string;
  /** Set -> enrich this live entry. Absent -> mint a new entry. */
  entryId?: string;
  /** New entry's name (mint). Ignored on the enrich path. */
  entryName: string;
  /** The key/value pair the writer confirmed. On a mint the value seeds the summary. */
  factKey: string;
  factValue: string;
}

/**
 * What the writer was looking at when they opened the picker.
 *
 * The origin — NOT the caller — decides the stable ids that make a re-confirm
 * idempotent, whether a confirmed enrich CORRECTS a contradicted fact or appends
 * beside it, and whether the source research card flips onto the board as "in
 * the wiki". A screen states where the confirmation came from and nothing more.
 */
export type PickerOrigin =
  /** /write: a check Mark on the manuscript. */
  | { from: "mark"; mark: Mark }
  /** /research: a proposition card the writer chose to write in. */
  | { from: "card"; propositionId: string };
