import { describe, expect, it } from "vitest";
import { assemble } from "@/lib/db/plot";

const ch = (number: number) => ({ id: `ch${number}`, number, title: `Chapter ${number}` });
const lane = (id: string, ownerName: string | null = null) => ({
  id,
  name: id,
  label: "arc",
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
    expect(p).toEqual({ chapters: [], lanes: [], latestChapter: 0 });
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
