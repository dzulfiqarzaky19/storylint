// tests/novel/loadBookTieDedup.test.ts — proves loadBook() dedups ties on the
// (from,to) pair and keeps the LAST-seen `rel`, not just any/first.
//
// T-ARCH-8 root cause: the-perfect-run.extraction.json has 342 (from,to) tie
// pairs repeated across chapters as a relationship evolves (e.g.
// ryan-romano->len has 10 entries, "searching for his best friend" ->
// ... -> "delays the raid on her father until she's ready"), but the
// seeded tie id is `tie-${from}-${to}` (no chapter component) — a clean
// db:seed on an isolated DB hit "duplicate key value violates unique
// constraint ties_pkey" the live dev DB never surfaced (it's never fully
// reset). Ground-truthed directly against the extraction JSON (see PR
// summary): raw valid ties=1195, unique (from,to) pairs=853.
import { describe, expect, it } from "vitest";
import { loadBook } from "@/lib/novel/loadBook";

describe("loadBook tie dedup (T-ARCH-8)", () => {
  const book = loadBook("the-perfect-run");

  it("emits no duplicate (from,to) tie pairs", () => {
    const pairs = book.ties.map(([from, to]) => `${from}\u0000${to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("keeps the LAST-seen rel for a pair that evolves across chapters", () => {
    // Ground truth from the-perfect-run.extraction.json: ryan-romano has 10
    // tie entries to len; the first is "searching for his best friend", the
    // last is "delays the raid on her father until she's ready".
    const tie = book.ties.find(([from, to]) => from === "ryan-romano" && to === "len");
    expect(tie).toBeDefined();
    expect(tie?.[2]).toBe("delays the raid on her father until she's ready");
    expect(tie?.[2]).not.toBe("searching for his best friend");
  });

  it("collapses the known raw/unique tie counts (1195 valid raw -> 853 unique pairs)", () => {
    expect(book.ties.length).toBe(853);
  });
});
