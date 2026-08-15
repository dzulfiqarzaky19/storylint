import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { getWorldTree } from "@/lib/db/queries";
import { resolveWikiScope } from "@/app/wiki/scope";
import { confirmCard } from "@/lib/actions/research";
import { DEFAULT_UNIVERSE_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// TCK-E06 (RESEARCH slice) — a research-CONFIRMED new entry must be LINKED into
// the active world, not left a persisted-but-invisible orphan (INTEGRATION, real
// Postgres). Sibling of the wiki slice (createEntry -> insertEntryLinkedToWorld).
//
// BUG: confirmCard's MINT branch wrote ONLY the `entries` row (in_wiki=true) and
// inserted NO `world_entities` link, so /wiki (loadWorldSnapshot JOINs membership
// on the active world) never showed it. The ENRICH branch was fine (its fact
// rides an already-linked entry).
//
// FIX: confirmCard now (a) takes a required `worldId`, (b) in the MINT branch
// FAILS CLOSED on a blank worldId and (c) mints the entry + world link in ONE
// transaction (insertEntryLinkedToWorld), so a bad worldId rolls the entry back
// with it (never an orphan). The active world is resolved on the server via
// resolveWikiScope(getWorldTree(), undefined, undefined) — the research URL has
// no ?u=/?w=, so the default world is used.
//
// LOCKS:
//   1. MINT links: a new entry gets EXACTLY ONE world_entities row for the active
//      world (entryCount 1 AND worldLinkCount 1 for that world).
//   2. ENRICH does not link: folding a fact into an existing entry mints NO new
//      entry and NO new world_entities row.
//   3. FAIL CLOSED: mint with a blank worldId -> ok:false, NO entry, NO link.
//   4. DEFAULT-WORLD PIN (case-a invariant guard): resolveWikiScope default ==
//      'world-universe-1', AND every research_threads row is universe-1 (i.e.
//      world-${universe_id} === the resolved default). This REDs the instant a
//      non-default-universe thread ships — exactly when the URL-default becomes
//      wrong and worldId must be derived from the thread's own universe instead.
//
// MUTATIONS (high-risk gate, reproduced independently by zebra):
//   - remove the world-link INSERT in insertEntryLinkedToWorld -> lock 1 RED
//     (worldLinkCount 1 -> 0), and the entry is now an orphan.
//   - defeat the fail-closed guard (mint with blank worldId writes anyway) ->
//     lock 3 RED (entryCount 0 -> 1).
//   - mutate resolveWikiScope's default world -> lock 4 RED.
//
// SHARED-DB HYGIENE: throwaway ids `test-e06r-*`; the derived mint entry
// (`prop-<propId>`), its world_entities links, kept_cards, and the
// thread->turn->proposition chain are all hard-deleted in afterEach. The seed
// universe-1 / world-universe-1 / the 15 baseline entries are NEVER touched.
// -----------------------------------------------------------------------------

loadEnv();

const DEFAULT_WORLD = "world-universe-1"; // the seed world resolveWikiScope defaults to

// Everything we create, cleaned in afterEach (FK-safe order).
const mintedEntryIds: string[] = []; // `prop-<propId>` rows confirmCard mints
const threadIds: string[] = []; // CASCADE removes turn + proposition
const propIds: string[] = []; // to purge kept_cards keyed by proposition

/** Build the thread -> turn -> proposition FK chain confirmCard's getProposition needs. */
async function freshProposition(
  title: string,
  body: string,
  universeId: string = DEFAULT_UNIVERSE_ID,
): Promise<string> {
  const tag = randomUUID();
  const threadId = `test-e06r-th-${tag}`;
  const turnId = `test-e06r-tn-${tag}`;
  const propId = `test-e06r-p-${tag}`;
  // world_id is NOT NULL (T-RESEARCH-2); a thread in universe-N backfills to that
  // universe's default world `world-${universeId}` (== world-universe-1 here).
  await query(`INSERT INTO research_threads (id, title, universe_id, world_id) VALUES ($1, $2, $3, $4)`, [threadId, "T", universeId, `world-${universeId}`]);
  await query(
    `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text) VALUES ($1, $2, 0, 'them', 'AI', '')`,
    [turnId, threadId],
  );
  await query(
    `INSERT INTO propositions (id, turn_id, kind, title, body, as_kind, sort_order)
     VALUES ($1, $2, 'world', $3, $4, 'world', 0)`,
    [propId, turnId, title, body],
  );
  threadIds.push(threadId);
  propIds.push(propId);
  // confirmCard mints the entry as `prop-<propId>`; track it for cleanup.
  mintedEntryIds.push(`prop-${propId}`);
  return propId;
}

async function worldLinkCount(entryId: string, worldId: string): Promise<number> {
  const r = await query<{ n: number }>(
    `SELECT COUNT(*)::int n FROM world_entities WHERE entity_id = $1 AND world_id = $2`,
    [entryId, worldId],
  );
  return r.rows[0]!.n;
}

async function entryCount(entryId: string): Promise<number> {
  const r = await query<{ n: number }>(`SELECT COUNT(*)::int n FROM entries WHERE id = $1`, [entryId]);
  return r.rows[0]!.n;
}

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterEach(async () => {
  // world_entities first (references entries + worlds), then entries, then the
  // kept_cards board, then the thread chain (CASCADE turn + proposition).
  while (mintedEntryIds.length > 0) {
    const id = mintedEntryIds.pop()!;
    await query(`DELETE FROM world_entities WHERE entity_id = $1`, [id]);
    await query(`DELETE FROM entries WHERE id = $1`, [id]);
  }
  while (propIds.length > 0) await query(`DELETE FROM kept_cards WHERE proposition_id = $1`, [propIds.pop()!]);
  while (threadIds.length > 0) await query(`DELETE FROM research_threads WHERE id = $1`, [threadIds.pop()!]);
});

afterAll(async () => {
  await closePool();
});

describe("TCK-E06 confirmCard MINT world-link (real Postgres)", () => {
  it("1. mints a new entry AND exactly one world_entities link for the active world", async () => {
    const propId = await freshProposition("Ashen Gate", "A basalt arch at the world's edge.");
    const res = await confirmCard({
      propositionId: propId,
      entry: { name: "Ashen Gate", kind: "world", summary: "A basalt arch at the world's edge." },
      worldId: DEFAULT_WORLD,
      confirmed: true,
    });

    expect(res.ok).toBe(true);
    const entryId = `prop-${propId}`;
    if (res.ok) expect(res.data.entryId).toBe(entryId);
    // The entry persisted AND is linked into the active world (visible on /wiki).
    expect(await entryCount(entryId)).toBe(1);
    expect(await worldLinkCount(entryId, DEFAULT_WORLD)).toBe(1); // NOT an orphan
  });

  it("3. FAILS CLOSED on a blank worldId — writes NO entry and NO link", async () => {
    const propId = await freshProposition("Orphan Keep", "Should never persist.");
    const res = await confirmCard({
      propositionId: propId,
      entry: { name: "Orphan Keep", kind: "world", summary: "Should never persist." },
      worldId: "   ", // blank/whitespace -> the guard must reject
      confirmed: true,
    });

    expect(res.ok).toBe(false); // refused
    const entryId = `prop-${propId}`;
    expect(await entryCount(entryId)).toBe(0); // no half-written entry
    expect(await worldLinkCount(entryId, DEFAULT_WORLD)).toBe(0); // no link
  });
});

describe("TCK-E06 confirmCard ENRICH does not world-link (real Postgres)", () => {
  it("2. enriching an existing entry adds NO new entry and NO new world_entities row", async () => {
    // A live target entry, already the sole member of the default world.
    const targetId = `test-e06r-tgt-${randomUUID()}`;
    mintedEntryIds.push(targetId); // reuse cleanup (deletes its link + row)
    await query(
      `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
       VALUES ($1, 'world', 'The Spire', 'TEST', '', '', 'places', 999, $2)`,
      [targetId, DEFAULT_UNIVERSE_ID],
    );
    await query(`INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)`, [DEFAULT_WORLD, targetId]);

    const linksBefore = await query<{ n: number }>(`SELECT COUNT(*)::int n FROM world_entities WHERE entity_id = $1`, [targetId]);
    const propId = await freshProposition("The Spire", "A black spire over Ashkeld.");

    const res = await confirmCard({
      propositionId: propId,
      entry: { name: "The Spire", kind: "world", summary: "A black spire over Ashkeld." },
      enrichEntryId: targetId,
      worldId: DEFAULT_WORLD,
      confirmed: true,
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.entryId).toBe(targetId); // folded into the target, no prop- entry
    // No NEW prop- entry was minted.
    expect(await entryCount(`prop-${propId}`)).toBe(0);
    // The target's world-link count is UNCHANGED (enrich adds a fact, not a link).
    const linksAfter = await query<{ n: number }>(`SELECT COUNT(*)::int n FROM world_entities WHERE entity_id = $1`, [targetId]);
    expect(linksAfter.rows[0]!.n).toBe(linksBefore.rows[0]!.n);
  });
});

describe("TCK-E06 default-world PIN — case-(a) invariant guard (real Postgres)", () => {
  it("4a. resolveWikiScope default (no ?u=/?w=) resolves the seed world 'world-universe-1'", async () => {
    const { activeWorldId } = resolveWikiScope(await getWorldTree(), undefined, undefined);
    expect(activeWorldId).toBe(DEFAULT_WORLD);
  });

  it("4b. every research thread is universe-1, so the URL-default world is correct for ALL threads today", async () => {
    // The moment a thread carries a non-default universe_id, `world-${universe_id}`
    // stops equaling the resolveWikiScope default and confirmCard would link the
    // entry into the WRONG world — this assertion REDs then, forcing the case-(b)
    // rewrite (derive worldId from the thread's own universe).
    const rows = await query<{ universe_id: string }>(`SELECT DISTINCT universe_id FROM research_threads`);
    for (const r of rows.rows) {
      expect(`world-${r.universe_id}`).toBe(DEFAULT_WORLD);
    }
  });
});
