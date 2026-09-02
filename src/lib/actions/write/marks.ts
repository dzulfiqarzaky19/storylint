"use server";

// ============================================================================
// Mark server actions (open / resolve)
// Split out of the former monolithic write.ts (T-ARCH-9). runAction/runActionBare
// envelopes are unchanged; only file boundaries moved.
// ============================================================================

import { upsertResolvedMark } from "../../db/mutations";
import { type ActionResult, runActionBare } from "../confirmation";

export type MarkActionId = "wiki" | "text" | "leave";

/**
 * What resolveMark did, so the store and editor can react. For a 'wiki'
 * resolution the wiki write happens via the confirmed wiki path, not here.
 */
export type ResolveMarkOutcome =
  | { kind: "resolved"; markKey: string } // 'leave' → suppressed permanently
  | { kind: "selectForEdit"; quote: string } // 'text' → select the run in the editor
  | { kind: "needsConfirmation"; entryId: string; factKey: string }; // 'wiki' → hand off to confirmed path

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
  return runActionBare<ResolveMarkOutcome>(async () => {
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
  });
}

// ---- AI: grounded mark explanation (read-only, NOT a wiki write) -----------
//
// When the engine flags a run, the writer can ask the AI to explain WHY it
// clashes with their world and offer an optional rewrite. This is purely
// advisory: it grounds on the wiki snapshot, writes NOTHING, and never touches
// the manuscript. The engine remains the source of truth — with AI off the
// note still shows the engine's own noteText + actions, unchanged.
