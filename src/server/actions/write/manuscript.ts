"use server";

import { replacePhraseMentions, saveChapterBody } from "@/server/db/chapters/mutations";
import { docToParagraphs } from "@/domain/write/adapters";
import { extractCandidatePhrases } from "@/domain/check/unrecorded";
import { type ActionResult, errorMessage, runActionBare } from "@/domain/result";

export async function saveManuscript(input: {
  bookId: string;
  chapterNumber: number;
  body: unknown;
}): Promise<ActionResult> {
  return runActionBare(async () => {
    await saveChapterBody({ number: input.chapterNumber, body: input.body, bookId: input.bookId });

    try {
      const phrases = extractCandidatePhrases(docToParagraphs(input.body));
      await replacePhraseMentions({ bookId: input.bookId, chapterNumber: input.chapterNumber, phrases });
    } catch (indexErr) {
      console.error(`saveManuscript: phrase-index refresh failed for chapter ${input.chapterNumber} (body saved; cross-chapter rank may be stale): ${errorMessage(indexErr)}`);
    }

    return { ok: true, data: undefined };
  });
}
