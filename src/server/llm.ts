import type { LlmConfig } from '../llm/types.ts'

export class LlmError extends Error {}

<<<<<<< HEAD
export async function completeJson(
  config: LlmConfig,
  system: string,
  user: string,
): Promise<unknown> {
=======
async function completeRaw(
  config: LlmConfig,
  system: string,
  user: string,
  temperature: number,
): Promise<string> {
>>>>>>> storylint/lab-slice
  if (!config.baseUrl || !config.model) throw new LlmError('LLM_BASE_URL and LLM_MODEL are required')
  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: config.maxTokens,
<<<<<<< HEAD
        temperature: 0.1,
=======
        temperature,
>>>>>>> storylint/lab-slice
      }),
      signal: AbortSignal.timeout(300_000),
    })
  } catch (error) {
    throw new LlmError(error instanceof Error ? `LLM request failed: ${error.message}` : 'LLM request failed')
  }
  if (!response.ok) throw new LlmError(`LLM request failed (${response.status})`)

  const rawBody = await response.text()
  let payload: unknown
  try {
    payload = JSON.parse(rawBody) as unknown
  } catch {
    // Some local routers append a second JSON object or a trailer after a valid envelope.
    try {
      payload = extractFirstJsonValue(rawBody)
    } catch {
      throw new LlmError('LLM HTTP body is not valid JSON')
    }
  }

  if (typeof payload !== 'object' || payload === null || !('choices' in payload) || !Array.isArray(payload.choices)) {
    throw new LlmError('LLM response has no choices')
  }
  const first = payload.choices[0]
  if (typeof first !== 'object' || first === null || !('message' in first)) throw new LlmError('LLM response has no message')
  const message = first.message
  if (typeof message !== 'object' || message === null || !('content' in message)) throw new LlmError('LLM response has no content')
  const content = Array.isArray(message.content)
    ? message.content.flatMap((part: unknown) =>
        typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string' ? [part.text] : [],
      ).join('')
    : message.content
  if (typeof content !== 'string') throw new LlmError('LLM response content is invalid')
<<<<<<< HEAD
  return parseJsonObject(content)
=======
  return content
}

/** Freeform assistant text (not forced JSON). */
export async function completeText(
  config: LlmConfig,
  system: string,
  user: string,
): Promise<string> {
  const content = (await completeRaw(config, system, user, 0.4)).trim()
  if (!content) throw new LlmError('LLM response content is empty')
  return content
}

export async function completeJson(
  config: LlmConfig,
  system: string,
  user: string,
): Promise<unknown> {
  return parseJsonObject(await completeRaw(config, system, user, 0.1))
>>>>>>> storylint/lab-slice
}

function parseJsonObject(content: string): unknown {
  const unfenced = content
    .replace(/^﻿/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  try {
    return extractFirstJsonValue(unfenced)
  } catch {
    throw new LlmError('LLM response contains invalid JSON')
  }
}

/** First complete JSON value in text (object/array), ignoring trailing junk after it. */
function extractFirstJsonValue(text: string): unknown {
  const startObject = text.indexOf('{')
  const startArray = text.indexOf('[')
  let start = -1
  if (startObject >= 0 && (startArray < 0 || startObject < startArray)) start = startObject
  else if (startArray >= 0) start = startArray
  if (start < 0) throw new SyntaxError('No JSON value')

  let depth = 0
  let inString = false
  let escape = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escape) escape = false
      else if (char === '\\') escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{' || char === '[') depth += 1
    else if (char === '}' || char === ']') {
      depth -= 1
      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1)) as unknown
      }
    }
  }
  throw new SyntaxError('Unterminated JSON value')
}
