// Idempotent seed of ALL HANDOFF §6 data, verbatim (curly apostrophes preserved).
// Postgres via pg. Runs inside one transaction; TRUNCATE first so re-running is safe.
// Usage: npm run db:seed
//
// NOT seeded on purpose:
//   - suggestions s1/s2 (§6: DERIVE them via the check engine)
//   - the derived Wiki poster suggestions
// The 3 ADDED facts (oath/saltnames, §6/§9) ARE seeded so contradiction rules work.
import { loadEnv } from "./env";
import { getPool, closePool, withTransaction } from "./pool";
import type { PoolClient } from "pg";
import { extractCandidatePhrases } from "../check/unrecorded";

// ---------------------------------------------------------------------------
// Seed data (verbatim from HANDOFF §6)
// ---------------------------------------------------------------------------

type Kind = "character" | "world" | "organization" | "lore";

interface SeedEntry {
  id: string;
  kind: Kind;
  name: string;
  no: string;
  note: string;
  summary: string;
}

// Shelf derives from kind (§6): character->people, world->places,
// organization->orders, lore->lore.
const KIND_SHELF: Record<Kind, string> = {
  character: "people",
  world: "places",
  organization: "orders",
  lore: "lore",
};

// F9-B built-in categories. Their ids EQUAL the legacy kind enum strings, so
// every seeded entry's `kind` already points at a real category row (no
// backfill). Labels are the shelf defaults; sort_order matches shelf order.
// Mirrors the seed block in schema.sql and the f9a migration's ON CONFLICT seed.
const BUILTIN_CATEGORIES: Array<{
  id: Kind;
  label: string;
  shelf: string;
  sortOrder: number;
}> = [
  { id: "character", label: "People", shelf: "people", sortOrder: 0 },
  { id: "world", label: "Places", shelf: "places", sortOrder: 1 },
  { id: "organization", label: "Orders", shelf: "orders", sortOrder: 2 },
  { id: "lore", label: "Lore", shelf: "lore", sortOrder: 3 },
];

const ENTRIES: SeedEntry[] = [
  {
    id: "maren",
    kind: "character",
    name: "Maren Vell",
    no: "04",
    note: "lamp-keeper",
    summary:
      "Lamp-keeper of the Verge Light since her father drowned, and the only person in Kirn who can still read a salt-name. Nineteen, sworn to the Quiet Sept out of season, and not forgiven for it.",
  },
  {
    id: "halvard",
    kind: "character",
    name: "Halvard Sarn",
    no: "01",
    note: "harbourmaster",
    summary:
      "Harbourmaster of Kirn and Maren’s uncle. Keeps the tide ledgers, and keeps what he knows about the Long Ebb off them.",
  },
  {
    id: "idra",
    kind: "character",
    name: "Sister Idra Cotch",
    no: "02",
    note: "archivist",
    summary:
      "Archivist of the Quiet Sept. Taught Maren to read salt, then argued against her oath.",
  },
  {
    id: "teodor",
    kind: "character",
    name: "Teodor Kest",
    no: "07",
    note: "cartographer",
    summary:
      "Cartographer, exiled after he mapped the drowned streets of Ashkeld too accurately for the Assembly’s comfort.",
  },
  {
    id: "ferrier",
    kind: "character",
    name: "The Ferrier",
    no: "09",
    note: "unnamed",
    summary:
      "Unnamed by anyone still living. Carries the drowned out past the light at low water.",
  },
  {
    id: "vergelight",
    kind: "world",
    name: "Verge Light",
    no: "11",
    note: "lighthouse",
    summary:
      "The lighthouse at the mouth of Kirn. Burns tallow, not oil, and has never once gone dark on a recorded night.",
  },
  {
    id: "kirn",
    kind: "world",
    name: "Kirn Harbour",
    no: "12",
    note: "harbour town",
    summary:
      "A working harbour of nine hundred souls, built on the shoulder of a city that went under.",
  },
  {
    id: "ashkeld",
    kind: "world",
    name: "Ashkeld",
    no: "13",
    note: "the drowned city",
    summary:
      "The drowned city. Its towers stand at low water and are gone again by noon.",
  },
  {
    id: "sept",
    kind: "organization",
    name: "The Quiet Sept",
    no: "21",
    note: "order of readers",
    summary:
      "The order that keeps the salt-names. Twenty-one members, never more, never fewer.",
  },
  {
    id: "assembly",
    kind: "organization",
    name: "Harbour Assembly",
    no: "22",
    note: "town council",
    summary: "Eleven families who decide what Kirn remembers about itself.",
  },
  {
    id: "ferrymen",
    kind: "organization",
    name: "Ferrymen’s Guild",
    no: "23",
    note: "the black boats",
    summary:
      "Licensed to cross the drowned quarter. Nobody checks the licences.",
  },
  {
    id: "tidewriting",
    kind: "lore",
    name: "Tidewriting",
    no: "31",
    note: "reading salt",
    summary:
      "Names left in salt on a wall by the tide, legible for one turn of the water to anyone taught to see them.",
  },
  {
    id: "longebb",
    kind: "lore",
    name: "The Long Ebb",
    no: "32",
    note: "twelve years back",
    summary:
      "Twelve years ago the water went out for nine days and did not come back the same. Forty-one drowned on its return.",
  },
  {
    id: "oath",
    kind: "lore",
    name: "The Lantern Oath",
    no: "33",
    note: "sworn at twenty-one",
    summary:
      "Sworn at twenty-one, at the turn of the year, in front of the light. There is no provision for swearing it early.",
  },
  {
    id: "saltnames",
    kind: "lore",
    name: "Salt-names",
    no: "34",
    note: "what the tide writes",
    summary:
      "A name the tide writes before the person it belongs to is born. Contested; the Assembly calls it weather.",
  },
];

