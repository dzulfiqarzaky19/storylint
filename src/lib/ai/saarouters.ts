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

import { parseSseEvents, textDeltaFrom, isStreamStop } from "./sseParse";

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
    "https://9qusaeri.com/v1";
  // Normalize: strip a trailing /v1 or / so we can always append /v1/messages.
  const baseUrl = rawBase.replace(/\/+$/, "").replace(/\/v1$/, "");

  const model =
    process.env.SAAROUTERS_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    "opus";

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
 * Marks an AiError as retryable: the gateway didn't give us a real answer, but a
 * fresh attempt with the same input might. Non-retryable failures (bad config,
 * 4xx auth, non-JSON) leave this false so we surface them immediately.
 */
class RetryableAiError extends AiError {
  readonly retryable = true as const;
}

/** True when this failure is worth one more identical attempt. */
function isRetryable(err: unknown): boolean {
  return err instanceof RetryableAiError;
}

/** One single request/response round-trip. Retry policy lives in `complete`. */
async function completeOnce(
  config: AiConfig,
  options: AiCompletionOptions,
): Promise<string> {
  const {
    system,
    messages,
    maxTokens = 1024,
    temperature,
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
        // Some SaaRouters routes return an EMPTY completion when `temperature`
        // is sent alongside a larger prompt, so only include it when explicitly
        // requested. Callers that need determinism can still pass one.
        ...(temperature !== undefined ? { temperature } : {}),
        ...(system ? { system } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      // A timeout is transient: worth one retry.
      throw new RetryableAiError(`AI request timed out after ${timeoutMs}ms`, err);
    }
    throw new AiError("AI request failed to reach the gateway", err);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const message = `AI gateway returned ${res.status} ${res.statusText}${bodyText ? `: ${bodyText.slice(0, 400)}` : ""}`;
    // 5xx / 429 are transient; 4xx (auth, bad request) are not.
    if (res.status >= 500 || res.status === 429) {
      throw new RetryableAiError(message);
    }
    throw new AiError(message);
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
    // An empty 200 (content: []) is the gateway artifact we most want to retry.
    throw new RetryableAiError("AI gateway returned an empty completion");
  }
  return text;
}

/**
 * Single-shot completion with one automatic retry on transient failures (empty
 * 200, timeout, 5xx, 429). Returns the concatenated text of the response.
 * Throws AiError on any non-transient failure or when the retry is also empty.
 */
export async function complete(options: AiCompletionOptions): Promise<string> {
  const config = getAiConfig();
  if (!config) {
    throw new AiError(
      "AI is not configured. Set SAAROUTERS_API_KEY (or ANTHROPIC_API_KEY) in .env.local.",
    );
  }

  const maxAttempts = 2; // one initial try + one retry
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await completeOnce(config, options);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isRetryable(err)) {
        continue; // transient: try once more with the same input
      }
      throw err;
    }
  }
  // Unreachable (loop either returns or throws), but satisfies the type checker.
  throw lastErr instanceof Error
    ? lastErr
    : new AiError("AI request failed");
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

// -----------------------------------------------------------------------------
// Streaming variant (F2b). Yields incremental text deltas as the gateway
// produces them, so the research chat can render the answer token-by-token.
//
// This is ADDITIVE: complete()/completeJson() (the blocking path) are untouched
// and remain the fallback. streamComplete throws AiError on config/upstream
// failure BEFORE the first yield; a failure mid-stream propagates as a thrown
// error out of the generator so the caller's persist gate can decline to write a
// partial turn. No retry policy here — a half-streamed answer can't be silently
// re-attempted the way a blocking call can.
// -----------------------------------------------------------------------------

export interface StreamCompletionOptions extends AiCompletionOptions {
  /** Abort the upstream fetch when this signal fires (client disconnect). */
  signal?: AbortSignal;
}

/**
 * Stream a completion as an async iterable of text chunks. Consumers concatenate
 * the yielded strings to assemble the full answer; parsing (Option-C sentinel)
 * runs on that full buffer at completion, never mid-stream.
 */
export async function* streamComplete(
  options: StreamCompletionOptions,
): AsyncGenerator<string, void, unknown> {
  const config = getAiConfig();
  if (!config) {
    throw new AiError(
      "AI is not configured. Set SAAROUTERS_API_KEY (or ANTHROPIC_API_KEY) in .env.local.",
    );
  }

  const { system, messages, maxTokens = 1024, temperature, signal } = options;

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": config.anthropicVersion,
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        stream: true,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(system ? { system } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      // The caller's AbortSignal (client disconnect) must tear down the upstream
      // request so we never keep generating tokens nobody is reading.
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiError("AI stream aborted", err);
    }
    throw new AiError("AI stream failed to reach the gateway", err);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new AiError(
      `AI gateway returned ${res.status} ${res.statusText}${bodyText ? `: ${bodyText.slice(0, 400)}` : ""}`,
    );
  }
  if (!res.body) {
    throw new AiError("AI gateway returned no stream body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseEvents(buffered);
      buffered = rest;
      for (const evt of events) {
        const text = textDeltaFrom(evt);
        if (text) yield text;
        if (isStreamStop(evt)) return;
      }
    }
  } finally {
    // Release the underlying connection whether we finished, threw, or the
    // consumer stopped pulling (e.g. client disconnect).
    await reader.cancel().catch(() => {});
  }
}
