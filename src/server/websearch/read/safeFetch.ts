import { isIP, BlockList } from "node:net";
import { lookup as dnsLookup } from "node:dns";
import { Agent } from "undici";

function buildBlockList(): BlockList {
  const bl = new BlockList();

  bl.addSubnet("0.0.0.0", 8, "ipv4");
  bl.addSubnet("10.0.0.0", 8, "ipv4");
  bl.addSubnet("100.64.0.0", 10, "ipv4");
  bl.addSubnet("127.0.0.0", 8, "ipv4");
  bl.addSubnet("169.254.0.0", 16, "ipv4");
  bl.addSubnet("172.16.0.0", 12, "ipv4");
  bl.addSubnet("192.0.0.0", 24, "ipv4");
  bl.addSubnet("192.0.2.0", 24, "ipv4");
  bl.addSubnet("192.168.0.0", 16, "ipv4");
  bl.addSubnet("198.18.0.0", 15, "ipv4");
  bl.addSubnet("198.51.100.0", 24, "ipv4");
  bl.addSubnet("203.0.113.0", 24, "ipv4");
  bl.addSubnet("224.0.0.0", 4, "ipv4");
  bl.addSubnet("240.0.0.0", 4, "ipv4");

  bl.addAddress("::", "ipv6");
  bl.addAddress("::1", "ipv6");
  // Local-use NAT64 (RFC 8215): not globally reachable, whatever it embeds.
  bl.addSubnet("64:ff9b:1::", 48, "ipv6");
  // Teredo (RFC 4380): a tunnel to a client behind NAT, never a public web host.
  bl.addSubnet("2001::", 32, "ipv6");
  bl.addSubnet("fc00::", 7, "ipv6");
  bl.addSubnet("fe80::", 10, "ipv6");
  bl.addSubnet("ff00::", 8, "ipv6");

  return bl;
}

const BLOCK_LIST = buildBlockList();

function unwrapMappedIPv4(addr: string): string | null {
  const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(addr);
  return m ? (m[1] ?? null) : null;
}

// The eight 16-bit groups of an IPv6 address, with `::` and a dotted tail expanded.
function ipv6Groups(addr: string): number[] | null {
  if (isIP(addr) !== 6) return null;
  let text = addr.split("%")[0] ?? addr;

  const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(2).map(Number) as [number, number, number, number];
    text = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head, tail] = text.split("::");
  const before = head ? head.split(":") : [];
  const after = tail ? tail.split(":") : [];
  const gap = tail === undefined ? 0 : 8 - before.length - after.length;
  const groups = [...before, ...Array<string>(gap).fill("0"), ...after].map((g) =>
    parseInt(g, 16),
  );
  return groups.length === 8 ? groups : null;
}

function dottedIPv4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

// NAT64 (64:ff9b::/96, RFC 6052) and 6to4 (2002::/16, RFC 3056) addresses carry
// the IPv4 address a gateway forwards to.
function unwrapEmbeddedIPv4(addr: string): string | null {
  const g = ipv6Groups(addr);
  if (!g) return null;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [
    number, number, number, number, number, number, number, number,
  ];
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return dottedIPv4(g6, g7);
  }
  if (g0 === 0x2002) return dottedIPv4(g1, g2);
  return null;
}

export function isBlockedAddress(address: string): boolean {
  // ::ffff:169.254.169.254 must be judged by the IPv4 rules, not slip past as IPv6.
  // The same goes for 64:ff9b::a9fe:a9fe and 2002:a9fe:a9fe::.
  const mapped = unwrapMappedIPv4(address) ?? unwrapEmbeddedIPv4(address);
  const candidate = mapped ?? address;

  // Fail closed: anything that is not a valid IP is blocked.
  const family = isIP(candidate);
  if (family === 0) return true;

  const kind = family === 4 ? "ipv4" : "ipv6";
  return BLOCK_LIST.check(candidate, kind);
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface FetchLikeResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; pinnedIp: string; hostname: string },
) => Promise<FetchLikeResponse>;

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  resolve?: HostResolver;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 4;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const defaultResolve: HostResolver = (hostname) =>
  new Promise((resolvePromise, reject) => {
    dnsLookup(hostname, { all: true }, (err, addresses) => {
      if (err) reject(err);
      else resolvePromise(addresses as ResolvedAddress[]);
    });
  });

const defaultFetch: FetchLike = async (url, { signal, pinnedIp, hostname }) => {
  const family = isIP(pinnedIp);
  const agent = new Agent({
    connect: {
      // Pin the connection to the validated IP so a DNS rebind cannot swap in a
      // private address after the check. The URL keeps the hostname, so TLS and
      // virtual hosts still work.
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

  // Every record must be public: one private A/AAAA record fails the whole host.
  for (const a of addresses) {
    if (isBlockedAddress(a.address)) {
      throw new UnsafeUrlError(`Private/reserved IP for ${url.hostname}: ${a.address}`);
    }
  }
  const pinnedIp = addresses[0]?.address ?? "";
  return { url, pinnedIp };
}

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
  // Redirects are followed by hand so every hop is re-validated: a redirect
  // target is fresh untrusted input.
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const { url, pinnedIp } = await assertSafeUrl(current, resolve);

    const res = await fetchImpl(url.toString(), {
      signal,
      pinnedIp,
      hostname: url.hostname,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new UnsafeUrlError(`Redirect without Location from ${url.toString()}`);
      }
      current = new URL(location, url).toString();
      continue;
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new UnsafeUrlError(`Non-HTML content-type: ${contentType || "(none)"}`);
    }
    const body = await readCappedBody(res, maxBytes);
    return { url: url.toString(), status: res.status, contentType, body };
  }
  throw new UnsafeUrlError(`Too many redirects (>${maxRedirects}) for ${raw}`);
}
