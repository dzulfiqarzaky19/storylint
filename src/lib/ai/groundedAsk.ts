// =============================================================================
// Asking the model a question grounded in the writer's own world (T-DEEP-4).
//
// storylint only ever asks the AI one SHAPE of question: take these entities,
// stay inside them, answer this. That recipe was written longhand at four call
// sites (explainMark, aiCheckChapter, askResearchAi, suggestEntryFacts), and
// each copy had to independently get four things right:
//
//   1. THE "AI IS OFF" GUARD, including the exact sentence shown to the writer.
//   2. THE GROUNDING CONVENTION — how an entity is rendered into the prompt, and
//      in particular the bracketed `[id]` form, which is load-bearing: it is the
//      only reason a check response can echo an entryId back that the server can
//      resolve. Three hand-written renderings had drifted apart.
//   3. THE TOKEN BUDGET, a bare number per call site.
//   4. THROW-VS-ENVELOPE. `completeJson` throws; some callers caught and
//      degraded, one caught and re-enveloped, one let it escape into the
//      surrounding runAction. Three answers to one question.
//
// A caller now supplies only what is actually its own: the rules the model must
// follow, the material to reason over, and how much answer to pay for. Grounding
// is rendered in ONE house style, and the result is always an envelope — this
// module never throws.
//
// The gateway itself sits behind `AiCompletionOptions.fetchImpl`, so everything
// here is exercisable without a live gateway.
// =============================================================================

import "server-only";

import { type ActionResult, errorMessage } from "@/lib/actions/confirmation";
import { aiEnabled, complete, completeJson } from "./saarouters";

/**
 * THE sentence the writer sees when no gateway is configured. Exported so a
 * caller that would otherwise load a snapshot before asking can bail out early
 * with the same wording, instead of re-typing it (it was typed out four times).
 */
export const AI_OFF = "AI is not configured. Add SAAROUTERS_API_KEY to .env.local.";

/**
 * How much answer to pay for. Named rather than numeric so the budgets stay
 * comparable across surfaces instead of being re-guessed per call site.
 *
 *   brief    — a couple of sentences, no structure (a fallback reply).
 *   standard — a short structured answer (a handful of facts, one explanation).
 *   full     — a whole-chapter cross-check or a reply plus proposition cards.
 */
export type AskBudget = "brief" | "standard" | "full";

const MAX_TOKENS: Record<AskBudget, number> = {
  brief: 400,
  standard: 500,
  full: 900,
};

/** One entity as the model sees it. Pass `facts: []` for cheap context. */
export interface GroundedEntry {
  id: string;
  name: string;
  kind: string;
  summary?: string;
  facts: { key: string; value: string }[];
}

/**
 * A block of entities the model must stay inside. The caller supplies only the
 * heading and the entities; the rendering is this module's.
 */
export interface GroundBlock {
  heading: string;
  entries: GroundedEntry[];
  /** Stands in for the block when there is nothing to ground on. */
  whenEmpty: string;
  /**
   * Prefix each entity with its bracketed `[id]` so the model can echo it back
   * (a check response's `entryId`). Only set it when the caller actually
   * resolves those ids — an un-echoable id is prompt weight for nothing.
   */
  addressable?: boolean;
}

/** A line of prompt, or a grounding block. `false`/null/undefined drop out. */
export type PromptPart = string | GroundBlock | false | null | undefined;

function isGroundBlock(part: PromptPart): part is GroundBlock {
  return typeof part === "object" && part !== null;
}

/**
 * THE house style for putting an entity in front of the model. The addressable
 * form leads with `[id]` and separates the summary with a colon; the plain form
 * parenthesises the kind and separates with an em dash. Facts always trail in
 * brackets, and an entity with none renders without them.
 */
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

/**
 * Render entities in the house style, one per line.
 *
 * Exported for the STREAMING path only: `/api/research/stream` cannot go through
 * the envelope below (it hands deltas straight to the client), so it composes
 * its own prompt — but it must ground identically to the blocking path, and a
 * fifth hand-written copy of this loop is exactly how the renderings drifted.
 */
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
  /** The rules the model must follow. Lines are joined with newlines. */
  system: string[];
  /** The material to reason over, in order. Falsy parts drop out. */
  user: PromptPart[];
  budget: AskBudget;
  /**
   * Sampling temperature. LEAVE IT UNSET unless the answer genuinely wants
   * variety: some gateway routes return an EMPTY completion when a temperature
   * accompanies a large prompt (verified live 2026-08-09 — with 0.2 the
   * whole-chapter check came back empty; without, it returned JSON reliably).
   */
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

/**
 * Ask for a STRUCTURED answer, grounded in the given entities.
 *
 * Never throws: a gateway failure, a non-JSON reply, or an unconfigured gateway
 * all come back as `{ ok: false, error }` for the caller to degrade on.
 */
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

/** Ask for PROSE, grounded in the given entities. Same envelope contract. */
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
