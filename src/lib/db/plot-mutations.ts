// /plot WRITE layer (mirrors the read layer in ./plot.ts). Every mutation the
// editable grid needs: rename a lane, set its arc state, upsert/delete/move a
// beat, and create/soft-delete a lane. Kept separate from the wiki mutations
// because a plot edit is an ARRANGEMENT of the writer's own outline, not a
// gated wiki-knowledge write, so these carry no confirmation token.
//
// The model (see ./plot.ts): a lane is an entries row (kind='plotline'); its
// arc state is encoded in that row's `summary` column as `state[:chapter]`; a
// beat is a chapter_plotlines row keyed on (chapter_id, plotline_id) whose
// `summary` holds the beat text with inline markers.
import { randomUUID } from "node:crypto";
import { query, one, withTransaction } from "./pool";
import { DEFAULT_UNIVERSE_ID } from "./scope";

/** Resolve a chapter's id from its number within a book. The grid addresses
 *  beats by chapter NUMBER (the visible column), but chapter_plotlines keys on
 *  chapter_id, so every beat write goes through this lookup. Returns null when
 *  the number is out of range for the book. */
async function chapterIdFor(bookId: string, chapterNumber: number): Promise<string | null> {
  const row = await one<{ id: string }>(
    `SELECT id FROM chapters WHERE book_id = $1 AND number = $2`,
    [bookId, chapterNumber],
  );
  return row?.id ?? null;
}

/** Feature 3 — rename a plotline lane. Writes the entry's `name`; a blank name
 *  is rejected so the grid never shows a nameless lane. */
export async function renamePlotline(input: { plotlineId: string; name: string }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("plotline name cannot be blank");
  await query(
    `UPDATE entries SET name = $2 WHERE id = $1 AND kind = 'plotline'`,
    [input.plotlineId, name],
  );
}

/** The four arc states the grid can set. `stalled` is derived, not set by hand
 *  (deriveState upgrades a quiet open arc), so it is not offered here. */
export type SettablePlotState = "open" | "resolved" | "abandoned";

/** Feature 5 — set a lane's arc state. The state tag lives in the entry's
 *  `summary` as `state[:chapter]`; resolved/abandoned carry the cap chapter so
 *  the grid can grey the tail after it. `open` clears any cap. */
export async function setPlotlineState(input: {
  plotlineId: string;
  state: SettablePlotState;
  resolvedAt: number | null;
}): Promise<void> {
  const tag =
    input.state === "open"
      ? "open"
      : input.resolvedAt != null
        ? `${input.state}:${input.resolvedAt}`
        : input.state;
  await query(
    `UPDATE entries SET summary = $2 WHERE id = $1 AND kind = 'plotline'`,
    [input.plotlineId, tag],
  );
}

/** Feature 2 — create OR edit a beat in a (chapter, plotline) cell. Upsert on
 *  the composite PK so re-saving the same cell edits in place rather than
 *  colliding. Throws when the chapter number is out of range for the book. */
export async function upsertBeat(input: {
  bookId: string;
  plotlineId: string;
  chapterNumber: number;
  summary: string;
}): Promise<void> {
  const chapterId = await chapterIdFor(input.bookId, input.chapterNumber);
  if (!chapterId) throw new Error(`no chapter ${input.chapterNumber} in book ${input.bookId}`);
  await query(
    `INSERT INTO chapter_plotlines (chapter_id, plotline_id, summary)
     VALUES ($1, $2, $3)
     ON CONFLICT (chapter_id, plotline_id) DO UPDATE SET summary = EXCLUDED.summary`,
    [chapterId, input.plotlineId, input.summary],
  );
}

/** Feature 2 — delete a beat from a cell. Idempotent: deleting an empty cell
 *  touches zero rows. */
export async function deleteBeat(input: {
  bookId: string;
  plotlineId: string;
  chapterNumber: number;
}): Promise<void> {
  const chapterId = await chapterIdFor(input.bookId, input.chapterNumber);
  if (!chapterId) return;
  await query(
    `DELETE FROM chapter_plotlines WHERE chapter_id = $1 AND plotline_id = $2`,
    [chapterId, input.plotlineId],
  );
}

