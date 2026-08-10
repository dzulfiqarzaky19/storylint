import type { ResearchScope } from "@/lib/domain/types";
import { SCOPE_KIND_LABEL } from "@/lib/research/scopeOptions";

/**
 * The self-police instruction the AI receives for a thread's scope (F4-P2-S4).
 *
 * - `'chat'` -> broad, answer freely (no wiki scope).
 * - a `Kind` -> answer ONLY within that scope; if asked outside it, say so and
 *   offer to switch. No extra classify call: the model self-polices from this
 *   line alone.
 */
export function scopeDirective(scope: ResearchScope): string {
  if (scope === "chat") {
    return "This is a broad Chat thread with NO specific wiki scope; answer freely.";
  }
  const label = SCOPE_KIND_LABEL[scope];
  return `This thread is scoped to ${label} (${scope}). Only answer within that scope; if the writer asks about something outside it, say so plainly and offer to switch scope.`;
}
