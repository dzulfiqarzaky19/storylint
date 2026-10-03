import "server-only";

import { parseSseEvents, textDeltaFrom, isStreamStop } from "./sseParse";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export type GatewayFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface AiCompletionOptions {
  system?: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  fetchImpl?: GatewayFetch;
}

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  anthropicVersion: string;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}

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
  const baseUrl = rawBase.replace(/\/+$/, "").replace(/\/v1$/, "");

  const model =
    process.env.SAAROUTERS_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    "opus";

  const anthropicVersion = process.env.ANTHROPIC_VERSION ?? "2023-06-01";

  return { baseUrl, apiKey, model, anthropicVersion };
}

export function aiEnabled(): boolean {
  return getAiConfig() !== null;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

class RetryableAiError extends AiError {
  readonly retryable = true as const;
}

function isRetryable(err: unknown): boolean {
  return err instanceof RetryableAiError;
}

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
    fetchImpl = fetch,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": config.anthropicVersion,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(system ? { system } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new RetryableAiError(`AI request timed out after ${timeoutMs}ms`, err);
    }
    throw new AiError("AI request failed to reach the gateway", err);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const message = `AI gateway returned ${res.status} ${res.statusText}${bodyText ? `: ${bodyText.slice(0, 400)}` : ""}`;
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
    throw new RetryableAiError("AI gateway returned an empty completion");
  }
  return text;
}

export async function complete(options: AiCompletionOptions): Promise<string> {
  const config = getAiConfig();
  if (!config) {
    throw new AiError(
      "AI is not configured. Set SAAROUTERS_API_KEY (or ANTHROPIC_API_KEY) in .env.local.",
    );
  }

  const maxAttempts = 2;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await completeOnce(config, options);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isRetryable(err)) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new AiError("AI request failed");
}

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
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
      }
    }
    throw new AiError(`AI did not return valid JSON: ${cleaned.slice(0, 200)}`, err);
  }
}

export interface StreamCompletionOptions extends AiCompletionOptions {
  signal?: AbortSignal;
}

export async function* streamComplete(
  options: StreamCompletionOptions,
): AsyncGenerator<string, void, unknown> {
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
    temperature,
    signal,
    fetchImpl = fetch,
  } = options;

  let res: Response;
  try {
    res = await fetchImpl(`${config.baseUrl}/v1/messages`, {
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
    await reader.cancel().catch(() => {});
  }
}
