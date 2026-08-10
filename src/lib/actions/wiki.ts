"use server";

// =============================================================================
// Wiki Server Actions (HANDOFF §8)
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
//
//   Of the actions in THIS file, `addSuggestionAsFact` is the ONLY one that
//   writes new wiki knowledge, and it is gated on an explicit `confirmed: true`
//   param via `confirmWikiWrite()`. `linkEntry` creates a directional tie
//   between existing entries; the design treats a tie as an arrangement (a
//   relationship the writer draws), not new prose knowledge, but because the DB
//   helper `insertTie` still demands a confirmation token, linkEntry routes
//   through the gate as well (defence in depth). The other actions
//   (selectEntry/moveEntry/moveFact/dismissSuggestion) persist arrangement or a
//   dismissal, never a new fact.
//
// Each action returns an ActionResult so the client store can SURFACE a failed
// write instead of letting it vanish (HANDOFF §8: per-mutation, no silent
// write-behind).
// =============================================================================

import { randomUUID } from "node:crypto";
import type { Kind, Shelf } from "../domain/types";
import { confirmWikiWrite } from "./confirmation";
import { completeJson, aiEnabled } from "../ai/saarouters";
import { loadWikiSnapshot } from "../db/queries";
import {
  insertFact,
  insertTie,
  deleteTie,
  createEntryWithTie,
  updateFactEntry,
  reorderShelf,
  insertDismissedSuggestion,
  insertEntry,
  updateEntryFields,
  updateFact,
  getMaxSortOrderForShelf,
  softDeleteEntry as softDeleteEntryRow,
  renameCategory as renameCategoryRow,
  resetCategoryLabel as resetCategoryLabelRow,
  deleteCategory as deleteCategoryRow,
} from "../db/mutations";

// ---- Result envelope ------------------------------------------------------

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(err: unknown, where: string): { ok: false; error: string } {
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, error: `${where}: ${msg}` };
}

// ---- Read-only selection --------------------------------------------------

/** Set the focused entry. Read-only session state; persisted nowhere. */
export async function selectEntry(entryId: string): Promise<ActionResult> {
  void entryId;
  return { ok: true, data: undefined };
}

// ---- Arrangement (does NOT write wiki knowledge) --------------------------

/**
 * Persist a tile's new placement after a drag. The client sends the destination
 * shelf and the FULL ordered id list for that shelf (what the reducer already
 * computed), so the DB matches the UI exactly. If the drag moved the entry
 * across shelves, the source shelf's remaining order is sent too. Mirrors
 * reducer `MOVE_ENTRY`.
 */
