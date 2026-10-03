import { describe, expect, it, vi } from 'vitest';

import {
  assertSafeUrl,
  isBlockedAddress,
  safeFetch,
  UnsafeUrlError,
  type FetchLike,
  type FetchLikeResponse,
  type HostResolver,
} from './safeFetch';

const PUBLIC_IP = '93.184.216.34';

/** A resolver that answers from a fixed table and fails for unknown hosts. */
function resolverOf(table: Record<string, string[]>): HostResolver {
  return async (hostname) => {
    const addresses = table[hostname];
    if (!addresses) throw new Error(`ENOTFOUND ${hostname}`);
    return addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  };
}

function response(over: Partial<{ status: number; headers: Record<string, string>; text: string }> = {}): FetchLikeResponse {
  const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8', ...over.headers };
  return {
    status: over.status ?? 200,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    body: null,
    text: async () => over.text ?? '<html></html>',
  };
}

function redirectTo(location: string | null): FetchLikeResponse {
  return response({ status: 302, headers: location === null ? {} : { location } });
}

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('isBlockedAddress', () => {
  it.each([
    ['loopback', '127.0.0.1'],
    ['private 10/8', '10.0.0.1'],
    ['private 172.16/12', '172.16.0.1'],
    ['private 192.168/16', '192.168.1.1'],
    ['the cloud metadata endpoint', '169.254.169.254'],
    ['carrier-grade NAT', '100.64.0.1'],
    ['the unspecified address', '0.0.0.0'],
    ['multicast', '224.0.0.1'],
    ['broadcast', '255.255.255.255'],
    ['IPv6 loopback', '::1'],
    ['IPv6 unspecified', '::'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv6 unique-local', 'fd12:3456::1'],
    ['IPv6 multicast', 'ff02::1'],
    ['IPv4-mapped loopback, dotted', '::ffff:127.0.0.1'],
    ['IPv4-mapped metadata endpoint, dotted', '::ffff:169.254.169.254'],
    ['IPv4-mapped loopback, hex (the form URL parsing produces)', '::ffff:7f00:1'],
    ['IPv4-mapped metadata endpoint, hex', '::ffff:a9fe:a9fe'],
    ['NAT64 metadata endpoint, hex', '64:ff9b::a9fe:a9fe'],
    ['NAT64 metadata endpoint, dotted', '64:ff9b::169.254.169.254'],
    ['NAT64 loopback, uncompressed', '64:ff9b:0:0:0:0:7f00:1'],
    ['NAT64 private 10/8', '64:ff9b::a00:1'],
    ['local-use NAT64, even around a public IPv4', '64:ff9b:1::808:808'],
    ['6to4 metadata endpoint', '2002:a9fe:a9fe::1'],
    ['6to4 loopback', '2002:7f00:1::'],
    ['6to4 private 192.168/16', '2002:c0a8:101:1::1'],
    ['Teredo, the RFC 4380 example', '2001:0:4136:e378:8000:63bf:3fff:fdd2'],
    ['Teredo, compressed', '2001::a9fe:a9fe'],
  ])('blocks %s (%s)', (_name, address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    ['a hostname', 'example.com'],
    ['an out-of-range IPv4', '999.1.1.1'],
    ['an empty string', ''],
  ])('fails closed on %s, which is not an IP address', (_name, address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    ['a public IPv4', '8.8.8.8'],
    ['another public IPv4', PUBLIC_IP],
    ['a public IPv6', '2606:4700:4700::1111'],
    ['an IPv4-mapped public address', '::ffff:8.8.8.8'],
    ['a NAT64 address around a public IPv4', '64:ff9b::808:808'],
    ['a 6to4 address around a public IPv4', '2002:808:808::1'],
    ['a public IPv6 that only resembles the NAT64 prefix', '64:ff9c::a9fe:a9fe'],
    ['a public IPv6 that only resembles the Teredo prefix', '2001:4860:4860::8888'],
  ])('allows %s (%s)', (_name, address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  const resolve = resolverOf({ 'example.com': [PUBLIC_IP], 'intranet.test': ['10.0.0.5'] });

  it('returns the parsed URL and the validated IP to pin the connection to', async () => {
    const result = await assertSafeUrl('https://example.com/page', resolve);

    expect(result.url.href).toBe('https://example.com/page');
    expect(result.pinnedIp).toBe(PUBLIC_IP);
  });

  it.each([
    ['file:///etc/passwd'],
    ['ftp://example.com/file'],
    ['javascript:alert(1)'],
    ['not a url'],
  ])('refuses %s', async (raw) => {
    await expect(assertSafeUrl(raw, resolve)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('refuses a host that resolves to a private address', async () => {
    await expect(assertSafeUrl('http://intranet.test/', resolve)).rejects.toThrow(/Private\/reserved IP/);
  });

  it('refuses a host when any one of its records is private', async () => {
    const mixed = resolverOf({ 'rebind.test': [PUBLIC_IP, '127.0.0.1'] });

    await expect(assertSafeUrl('http://rebind.test/', mixed)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it.each([
    ['a private IPv4 literal', 'http://192.168.1.1/'],
    ['the metadata endpoint', 'http://169.254.169.254/latest/meta-data/'],
    ['a bracketed IPv6 loopback', 'http://[::1]/'],
    ['an IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/'],
    ['a decimal-encoded loopback', 'http://2130706433/'],
    ['a short-form loopback', 'http://127.1/'],
  ])('refuses %s without asking DNS', async (_name, raw) => {
    const dns = vi.fn<HostResolver>();

    await expect(assertSafeUrl(raw, dns)).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(dns).not.toHaveBeenCalled();
  });

  it('accepts a public IP literal without asking DNS', async () => {
    const dns = vi.fn<HostResolver>();

    const result = await assertSafeUrl('http://8.8.8.8/', dns);

    expect(result.pinnedIp).toBe('8.8.8.8');
    expect(dns).not.toHaveBeenCalled();
  });

  it('refuses a host that does not resolve', async () => {
    await expect(assertSafeUrl('http://nowhere.test/', resolve)).rejects.toThrow(/DNS resolution failed/);
  });

  it('refuses a host that resolves to no addresses', async () => {
    const empty = resolverOf({ 'empty.test': [] });

    await expect(assertSafeUrl('http://empty.test/', empty)).rejects.toThrow(/No addresses/);
  });
});

describe('safeFetch', () => {
  const resolve = resolverOf({
    'example.com': [PUBLIC_IP],
    'other.example': ['8.8.8.8'],
    'intranet.test': ['10.0.0.5'],
  });

  it('returns the page, fetched from the validated IP under the original hostname', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => response({ text: '<p>hello</p>' }));

    const result = await safeFetch('https://example.com/page', { resolve, fetchImpl });

    expect(result).toEqual({
      url: 'https://example.com/page',
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<p>hello</p>',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/page',
      expect.objectContaining({ pinnedIp: PUBLIC_IP, hostname: 'example.com' }),
    );
  });

  it('never fetches a URL the guard refuses', async () => {
    const fetchImpl = vi.fn<FetchLike>();

    await expect(safeFetch('http://intranet.test/', { resolve, fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  describe('redirects', () => {
    it('follows a redirect and re-pins to the new host’s validated IP', async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(redirectTo('https://other.example/landing'))
        .mockResolvedValueOnce(response({ text: 'landed' }));

      const result = await safeFetch('https://example.com/', { resolve, fetchImpl });

      expect(result.url).toBe('https://other.example/landing');
      expect(result.body).toBe('landed');
      expect(fetchImpl).toHaveBeenLastCalledWith(
        'https://other.example/landing',
        expect.objectContaining({ pinnedIp: '8.8.8.8', hostname: 'other.example' }),
      );
    });

    it('resolves a relative redirect against the current URL', async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(redirectTo('/moved'))
        .mockResolvedValueOnce(response());

      const result = await safeFetch('https://example.com/a/b', { resolve, fetchImpl });

      expect(result.url).toBe('https://example.com/moved');
    });

    it.each([
      ['a private host', 'http://intranet.test/admin'],
      ['the metadata endpoint', 'http://169.254.169.254/latest/meta-data/'],
      ['a non-http scheme', 'file:///etc/passwd'],
    ])('refuses a redirect to %s and does not fetch it', async (_name, location) => {
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(redirectTo(location));

      await expect(safeFetch('https://example.com/', { resolve, fetchImpl })).rejects.toBeInstanceOf(UnsafeUrlError);
      expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('refuses a redirect that names no location', async () => {
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(redirectTo(null));

      await expect(safeFetch('https://example.com/', { resolve, fetchImpl })).rejects.toThrow(/without Location/);
    });

    it('gives up after the redirect limit', async () => {
      const fetchImpl = vi.fn<FetchLike>(async () => redirectTo('https://example.com/loop'));

      await expect(
        safeFetch('https://example.com/', { resolve, fetchImpl, maxRedirects: 2 }),
      ).rejects.toThrow(/Too many redirects/);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });
  });

  describe('the response body', () => {
    it.each([['application/json'], ['image/png'], ['']])('refuses the content type "%s"', async (contentType) => {
      const fetchImpl = vi.fn<FetchLike>(async () => response({ headers: { 'content-type': contentType } }));

      await expect(safeFetch('https://example.com/', { resolve, fetchImpl })).rejects.toThrow(/Non-HTML/);
    });

    it('accepts XHTML', async () => {
      const fetchImpl = vi.fn<FetchLike>(async () =>
        response({ headers: { 'content-type': 'application/xhtml+xml' } }),
      );

      await expect(safeFetch('https://example.com/', { resolve, fetchImpl })).resolves.toMatchObject({ status: 200 });
    });

    it('stops reading a streamed body at the byte cap', async () => {
      const fetchImpl = vi.fn<FetchLike>(async () => ({
        ...response(),
        body: streamOf(['aaaa', 'bbbb', 'cccc']),
      }));

      const result = await safeFetch('https://example.com/', { resolve, fetchImpl, maxBytes: 6 });

      expect(result.body).toBe('aaaabb');
    });

    it('reads a streamed body in full when it is under the cap', async () => {
      const fetchImpl = vi.fn<FetchLike>(async () => ({ ...response(), body: streamOf(['aaaa', 'bbbb']) }));

      const result = await safeFetch('https://example.com/', { resolve, fetchImpl, maxBytes: 100 });

      expect(result.body).toBe('aaaabbbb');
    });

    it('caps a body that arrives without a stream', async () => {
      const fetchImpl = vi.fn<FetchLike>(async () => response({ text: 'abcdefgh' }));

      const result = await safeFetch('https://example.com/', { resolve, fetchImpl, maxBytes: 3 });

      expect(result.body).toBe('abc');
    });
  });

  it('hands the fetch a signal that aborts when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<FetchLike>(async () => response());

    await safeFetch('https://example.com/', { resolve, fetchImpl, signal: controller.signal });
    const signal = fetchImpl.mock.calls[0]?.[1].signal;
    controller.abort();

    expect(signal?.aborted).toBe(true);
  });
});
