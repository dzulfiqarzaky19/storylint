"use server";

import { countChaptersInBook, deleteChapter as deleteChapterRow, getNextChapterNumber, insertChapter, renameChapter as renameChapterRow } from "@/server/db/chapters/mutations";
import { randomUUID } from "node:crypto";
import { listChapters } from "@/server/db/chapters/queries";
import { type ActionResult, runActionBare } from "@/domain/result";

const EMPTY_CHAPTER_BODY = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;

export async function createChapter(input: {
  title?: string;
  bookId: string;
}): Promise<ActionResult<{ number: number }>> {
  return runActionBare(async () => {
    const number = await getNextChapterNumber(input.bookId);
    const title = input.title?.trim() || "Untitled";
    await insertChapter({
      id: randomUUID(),
      number,
      title,
      body: EMPTY_CHAPTER_BODY,
      bookId: input.bookId,
    });
    return { ok: true, data: { number } };
  });
}

export async function renameChapter(input: {
  number: number;
  title: string;
  bookId: string;
}): Promise<ActionResult<{ number: number; title: string }>> {
  return runActionBare(async () => {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "A chapter needs a title." };
    await renameChapterRow({ number: input.number, title, bookId: input.bookId });
    return { ok: true, data: { number: input.number, title } };
  });
}

export async function deleteChapter(input: {
  number: number;
  bookId: string;
}): Promise<ActionResult<{ next: number }>> {
  return runActionBare(async () => {
    const remaining = await countChaptersInBook(input.bookId);
    if (remaining <= 1) {
      return { ok: false, error: "A book must keep at least one chapter." };
    }
    const res = await deleteChapterRow({ number: input.number, bookId: input.bookId });
    if (res.deleted === 0) return { ok: false, error: "That chapter no longer exists." };
    const numbers = (await listChapters(input.bookId)).map((c) => c.number);
    const next =
      numbers.filter((n) => n < input.number).pop() ?? numbers[0] ?? 1;
    return { ok: true, data: { next } };
  });
}

