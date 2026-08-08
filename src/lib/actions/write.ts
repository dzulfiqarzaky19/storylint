"use server";

// =============================================================================
// Write Server Actions (HANDOFF §8)
//
// PRODUCT RULE 1 — "Nothing enters the wiki without an explicit confirmation."
//
//   NONE of this file's actions write to the wiki *directly*. saveManuscript
//   persists the chapter body; openMark is read-only UI state; resolveMark
//   handles the three distinct note actions (§8):
//     - 'text'  → selects the run for editing. No wiki write.
//     - 'leave' → marks the run deliberate; persists the markKey in
//                 resolved_marks so the engine suppresses it. No wiki write.
//     - 'wiki'  → "the wiki is out of date": updates the fact. This MUST go
//                 "through the same confirmation path" (§8). resolveMark does
//                 not itself write the fact — it hands off to the confirmed
//                 wiki path (addSuggestionAsFact / a confirmed fact update),
//                 which is gated by confirmWikiWrite. So the only two wiki-write
//                 paths remain addSuggestionAsFact and confirmCard.
//
// CONTRACT-FIRST: stable signatures; trivial bodies call the query/mutation
// layer, otherwise a typed NOT_IMPLEMENTED stub for a later phase.
// =============================================================================

import {
  saveChapterBody,
  upsertResolvedMark,
  insertChapter,
  getNextChapterNumber,
} from "../db/mutations";
import { randomUUID } from "node:crypto";

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** The three note actions offered under a mark (§8). `actionId` on resolveMark is one of these. */
export type MarkActionId = "wiki" | "text" | "leave";

/**
 * What resolveMark did, so the store and editor can react. For a 'wiki'
 * resolution the wiki write happens via the confirmed wiki path, not here.
 */
export type ResolveMarkOutcome =
  | { kind: "resolved"; markKey: string } // 'leave' → suppressed permanently
  | { kind: "selectForEdit"; quote: string } // 'text' → select the run in the editor
  | { kind: "needsConfirmation"; entryId: string; factKey: string }; // 'wiki' → hand off to confirmed path

// ---- Manuscript persistence (no wiki write) -------------------------------

/**
 * Persist the chapter's ProseMirror JSON body. Per-mutation write, not a
 * debounced write-behind, so a failed save surfaces (§8). Mirrors reducer
 * action `SAVE_MANUSCRIPT`.
 */
export async function saveManuscript(input: {
  chapterNumber: number;
  body: unknown; // ProseMirror document JSON
}): Promise<ActionResult> {
  try {
    await saveChapterBody({ number: input.chapterNumber, body: input.body });
    return { ok: true, data: undefined };
  } catch (err) {
    // Surface, don't swallow (§8): a failed save must reach the user.
    return { ok: false, error: messageOf(err) };
  }
}

// ---- Chapters (new chapter) — no wiki write -------------------------------

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
}): Promise<ActionResult<{ number: number }>> {
  try {
    const number = await getNextChapterNumber();
    const title = input?.title?.trim() || "Untitled";
    await insertChapter({
      id: randomUUID(),
      number,
      title,
      body: EMPTY_CHAPTER_BODY,
    });
    return { ok: true, data: { number } };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

// ---- Marks ----------------------------------------------------------------

/**
 * Open a mark's inline note (one open at a time). Read-only UI state; clicking
 * a rail row and clicking the underline are the same action (§8). Mirrors
 * reducer action `OPEN_MARK`.
 */
export async function openMark(markKey: string): Promise<ActionResult> {
  void markKey;
  // No persistence: open-mark is session state. Server action kept for uniform pairing.
  return { ok: true, data: undefined };
}

/**
 * Resolve a mark via one of its note actions. The three actions differ in
 * production (§8) and are dispatched on `actionId`:
 *   - 'leave' → persist markKey in resolved_marks (suppress permanently).
 *   - 'text'  → return selectForEdit; the editor selects the run. No DB write.
 *   - 'wiki'  → return needsConfirmation; the UI routes into the confirmed
 *               wiki path. resolveMark never writes the wiki itself.
 *
 * Mirrors reducer action `RESOLVE_MARK`. Signature: resolveMark(markId, actionId).
 */
/**
 * Context the client supplies alongside the markKey. `resolveMark(markId,
 * actionId)` keeps its documented primary shape; `context` carries the
 * mark-derived data the server can't recover from a markKey alone (the quote to
 * select, or the entry/fact a 'wiki' correction would touch). Optional so the
 * signature stays backward compatible.
 */
export interface ResolveMarkContext {
  quote?: string;
  entryId?: string;
  factKey?: string;
}

export async function resolveMark(
  markId: string,
  actionId: MarkActionId,
  context: ResolveMarkContext = {},
): Promise<ActionResult<ResolveMarkOutcome>> {
  try {
    switch (actionId) {
      case "leave":
        // The ONLY DB write here: suppress this mark permanently by its stable
        // key, so it stays resolved across reloads even after the paragraph moves.
        await upsertResolvedMark({
          markKey: markId,
          resolution: "leave",
          resolvedAt: Date.now(),
        });
        return { ok: true, data: { kind: "resolved", markKey: markId } };

      case "text":
        // No DB write: the editor selects the run so the author can rewrite it.
        return {
          ok: true,
          data: { kind: "selectForEdit", quote: context.quote ?? "" },
        };

      case "wiki":
        // No wiki write here (product rule 1). Hand off to the confirmed wiki
        // path; the UI opens the confirmation flow keyed by entry + fact.
        return {
          ok: true,
          data: {
            kind: "needsConfirmation",
            entryId: context.entryId ?? "",
            factKey: context.factKey ?? "",
          },
        };
    }
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}
