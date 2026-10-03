"use server";

import { upsertResolvedMark } from "@/server/db/chapters/mutations";
import { type ActionResult, runActionBare } from "@/domain/result";

export type MarkActionId = "wiki" | "text" | "leave";

export type ResolveMarkOutcome =
  | { kind: "resolved"; markKey: string }
  | { kind: "selectForEdit"; quote: string }
  | { kind: "needsConfirmation"; entryId: string; factKey: string };

export async function openMark(markKey: string): Promise<ActionResult> {
  void markKey;
  return { ok: true, data: undefined };
}

export interface ResolveMarkContext {
  bookId: string;
  quote?: string;
  entryId?: string;
  factKey?: string;
}

export async function resolveMark(
  markId: string,
  actionId: MarkActionId,
  context: ResolveMarkContext,
): Promise<ActionResult<ResolveMarkOutcome>> {
  return runActionBare<ResolveMarkOutcome>(async () => {
    switch (actionId) {
      case "leave":
        await upsertResolvedMark({
          bookId: context.bookId,
          markKey: markId,
          resolution: "leave",
          resolvedAt: Date.now(),
        });
        return { ok: true, data: { kind: "resolved", markKey: markId } };

      case "text":
        return {
          ok: true,
          data: { kind: "selectForEdit", quote: context.quote ?? "" },
        };

      case "wiki":
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

