// =============================================================================
// SaaRouters AI client (server-only).
//
// SaaRouters is an Anthropic Messages API-compatible gateway. We talk to it with
// plain `fetch` (zero new deps) against POST {base}/v1/messages using the
// `x-api-key` + `anthropic-version` headers, exactly like the Anthropic API.
//
// Verified live: POST https://saafragrance.xyz/v1/messages -> 200 with
// { content: [{ type: "text", text }] }.
//
// This module must never be imported from a client component. It reads secrets
// from the environment and is only used by server actions / server components.
// =============================================================================

import "server-only";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiCompletionOptions {
  /** System prompt (Anthropic top-level `system`). */
  system?: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Abort if the upstream takes longer than this (ms). Default 30s. */
  timeoutMs?: number;
}

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  anthropicVersion: string;
}

/** Thrown for any AI failure (missing config, upstream error, timeout). */
export class AiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/**
 * Resolve config from the environment. Accepts several env spellings so the same
 * key works whether it was set for jcode (JCODE_PROVIDER_SAAFRAGRANCE_API_KEY),
 * for Claude Code (ANTHROPIC_*), or app-specific (SAAROUTERS_*).
 *
 * Returns null (rather than throwing) when no API key is configured, so callers
 * can degrade gracefully and keep the "AI off" experience intact.
 */
export function getAiConfig(): AiConfig | null {
  const apiKey =
    process.env.SAAROUTERS_API_KEY ??
    process.env.JCODE_PROVIDER_SAAFRAGRANCE_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    "";
  if (!apiKey) return null;

  const rawBase =
    process.env.SAAROUTERS_BASE_URL ??
    process.env.ANTHROPIC_BASE_URL ??
    "https://saafragrance.xyz";
  // Normalize: strip a trailing /v1 or / so we can always append /v1/messages.
  const baseUrl = rawBase.replace(/\/+$/, "").replace(/\/v1$/, "");

  const model =
    process.env.SAAROUTERS_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    "SaaRouters";

  const anthropicVersion = process.env.ANTHROPIC_VERSION ?? "2023-06-01";

  return { baseUrl, apiKey, model, anthropicVersion };
}

/** True when an API key is configured. Cheap check for UI gating. */
export function aiEnabled(): boolean {
  return getAiConfig() !== null;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

/**
 * Single-shot completion. Returns the concatenated text of the response.
 * Throws AiError on any failure.
 */
export async function complete(options: AiCompletionOptions): Promise<string> {
  const config = getAiConfig();
  if (!config) {
    throw new AiError(
      "AI is not configured. Set SAAROUTERS_API_KEY (or ANTHROPIC_API_KEY) in .env.local.",
    );
  }

  const {
    system,
    messages,
    maxTokens = 1024,
    temperature = 0.7,
    timeoutMs = 30_000,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": config.anthropicVersion,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiError(`AI request timed out after ${timeoutMs}ms`, err);
    }
    throw new AiError("AI request failed to reach the gateway", err);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new AiError(
      `AI gateway returned ${res.status} ${res.statusText}${bodyText ? `: ${bodyText.slice(0, 400)}` : ""}`,
    );
  }

  let data: AnthropicResponse;
  try {
    data = (await res.json()) as AnthropicResponse;
  } catch (err) {
    throw new AiError("AI gateway returned a non-JSON response", err);
  }

  if (data.error?.message) {
    throw new AiError(`AI gateway error: ${data.error.message}`);
  }

  const text = (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim();

  if (!text) {
    throw new AiError("AI gateway returned an empty completion");
  }
  return text;
}

/**
 * Convenience: ask for JSON and parse it. Instructs the model to reply with only
 * JSON, strips common ```json fences, and parses. Throws AiError on parse fail.
 */
export async function completeJson<T = unknown>(
  options: AiCompletionOptions,
): Promise<T> {
  const raw = await complete(options);
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Last resort: extract the first {...} or [...] block.
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    throw new AiError(`AI did not return valid JSON: ${cleaned.slice(0, 200)}`, err);
  }
}