// Ties (§6). Directional; seeded exactly as listed (both directions given).
// Tuple: [fromId, toId, rel].
const TIES: Array<[string, string, string]> = [
  ["maren", "halvard", "uncle"],
  ["maren", "idra", "taught her"],
  ["maren", "vergelight", "keeps"],
  ["maren", "sept", "sworn to"],
  ["maren", "longebb", "survived"],
  ["maren", "teodor", "owed a map"],
  ["halvard", "maren", "niece"],
  ["halvard", "kirn", "harbourmaster"],
  ["halvard", "assembly", "sits on"],
  ["idra", "sept", "archivist"],
  ["idra", "maren", "student"],
  ["idra", "saltnames", "keeps"],
  ["teodor", "ashkeld", "mapped"],
  ["teodor", "assembly", "exiled by"],
  ["ferrier", "ferrymen", "unlicensed"],
  ["ferrier", "ashkeld", "crosses"],
  ["vergelight", "kirn", "guards"],
  ["vergelight", "maren", "kept by"],
  ["vergelight", "oath", "sworn before"],
  ["kirn", "ashkeld", "built above"],
  ["kirn", "assembly", "governed by"],
  ["ashkeld", "longebb", "drowned in"],
  ["sept", "saltnames", "keeps"],
  ["sept", "idra", "archivist"],
  ["assembly", "kirn", "governs"],
  ["ferrymen", "ashkeld", "crosses"],
  ["tidewriting", "saltnames", "produces"],
  ["tidewriting", "sept", "read by"],
  ["longebb", "ashkeld", "drowned"],
  ["longebb", "kirn", "scarred"],
  ["oath", "vergelight", "sworn at"],
  ["oath", "sept", "administered by"],
  ["saltnames", "tidewriting", "written by"],
];

// Facts (§6). Tuple: [id, entryId, key, value, fresh]. fresh=false throughout
// (the --fresh background is for suggestions added at runtime, not seed data).
const FACTS: Array<[string, string, string, string]> = [
  ["f1", "maren", "Age", "Nineteen"],
  ["f2", "maren", "Eyes", "Green"],
  ["f3", "maren", "Born", "Kirn Harbour, the year after the Ebb"],
  ["f4", "maren", "Keeps", "Verge Light, since Ch. 1"],
  ["f5", "maren", "Sworn", "Lantern Oath, Ch. 4"],
  ["g1", "halvard", "Office", "Harbourmaster, nineteen years"],
  ["g2", "halvard", "Keeps", "The tide ledgers"],
  ["h1", "idra", "Office", "Archivist of the Sept"],
  ["h2", "idra", "Age", "Sixty-one"],
  ["i1", "vergelight", "Burns", "Tallow"],
  ["i2", "vergelight", "Height", "Eleven fathoms"],
  ["j1", "sept", "Members", "Twenty-one, never more"],
  // ADDED (§6/§9): structured facts so contradiction rules have targets.
  ["oath1", "oath", "Sworn at", "Twenty-one"],
  ["oath2", "oath", "When", "Turn of the year"],
  ["salt1", "saltnames", "Written", "Before birth"],
];

