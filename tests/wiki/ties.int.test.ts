import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, rows, closePool } from "@/lib/db/pool";
import {
  insertEntry,
  insertTie,
  deleteTie,
  createEntryWithTie,
} from "@/lib/db/mutations";
import { confirmWikiWrite } from "@/lib/actions/confirmation";

// -----------------------------------------------------------------------------
// F6-S4a — ties add/untie backend (INTEGRATION, real Postgres). Two locks:
//
//  1. deleteTie(id) HARD-deletes exactly the addressed edge. Mutate the WHERE
//     clause to a no-op (`WHERE id = $1` -> `WHERE 1 = 0`) and the tie survives
//     the "delete" -> the row-count assertion goes RED. Untie is intentional
//     removal, so NO tombstone: the row is gone, not soft-deleted.
//
//  2. createEntryWithTie inserts the new person AND its tie in ONE transaction
//     (both-or-neither). Force the tie insert to fail (a tie to a NON-EXISTENT
//     target violates the ties.to_entry_id FK) and the WHOLE txn must roll back:
//     the person row must NOT be left behind -> the "person absent" assertion
//     goes RED if the two writes are not transactional.
//
// SHARED-DB HYGIENE: throwaway ids (`test-f6s4-<uuid>`); every entry/tie is
// hard-deleted in afterEach (ties CASCADE off entries, but we delete explicitly
// so a rolled-back-person test leaves nothing either way).
// -----------------------------------------------------------------------------

loadEnv();

const CONFIRM = confirmWikiWrite({ confirmed: true });
const entries: string[] = [];
const ties: string[] = [];

async function freshEntry(name: string): Promise<string> {
  const id = `test-f6s4-e-${randomUUID()}`;
  await insertEntry(
    { id, kind: "character", name, catalogueNo: "TEST", note: "", summary: "", shelf: "cast", sortOrder: 999 },
    CONFIRM,
  );
  entries.push(id);
  return id;
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterEach(async () => {
  while (ties.length > 0) await query(`DELETE FROM ties WHERE id = $1`, [ties.pop()!]);
  while (entries.length > 0) await query(`DELETE FROM entries WHERE id = $1`, [entries.pop()!]);
});

afterAll(async () => {
  await closePool();
});

describe("deleteTie (F6-S4a, real Postgres)", () => {
  it("hard-deletes the addressed tie so it is gone from the table", async () => {
    const a = await freshEntry("Aldric");
    const b = await freshEntry("Brenna");
    const tieId = `test-f6s4-t-${randomUUID()}`;
    await insertTie({ id: tieId, fromEntryId: a, toEntryId: b, rel: "sister" }, CONFIRM);

    const before = await rows<{ n: string }>(`SELECT count(*) AS n FROM ties WHERE id = $1`, [tieId]);
    expect(Number(before[0]!.n)).toBe(1); // precondition: tie exists

    await deleteTie(tieId, CONFIRM);

    const after = await rows<{ n: string }>(`SELECT count(*) AS n FROM ties WHERE id = $1`, [tieId]);
    expect(Number(after[0]!.n)).toBe(0); // lock: no-op WHERE mutant leaves the row -> RED
  });

  it("leaves OTHER ties untouched (deletes only the addressed id)", async () => {
    const a = await freshEntry("Cael");
    const b = await freshEntry("Dara");
    const keepId = `test-f6s4-t-${randomUUID()}`;
    const dropId = `test-f6s4-t-${randomUUID()}`;
    await insertTie({ id: keepId, fromEntryId: a, toEntryId: b, rel: "father" }, CONFIRM);
    ties.push(keepId);
    await insertTie({ id: dropId, fromEntryId: b, toEntryId: a, rel: "daughter" }, CONFIRM);

    await deleteTie(dropId, CONFIRM);

    const keep = await rows<{ n: string }>(`SELECT count(*) AS n FROM ties WHERE id = $1`, [keepId]);
    const drop = await rows<{ n: string }>(`SELECT count(*) AS n FROM ties WHERE id = $1`, [dropId]);
    expect(Number(keep[0]!.n)).toBe(1); // untouched
    expect(Number(drop[0]!.n)).toBe(0); // gone
  });
});

describe("createEntryWithTie (F6-S4a, real Postgres)", () => {
  it("inserts the new person AND the tie atomically (both present)", async () => {
    const anchor = await freshEntry("Eirian");
    const personId = `test-f6s4-e-${randomUUID()}`;
    const tieId = `test-f6s4-t-${randomUUID()}`;
    entries.push(personId);
    ties.push(tieId);

    await createEntryWithTie(
      {
        entry: { id: personId, kind: "character", name: "Uncle Fen", catalogueNo: "TEST", note: "", summary: "", shelf: "cast", sortOrder: 999 },
        tie: { id: tieId, fromEntryId: anchor, toEntryId: personId, rel: "uncle" },
      },
      CONFIRM,
    );

    const person = await rows<{ name: string }>(`SELECT name FROM entries WHERE id = $1`, [personId]);
    const tie = await rows<{ rel: string }>(`SELECT rel FROM ties WHERE id = $1`, [tieId]);
    expect(person).toHaveLength(1);
    expect(person[0]!.name).toBe("Uncle Fen"); // person created
    expect(tie).toHaveLength(1);
    expect(tie[0]!.rel).toBe("uncle"); // tie carries the relationship label
  });

  it("rolls the WHOLE txn back when the tie fails: the person is NOT left behind", async () => {
    const personId = `test-f6s4-e-${randomUUID()}`;
    const tieId = `test-f6s4-t-${randomUUID()}`;
    entries.push(personId); // afterEach cleanup even if the row unexpectedly persists
    ties.push(tieId);

    // A tie whose toEntryId does NOT exist violates ties.to_entry_id's FK, so the
    // second write throws. If the two writes share one txn, the person insert is
    // rolled back with it; if they do NOT, the person row is orphaned -> assertion RED.
    await expect(
      createEntryWithTie(
        {
          entry: { id: personId, kind: "character", name: "Ghost", catalogueNo: "TEST", note: "", summary: "", shelf: "cast", sortOrder: 999 },
          tie: { id: tieId, fromEntryId: personId, toEntryId: `test-f6s4-MISSING-${randomUUID()}`, rel: "uncle" },
        },
        CONFIRM,
      ),
    ).rejects.toThrow();

    const person = await rows<{ n: string }>(`SELECT count(*) AS n FROM entries WHERE id = $1`, [personId]);
    expect(Number(person[0]!.n)).toBe(0); // lock: non-atomic writes leave the person -> RED
  });
});
