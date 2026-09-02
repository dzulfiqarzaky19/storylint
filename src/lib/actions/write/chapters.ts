"use server";

// ============================================================================
// Chapter server actions (create / rename / delete)
// Split out of the former monolithic write.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import {
  countChaptersInBook,
  deleteChapter as deleteChapterRow,
  getNextChapterNumber,
  insertChapter,
  renameChapter as renameChapterRow,
} from "../../db/mutations";
import { randomUUID } from "node:crypto";
import { listChapters } from "../../db/chapter-queries";
import { type ActionResult, runActionBare } from "../confirmation";

/** An empty ProseMirror doc (one empty paragraph) for a fresh chapter body. */
const EMPTY_CHAPTER_BODY = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;

/**
 * Create a new, empty chapter appended after the last one. Not a wiki write, so
 * no confirmation token is needed. Returns the new chapter number so the client
 * can navigate to it (?chapter=<n>).
 */
export async function createChapter(input?: {
  title?: string;
  bookId?: string;
}): Promise<ActionResult<{ number: number }>> {
  return runActionBare(async () => {
    // Book scope: numbering and insertion must target the active book, or
    // "+ New chapter" on a freshly created book lands the row in
    // DEFAULT_BOOK_ID and the new book never grows past its seeded Chapter One.
    const number = await getNextChapterNumber(input?.bookId);
    const title = input?.title?.trim() || "Untitled";
    await insertChapter({
      id: randomUUID(),
      number,
      title,
      body: EMPTY_CHAPTER_BODY,
      bookId: input?.bookId,
    });
    return { ok: true, data: { number } };
  });
}

// ---- Chapters (rename / delete) — no wiki write ---------------------------

/** Rename a chapter's title within its book. Not a wiki write. */
export async function renameChapter(input: {
  number: number;
  title: string;
  bookId?: string;
}): Promise<ActionResult<{ number: number; title: string }>> {
  return runActionBare(async () => {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "A chapter needs a title." };
    await renameChapterRow({ number: input.number, title, bookId: input.bookId });
    return { ok: true, data: { number: input.number, title } };
  });
}

/**
 * Delete a chapter from its book. Guarded: a book must keep at least one
 * chapter, so deleting the last one is refused (the UI also disables the
 * affordance, but the server enforces the invariant so no client can break it).
 * Returns the surviving chapter to navigate to — the nearest lower number, else
 * the new lowest — so the caller lands the writer somewhere real. Not a wiki write.
 */
export async function deleteChapter(input: {
  number: number;
  bookId?: string;
}): Promise<ActionResult<{ next: number }>> {
  return runActionBare(async () => {
    const remaining = await countChaptersInBook(input.bookId);
    if (remaining <= 1) {
      return { ok: false, error: "A book must keep at least one chapter." };
    }
    const res = await deleteChapterRow({ number: input.number, bookId: input.bookId });
    if (res.deleted === 0) return { ok: false, error: "That chapter no longer exists." };
    // Land on the nearest SURVIVING chapter: prefer the previous number, else the
    // new lowest. The resolver clamps an unknown ?chapter= to the last chapter, so
    // this only needs to be a real surviving number, which the page then honors.
    const numbers = (await listChapters(input.bookId)).map((c) => c.number);
    const next =
      numbers.filter((n) => n < input.number).pop() ?? numbers[0] ?? 1;
    return { ok: true, data: { next } };
  });
}

// ---- Marks ----------------------------------------------------------------
