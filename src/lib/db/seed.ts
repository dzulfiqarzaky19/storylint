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

// Research (§6). Thread id is stable.
const THREAD_ID = "salt-debt";

interface SeedTurn {
  id: string;
  ordinal: number;
  side: "them" | "you";
  who: string;
  text: string;
}

const TURNS: SeedTurn[] = [
  {
    id: "t1",
    ordinal: 1,
    side: "them",
    who: "Collaborator",
    text:
      "You left the Ferrier unnamed in Chapter 7. Good absence — but it only pays off if somebody tries to name him. Three ways that could go.",
  },
  {
    id: "t2",
    ordinal: 2,
    side: "you",
    who: "You",
    text: "The third one. I like names being owed.",
  },
  {
    id: "t3",
    ordinal: 3,
    side: "them",
    who: "Collaborator",
    text:
      "Then salt-names are not prophecy, they are invoices — and somebody has been collecting for twelve years. Two places that leaves a mark.",
  },
  // Revealed after a prompt chip is clicked (the deferred `more` turns).
  {
    id: "t4",
    ordinal: 4,
    side: "you",
    who: "You",
    text: "What does it cost her?",
  },
  {
    id: "t5",
    ordinal: 5,
    side: "them",
    who: "Collaborator",
    text:
      "Maren’s name was written before she was born, so it was paid in advance. Whatever that bought is the shape of Chapter 12.",
  },
];

interface SeedCard {
  id: string;
  turnId: string;
  kind: string;
  title: string;
  body: string;
  asKind: string;
}

const CARDS: SeedCard[] = [
  {
    id: "c1",
    turnId: "t1",
    kind: "What if",
    title: "Halvard knows the name",
    body:
      "And has kept it off the tide ledger for twelve years, one line at a time.",
    asKind: "lore",
  },
  {
    id: "c2",
    turnId: "t1",
    kind: "Beat",
    title: "Maren asks. He answers wrong.",
    body: "The wrong name is the one she read on the harbour wall in Chapter 2.",
    asKind: "beat",
  },
  {
    id: "c3",
    turnId: "t1",
    kind: "Motif",
    title: "Names as debts",
    body: "Nobody in Kirn owns their name outright. Somebody paid for it first.",
    asKind: "lore",
  },
  {
    id: "c4",
    turnId: "t3",
    kind: "Question",
    title: "Twenty-one members, twenty-two chairs",
    body: "You wrote that into the Sept without deciding why. This is the why.",
    asKind: "question",
  },
  {
    id: "c5",
    turnId: "t3",
    kind: "Lore",
    title: "The Sept as collectors",
    body:
      "One member per unpaid name. The empty chair is a debt nobody will take.",
    asKind: "lore",
  },
  {
    id: "c6",
    turnId: "t5",
    kind: "What if",
    title: "Her name was paid in advance",
    body: "Written before she was born. By whom, and what did the payment buy?",
    asKind: "lore",
  },
];

// Write — Chapter 7, "Low Water" (§6). Stored as ProseMirror JSON (paragraphs
// only, matching the StarterKit editor). Marks are derived by the check engine,
// so the body is plain text of the four paragraphs.
const CHAPTER7_PARAGRAPHS: string[] = [
  "The Ferrier came in on the low water with the sun still an hour off the roofs. Maren had lit the Verge at four, as she had every night since she was nineteen and sworn.",
  "She kept her mother’s brass ring in her coat and turned it twice, the way the tallow rule said, before she went down to the water.",
  "He looked at her with the flat attention of a man counting what he is owed. Her own grey eyes did not move.",
  "Neither of them said the name. That was the arrangement, and it had been the arrangement since before she was born.",
];

const CHAPTER7_BODY = {
  type: "doc",
  content: CHAPTER7_PARAGRAPHS.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  })),
};

// ---------------------------------------------------------------------------
// Insert routine
// ---------------------------------------------------------------------------

async function seedWithin(client: PoolClient): Promise<void> {
  // Idempotent: clear everything, then insert. CASCADE covers FK children.
  await client.query(`
    TRUNCATE TABLE
      entries, facts, ties, chapter_appearances, open_questions,
      chapters, research_turns, propositions, kept_cards,
      resolved_marks, dismissed_suggestions
    RESTART IDENTITY CASCADE
  `);

  // Entries
  for (let i = 0; i < ENTRIES.length; i++) {
    const e = ENTRIES[i]!;
    await client.query(
      `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [e.id, e.kind, e.name, e.no, e.note, e.summary, KIND_SHELF[e.kind], i],
    );
  }

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
      `INSERT INTO chapter_appearances (id, entry_id, chapter, text, flag, flag_text, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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

  // Chapter 7 manuscript
  await client.query(
    `INSERT INTO chapters (id, number, title, body)
     VALUES ($1, $2, $3, $4)`,
    ["ch7", 7, "Low Water", JSON.stringify(CHAPTER7_BODY)],
  );

  // Research turns
  for (const t of TURNS) {
    await client.query(
      `INSERT INTO research_turns (id, thread_id, ordinal, side, who, text)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [t.id, THREAD_ID, t.ordinal, t.side, t.who, t.text],
    );
  }

  // Research propositions (cards)
  for (let i = 0; i < CARDS.length; i++) {
    const c = CARDS[i]!;
    await client.query(
      `INSERT INTO propositions (id, turn_id, kind, title, body, as_kind, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [c.id, c.turnId, c.kind, c.title, c.body, c.asKind, i],
    );
  }

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
