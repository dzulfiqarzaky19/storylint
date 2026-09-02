"use server";

// ============================================================================
// Wiki entry & fact server actions
// Split out of the former monolithic wiki.ts (T-ARCH-7). Product rule 1 and the
// runAction envelope are unchanged; only file boundaries moved.
// ============================================================================

import { randomUUID } from "node:crypto";
import { type Kind, type Shelf } from "../../domain/types";
import { type ActionResult, confirmWikiWrite, requireWorldId, runAction } from "../confirmation";
import {
  createEntryWithTie,
  deleteFact as deleteFactMutation,
  deleteTie,
  getMaxSortOrderForFacts,
  getMaxSortOrderForShelf,
  insertEntryLinkedToWorld,
  insertFact,
  insertTie,
  reorderShelf,
  softDeleteEntry as softDeleteEntryRow,
  updateEntryFields,
  updateFact,
  updateFactEntry,
} from "../../db/gazetteer-mutations";
import { insertDismissedSuggestion } from "../../db/chapter-mutations";

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
  return runAction("wiki.moveEntry", async () => {
    // Persist destination first, then source (a cross-shelf move renumbers both).
    await reorderShelf({ shelf: input.toShelf, orderedIds: input.toShelfOrder });
    if (input.fromShelf !== input.toShelf) {
      await reorderShelf({
        shelf: input.fromShelf,
        orderedIds: input.fromShelfOrder,
      });
    }
    return { ok: true, data: undefined };
  });
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
  return runAction("wiki.linkEntry", async () => {
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
  });
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
  return runAction("wiki.untie", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await deleteTie(input.tieId, confirmation);
    return { ok: true, data: undefined };
  });
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
  /** TCK-E06: the active world to link the new entry into (fail-closed). */
  worldId: string;
}): Promise<ActionResult<{ entryId: string; tieId: string }>> {
  return runAction("wiki.createEntryTied", async () => {
    // Fail closed BEFORE any write: an entry with no world link is invisible.
    const world = requireWorldId(input.worldId, "wiki.createEntryTied");
    if (!world.ok) return world;
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
        worldId: world.worldId,
      },
      confirmation,
    );
    return { ok: true, data: { entryId, tieId } };
  });
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
  return runAction("wiki.moveFact", async () => {
    await updateFactEntry({
      factId: input.factId,
      toEntryId: input.toEntryId,
      sortOrder: input.sortOrder,
    });
    return { ok: true, data: undefined };
  });
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
  return runAction("wiki.addSuggestionAsFact", async () => {
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
  });
}

/**
 * Record that a poster suggestion was dismissed ("Leave it"). Never writes a
 * fact. Mirrors reducer `DISMISS_SUGGESTION`.
 */
export async function dismissSuggestion(
  suggestionKey: string,
): Promise<ActionResult> {
  return runAction("wiki.dismissSuggestion", async () => {
    await insertDismissedSuggestion(suggestionKey);
    return { ok: true, data: undefined };
  });
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
  return runAction("wiki.editEntry", async () => {
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
  });
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
  return runAction("wiki.editFact", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await updateFact({ id: input.factId, key: input.key, value: input.value }, confirmation);
    return { ok: true, data: undefined };
  });
}

/**
 * WIKI WRITE (product rule 1). Create a new entry on a shelf (the "+ New
 * person/place/order/lore" action). Server assigns the id and the next
 * sort_order on that shelf. Mirrors reducer `CREATE_ENTRY`. Returns the new
 * id + sortOrder so the reducer inserts the same row.
 */
export async function createEntry(input: {
  id?: string;
  kind: string;
  shelf: Shelf;
  name: string;
  note?: string;
  summary?: string;
  /** TCK-E06: the active world to link the new entry into (fail-closed). */
  worldId: string;
}): Promise<ActionResult<{ entryId: string; sortOrder: number }>> {
  return runAction("wiki.createEntry", async () => {
    // Fail closed BEFORE any write: an entry with no world link is invisible.
    const world = requireWorldId(input.worldId, "wiki.createEntry");
    if (!world.ok) return world;
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = input.id ?? randomUUID();
    const sortOrder = (await getMaxSortOrderForShelf(input.shelf)) + 1;
    // TCK-E06: entry INSERT + world link run in ONE txn so a nonexistent worldId
    // FK-throws and rolls the entry back with it (no persisted-but-invisible
    // orphan). requireWorldId above already fail-closed on blank/missing worldId.
    await insertEntryLinkedToWorld(
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
      world.worldId,
      confirmation,
    );
    return { ok: true, data: { entryId: id, sortOrder } };
  });
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
  return runAction("wiki.softDeleteEntry", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await softDeleteEntryRow({ id: input.id, deletedAt: Date.now() }, confirmation);
    return { ok: true, data: undefined };
  });
}

// ---- Category management (F6-S5; F9-B categories table) -------------------

/**
 * WIKI WRITE (product rule 1). Add a new fact to an entry manually. Mirrors
 * reducer `CREATE_FACT`. Returns the new fact id + sortOrder.
 */
export async function createFact(input: {
  /**
   * Caller-supplied stable id (optional). A mark-keyed id (the /write modal's
   * `mark-fact-<markKey>`) makes a re-confirm idempotent: insertFact is
   * ON CONFLICT (id) DO UPDATE, so confirming the same mark twice updates the
   * fact in place instead of stacking a duplicate. Omitted (manual authoring)
   * -> a fresh uuid, unchanged behavior.
   */
  id?: string;
  entryId: string;
  key: string;
  value: string;
  /**
   * Append position among the entry's facts. Optional: omitted, it derives
   * `getMaxSortOrderForFacts(entryId) + 1` so a client (the /write modal) that
   * can't see the entry's current facts still appends correctly instead of
   * guessing a colliding index.
   */
  sortOrder?: number;
}): Promise<ActionResult<{ factId: string }>> {
  return runAction("wiki.createFact", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    const id = input.id ?? randomUUID();
    const sortOrder =
      input.sortOrder ?? (await getMaxSortOrderForFacts(input.entryId)) + 1;
    const fact = await insertFact(
      {
        id,
        entryId: input.entryId,
        key: input.key,
        value: input.value,
        fresh: true,
        sortOrder,
      },
      confirmation,
    );
    return { ok: true, data: { factId: fact.id } };
  });
}

/**
 * WIKI WRITE (product rule 1). Delete a fact from an entry. Mirrors reducer
 * `DELETE_FACT`. A fact is a low-stakes wiki detail (no cascade), so it removes
 * the row outright without a tombstone. Requires a confirmation token, mirroring
 * createFact (defence in depth on every wiki write).
 */
export async function deleteFact(input: {
  factId: string;
}): Promise<ActionResult<{ ok: true }>> {
  return runAction("wiki.deleteFact", async () => {
    const confirmation = confirmWikiWrite({ confirmed: true });
    await deleteFactMutation(input.factId, confirmation);
    return { ok: true, data: { ok: true } };
  });
}
