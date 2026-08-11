import { describe, it, expect } from "vitest";

import { isHttpUrl } from "@/lib/websearch/types";

describe("isHttpUrl", () => {
  it("accepts http and https absolute URLs", () => {
    expect(isHttpUrl("http://example.com/a")).toBe(true);
    expect(isHttpUrl("https://example.com")).toBe(true);
  });

  it("rejects other schemes", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,x")).toBe(false);
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
  });

  it("rejects non-strings, empties, and unparseable values", () => {
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
    expect(isHttpUrl(123)).toBe(false);
  });
});
