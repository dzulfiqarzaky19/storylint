import { describe, expect, it } from "vitest";
import { assemble } from "@/lib/db/plot";

const ch = (number: number) => ({ id: `ch${number}`, number, title: `Chapter ${number}` });
const lane = (
  id: string,
  ownerName: string | null = null,
  stateTag = "open",
) => ({
  id,
  name: id,
  label: "arc",
  stateTag,
  ownerName,
});
const beat = (plotlineId: string, chapterNumber: number) => ({
  plotlineId,
  chapterNumber,
  summary: `beat ${plotlineId} ch${chapterNumber}`,
});

describe("assemble — empty data never throws", () => {
  it("returns an empty payload for no data", () => {
    const p = assemble([], [], []);
    expect(p).toEqual({
      chapters: [],
      lanes: [],
      latestChapter: 0,
      completion: { resolved: 0, owed: 0, percent: 0 },
    });
  });

  it("keeps lanes with zero beats as not-yet-begun (null lastAdvanced, 0 neglect)", () => {
    const p = assemble([ch(1), ch(2)], [lane("a")], []);
    expect(p.lanes).toHaveLength(1);
    expect(p.lanes[0]!.beats).toEqual([]);
    expect(p.lanes[0]!.lastAdvanced).toBeNull();
    expect(p.lanes[0]!.neglect).toBe(0);
  });

  it("handles lanes present but no chapters (latestChapter 0)", () => {
    const p = assemble([], [lane("a")], [beat("a", 3)]);
    expect(p.latestChapter).toBe(0);
    expect(p.lanes[0]!.neglect).toBeLessThanOrEqual(0);
  });
});

describe("assemble — neglect math", () => {
  it("neglect = latestChapter - lastAdvanced", () => {
    const p = assemble([ch(1), ch(2), ch(3), ch(7)], [lane("a")], [beat("a", 1), beat("a", 4)]);
    expect(p.latestChapter).toBe(7);
    expect(p.lanes[0]!.lastAdvanced).toBe(4);
    expect(p.lanes[0]!.neglect).toBe(3);
  });

  it("a lane advanced in the latest chapter has neglect 0", () => {
    const p = assemble([ch(1), ch(5)], [lane("a")], [beat("a", 5)]);
    expect(p.lanes[0]!.neglect).toBe(0);
  });
});

describe("assemble — multi-owner dedup", () => {
  it("folds N owner rows of one plotline into a single lane", () => {
    const p = assemble(
      [ch(1)],
      [lane("a", null), lane("a", "Maren"), lane("a", "Halvard")],
      [beat("a", 1)],
    );
    expect(p.lanes).toHaveLength(1);
    expect(p.lanes[0]!.ownerName).toBe("Maren");
    expect(p.lanes[0]!.beats).toHaveLength(1);
  });
});

describe("assemble — arc state, resolution, completion", () => {
  it("an open arc quiet for LONG_GAP+ chapters becomes stalled but keeps its neglect", () => {
    const p = assemble([ch(1), ch(6)], [lane("a")], [beat("a", 1)]);
    expect(p.lanes[0]!.state).toBe("stalled");
    expect(p.lanes[0]!.neglect).toBe(5);
  });

  it("a resolved arc reports 0 neglect (its tail is intentional, not dropped)", () => {
    const p = assemble([ch(1), ch(9)], [lane("a", null, "resolved:4")], [beat("a", 4)]);
    expect(p.lanes[0]!.state).toBe("resolved");
    expect(p.lanes[0]!.resolvedAt).toBe(4);
    expect(p.lanes[0]!.neglect).toBe(0);
  });

  it("completion counts resolved arcs over non-abandoned arcs", () => {
    const p = assemble(
      [ch(1), ch(2)],
      [
        lane("a", null, "resolved:2"),
        lane("b", null, "resolved:1"),
        lane("c", null, "abandoned:1"),
      ],
      [beat("a", 2), beat("b", 1), beat("c", 1)],
    );
    // owed excludes the abandoned arc (2 owed, not 3): 2 resolved / 2 owed = 100%.
    // A denominator of "not resolved" would give 2/1 = 200%, so this pins the rule.
    expect(p.completion).toEqual({ resolved: 2, owed: 2, percent: 100 });
  });

  it("parses a canon-break warn prefix and a resolve marker off the beat text", () => {
    const p = assemble(
      [ch(1)],
      [lane("a", null, "resolved:1")],
      [{ plotlineId: "a", chapterNumber: 1, summary: "she swears the oath  \u26a0 timeline clash \u2691resolves" }],
    );
    const b = p.lanes[0]!.beats[0]!;
    expect(b.summary).toBe("she swears the oath");
    expect(b.warn).toBe("timeline clash");
    expect(b.resolves).toBe(true);
  });
});
