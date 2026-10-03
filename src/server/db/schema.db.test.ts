import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePool, getPool, one, query } from "./pool";
import { reset } from "./reset";
import { deleteCascade, previewCascade, type CascadeTarget } from "./cascade";
import { replacePhraseMentions, upsertResolvedMark } from "./chapters/mutations";
import { getPhraseChapterCounts, getResolvedMarkKeys } from "./chapters/queries";
import { deleteKeptCard, markKeptInWiki, upsertKeptCard } from "./research/mutations";
import { getWorldKeptCards } from "./research/queries";
import { confirmWikiWrite } from "@/domain/result";

// reset() drops the whole schema, so this suite must never see the dev database.
if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error("schema.db.test.ts needs DATABASE_URL to point at a *_test database");
}

const DOC = JSON.stringify({ type: "doc", content: [] });

// One universe, two worlds. `shared` lives in both worlds, `solo` only in w1.
async function fixture(): Promise<void> {
  await query(`
    INSERT INTO universes (id, name) VALUES ('u1', 'U');
    INSERT INTO worlds (id, universe_id, name) VALUES ('w1', 'u1', 'W1'), ('w2', 'u1', 'W2');
    INSERT INTO books (id, world_id, name, sort_order) VALUES
      ('b1', 'w1', 'B1', 0), ('b2', 'w1', 'B2', 1), ('b3', 'w2', 'B3', 0);
    INSERT INTO chapters (id, book_id, number, title, body) VALUES
      ('b1c1', 'b1', 1, 'One', '${DOC}'), ('b1c2', 'b1', 2, 'Two', '${DOC}'),
      ('b2c1', 'b2', 1, 'One', '${DOC}'), ('b3c1', 'b3', 1, 'One', '${DOC}');
    INSERT INTO entries (id, universe_id, category_id, name, shelf) VALUES
      ('shared', 'u1', 'character', 'Shared', 'people'),
      ('solo',   'u1', 'character', 'Solo',   'people'),
      ('arc',    'u1', 'plotline',  'Arc',    'plots');
    INSERT INTO world_entries (world_id, entry_id) VALUES
      ('w1', 'shared'), ('w2', 'shared'), ('w1', 'solo'), ('w1', 'arc');
    INSERT INTO facts (id, entry_id, key, value) VALUES
      ('f1', 'shared', 'age', '30'), ('f2', 'solo', 'age', '40');
    INSERT INTO ties (id, from_entry_id, to_entry_id, rel) VALUES ('t1', 'solo', 'shared', 'knows');
    INSERT INTO beats (chapter_id, plotline_id, summary) VALUES ('b1c1', 'arc', 'starts');
    INSERT INTO entry_plotlines (entry_id, plotline_id) VALUES ('solo', 'arc');
    INSERT INTO research_threads (id, world_id, title) VALUES ('th1', 'w1', 'T1'), ('th2', 'w2', 'T2');
    INSERT INTO research_turns (id, thread_id, ordinal, side, who, text) VALUES
      ('tu1', 'th1', 0, 'you', 'me', 'q'), ('tu2', 'th1', 1, 'them', 'ai', 'a');
    INSERT INTO propositions (id, turn_id, kind, title, body, as_kind) VALUES
      ('p1', 'tu2', 'character', 'Card', 'body', 'character');
    INSERT INTO phrase_mentions (chapter_id, phrase, count) VALUES ('b1c1', 'the gate', 2);
    INSERT INTO dismissed_suggestions (world_id, suggestion_key) VALUES ('w1', 'k1');
  `);
  await upsertResolvedMark({ bookId: "b1", markKey: "m1", resolution: "leave", resolvedAt: 1000 });
}

async function totalRows(): Promise<number> {
  const tables = await query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  let total = 0;
  for (const { name } of tables.rows) {
    const res = await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "${name}"`);
    total += res?.n ?? 0;
  }
  return total;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return (await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${sql}`, params))?.n ?? 0;
}

beforeEach(async () => {
  await reset();
  await fixture();
});

afterAll(async () => {
  await closePool();
});

