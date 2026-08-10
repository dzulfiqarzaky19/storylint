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
  /** If set, the DELETE on this table throws, simulating a mid-wipe failure. */
  failOnDeleteOf?: string;
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
        // Simulate a DB-side DELETE failure (e.g. FK violation, lost conn)
        // BEFORE mutating state, so the wipe throws mid-flight.
        if (opts.failOnDeleteOf === del[1]!) {
          throw new Error(`simulated DELETE failure on ${del[1]!}`);
        }
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

  it("fires onBackup BEFORE any DELETE runs (dump persists on disk pre-wipe)", async () => {
    const { client, calls } = makeClient();
    let deletesAtBackup = -1;
    await resetResearchWithin(client, (backup) => {
      // Record how many DELETEs had run at the moment the backup is handed over.
      deletesAtBackup = calls.filter((c) => /^DELETE FROM/.test(c)).length;
      // The backup handed to the sink must already be fully populated.
      expect(backup.research_threads).toHaveLength(2);
    });
    // Backup callback ran with ZERO deletes done -> it precedes all destruction.
    expect(deletesAtBackup).toBe(0);
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

  it("PROPAGATES a mid-wipe DELETE failure (so withTransaction ROLLS BACK)", async () => {
    // A DELETE fails partway through the FK-safe sequence. The core must let the
    // error propagate unchanged so the caller's withTransaction issues ROLLBACK
    // and the DB is restored -- it must NOT swallow it and appear to succeed.
    const { client } = makeClient({ failOnDeleteOf: "research_turns" });
    await expect(resetResearchWithin(client)).rejects.toThrow(
      /simulated DELETE failure on research_turns/,
    );
  });

  it("has ALREADY persisted the backup before a mid-wipe DELETE failure", async () => {
    // Recovery guarantee: even when a later DELETE blows up, onBackup has already
    // fired with the full dump, so a recovery file exists on disk pre-failure.
    const { client } = makeClient({ failOnDeleteOf: "kept_cards" });
    let captured: number | null = null;
    await expect(
      resetResearchWithin(client, (backup) => {
        // Full row set captured before the very first DELETE even runs.
        captured =
          backup.kept_cards.length +
          backup.propositions.length +
          backup.research_turns.length +
          backup.research_threads.length;
      }),
    ).rejects.toThrow(/simulated DELETE failure on kept_cards/);
    // Backup was handed over with the full 14-row dump (3+5+4+2) BEFORE the throw.
    expect(captured).toBe(3 + 5 + 4 + 2);
  });
});

describe("backupPath", () => {
  it("builds a timestamped path under backups/", () => {
    const p = backupPath("2026-08-10T06-15-00-000Z");
    expect(p).toContain("backups");
    expect(p).toContain("research-backup-2026-08-10T06-15-00-000Z.json");
  });
});
