// M3 — safeFetch: SSRF-hardened HTTP(S) fetch for the web-search engine.
//
// PORTABLE MODULE BOUNDARY: imports ONLY node builtins + undici + siblings.
// No @/lib imports.
//
// THREAT MODEL (SSRF, security-and-hardening skill):
//   Trust boundary: a URL the engine fetches (search result / page to read).
//   Asset at risk: internal services, cloud metadata (169.254.169.254), other
//   loopback/private hosts.
//   Controls (defense in depth):
//     1. scheme allowlist (http/https only)
//     2. resolve ALL A/AAAA records and reject if ANY is private/reserved
//     3. PIN the connection to the validated IP via undici Agent connect.lookup
//        (anti-DNS-rebind: fetch cannot re-resolve to a different IP after the
//        check; SNI/Host stay the original hostname so TLS + vhosts work)
//     4. manual redirects, re-validated at EVERY hop
//     5. html-only content-type
//     6. hard byte cap (OOM safety)
//     7. AbortSignal timeout (injectable timeoutMs; fake timers do not mock
//        AbortSignal.timeout, nodejs/node#3088, so timeout is injectable)

import { isIP, BlockList } from "node:net";
import { lookup as dnsLookup } from "node:dns";
import { Agent } from "undici";

/**
 * Build the reserved/private BlockList once. Covers the ranges that must never
 * be reachable from a user-influenced fetch.
 */
function buildBlockList(): BlockList {
  const bl = new BlockList();

  // ---- IPv4 reserved / private / special-use ----
  bl.addSubnet("0.0.0.0", 8, "ipv4"); // "this host" / unspecified
  bl.addSubnet("10.0.0.0", 8, "ipv4"); // RFC1918 private
  bl.addSubnet("100.64.0.0", 10, "ipv4"); // RFC6598 CGNAT
  bl.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
  bl.addSubnet("169.254.0.0", 16, "ipv4"); // link-local incl 169.254.169.254 metadata
  bl.addSubnet("172.16.0.0", 12, "ipv4"); // RFC1918 private
  bl.addSubnet("192.0.0.0", 24, "ipv4"); // IETF protocol assignments
  bl.addSubnet("192.0.2.0", 24, "ipv4"); // TEST-NET-1
  bl.addSubnet("192.168.0.0", 16, "ipv4"); // RFC1918 private
  bl.addSubnet("198.18.0.0", 15, "ipv4"); // benchmarking
  bl.addSubnet("198.51.100.0", 24, "ipv4"); // TEST-NET-2
  bl.addSubnet("203.0.113.0", 24, "ipv4"); // TEST-NET-3
  bl.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
  bl.addSubnet("240.0.0.0", 4, "ipv4"); // reserved incl 255.255.255.255 broadcast

  // ---- IPv6 reserved / private / special-use ----
  bl.addAddress("::", "ipv6"); // unspecified
  bl.addAddress("::1", "ipv6"); // loopback
  bl.addSubnet("fc00::", 7, "ipv6"); // unique-local (fc00::/7 covers fc/fd)
  bl.addSubnet("fe80::", 10, "ipv6"); // link-local
  bl.addSubnet("ff00::", 8, "ipv6"); // multicast

  return bl;
}

const BLOCK_LIST = buildBlockList();

/**
 * Normalize an IPv4-mapped IPv6 address (::ffff:a.b.c.d) to its IPv4 form so the
 * IPv4 BlockList rules apply. Returns null when not mapped.
 */
function unwrapMappedIPv4(addr: string): string | null {
  const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(addr);
  return m ? (m[1] ?? null) : null;
}

/**
 * Is this RESOLVED IP address unsafe to connect to? Fail-closed: anything not a
 * valid, clearly-public unicast address is blocked.
 *
 * This is the security core — mutation-proofed against the metadata endpoint.
 */
export function isBlockedAddress(address: string): boolean {
  // Unwrap IPv4-mapped IPv6 first so ::ffff:169.254.169.254 is judged as IPv4.
  const mapped = unwrapMappedIPv4(address);
  const candidate = mapped ?? address;

  const family = isIP(candidate);
  if (family === 0) return true; // not a valid IP => fail closed

  const kind = family === 4 ? "ipv4" : "ipv6";
  return BLOCK_LIST.check(candidate, kind);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Thrown for any request the SSRF guard refuses. Callers treat it as "skip". */
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** A resolved address record (subset of dns.LookupAddress). */
export interface ResolvedAddress {
  address: string;
  family: number;
}

/** Resolver seam: hostname -> all A/AAAA records. Injectable for tests. */
export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

/** A minimal Response shape the orchestration relies on (fetch/undici compatible). */
export interface FetchLikeResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

/** Fetch seam: perform ONE hop with redirects disabled, pinned to `pinnedIp`. */
export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; pinnedIp: string; hostname: string },
) => Promise<FetchLikeResponse>;

