import { describe, it, expect } from "vitest";

import { isBlockedAddress } from "@/lib/websearch/read/safeFetch";

// M3a — SSRF address classifier. This is the security core: it decides whether a
// RESOLVED IP is safe to connect to. It must reject every private / loopback /
// link-local / reserved range across IPv4 and IPv6, including the cloud metadata
// endpoint 169.254.169.254 and its IPv4-mapped IPv6 form.

describe("isBlockedAddress", () => {
  it("blocks IPv4 loopback", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("127.9.9.9")).toBe(true);
  });

  it("blocks IPv4 private ranges (RFC1918)", () => {
    expect(isBlockedAddress("10.0.0.1")).toBe(true);
    expect(isBlockedAddress("172.16.5.4")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
  });

  it("blocks IPv4 link-local incl the cloud metadata endpoint", () => {
    expect(isBlockedAddress("169.254.0.1")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
  });

  it("blocks 0.0.0.0/8, CGNAT, and broadcast", () => {
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
    expect(isBlockedAddress("100.64.0.1")).toBe(true);
    expect(isBlockedAddress("255.255.255.255")).toBe(true);
  });

  it("blocks IPv6 loopback, unique-local, and link-local", () => {
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("fc00::1")).toBe(true);
    expect(isBlockedAddress("fd12:3456::1")).toBe(true);
    expect(isBlockedAddress("fe80::1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 form of the metadata endpoint", () => {
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:10.0.0.1")).toBe(true);
  });

  it("allows real public unicast addresses", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("1.1.1.1")).toBe(false);
    expect(isBlockedAddress("93.184.216.34")).toBe(false); // example.com
    expect(isBlockedAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });

  it("blocks an unparseable address rather than allowing it (fail-closed)", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });
});