// Timeline / chapter appearances (§6).
// Tuple: [id, entryId, chapter, text, flag|null, flagText|null].
const APPEARANCES: Array<
  [string, string, number, string, "red" | "yellow" | null, string | null]
> = [
  [
    "a-maren-1",
    "maren",
    1,
    "Lights the Verge alone for the first time, three days after the funeral.",
    null,
    null,
  ],
  [
    "a-maren-2",
    "maren",
    2,
    "Reads a salt-name on the harbour wall and tells no one whose it is.",
    null,
    null,
  ],
  [
    "a-maren-4",
    "maren",
    4,
    "Swears the Lantern Oath at nineteen, out of season.",
    "red",
    "contradicts The Lantern Oath — sworn at twenty-one",
  ],
  [
    "a-maren-5",
    "maren",
    5,
    "Refuses Halvard’s berth out to the drowned quarter.",
    null,
    null,
  ],
  [
    "a-maren-3",
    "maren",
    3,
    "Counts forty-one names struck from her uncle’s ledger and says nothing.",
    null,
    null,
  ],
  [
    "a-maren-6",
    "maren",
    6,
    "Asks Idra about the empty chair, and is told to go and light her lamp.",
    null,
    null,
  ],
  [
    "a-maren-7",
    "maren",
    7,
    "Meets the Ferrier at low water. Her eyes are described as grey.",
    "yellow",
    "entry says green",
  ],
  [
    "a-halvard-3",
    "halvard",
    3,
    "Strikes forty-one names off the tide ledger without explaining why.",
    null,
    null,
  ],
  [
    "a-halvard-5",
    "halvard",
    5,
    "Offers Maren a berth she does not take.",
    null,
    null,
  ],
  [
    "a-idra-4",
    "idra",
    4,
    "Argues against the oath in front of the whole Sept, and loses.",
    null,
    null,
  ],
  [
    "a-vergelight-1",
    "vergelight",
    1,
    "Burns through a storm with one keeper on the stair.",
    null,
    null,
  ],
];

// Open questions (§6). Tuple: [id, entryId, text].
const OPEN_QUESTIONS: Array<[string, string, string]> = [
  ["q-maren-1", "maren", "Whose name did she read on the wall in Chapter 2?"],
  [
    "q-maren-2",
    "maren",
    "Teodor owes her a map. It has not arrived in seven chapters.",
  ],
  ["q-maren-3", "maren", "Does the Sept know she lit the Verge during the Ebb?"],
  [
    "q-halvard-1",
    "halvard",
    "Why forty-one names, when the Ebb took forty-one people?",
  ],
  [
    "q-idra-1",
    "idra",
    "What did she read in the archive the night before the oath?",
  ],
  ["q-vergelight-1", "vergelight", "Who kept the light on the night of the Ebb?"],
  [
    "q-sept-1",
    "sept",
    "Twenty-one members and twenty-two chairs in the chapter house.",
  ],
];

// Research (§6) now starts EMPTY. Threads, turns, and propositions are created
// at runtime by real AI conversations — there is no seed content and no
// synthetic starter thread. The TRUNCATE below still clears these tables so a
// re-seed leaves research genuinely empty.

// Write — the full arc, Chapters 1-7. Stored as ProseMirror JSON (paragraphs
// only, matching the StarterKit editor). Marks are derived by the check engine,
// so each body is plain prose. Chapter 7 ("Low Water") is the proof chapter and
// keeps the phrases the engine trips on: "brass ring" + "tallow rule" (never
// recorded in the wiki -> poster suggestions) and "grey eyes" (conflicts with
// the entry's "Eyes: Green"). Chapter 4 states the oath sworn "at nineteen",
// which contradicts The Lantern Oath "sworn at twenty-one". These are the same
// contradictions the wiki timeline flags, now readable in the manuscript itself.
interface SeedChapter {
  id: string;
  number: number;
  title: string;
  paragraphs: string[];
}

