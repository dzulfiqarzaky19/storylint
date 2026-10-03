import { randomUUID } from "node:crypto";
import { query, one, withTransaction } from "@/server/db/pool";
import { fromEpochMs } from "@/server/db/sql";

async function chapterIdFor(bookId: string, chapterNumber: number): Promise<string | null> {
  const row = await one<{ id: string }>(
    `SELECT id FROM chapters WHERE book_id = $1 AND number = $2`,
    [bookId, chapterNumber],
  );
  return row?.id ?? null;
}

export async function renamePlotline(input: { plotlineId: string; name: string }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("plotline name cannot be blank");
  await query(
    `UPDATE entries SET name = $2 WHERE id = $1 AND category_id = 'plotline'`,
    [input.plotlineId, name],
  );
}

export type SettablePlotState = "open" | "resolved" | "abandoned";

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
    `UPDATE entries SET summary = $2 WHERE id = $1 AND category_id = 'plotline'`,
    [input.plotlineId, tag],
  );
}

export async function upsertBeat(input: {
  bookId: string;
  plotlineId: string;
  chapterNumber: number;
  summary: string;
}): Promise<void> {
  const chapterId = await chapterIdFor(input.bookId, input.chapterNumber);
  if (!chapterId) throw new Error(`no chapter ${input.chapterNumber} in book ${input.bookId}`);
  await query(
    `INSERT INTO beats (chapter_id, plotline_id, summary)
     VALUES ($1, $2, $3)
     ON CONFLICT (chapter_id, plotline_id) DO UPDATE SET summary = EXCLUDED.summary`,
    [chapterId, input.plotlineId, input.summary],
  );
}

export async function deleteBeat(input: {
  bookId: string;
  plotlineId: string;
  chapterNumber: number;
}): Promise<void> {
  const chapterId = await chapterIdFor(input.bookId, input.chapterNumber);
  if (!chapterId) return;
  await query(
    `DELETE FROM beats WHERE chapter_id = $1 AND plotline_id = $2`,
    [chapterId, input.plotlineId],
  );
}

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
      `SELECT 1 FROM beats WHERE chapter_id = $1 AND plotline_id = $2`,
      [toId, input.plotlineId],
    );
    if ((occupied.rowCount ?? 0) > 0) {
      throw new Error(`chapter ${input.toChapterNumber} already has a beat on this plotline`);
    }
    await client.query(
      `UPDATE beats SET chapter_id = $1
        WHERE chapter_id = $2 AND plotline_id = $3`,
      [toId, fromId, input.plotlineId],
    );
  });
}

export async function createPlotline(input: {
  worldId: string;
  name: string;
  label?: string;
}): Promise<{ plotlineId: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("plotline name cannot be blank");
  const id = randomUUID();
  const next = await one<{ next: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM entries WHERE category_id = 'plotline'`,
  );
  const sortOrder = next?.next ?? 1;
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO entries (id, universe_id, category_id, name, note, summary, shelf, sort_order)
       SELECT $1, w.universe_id, 'plotline', $2, $3, 'open', 'plots', $4
         FROM worlds w WHERE w.id = $5`,
      [id, name, input.label ?? "", sortOrder, input.worldId],
    );
    await client.query(
      `INSERT INTO world_entries (world_id, entry_id) VALUES ($1, $2)`,
      [input.worldId, id],
    );
  });
  return { plotlineId: id };
}

export async function deletePlotline(input: { plotlineId: string; deletedAt: number }): Promise<void> {
  await query(
    `UPDATE entries SET deleted_at = ${fromEpochMs("$2")}
      WHERE id = $1 AND category_id = 'plotline' AND deleted_at IS NULL`,
    [input.plotlineId, input.deletedAt],
  );
}
