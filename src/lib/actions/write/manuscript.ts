"use server";

// ============================================================================
// Manuscript persistence server action
// Split out of the former monolithic write.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import { replacePhraseMentions, saveChapterBody } from "../../db/mutations";
import { docToParagraphs } from "../../write/adapters";
import { extractCandidatePhrases } from "../../check/unrecorded";
import { type ActionResult, errorMessage, runActionBare } from "../confirmation";

/**
 * Persist the chapter's ProseMirror JSON body. Per-mutation write, not a
 * debounced write-behind, so a failed save surfaces (§8). Mirrors reducer
 * action `SAVE_MANUSCRIPT`.
 */
export async function saveManuscript(input: {
  chapterNumber: number;
  body: unknown; // ProseMirror document JSON
}): Promise<ActionResult> {
  return runActionBare(async () => {
    // The writer's prose is the sacred write. saveChapterBody is the ONLY thing
    // in this try whose failure returns ok:false — a body-save error MUST reach
    // the user (§8), never a green ack over lost work.
    await saveChapterBody({ number: input.chapterNumber, body: input.body });

    // Tier 2: refresh this chapter's rows in the book-wide phrase index so
    // cross-chapter recurrence ranking stays current. This is RANK data only:
    // importanceOf reads it to rank an unrecorded mark high-vs-normal, but it
    // NEVER gates WHAT is flagged (unrecorded.ts). So the index refresh is
    // BEST-EFFORT and runs in its OWN try: if it fails, the body is already
    // saved and the writer keeps their words. We do NOT put it in the same
    // transaction as the body — that would convert a cosmetic stale-rank into
    // DATA LOSS (a failed side-table write would block saving prose). Instead we
    // log LOUDLY (error level, naming the chapter) so a systematic index failure
    // screams in our server logs rather than hiding as silent staleness.
    try {
      const phrases = extractCandidatePhrases(docToParagraphs(input.body));
      await replacePhraseMentions({ chapterNumber: input.chapterNumber, phrases });
    } catch (indexErr) {
      console.error(`saveManuscript: phrase-index refresh failed for chapter ${input.chapterNumber} (body saved; cross-chapter rank may be stale): ${errorMessage(indexErr)}`);
    }

    return { ok: true, data: undefined };
  });
}

// ---- Chapters (new chapter) — no wiki write -------------------------------

/** An empty ProseMirror doc (one empty paragraph) for a fresh chapter body. */
const EMPTY_CHAPTER_BODY = {
  type: "doc",
  content: [{ type: "paragraph" }],
} as const;