const CHAPTERS: SeedChapter[] = [
  {
    id: "ch1",
    number: 1,
    title: "Three Days After",
    paragraphs: [
      "They buried her father on a falling tide, which the Sept said was unlucky and Halvard said was the only tide they had. Maren stood at the graveside in her mother's coat and did not cry, because crying was a thing you did with your hands and hers were busy holding the coat shut against the wind.",
      "On the third night she climbed the eleven fathoms of the Verge alone and lit it, because someone had to and there was no one left who knew the trick of the tallow. The flame took on the second match. She watched it steady and thought: this is mine now, whether I swore for it or not.",
      "Below her the harbour of Kirn lay dark except where the light found it. Nine hundred souls, and not one of them awake to see the Verge come back. She stayed on the stair until dawn, learning the sound the wind made against the glass.",
    ],
  },
  {
    id: "ch2",
    number: 2,
    title: "What the Wall Said",
    paragraphs: [
      "The salt came up on the harbour wall the morning after the storm, white letters on grey stone, legible for one turn of the water to anyone the Sept had taught to see them. Maren had been taught. She read the name before she could decide not to.",
      "It was not a name she expected. She stood with the tide climbing her boots and read it twice more to be certain, then walked home the long way so no one would ask where she had been looking.",
      "By noon the water had taken it back, the way it always did. She told no one whose name it was. That, she would later think, was the first debt she took on without being asked.",
    ],
  },
  {
    id: "ch3",
    number: 3,
    title: "The Ledger",
    paragraphs: [
      "Halvard kept the tide ledgers in a locked room off the harbourmaster's office, and in nineteen years he had never once let Maren past the door. She heard him in there the night after the wall, the scratch of a pen striking things out.",
      "In the morning forty-one names were gone from the roll of the drowned, ruled through with a single line each, and no note beside them to say why. When she asked, he said the ledger was his to keep and she was not to read what she had no business reading.",
      "Forty-one. She counted them twice. It was the number the Long Ebb had taken, twelve years back, when the water went out for nine days and came back wrong. She did not say so. She was learning what her uncle already knew, which was that some arithmetic is safer left unspoken.",
    ],
  },
  {
    id: "ch4",
    number: 4,
    title: "Out of Season",
    paragraphs: [
      "The Lantern Oath is sworn at twenty-one, at the turn of the year, in front of the light, and there is no provision in any of the Sept's books for swearing it early. Maren swore it at nineteen, out of season, on an ordinary autumn night with the tide half in.",
      "Sister Idra argued against it in front of the whole Sept and lost, which was rare for her. She said the oath was a door you could only walk through once and Maren was too young to know what was on the other side. Maren said she had been keeping the light alone for two years and the door was already behind her.",
      "They let her swear. Twenty-one members watched, never more and never fewer, from the twenty-two chairs of the chapter house. Afterward Idra would not look at her, and Maren understood that she had won something she could not give back.",
    ],
  },
  {
    id: "ch5",
    number: 5,
    title: "The Berth Refused",
    paragraphs: [
      "Halvard offered her a berth on a boat going out past the light to the drowned quarter, where the towers of Ashkeld stand at low water and are gone again by noon. He offered it the way he offered most things, as though it were already decided and she was only there to agree.",
      "She refused. She had reasons she gave him and one she did not: that the last person to map the drowned streets too well had been Teodor Kest, and the Assembly had exiled him for the accuracy of it. She did not intend to learn what he had learned.",
      "Halvard did not argue. He wrote something in a book that was not the tide ledger and told her the offer would not come again. She lit the Verge that night as she had every night, and did not watch the boat go out without her.",
    ],
  },
  {
    id: "ch6",
    number: 6,
    title: "The Empty Chair",
    paragraphs: [
      "There are twenty-one members of the Quiet Sept, never more and never fewer, and twenty-two chairs in the chapter house. Maren had sat in that house a dozen times before she let herself ask Idra why they kept a chair no one was allowed to fill.",
      "Idra was old enough to remember when the chair had a name to it, and careful enough not to say the name aloud. She said only that the Sept kept one seat for a debt that had never been paid, and that a wise reader did not ask after debts that predated her.",
      "Maren asked anyway. Idra told her to go and light her lamp. But that night, on the stair, Maren turned her mother's brass ring twice in her pocket and understood that the empty chair and the struck-out names and the name on the wall were the same arithmetic, and that she was somewhere inside the sum.",
    ],
  },
  {
    id: "ch7",
    number: 7,
    title: "Low Water",
    paragraphs: [
      "The Ferrier came in on the low water with the sun still an hour off the roofs. Maren had lit the Verge at four, as she had every night since she was nineteen and sworn.",
      "She kept her mother\u2019s brass ring in her coat and turned it twice, the way the tallow rule said, before she went down to the water.",
      "He looked at her with the flat attention of a man counting what he is owed. Her own grey eyes did not move.",
      "Neither of them said the name. That was the arrangement, and it had been the arrangement since before she was born.",
    ],
  },
];