export async function moveEntry(input: {
  entryId: string;
  toShelf: Shelf;
  toShelfOrder: string[];
  fromShelf: Shelf;
  fromShelfOrder: string[];
}): Promise<ActionResult> {
  try {
    // Persist destination first, then source (a cross-shelf move renumbers both).
    await reorderShelf({ shelf: input.toShelf, orderedIds: input.toShelfOrder });
    if (input.fromShelf !== input.toShelf) {
      await reorderShelf({
        shelf: input.fromShelf,
        orderedIds: input.fromShelfOrder,
      });
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.moveEntry");
  }
}

/**
 * Record a directional tie between two existing entries (drag a tile onto the
 * Ties block). Does not create entries or facts. Mirrors reducer `LINK_ENTRY`.
 * Returns the new tie id so the reducer and DB agree.
 */
export async function linkEntry(input: {
  fromEntryId: string;
  toEntryId: string;
  rel: string;
}): Promise<ActionResult<{ tieId: string }>> {
  try {
    // A tie between existing entries is an arrangement, but insertTie demands a
    // confirmation token (product rule 1, defence in depth) — mint it here.
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = randomUUID();
    const tie = await insertTie(
      {
        id,
        fromEntryId: input.fromEntryId,
        toEntryId: input.toEntryId,
        rel: input.rel,
      },
      confirmation,
    );
    return { ok: true, data: { tieId: tie.id } };
  } catch (err) {
    return fail(err, "wiki.linkEntry");
  }
}

/**
 * Remove a directional tie (the "untie" affordance on a Ties row). HARD-delete:
 * untie is an intentional removal of a relationship the writer drew, so the row
 * is gone (no `deleted_at` tombstone — that is reserved for a soft-deleted
 * entry, whose ties survive as dangling badges). `deleteTie` demands a
 * confirmation token, so mint it here (defence in depth). Idempotent: untying an
 * already-removed tie is a harmless no-op DELETE.
 */
export async function untie(input: { tieId: string }): Promise<ActionResult> {
  try {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await deleteTie(input.tieId, confirmation);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.untie");
  }
}

/**
 * WIKI WRITE (product rule 1). Create a NEW person AND tie them to an existing
 * entry in ONE step (the "add a new <name> as <rel>-to-X" affordance on the Ties
 * block). Both writes share one transaction (createEntryWithTie), so a failure
 * on either leaves neither behind. Returns the generated entry + tie ids so the
 * reducer and DB agree. REQUIRES an explicit confirmation.
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function createEntryTied(input: {
  name: string;
  kind: Kind;
  shelf: Shelf;
  toEntryId: string;
  rel: string;
  confirmed: true;
}): Promise<ActionResult<{ entryId: string; tieId: string }>> {
  try {
    const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
    const entryId = randomUUID();
    const tieId = randomUUID();
    await createEntryWithTie(
      {
        entry: {
          id: entryId,
          kind: input.kind,
          name: input.name,
          catalogueNo: "",
          note: "",
          summary: "",
          shelf: input.shelf,
          sortOrder: await getMaxSortOrderForShelf(input.shelf) + 1,
        },
        tie: { id: tieId, fromEntryId: input.toEntryId, toEntryId: entryId, rel: input.rel },
      },
      confirmation,
    );
    return { ok: true, data: { entryId, tieId } };
  } catch (err) {
    return fail(err, "wiki.createEntryTied");
  }
}

/**
 * Move a fact from one entry to another (drag a fact row between tiles).
 * Rearrangement of existing knowledge, not a new wiki write. Mirrors reducer
 * `MOVE_FACT`. `sortOrder` places the fact at the end of the destination entry.
 */
export async function moveFact(input: {
  factId: string;
  toEntryId: string;
  sortOrder: number;
}): Promise<ActionResult> {
  try {
    await updateFactEntry({
      factId: input.factId,
      toEntryId: input.toEntryId,
      sortOrder: input.sortOrder,
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.moveFact");
  }
}

// ---- WIKI WRITE (confirmation-gated) --------------------------------------

/**
 * WIKI WRITE (product rule 1). Turn a poster-band suggestion into a recorded
 * fact on an entry. One of the two only paths that write new wiki knowledge, so
 * it REQUIRES an explicit confirmation. The new fact is `fresh` (drives the
 * --fresh row background). Returns the generated fact id.
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function addSuggestionAsFact(input: {
  suggestionKey: string;
  entryId: string;
  key: string;
  value: string;
  sortOrder: number;
  confirmed: true;
}): Promise<ActionResult<{ factId: string }>> {
  try {
    // Mint the token; a caller that omits `confirmed: true` fails to type-check.
    const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
    const id = randomUUID();
    const fact = await insertFact(
      {
        id,
        entryId: input.entryId,
        key: input.key,
        value: input.value,
        fresh: true,
        sortOrder: input.sortOrder,
      },
      confirmation,
    );
    // Adding it IS the resolution — record the dismissal so it does not re-appear
    // on reload (the suggestion is now written down).
    await insertDismissedSuggestion(input.suggestionKey);
    return { ok: true, data: { factId: fact.id } };
  } catch (err) {
    return fail(err, "wiki.addSuggestionAsFact");
  }
}

/**
 * Record that a poster suggestion was dismissed ("Leave it"). Never writes a
 * fact. Mirrors reducer `DISMISS_SUGGESTION`.
 */
export async function dismissSuggestion(
  suggestionKey: string,
): Promise<ActionResult> {
  try {
    await insertDismissedSuggestion(suggestionKey);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.dismissSuggestion");
  }
}

// ---- Manual authoring (Track A) — WIKI WRITE, inherently confirmed --------
//
// PRODUCT RULE 1 still holds: a manual edit/create is an EXPLICIT confirmation
// by construction (the user typed it and pressed save / added it), so each of
// these mints the branded token via confirmWikiWrite({ confirmed: true }) and
// passes it to the gated DB helper. They cannot reach the wiki any other way —
// the helpers refuse to type-check without the token.

/**
 * WIKI WRITE (product rule 1). Patch scalar fields on an existing entry
 * (rename, edit note/summary/catalogue). Mirrors reducer `EDIT_ENTRY_FIELDS`.
 */
export async function editEntry(input: {
  entryId: string;
  name?: string;
  note?: string;
  summary?: string;
  catalogueNo?: string;
}): Promise<ActionResult> {
  try {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await updateEntryFields(
      {
        id: input.entryId,
        name: input.name,
        note: input.note,
        summary: input.summary,
        catalogueNo: input.catalogueNo,
      },
      confirmation,
    );
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.editEntry");
  }
}

/**
 * WIKI WRITE (product rule 1). Patch a fact's key/value in place. Mirrors
 * reducer `EDIT_FACT`.
 */
export async function editFact(input: {
  factId: string;
  key?: string;
  value?: string;
}): Promise<ActionResult> {
  try {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await updateFact({ id: input.factId, key: input.key, value: input.value }, confirmation);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.editFact");
  }
}

/**
 * WIKI WRITE (product rule 1). Create a new entry on a shelf (the "+ New
 * person/place/order/lore" action). Server assigns the id and the next
 * sort_order on that shelf. Mirrors reducer `CREATE_ENTRY`. Returns the new
 * id + sortOrder so the reducer inserts the same row.
 */
export async function createEntry(input: {
  id?: string;
  kind: Kind;
  shelf: Shelf;
  name: string;
  note?: string;
  summary?: string;
}): Promise<ActionResult<{ entryId: string; sortOrder: number }>> {
  try {
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = input.id ?? randomUUID();
    const sortOrder = (await getMaxSortOrderForShelf(input.shelf)) + 1;
    await insertEntry(
      {
        id,
        kind: input.kind,
        name: input.name,
        catalogueNo: "—",
        note: input.note ?? "",
        summary: input.summary ?? "",
        shelf: input.shelf,
        sortOrder,
      },
      confirmation,
    );
    return { ok: true, data: { entryId: id, sortOrder } };
  } catch (err) {
    return fail(err, "wiki.createEntry");
  }
}

/**
 * WIKI WRITE (product rule 1). Soft-delete an entry: stamp `deleted_at` so it
 * drops out of the gazetteer read filter but its row survives, letting any tie
 * that still points at it render as a dangling "removed" tombstone. Idempotent
 * server-side (the mutation's `AND deleted_at IS NULL` guard). Mirrors reducer
 * `SOFT_DELETE_ENTRY`.
 */
export async function softDeleteEntry(input: {
  id: string;
}): Promise<ActionResult> {
  try {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await softDeleteEntryRow({ id: input.id, deletedAt: Date.now() }, confirmation);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.softDeleteEntry");
  }
}

// ---- Category management (F6-S5) ------------------------------------------

/**
 * Rename a category header (e.g. "People" -> "Cast"). Writes the label-override
 * row for the kind. NOT a wiki-content write (category_labels holds no wiki
 * knowledge), so product rule 1 does not apply and no confirmation token is
 * required. The mutation trims and treats a blank label as a reset. Mirrors
 * reducer `RENAME_CATEGORY`.
 */
export async function renameCategory(input: {
  kind: Kind;
  label: string;
}): Promise<ActionResult> {
  try {
    await renameCategoryRow({ kind: input.kind, label: input.label });
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.renameCategory");
  }
}

/**
 * Reset a category header back to its shelf default by deleting the override
 * row. Idempotent (deleting an absent row is a no-op). No confirmation token
 * (not a wiki-content write). Mirrors reducer `RESET_CATEGORY`.
 */
export async function resetCategoryLabel(input: {
  kind: Kind;
}): Promise<ActionResult> {
  try {
    await resetCategoryLabelRow(input.kind);
    return { ok: true, data: undefined };
  } catch (err) {
    return fail(err, "wiki.resetCategoryLabel");
  }
}

/**
 * WIKI WRITE (product rule 1). Delete a whole category: bulk soft-delete EVERY
 * live entry of the kind (their rows survive, so inbound ties render as
 * tombstones). Irreversible from the UI, so it REQUIRES an explicit confirmation
 * and is gated behind a danger confirm dialog in the caller. Returns the number
 * of entries soft-deleted. Mirrors reducer `DELETE_CATEGORY`.
 *
 * @param input.confirmed must be the literal `true` — the confirmation gate.
 */
export async function deleteCategory(input: {
  kind: Kind;
  confirmed: true;
}): Promise<ActionResult<{ deleted: number }>> {
  try {
    const confirmation = confirmWikiWrite({ confirmed: input.confirmed });
    const deleted = await deleteCategoryRow(
      { kind: input.kind, deletedAt: Date.now() },
      confirmation,
    );
    return { ok: true, data: { deleted } };
  } catch (err) {
    return fail(err, "wiki.deleteCategory");
  }
}

/**
 * WIKI WRITE (product rule 1). Add a new fact to an entry manually. Mirrors
 * reducer `CREATE_FACT`. Returns the new fact id + sortOrder.
 */
export async function createFact(input: {
  entryId: string;
  key: string;
  value: string;
  sortOrder: number;
}): Promise<ActionResult<{ factId: string }>> {
  try {
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = randomUUID();
    const fact = await insertFact(
      {
        id,
        entryId: input.entryId,
        key: input.key,
        value: input.value,
        fresh: true,
        sortOrder: input.sortOrder,
      },
      confirmation,
    );
    return { ok: true, data: { factId: fact.id } };
  } catch (err) {
    return fail(err, "wiki.createFact");
  }
}

// ---- AI: suggest details for an entry (READ-ONLY; writes nothing) ----------
//
// Grounds on the whole gazetteer plus the focused entry and asks the model for
// candidate facts (key/value). This writes NOTHING — it only returns proposals.
// The writer turns any proposal into a real fact via createFact (the gate), so
// product rule 1 holds: nothing enters the wiki without explicit confirmation.

export interface SuggestedFact {
  key: string;
  value: string;
}

interface AiFactsResponse {
  facts?: SuggestedFact[];
}

export async function suggestEntryFacts(input: {
  entryId: string;
}): Promise<ActionResult<{ facts: SuggestedFact[] }>> {
  if (!aiEnabled()) {
    return { ok: false, error: "AI is not configured. Add SAAROUTERS_API_KEY to .env.local." };
  }
  try {
    const wiki = await loadWikiSnapshot();
    const entry = wiki.byId[input.entryId];
    if (!entry) return { ok: false, error: `Unknown entry: ${input.entryId}` };

    const existing = entry.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
    const world = wiki.entries
      .filter((e) => e.id !== entry.id)
      .slice(0, 40)
      .map((e) => `- ${e.name} (${e.kind})${e.summary ? `: ${e.summary}` : ""}`)
      .join("\n");

    const system = [
      "You help a fiction writer flesh out their own story wiki (gazetteer).",
      "Given one entry and the surrounding world, propose 3-5 SHORT candidate details (facts) that are consistent with what already exists.",
      "Never contradict existing facts. Prefer concrete, gazetteer-style details (e.g. Eyes: Grey, Allegiance: Quiet Sept).",
      "Do NOT repeat details the entry already has.",
      'Return STRICT JSON only: {"facts": [{"key": string, "value": string}]}. key <= 3 words, value <= 8 words.',
    ].join("\n");

    const user = [
      `Entry: ${entry.name} (${entry.kind})`,
      entry.summary ? `Summary: ${entry.summary}` : "",
      existing ? `Existing details: ${existing}` : "Existing details: (none)",
      "",
      world ? `Elsewhere in the world:\n${world}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await completeJson<AiFactsResponse>({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 500,
      temperature: 0.6,
    });

    const existingKeys = new Set(entry.facts.map((f) => f.key.trim().toLowerCase()));
    const facts = (res.facts ?? [])
      .filter((f) => f && f.key && f.value)
      .map((f) => ({ key: f.key.trim(), value: f.value.trim() }))
      .filter((f) => !existingKeys.has(f.key.toLowerCase()))
      .slice(0, 5);

    return { ok: true, data: { facts } };
  } catch (err) {
    return fail(err, "wiki.suggestEntryFacts");
  }
}
