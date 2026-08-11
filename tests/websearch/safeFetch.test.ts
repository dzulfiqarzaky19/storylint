import { describe, it, expect } from "vitest";

import {
  safeFetch,
  assertSafeUrl,
  UnsafeUrlError,
  type HostResolver,
  type FetchLike,
  type FetchLikeResponse,
} from "@/lib/websearch/read/safeFetch";

// M3b — safeFetch orchestration. All network + DNS is injected so these are
// small, deterministic tests of the SSRF control flow: scheme allowlist,
// resolve-all rejection, PER-HOP redirect re-validation, content-type gate, and
// the byte cap. The real undici Agent IP-pin is exercised in the live E2E (M10).

/** A resolver that maps specific hostnames to canned addresses. */
function resolverFor(map: Record<string, string[]>): HostResolver {
  return async (hostname) => {
    const addrs = map[hostname];
    if (!addrs) throw new Error(`no record for ${hostname}`);
    return addrs.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };
}

/** Build a fetch seam response from html/status/headers, streaming the body. */
function htmlResponse(
  body: string,
  { status = 200, contentType = "text/html; charset=utf-8", location }: {
    status?: number;
    contentType?: string;
    location?: string;
  } = {},
): FetchLikeResponse {
  const headers = new Map<string, string>();
  if (contentType) headers.set("content-type", contentType);
  if (location) headers.set("location", location);
  const bytes = new TextEncoder().encode(body);
  return {
    status,
    headers: { get: (n) => headers.get(n.toLowerCase()) ?? null },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    text: async () => body,
  };
}

const PUBLIC = ["93.184.216.34"];

describe("assertSafeUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(
      assertSafeUrl("file:///etc/passwd", resolverFor({})),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(
      assertSafeUrl("ftp://example.com", resolverFor({})),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects a host whose DNS resolves to a private IP", async () => {
    await expect(
      assertSafeUrl("https://evil.test/", resolverFor({ "evil.test": ["10.0.0.5"] })),
    ).rejects.toThrow(/Private\/reserved IP/);
  });

  it("rejects when ANY of several resolved records is private (DNS pinning is all-or-nothing)", async () => {
    await expect(
      assertSafeUrl(
        "https://mixed.test/",
        resolverFor({ "mixed.test": ["93.184.216.34", "169.254.169.254"] }),
      ),
    ).rejects.toThrow(/Private\/reserved IP/);
  });

  it("rejects a bare private IP literal in the URL without any DNS", async () => {
    await expect(
      assertSafeUrl("http://169.254.169.254/latest/meta-data", resolverFor({})),
    ).rejects.toThrow(/Private\/reserved IP/);
  });

  it("accepts a public host and pins its first address", async () => {
    const { url, pinnedIp } = await assertSafeUrl(
      "https://example.com/x",
      resolverFor({ "example.com": PUBLIC }),
    );
    expect(url.hostname).toBe("example.com");
    expect(pinnedIp).toBe("93.184.216.34");
  });
});

describe("safeFetch", () => {
  const resolve = resolverFor({
    "example.com": PUBLIC,
    "cdn.example.com": ["93.184.216.35"],
    "internal.test": ["10.1.2.3"],
  });

  it("returns the full body for a public html page (no truncation)", async () => {
    const html = "<html><body>" + "x".repeat(10000) + "<p>END-SENTINEL</p></body></html>";
    const fetchImpl: FetchLike = async () => htmlResponse(html);
    const res = await safeFetch("https://example.com/page", { resolve, fetchImpl });
    expect(res.status).toBe(200);
    expect(res.body).toContain("END-SENTINEL");
    expect(res.body.length).toBe(html.length);
  });

  it("follows a redirect and re-validates the new hop (allowed -> allowed)", async () => {
    let hop = 0;
    const fetchImpl: FetchLike = async (url) => {
      hop++;
      if (url.includes("//example.com")) {
        return htmlResponse("", { status: 302, location: "https://cdn.example.com/final" });
      }
      return htmlResponse("<html>final</html>");
    };
    const res = await safeFetch("https://example.com/start", { resolve, fetchImpl });
    expect(hop).toBe(2);
    expect(res.url).toContain("cdn.example.com");
    expect(res.body).toContain("final");
  });

  it("BLOCKS a redirect whose target resolves to a private IP (per-hop re-validation)", async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("example.com")) {
        return htmlResponse("", { status: 302, location: "https://internal.test/secret" });
      }
      return htmlResponse("<html>should never reach</html>");
    };
    await expect(
      safeFetch("https://example.com/start", { resolve, fetchImpl }),
    ).rejects.toThrow(/Private\/reserved IP/);
  });

  it("rejects a non-HTML content-type", async () => {
    const fetchImpl: FetchLike = async () =>
      htmlResponse("{}", { contentType: "application/json" });
    await expect(
      safeFetch("https://example.com/data.json", { resolve, fetchImpl }),
    ).rejects.toThrow(/Non-HTML content-type/);
  });

  it("caps the body at maxBytes (OOM safety)", async () => {
    const big = "<html>" + "a".repeat(1000) + "</html>";
    const fetchImpl: FetchLike = async () => htmlResponse(big);
    const res = await safeFetch("https://example.com/big", {
      resolve,
      fetchImpl,
      maxBytes: 100,
    });
    expect(res.body.length).toBe(100);
  });

  it("gives up after too many redirects", async () => {
    const fetchImpl: FetchLike = async () =>
      htmlResponse("", { status: 302, location: "https://example.com/loop" });
    await expect(
      safeFetch("https://example.com/loop", { resolve, fetchImpl, maxRedirects: 2 }),
    ).rejects.toThrow(/Too many redirects/);
  });
});
