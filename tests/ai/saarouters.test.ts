// =============================================================================
// SaaRouters client retry policy.
//
// The live gateway occasionally returns an EMPTY 200 (content: []) instead of a
// real answer, especially under load. `complete()` treats that (and timeouts /
// 5xx / 429) as transient and retries ONCE with the same input. These tests pin
// that behavior with a stubbed fetch so we never regress into "AI check silently
// skipped" on a recoverable blip.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The module reads config from the environment at call time, so set a key before
// importing. getAiConfig() returns null without one and complete() would throw a
// config error instead of exercising the retry path.
process.env.SAAROUTERS_API_KEY = 'test-key';
process.env.SAAROUTERS_BASE_URL = 'https://gateway.test';
process.env.SAAROUTERS_MODEL = 'SaaRouters';

import { complete, completeJson, streamComplete, AiError } from '@/lib/ai/saarouters';

/** Build a Response-like object for the stubbed fetch. */
function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'ERR',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const okBody = { content: [{ type: 'text', text: 'the real answer' }] };
const emptyBody = { content: [] as Array<{ type: string; text?: string }> };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('complete — retry on transient failures', () => {
  it('retries once after an empty 200 and returns the second answer', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(emptyBody))
      .mockResolvedValueOnce(jsonResponse(okBody));

    const text = await complete({ messages: [{ role: 'user', content: 'hi' }] });

    expect(text).toBe('the real answer');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('succeeds on the first try without retrying', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));

    const text = await complete({ messages: [{ role: 'user', content: 'hi' }] });

    expect(text).toBe('the real answer');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws after TWO consecutive empty completions (no infinite retry)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(emptyBody))
      .mockResolvedValueOnce(jsonResponse(emptyBody));

    await expect(
      complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(AiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once on a 5xx then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'boom' } }, { ok: false, status: 503 }))
      .mockResolvedValueOnce(jsonResponse(okBody));

    const text = await complete({ messages: [{ role: 'user', content: 'hi' }] });

    expect(text).toBe('the real answer');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 4xx (auth/bad-request is not transient)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'unauthorized' } }, { ok: false, status: 401 }),
    );

    await expect(
      complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(AiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('omits temperature from the request body when the caller omits it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));

    await complete({ messages: [{ role: 'user', content: 'hi' }] });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect('temperature' in body).toBe(false);
  });

  it('includes temperature when the caller passes one', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(okBody));

    await complete({ messages: [{ role: 'user', content: 'hi' }], temperature: 0.5 });

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.temperature).toBe(0.5);
  });
});

describe('completeJson — retry carries through', () => {
  it('parses JSON from the retried (second) response', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(emptyBody))
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ type: 'text', text: '{"ok":true}' }] }),
      );

    const parsed = await completeJson<{ ok: boolean }>({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(parsed.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// streamComplete (F2b) — the async-generator streaming transport.
// ---------------------------------------------------------------------------

const enc = new TextEncoder();

/** A delta SSE frame carrying `text`. */
function deltaFrame(text: string): string {
  return `event: content_block_delta\ndata: ${JSON.stringify({
    type: 'content_block_delta',
    delta: { type: 'text_delta', text },
  })}\n\n`;
}
const STOP_FRAME = 'event: message_stop\ndata: {"type":"message_stop"}\n\n';

/** Build a streaming Response whose body.getReader() yields `chunks` in order. */
function streamResponse(chunks: string[], init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  let i = 0;
  const reader = {
    read: async () =>
      i < chunks.length
        ? { done: false, value: enc.encode(chunks[i++]) }
        : { done: true, value: undefined },
    cancel: async () => {},
  };
  return {
    ok,
    status: init?.status ?? (ok ? 200 : 500),
    statusText: ok ? 'OK' : 'ERR',
    body: { getReader: () => reader },
    text: async () => 'err-body',
  } as unknown as Response;
}

/** Drain an async generator into an array. */
async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const c of gen) out.push(c);
  return out;
}

describe('streamComplete — SSE streaming transport', () => {
  it('yields each text delta in order and stops at message_stop', async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse([deltaFrame('Hello'), deltaFrame(' world'), STOP_FRAME]),
    );

    const chunks = await collect(streamComplete({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('reassembles a frame split across two network reads', async () => {
    const whole = deltaFrame('spanned');
    const cut = Math.floor(whole.length / 2);
    fetchMock.mockResolvedValueOnce(
      streamResponse([whole.slice(0, cut), whole.slice(cut), STOP_FRAME]),
    );

    const chunks = await collect(streamComplete({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(chunks).toEqual(['spanned']);
  });

  it('stops yielding after message_stop even if more deltas follow', async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse([deltaFrame('kept'), STOP_FRAME, deltaFrame('AFTER-STOP')]),
    );

    const chunks = await collect(streamComplete({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(chunks).toEqual(['kept']);
  });

  it('sends stream:true and accept text/event-stream on the request', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse([deltaFrame('x'), STOP_FRAME]));

    await collect(streamComplete({ messages: [{ role: 'user', content: 'hi' }] }));

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(true);
    expect((init.headers as Record<string, string>).accept).toBe('text/event-stream');
  });

  it('throws AiError on a non-ok upstream status', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse([], { ok: false, status: 500 }));

    await expect(
      collect(streamComplete({ messages: [{ role: 'user', content: 'hi' }] })),
    ).rejects.toBeInstanceOf(AiError);
  });
});

