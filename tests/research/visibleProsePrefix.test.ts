import { describe, it, expect } from "vitest";
import { visibleProsePrefix, CARDS_SENTINEL } from "@/lib/research/streamParse";

// -----------------------------------------------------------------------------
// F2b — mid-stream forwarding guard. The route forwards prose token-by-token
// but must NEVER show the writer the sentinel or the trailing cards JSON. This
// helper returns the safe-to-show prefix of the running buffer; the route diffs
// it against what it already forwarded. Complements splitStreamedAnswer, which
// is the COMPLETION-time reconciliation.
// -----------------------------------------------------------------------------

describe("visibleProsePrefix", () => {
  it("returns the whole buffer when no sentinel (partial or full) is present", () => {
    expect(visibleProsePrefix("The sky is blue and clear")).toBe("The sky is blue and clear");
  });

  it("cuts at the FULL sentinel so the cards JSON is never visible", () => {
    const buffer = "Prose reply." + CARDS_SENTINEL + '[{"title":"X"}]';
    expect(visibleProsePrefix(buffer)).toBe("Prose reply.");
  });

  it("holds back a trailing PARTIAL sentinel so no delimiter fragment leaks", () => {
    // A real partial is a genuine PREFIX of the sentinel, which begins with the
    // invisible U+2063 separator then "---CARDS---". A buffer cut mid-sentinel
    // must not surface that fragment to the writer.
    const partial = CARDS_SENTINEL.slice(0, 6); // "\n\u2063---C"
    const buffer = "Prose reply." + partial;
    const out = visibleProsePrefix(buffer);
    expect(out).toBe("Prose reply.");
    expect(out).not.toContain("---C");
  });

  it("is monotonic: the visible prefix never shrinks as more text arrives", () => {
    const a = visibleProsePrefix("Hello wor");
    const b = visibleProsePrefix("Hello world");
    expect(b.startsWith(a)).toBe(true);
    expect(b.length).toBeGreaterThanOrEqual(a.length);
  });

  it("does NOT trim interior/leading whitespace already shown", () => {
    // A growing buffer must not retroactively drop whitespace the writer saw.
    expect(visibleProsePrefix("  leading and  interior  ")).toBe("  leading and  interior  ");
  });
});