describe("schema", () => {
  it("has the 18 tables and the built-in categories", async () => {
    expect(await count(`information_schema.tables WHERE table_schema = 'public'`)).toBe(18);
    expect(await count(`categories WHERE is_builtin`)).toBe(5);
  });

  it("rejects a row whose parent does not exist", async () => {
    await expect(
      query(
        `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text)
         VALUES ('x', 'no-such-thread', 0, 'you', 'me', 'q')`,
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("cascade", () => {
  const targets: CascadeTarget[] = [
    { kind: "book", id: "b1" },
    { kind: "world", id: "w1" },
    { kind: "universe", id: "u1" },
  ];

  it.each(targets)("previews exactly what deleting a $kind removes", async (target) => {
    const before = await totalRows();

    const preview = await previewCascade(target);
    expect(await totalRows()).toBe(before);
    expect(preview.total).toBeGreaterThan(0);

    const removed = await deleteCascade(target);
    expect(removed).toEqual(preview);
    expect(before - (await totalRows())).toBe(preview.total);
  });

  it("deleting a world takes its own entries and keeps shared ones", async () => {
    await deleteCascade({ kind: "world", id: "w1" });

    expect(await count(`entries WHERE id = 'solo'`)).toBe(0);
    expect(await count(`entries WHERE id = 'arc'`)).toBe(0);
    expect(await count(`entries WHERE id = 'shared'`)).toBe(1);
    expect(await count(`facts WHERE id = 'f1'`)).toBe(1);
    expect(await count(`world_entries WHERE entry_id = 'shared'`)).toBe(1);
  });

  it("deleting a world leaves no research rows behind", async () => {
    await deleteCascade({ kind: "world", id: "w1" });

    expect(await count(`research_threads`)).toBe(1);
    expect(await count(`research_turns`)).toBe(0);
    expect(await count(`propositions`)).toBe(0);
    expect(await count(`dismissed_suggestions`)).toBe(0);
  });

  it("deleting a book removes its check state", async () => {
    await deleteCascade({ kind: "book", id: "b1" });

    expect(await count(`phrase_mentions`)).toBe(0);
    expect(await count(`resolved_marks`)).toBe(0);
    expect(await count(`beats`)).toBe(0);
    expect(await count(`entries`)).toBe(3);
  });
});

describe("book scoping", () => {
  it("keeps phrase mentions of two books' chapter 1 apart", async () => {
    await replacePhraseMentions({
      bookId: "b2",
      chapterNumber: 1,
      phrases: new Map([["the gate", 5], ["old road", 1]]),
    });

    expect(await count(`phrase_mentions WHERE chapter_id = 'b1c1'`)).toBe(1);
    expect(await getPhraseChapterCounts("b1", ["the gate", "old road"])).toEqual(
      new Map([["the gate", 1]]),
    );
    expect(await getPhraseChapterCounts("b2", ["the gate", "old road"])).toEqual(
      new Map([["the gate", 1], ["old road", 1]]),
    );
  });

  it("scopes resolved marks to their book", async () => {
    expect(await getResolvedMarkKeys("b1")).toEqual(["m1"]);
    expect(await getResolvedMarkKeys("b2")).toEqual([]);
  });
});

describe("kept cards", () => {
  const confirmation = confirmWikiWrite({ confirmed: true });

  it("keeps, lists and releases a card", async () => {
    await upsertKeptCard({ propositionId: "p1", keptAt: 2000 });
    expect((await getWorldKeptCards("w1")).map((c) => c.propositionId)).toEqual(["p1"]);
    expect(await getWorldKeptCards("w2")).toEqual([]);

    expect(await deleteKeptCard("p1")).toBe(true);
    expect(await getWorldKeptCards("w1")).toEqual([]);
  });

  it("will not release a card that is already in the wiki", async () => {
    await upsertKeptCard({ propositionId: "p1", keptAt: 2000 });
    await markKeptInWiki("p1", confirmation);

    expect(await deleteKeptCard("p1")).toBe(false);
    expect(await count(`propositions WHERE id = 'p1' AND in_wiki`)).toBe(1);
  });

  it("refuses to keep a card that does not exist", async () => {
    await expect(upsertKeptCard({ propositionId: "nope", keptAt: 1 })).rejects.toThrow();
  });
});

it("connects to the test database", async () => {
  const res = await getPool().query<{ db: string }>(`SELECT current_database() AS db`);
  expect(res.rows[0]?.db).toMatch(/_test$/);
});
