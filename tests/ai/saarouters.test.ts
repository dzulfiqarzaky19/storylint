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

import { complete, completeJson, AiError } from '@/lib/ai/saarouters';

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
