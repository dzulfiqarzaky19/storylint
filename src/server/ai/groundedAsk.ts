import "server-only";

import { type ActionResult, errorMessage } from "@/domain/result";
import { aiEnabled, complete, completeJson } from "./saarouters";

export const AI_OFF = "AI is not configured. Add SAAROUTERS_API_KEY to .env.local.";

export type AskBudget = "brief" | "standard" | "full";

const MAX_TOKENS: Record<AskBudget, number> = {
  brief: 400,
  standard: 500,
  full: 900,
};

export interface GroundedEntry {
  id: string;
  name: string;
  kind: string;
  summary?: string;
  facts: { key: string; value: string }[];
}

export interface GroundBlock {
  heading: string;
  entries: GroundedEntry[];
  whenEmpty: string;
  // Prefixes each entity with `[id]` so the model can echo an entryId the server
  // can resolve. Set it only when the caller resolves those ids.
  addressable?: boolean;
}

export type PromptPart = string | GroundBlock | false | null | undefined;

function renderEntry(entry: GroundedEntry, addressable: boolean): string {
  const facts = entry.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
  const head = addressable
    ? `- [${entry.id}] ${entry.name} — ${entry.kind}`
    : `- ${entry.name} (${entry.kind})`;
  const summary = entry.summary
    ? addressable
      ? `: ${entry.summary}`
      : ` — ${entry.summary}`
    : "";
  return `${head}${summary}${facts ? ` [${facts}]` : ""}`;
}

export function renderGrounding(
  entries: readonly GroundedEntry[],
  opts?: { addressable?: boolean },
): string {
  return entries.map((e) => renderEntry(e, opts?.addressable ?? false)).join("\n");
}

function renderPart(part: string | GroundBlock): string {
  if (typeof part === "string") return part;
  if (part.entries.length === 0) return part.whenEmpty;
  return `${part.heading}\n${renderGrounding(part.entries, { addressable: part.addressable })}`;
}

export interface GroundedAsk {
  system: string[];
  user: PromptPart[];
  budget: AskBudget;
  // Leave unset unless the answer wants variety: some gateway routes return an
  // empty completion when a temperature accompanies a large prompt (seen live
  // 2026-08-09: 0.2 on the whole-chapter check came back empty).
  temperature?: number;
}

function compose(ask: GroundedAsk): { system: string; user: string } {
  return {
    system: ask.system.join("\n"),
    user: ask.user
      .filter((p): p is string | GroundBlock => p !== false && p != null)
      .map(renderPart)
      .join("\n"),
  };
}

// Never throws: an unconfigured gateway, a gateway failure and a non-JSON reply
// all come back as { ok: false } for the caller to degrade on.
export async function askGroundedJson<T>(ask: GroundedAsk): Promise<ActionResult<T>> {
  if (!aiEnabled()) return { ok: false, error: AI_OFF };
  const { system, user } = compose(ask);
  try {
    const data = await completeJson<T>({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: MAX_TOKENS[ask.budget],
      ...(ask.temperature !== undefined ? { temperature: ask.temperature } : {}),
    });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function askGroundedText(ask: GroundedAsk): Promise<ActionResult<string>> {
  if (!aiEnabled()) return { ok: false, error: AI_OFF };
  const { system, user } = compose(ask);
  try {
    const data = await complete({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: MAX_TOKENS[ask.budget],
      ...(ask.temperature !== undefined ? { temperature: ask.temperature } : {}),
    });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
