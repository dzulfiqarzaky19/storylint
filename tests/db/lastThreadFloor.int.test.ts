import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, one, closePool } from "@/lib/db/pool";
import { insertWorld, insertResearchThread } from "@/lib/db/mutations";
import { deleteThread } from "@/lib/actions/research";

// -----------------------------------------------------------------------------
// R3 server-side last-thread floor (INTEGRATION, real Postgres).
//
// A live world's /research rail must never drop to ZERO threads. The UI's
// removeThread re-opens a fresh thread on the client, but a RAW deleteThread
// action call (no UI) previously had no guard and could empty a world. The
// deleteLastThreadGuarded mutation closes that hole server-side.
//
// This stands up a THROWAWAY world (via insertWorld, which R2-seeds it with ONE
// default thread) and proves:
//   A. deleting the world's ONLY thread is REFUSED ({ok:false}) and the thread
//      SURVIVES (count stays 1).
//   B. with a SECOND thread present, deleting one SUCCEEDS and the count drops to 1.
//   C. deleting the now-last thread is REFUSED again (the floor re-arms).
//
// MUTATION (run manually at ready):
//   - Weaken the guard `<= 1` -> `< 1` (or `<= 0`) in deleteLastThreadGuarded:
//     assertion A flips (the last thread gets deleted, count -> 0) -> RED.
//
// SHARED-DB HYGIENE: all ids are `test-r3floor-*`; the whole fixture is
// hard-deleted in afterAll in FK order. Seeded worlds are never touched.
// -----------------------------------------------------------------------------

loadEnv();

const UNI = `test-r3floor-u-${randomUUID()}`;
const WORLD = `test-r3floor-w-${randomUUID()}`;
const BOOK = `test-r3floor-b-${randomUUID()}`;

async function threadCount(): Promise<number> {
  const r = await one<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM research_threads WHERE world_id = $1`,
    [WORLD],
  );
  return Number(r!.n);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await query(`INSERT INTO universes (id, name) VALUES ($1, 'R3 Floor Universe')`, [UNI]);
  // insertWorld R2-seeds the world with exactly one default thread.
  await insertWorld({ id: WORLD, universeId: UNI, title: "Floor World", bookId: BOOK });
});

afterAll(async () => {
  await query(`DELETE FROM research_threads WHERE world_id = $1`, [WORLD]);
  await query(`DELETE FROM books WHERE world_id = $1`, [WORLD]);
  await query(`DELETE FROM worlds WHERE id = $1`, [WORLD]);
  await query(`DELETE FROM universes WHERE id = $1`, [UNI]);
  await closePool();
});

describe("R3 last-thread floor (real Postgres)", () => {
  it("A: refuses to delete a world's ONLY thread; the thread survives", async () => {
    expect(await threadCount()).toBe(1); // R2 seed

    const only = await one<{ id: string }>(
      `SELECT id FROM research_threads WHERE world_id = $1`,
      [WORLD],
    );
    const res = await deleteThread({ threadId: only!.id });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/last thread/i);
    expect(await threadCount()).toBe(1); // floor held — still exactly one
  });

  it("B: with a second thread, deleting one succeeds and count drops to 1", async () => {
    const second = `test-r3floor-t2-${randomUUID()}`;
    await insertResearchThread({
      id: second,
      title: "Second thread",
      subtitle: "",
      sortOrder: 1,
      scope: "chat",
      worldId: WORLD,
    });
    expect(await threadCount()).toBe(2);

    const res = await deleteThread({ threadId: second });
    expect(res.ok).toBe(true);
    expect(await threadCount()).toBe(1);
  });

  it("C: the floor re-arms — deleting the now-last thread is refused again", async () => {
    const last = await one<{ id: string }>(
      `SELECT id FROM research_threads WHERE world_id = $1`,
      [WORLD],
    );
    const res = await deleteThread({ threadId: last!.id });

    expect(res.ok).toBe(false);
    expect(await threadCount()).toBe(1);
  });
});