/** Feature 1 — move a beat horizontally to another chapter in the same lane.
 *  Re-points the row's chapter_id. Rejects the move when the destination cell
 *  is already filled (the composite PK would collide) so a drag never silently
 *  clobbers an existing beat — the caller surfaces that as a blocked drop. */
export async function moveBeat(input: {
  bookId: string;
  plotlineId: string;
  fromChapterNumber: number;
  toChapterNumber: number;
}): Promise<void> {
  if (input.fromChapterNumber === input.toChapterNumber) return;
  const fromId = await chapterIdFor(input.bookId, input.fromChapterNumber);
  const toId = await chapterIdFor(input.bookId, input.toChapterNumber);
  if (!fromId) throw new Error(`no chapter ${input.fromChapterNumber} in book ${input.bookId}`);
  if (!toId) throw new Error(`no chapter ${input.toChapterNumber} in book ${input.bookId}`);
  await withTransaction(async (client) => {
    const occupied = await client.query(
      `SELECT 1 FROM chapter_plotlines WHERE chapter_id = $1 AND plotline_id = $2`,
      [toId, input.plotlineId],
    );
    if ((occupied.rowCount ?? 0) > 0) {
      throw new Error(`chapter ${input.toChapterNumber} already has a beat on this plotline`);
    }
    await client.query(
      `UPDATE chapter_plotlines SET chapter_id = $1
        WHERE chapter_id = $2 AND plotline_id = $3`,
      [toId, fromId, input.plotlineId],
    );
  });
}

/** Feature 4 — create a new plotline lane VISIBLE in one world. The entry INSERT
 *  and its world_entities membership run in one txn (mirrors insertEntryLinked-
 *  ToWorld) so a bad worldId FK-throws and rolls the entry back — no lane that
 *  is persisted but invisible on the grid. New lanes start `open` (summary tag)
 *  and sort after every existing plotline. Returns the generated id. */
export async function createPlotline(input: {
  worldId: string;
  name: string;
  label?: string;
  universeId?: string;
}): Promise<{ plotlineId: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("plotline name cannot be blank");
  const id = randomUUID();
  const next = await one<{ next: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM entries WHERE kind = 'plotline'`,
  );
  const sortOrder = next?.next ?? 1;
  await withTransaction(async (client) => {
    // The new entry MUST live in the same universe as the world it links to, or
    // the entries.universe_id FK points at a universe that world can't reach.
    // Derive it from the target world (fall back to the caller/default) rather
    // than trusting a static default that drifts per book.
    const worldUniverse = await client.query<{ universe_id: string }>(
      `SELECT universe_id FROM worlds WHERE id = $1`,
      [input.worldId],
    );
    const universeId =
      input.universeId ?? worldUniverse.rows[0]?.universe_id ?? DEFAULT_UNIVERSE_ID;
    await client.query(
      `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
       VALUES ($1, 'plotline', $2, '', $3, 'open', 'plots', $4, $5)`,
      [id, name, input.label ?? "", sortOrder, universeId],
    );
    await client.query(
      `INSERT INTO world_entities (world_id, entity_id)
       VALUES ($1, $2)
       ON CONFLICT (world_id, entity_id) DO NOTHING`,
      [input.worldId, id],
    );
  });
  return { plotlineId: id };
}

/** Feature 4 — delete a plotline lane. Soft-delete (stamp `deleted_at`) so the
 *  loader's `deleted_at IS NULL` filter drops it from the grid while its beats
 *  and owner edge survive, matching how wiki entries are removed. Idempotent via
 *  the `deleted_at IS NULL` guard. */
export async function deletePlotline(input: { plotlineId: string; deletedAt: number }): Promise<void> {
  await query(
    `UPDATE entries SET deleted_at = $2
      WHERE id = $1 AND kind = 'plotline' AND deleted_at IS NULL`,
    [input.plotlineId, input.deletedAt],
  );
}