/** ProseMirror doc from plain paragraphs (StarterKit shape). */
function bodyOf(paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

// ---------------------------------------------------------------------------
// Insert routine
// ---------------------------------------------------------------------------

export async function seedWithin(client: PoolClient): Promise<void> {
  // Idempotent: clear everything, then insert. CASCADE covers FK children.
  // F7/W-6: universes/books/entry_facets are cleared too (CASCADE from the
  // structural parents also clears any facet rows). Order does not matter under
  // one TRUNCATE ... CASCADE. (series is gone — W-6 merged it into worlds.)
  await client.query(`
    TRUNCATE TABLE
      universes, books, entry_facets,
      worlds, world_entities,
      categories,
      entries, facts, ties, chapter_appearances, open_questions,
      chapters, research_threads, research_turns, propositions, kept_cards,
      resolved_marks, dismissed_suggestions, phrase_mentions
    RESTART IDENTITY CASCADE
  `);

  // F7/W-6 worlds hierarchy: one Universe 1 / World 1 / Book 1 so a fresh seed
  // lands in exactly the state a live DB reaches after the w6a-books-world-expand
  // migration (books hang off the world directly). The world is inserted BEFORE
  // the book so books.world_id FK resolves; its id matches B1 below
  // ('world-' || universe_id), so B1's ON CONFLICT re-insert is a no-op.
  await client.query(`INSERT INTO universes (id, name) VALUES ('universe-1', 'Ashkeld')`);
  await client.query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ('world-universe-1', 'universe-1', 'Ashkeld', 0)`,
  );
  await client.query(
    `INSERT INTO books (id, world_id, name, sort_order) VALUES ('book-1', 'world-universe-1', 'Ashkeld', 0)`,
  );

  // F9-B categories: seed the 4 built-ins BEFORE entries, since entries.kind is a
  // soft FK to categories(id). ids equal the legacy kind strings, so every seeded
  // entry's kind already resolves to a real category row.
  for (const c of BUILTIN_CATEGORIES) {
    await client.query(
      `INSERT INTO categories (id, label, shelf, sort_order, is_builtin)
       VALUES ($1, $2, $3, $4, true)`,
      [c.id, c.label, c.shelf, c.sortOrder],
    );
  }

  // Entries
  for (let i = 0; i < ENTRIES.length; i++) {
    const e = ENTRIES[i]!;
    await client.query(
      `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'universe-1')`,
      [e.id, e.kind, e.name, e.no, e.note, e.summary, KIND_SHELF[e.kind], i],
    );
  }

  // W-1 world layer backfill. Runs AFTER the entries loop (B2 links every entry,
  // so entries must exist first) and inside THIS seed transaction (a separate
  // connection could not see the uncommitted entries above). The two INSERTs are
  // KEPT BYTE-IDENTICAL to w1-worlds-expand.mts B1/B2 so a reseed and a migrate()
  // land in the SAME world shape — if these drift, the review gate must catch it.
  // Built-ins stay world_id NULL (global), already handled above. schema.sql/
  // db:reset created the worlds + world_entities tables; this only backfills rows.
  //
  // B1 — one world per universe, id = 'world-'||universe_id. ON CONFLICT DO
  // NOTHING makes a re-run a no-op. title = the universe's own name.
  await client.query(
    `INSERT INTO worlds (id, universe_id, title, sort_order)
       SELECT 'world-' || u.id, u.id, u.name, 0
         FROM universes u
     ON CONFLICT (id) DO NOTHING`,
  );

  // B2 — link EVERY entry (live + tombstoned) to its OWN universe's world. The
  // per-row JOIN on e.universe_id is the load-bearing predicate: each membership
  // row's world_id is derived from THAT entry's universe, so a mis-homing mutation
  // is observable per-entry, not just in an aggregate count. ON CONFLICT DO
  // NOTHING => idempotent re-run.
  await client.query(
    `INSERT INTO world_entities (world_id, entity_id)
       SELECT 'world-' || e.universe_id, e.id
         FROM entries e
     ON CONFLICT (world_id, entity_id) DO NOTHING`,
  );

  // Facts
  for (let i = 0; i < FACTS.length; i++) {
    const [id, entryId, key, value] = FACTS[i]!;
    await client.query(
      `INSERT INTO facts (id, entry_id, key, value, fresh, sort_order)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [id, entryId, key, value, i],
    );
  }

  // Ties
  for (let i = 0; i < TIES.length; i++) {
    const [from, to, rel] = TIES[i]!;
    await client.query(
      `INSERT INTO ties (id, from_entry_id, to_entry_id, rel)
       VALUES ($1, $2, $3, $4)`,
      [`tie-${from}-${to}`, from, to, rel],
    );
  }

  // Chapter appearances
  for (let i = 0; i < APPEARANCES.length; i++) {
    const [id, entryId, chapter, text, flag, flagText] = APPEARANCES[i]!;
    await client.query(
      `INSERT INTO chapter_appearances (id, entry_id, chapter, text, flag, flag_text, sort_order, book_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'book-1')`,
      [id, entryId, chapter, text, flag, flagText, i],
    );
  }

  // Open questions
  for (let i = 0; i < OPEN_QUESTIONS.length; i++) {
    const [id, entryId, text] = OPEN_QUESTIONS[i]!;
    await client.query(
      `INSERT INTO open_questions (id, entry_id, text, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [id, entryId, text, i],
    );
  }

  // Chapters 1-7 (the full arc). Each body is real prose; the Write screen loads
  // one by number and derives its marks live.
  for (const c of CHAPTERS) {
    await client.query(
      `INSERT INTO chapters (id, number, title, body, book_id)
       VALUES ($1, $2, $3, $4, 'book-1')`,
      [c.id, c.number, c.title, JSON.stringify(bodyOf(c.paragraphs))],
    );
    // Tier 2: seed the book-wide phrase index the same way a chapter save would
    // (extractCandidatePhrases over the plain paragraphs), so cross-chapter
    // recurrence ranking is live from first load, not only after an edit.
    for (const [phrase, count] of extractCandidatePhrases(c.paragraphs)) {
      await client.query(
        `INSERT INTO phrase_mentions (phrase, chapter_number, count)
         VALUES ($1, $2, $3)`,
        [phrase, c.number, count],
      );
    }
  }

  // Research (threads / turns / propositions) is created at runtime by real AI
  // conversations — nothing to seed. TRUNCATE above left these tables empty.

  // kept_cards, resolved_marks, dismissed_suggestions start empty (runtime state).
}

async function main(): Promise<void> {
  loadEnv();
  await withTransaction(seedWithin);

  const counts = await getPool().query<{ table_name: string; n: string }>(`
    SELECT 'entries' AS table_name, count(*)::text AS n FROM entries
    UNION ALL SELECT 'facts', count(*)::text FROM facts
    UNION ALL SELECT 'ties', count(*)::text FROM ties
    UNION ALL SELECT 'chapter_appearances', count(*)::text FROM chapter_appearances
    UNION ALL SELECT 'open_questions', count(*)::text FROM open_questions
    UNION ALL SELECT 'chapters', count(*)::text FROM chapters
    UNION ALL SELECT 'research_threads', count(*)::text FROM research_threads
    UNION ALL SELECT 'research_turns', count(*)::text FROM research_turns
    UNION ALL SELECT 'propositions', count(*)::text FROM propositions
    ORDER BY table_name
  `);
  console.log("[db:seed] loaded:");
  for (const r of counts.rows) console.log(`  ${r.table_name}: ${r.n}`);
  await closePool();
}

main().catch(async (err) => {
  console.error("[db:seed] failed:", err);
  await closePool();
  process.exit(1);
});
