import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, one, closePool } from "@/lib/db/pool";
import { insertWorld } from "@/lib/db/mutations";
import { listResearchThreads } from "@/lib/db/research-queries";

// -----------------------------------------------------------------------------
// T-ARCH-2 — listResearchThreads world-scope (INTEGRATION, real Postgres).
//
// The research rail must list ONLY the active world's threads. Filtering lives
// in SQL (`WHERE world_id = $1`), not in JS after an unfiltered read, so a
// wiki/bag edit cannot silently bleed sibling-world threads into /research.
//
// Two throwaway worlds, each born with R2's one default thread. Listing world A
// must return A's thread and NEVER B's.
//
// MUTATION (run at ready): drop `WHERE world_id = $1` in listResearchThreads.
// The "no sibling-world bleed" assertion flips RED. Inverse replace; re-GREEN.
//
// SHARED-DB HYGIENE: ids are `test-tarch2-list-*`. Fixture hard-deleted in
// afterAll in FK order. Seeded worlds are never touched.
// -----------------------------------------------------------------------------

loadEnv();

const UNI_A = `test-tarch2-list-ua-${randomUUID()}`;
const WORLD_A = `test-tarch2-list-wa-${randomUUID()}`;
const BOOK_A = `test-tarch2-list-ba-${randomUUID()}`;
const UNI_B = `test-tarch2-list-ub-${randomUUID()}`;
const WORLD_B = `test-tarch2-list-wb-${randomUUID()}`;
const BOOK_B = `test-tarch2-list-bb-${randomUUID()}`;

async function threadIdOf(worldId: string): Promise<string> {
  const r = await one<{ id: string }>(
    `SELECT id FROM research_threads WHERE world_id = $1`,
    [worldId],
  );
  return r!.id;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await query(`INSERT INTO universes (id, name) VALUES ($1, 'TARCH2 List A')`, [UNI_A]);
  await query(`INSERT INTO universes (id, name) VALUES ($1, 'TARCH2 List B')`, [UNI_B]);
  await insertWorld({ id: WORLD_A, universeId: UNI_A, title: "List World A", bookId: BOOK_A });
  await insertWorld({ id: WORLD_B, universeId: UNI_B, title: "List World B", bookId: BOOK_B });
});

afterAll(async () => {
  await query(`DELETE FROM research_threads WHERE world_id IN ($1, $2)`, [WORLD_A, WORLD_B]);
  await query(`DELETE FROM books WHERE world_id IN ($1, $2)`, [WORLD_A, WORLD_B]);
  await query(`DELETE FROM worlds WHERE id IN ($1, $2)`, [WORLD_A, WORLD_B]);
  await query(`DELETE FROM universes WHERE id IN ($1, $2)`, [UNI_A, UNI_B]);
  await closePool();
});

describe("listResearchThreads world scope (T-ARCH-2)", () => {
  it("returns only the requested world's threads (no sibling-world bleed)", async () => {
    const threadA = await threadIdOf(WORLD_A);
    const threadB = await threadIdOf(WORLD_B);

    const listed = await listResearchThreads(WORLD_A);
    const ids = listed.map((t) => t.id);

    expect(listed.length).toBe(1);
    expect(ids).toContain(threadA);
    expect(ids).not.toContain(threadB);
    expect(listed.every((t) => t.worldId === WORLD_A)).toBe(true);
  });
});
