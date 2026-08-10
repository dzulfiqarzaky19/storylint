import { describe, it, expect } from "vitest";
import {
  wipeOrder,
  RESEARCH_WIPE_ORDER,
  PROTECTED_TABLES,
  protectedCountsUnchanged,
  resetResearchWithin,
  ProtectedDataChangedError,
  backupPath,
  type ResetClient,
  type ProtectedCounts,
} from "@/lib/db/reset-research";

// ---------------------------------------------------------------------------
// A fake ResetClient with an in-memory table model. Each research table starts
// with `seed` rows; DELETE empties it. Protected tables (entries/chapters) hold
// a fixed count; an optional `driftProtected` flips a protected count the first
// time it is read AFTER the deletes, to simulate a concurrent change that the
// negative-proof guard must catch.
// ---------------------------------------------------------------------------
interface FakeOpts {
  research?: Partial<Record<string, number>>;
  entries?: number;
  chapters?: number;
  /** If set, this protected table's count changes after the deletes run. */
  driftProtectedAfter?: "entries" | "chapters";
}

function makeClient(opts: FakeOpts = {}) {
  const counts: Record<string, number> = {
    kept_cards: opts.research?.kept_cards ?? 3,
    propositions: opts.research?.propositions ?? 5,
    research_turns: opts.research?.research_turns ?? 4,
    research_threads: opts.research?.research_threads ?? 2,
    entries: opts.entries ?? 15,
    chapters: opts.chapters ?? 7,
  };
  const calls: string[] = [];
  let deletesDone = 0;

  const client: ResetClient = {
    async query(text: string) {
      calls.push(text);
      const del = /^DELETE FROM (\w+)/.exec(text);
      if (del) {
        counts[del[1]!] = 0;
        deletesDone++;
        return { rows: [] };
      }
      const count = /^SELECT count\(\*\)::int AS n FROM (\w+)/.exec(text);
      if (count) {
        const table = count[1]!;
        // Simulate protected drift only AFTER all deletes have happened.
        if (
          opts.driftProtectedAfter === table &&
          deletesDone >= RESEARCH_WIPE_ORDER.length
        ) {
          counts[table] = counts[table]! + 1;
        }
        return { rows: [{ n: counts[table] ?? 0 }] };
      }
      const selectAll = /^SELECT \* FROM (\w+)/.exec(text);
      if (selectAll) {
        const table = selectAll[1]!;
        const n = counts[table] ?? 0;
        return { rows: Array.from({ length: n }, (_, i) => ({ id: `${table}-${i}` })) };
      }
      return { rows: [] };
    },
  };
  return { client, calls, counts };
}

describe("wipeOrder — the FK-safe delete sequence is behavior-bearing data", () => {
  it("returns exactly [kept_cards, propositions, research_turns, research_threads]", () => {
    expect(wipeOrder()).toEqual([
      "kept_cards",
      "propositions",
      "research_turns",
      "research_threads",
    ]);
  });

  it("puts research_turns BEFORE research_threads (no-FK ordering rule)", () => {
    const order = wipeOrder();
    expect(order.indexOf("research_turns")).toBeLessThan(
      order.indexOf("research_threads"),
    );
  });

  it("covers all four research tables and nothing else", () => {
    expect(wipeOrder()).toHaveLength(4);
    expect(PROTECTED_TABLES).toEqual(["entries", "chapters"]);
  });
});

describe("protectedCountsUnchanged — the negative-proof guard", () => {
  const base: ProtectedCounts = { entries: 15, chapters: 7 };

  it("is true when every protected count matches", () => {
    expect(protectedCountsUnchanged(base, { entries: 15, chapters: 7 })).toBe(true);
  });

  it("is false when entries changed", () => {
    expect(protectedCountsUnchanged(base, { entries: 14, chapters: 7 })).toBe(false);
  });

  it("is false when chapters changed", () => {
    expect(protectedCountsUnchanged(base, { entries: 15, chapters: 8 })).toBe(false);
  });
});

describe("resetResearchWithin — transactional core (injected fake client)", () => {
  it("deletes every research table in wipeOrder and reports 0 after", async () => {
    const { client, calls } = makeClient();
    const res = await resetResearchWithin(client);

    // Deletes happened in the exact FK-safe order.
    const deletes = calls
      .map((c) => /^DELETE FROM (\w+)/.exec(c)?.[1])
      .filter(Boolean);
    expect(deletes).toEqual([
      "kept_cards",
      "propositions",
      "research_turns",
      "research_threads",
    ]);

    // Every research table is empty afterwards.
    for (const table of wipeOrder()) {
      expect(res.researchAfter[table]).toBe(0);
    }
    // Before counts were captured non-zero (proves before != after).
    expect(res.researchBefore.research_threads).toBe(2);
  });

  it("backs up all research rows BEFORE deleting (reversible)", async () => {
    const { client } = makeClient();
    const res = await resetResearchWithin(client);
    expect(res.backup.kept_cards).toHaveLength(3);
    expect(res.backup.propositions).toHaveLength(5);
    expect(res.backup.research_turns).toHaveLength(4);
    expect(res.backup.research_threads).toHaveLength(2);
  });

  it("leaves protected counts unchanged on the happy path", async () => {
    const { client } = makeClient();
    const res = await resetResearchWithin(client);
    expect(res.protectedBefore).toEqual({ entries: 15, chapters: 7 });
    expect(res.protectedAfter).toEqual({ entries: 15, chapters: 7 });
  });

  it("THROWS ProtectedDataChangedError when entries count drifts (=> ROLLBACK)", async () => {
    const { client } = makeClient({ driftProtectedAfter: "entries" });
    await expect(resetResearchWithin(client)).rejects.toBeInstanceOf(
      ProtectedDataChangedError,
    );
  });

  it("THROWS when chapters count drifts (protected data touched => abort)", async () => {
    const { client } = makeClient({ driftProtectedAfter: "chapters" });
    await expect(resetResearchWithin(client)).rejects.toBeInstanceOf(
      ProtectedDataChangedError,
    );
  });
});

describe("backupPath", () => {
  it("builds a timestamped path under backups/", () => {
    const p = backupPath("2026-08-10T06-15-00-000Z");
    expect(p).toContain("backups");
    expect(p).toContain("research-backup-2026-08-10T06-15-00-000Z.json");
  });
});