export interface SafeFetchOptions {
  /** Per-request timeout (injectable; fake timers cannot mock AbortSignal.timeout). */
  timeoutMs?: number;
  /** Hard byte cap on the body (OOM safety). */
  maxBytes?: number;
  /** Max redirect hops before giving up. */
  maxRedirects?: number;
  /** DNS resolver seam (default: node dns.lookup all records). */
  resolve?: HostResolver;
  /** Fetch seam (default: undici fetch with an IP-pinned per-request Agent). */
  fetchImpl?: FetchLike;
  /** External abort signal (client disconnect); combined with the timeout. */
  signal?: AbortSignal;
}

export interface SafeFetchResult {
  /** Final URL after redirects. */
  url: string;
  status: number;
  contentType: string;
  /** Full body text (capped at maxBytes). */
  body: string;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 4;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Default resolver: dns.lookup({all:true}) wrapped in a promise. */
const defaultResolve: HostResolver = (hostname) =>
  new Promise((resolvePromise, reject) => {
    dnsLookup(hostname, { all: true }, (err, addresses) => {
      if (err) reject(err);
      else resolvePromise(addresses as ResolvedAddress[]);
    });
  });

/**
 * Default fetch seam: undici fetch pinned to the validated IP via an Agent
 * whose connect.lookup ALWAYS returns the pre-validated address (anti-rebind).
 * SNI/Host stay the original hostname so TLS + name-based vhosts work. A fresh
 * agent per request is created and closed by the caller's finally.
 */
const defaultFetch: FetchLike = async (url, { signal, pinnedIp, hostname }) => {
  const family = isIP(pinnedIp);
  const agent = new Agent({
    connect: {
      // Pin: hand undici the validated IP regardless of what it asks to resolve.
      lookup: (_hostname, _opts, cb) => {
        cb(null, [{ address: pinnedIp, family: family === 6 ? 6 : 4 }]);
      },
    },
  });
  try {
    const res = await fetch(url, {
      signal,
      redirect: "manual",
      // @ts-expect-error undici-specific dispatcher option on the global fetch
      dispatcher: agent,
      headers: { host: hostname, accept: "text/html,application/xhtml+xml" },
    });
    return res as unknown as FetchLikeResponse;
  } finally {
    await agent.close();
  }
};

/**
 * Validate a URL for SSRF safety and return the pinned IP to connect to.
 * Rejects: non-http(s) scheme, unresolvable host, or ANY resolved address that
 * is private/reserved. Returns the FIRST validated address (all were checked).
 */
export async function assertSafeUrl(
  raw: string,
  resolve: HostResolver,
): Promise<{ url: URL; pinnedIp: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError(`Unparseable URL: ${raw}`);
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(`Scheme not allowed: ${url.protocol}`);
  }

  // A bare IP literal in the host is validated directly (no DNS).
  const hostLiteral = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: ResolvedAddress[];
  if (isIP(hostLiteral) !== 0) {
    addresses = [{ address: hostLiteral, family: isIP(hostLiteral) }];
  } else {
    try {
      addresses = await resolve(url.hostname);
    } catch {
      throw new UnsafeUrlError(`DNS resolution failed: ${url.hostname}`);
    }
    if (addresses.length === 0) {
      throw new UnsafeUrlError(`No addresses for host: ${url.hostname}`);
    }
  }

  // Reject if ANY resolved address is unsafe (a single bad record fails all).
  for (const a of addresses) {
    if (isBlockedAddress(a.address)) {
      throw new UnsafeUrlError(`Private/reserved IP for ${url.hostname}: ${a.address}`);
    }
  }
  // Pin the first validated address.
  const pinnedIp = addresses[0]?.address ?? "";
  return { url, pinnedIp };
}

/** Read a stream body with a hard byte cap; falls back to text() if no stream. */
async function readCappedBody(
  res: FetchLikeResponse,
  maxBytes: number,
): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Keep only up to the cap, then stop reading (OOM safety).
        const remaining = maxBytes - (total - value.byteLength);
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        break;
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

/**
 * SSRF-safe fetch. Follows redirects MANUALLY, re-validating every hop; enforces
 * an html-only content-type and a hard byte cap; times out via an injectable
 * AbortSignal. Throws UnsafeUrlError for anything the guard refuses; callers
 * treat that as "skip this URL" (fail-soft).
 */
export async function safeFetch(
  raw: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const resolve = opts.resolve ?? defaultResolve;
  const fetchImpl = opts.fetchImpl ?? defaultFetch;

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, timeoutSignal])
    : timeoutSignal;

  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    // Re-validate EVERY hop (a redirect target is fresh untrusted input).
    const { url, pinnedIp } = await assertSafeUrl(current, resolve);

    const res = await fetchImpl(url.toString(), {
      signal,
      pinnedIp,
      hostname: url.hostname,
    });

    // Manual redirect handling: re-validate the Location on the next loop.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new UnsafeUrlError(`Redirect without Location from ${url.toString()}`);
      }
      current = new URL(location, url).toString();
      continue;
    }

    // Non-redirect: enforce content-type and read the capped body.
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new UnsafeUrlError(`Non-HTML content-type: ${contentType || "(none)"}`);
    }
    const body = await readCappedBody(res, maxBytes);
    return { url: url.toString(), status: res.status, contentType, body };
  }
  throw new UnsafeUrlError(`Too many redirects (>${maxRedirects}) for ${raw}`);
}
