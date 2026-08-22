// Generic per-book loader for the seed.
// A "book" is one prose work living in this folder as `<slug>.chapters.json`
// (required, the extracted prose) plus an optional `<slug>.extraction.json`
// (the authored wiki + plot). This module reads those files for a given slug and
// maps them onto the seed's row shapes — the same mapping that used to be
// hardcoded for Mother of Learning, now parameterized so ANY book seeds by just
// dropping its JSON here. All ids are namespaced by the slug so books never
// collide: `<slug>-ch1`, `universe-<slug>`, `world-<slug>`, `<slug>-1` (book).
// The extraction's OWN entity ids (e.g. `mol-zorian`) are opaque internal strings
// kept verbatim — they are self-referential (ties/owners point at them) and need
// no prefixing.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { DEFAULT_BOOK_SLUG } from "./bookSlug";
export { DEFAULT_BOOK_SLUG };

const HERE = dirname(fileURLToPath(import.meta.url));

export type Kind = "character" | "world" | "organization" | "lore";

export interface SeedEntry {
  id: string;
  kind: Kind;
  name: string;
  no: string;
  note: string;
  summary: string;
}

export interface SeedChapter {
  id: string;
  number: number;
  title: string;
  paragraphs: string[];
}

export interface BookPlotline {
  id: string;
  name: string;
  label: string;
  ownerEntryId: string | null;
  state: string;
  beats: Array<{ chapterId: string; summary: string }>;
}

// One fully-loaded book: identity (ids + display names) plus every row set the
// seed inserts. `entries`/`facts`/`ties`/`plotlines` are empty when the book has
// no extraction.json (chapters-only import).
export interface LoadedBook {
  slug: string;
  universeId: string;
  worldId: string;
  bookId: string;
  universeName: string;
  worldTitle: string;
  bookName: string;
  chapters: SeedChapter[];
  entries: SeedEntry[];
  facts: Array<[string, string, string, string]>;
  ties: Array<[string, string, string]>;
  plotlines: BookPlotline[];
}

// ---- extraction.json shape (authored wiki + plot) ----
interface ExFact {
  key: string;
  value: string;
}
interface ExTie {
  to: string;
  rel: string;
}
interface ExEntity {
  id: string;
  kind: string;
  name: string;
  summary: string;
  facts?: ExFact[];
  ties?: ExTie[];
}
interface ExBeat {
  chapter: number;
  summary: string;
}
interface ExPlotline {
  id: string;
  title: string;
  summary: string;
  state: string;
  label?: string;
  owner?: string;
  entities?: string[];
  beats?: ExBeat[];
}
interface Extraction {
  wiki: { entities: ExEntity[] };
  plot: { plotlines: ExPlotline[] };
}

interface RawChapter {
  number: number;
  title: string;
  paragraphs: string[];
}

// slug "mother-of-learning" -> "Mother of Learning". The seed uppercases display
// names itself (Ashkeld convention), so this only needs to be human-readable.
function titleize(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// The richer extraction kinds fold onto the seed's 4 built-in kinds: a location is
// a place (world), and every lore-shelf kind (species/magic/event/concept) is lore.
const KIND_MAP: Record<string, Kind> = {
  character: "character",
  location: "world",
  organization: "organization",
  species: "lore",
  magic: "lore",
  event: "lore",
  concept: "lore",
};

// Catalogue-number prefix by shelf, mirroring the Ashkeld convention (people 0x,
// places 1x, orders 2x, lore 3x). A running per-shelf counter yields "01".."3n".
const SHELF_PREFIX: Record<Kind, number> = {
  character: 0,
  world: 1,
  organization: 2,
  lore: 3,
};

// Read `<slug>.chapters.json` (+ optional `<slug>.extraction.json`) and map onto
// the seed row shapes, all ids namespaced by slug. Throws if chapters are missing.
export function loadBook(slug: string): LoadedBook {
  const raw = JSON.parse(
    readFileSync(join(HERE, `${slug}.chapters.json`), "utf8"),
  ) as RawChapter[];
  const chapters: SeedChapter[] = raw.map((c, i) => ({
    id: `${slug}-ch${i + 1}`,
    number: i + 1,
    title: c.title,
    paragraphs: c.paragraphs,
  }));

  const book: LoadedBook = {
    slug,
    universeId: `universe-${slug}`,
    worldId: `world-${slug}`,
    bookId: `${slug}-1`,
    universeName: titleize(slug),
    worldTitle: titleize(slug),
    bookName: titleize(slug),
    chapters,
    entries: [],
    facts: [],
    ties: [],
    plotlines: [],
  };

  let ex: Extraction | null = null;
  try {
    ex = JSON.parse(
      readFileSync(join(HERE, `${slug}.extraction.json`), "utf8"),
    ) as Extraction;
  } catch {
    return book; // chapters-only book (no authored wiki/plot yet)
  }

  // Per-shelf catalogue counter, local to this book.
  const shelfSeq: Record<string, number> = {};
  const catalogueNo = (kind: Kind): string => {
    const n = (shelfSeq[kind] = (shelfSeq[kind] ?? 0) + 1);
    return `${SHELF_PREFIX[kind]}${n}`;
  };
  const noteFor = (e: ExEntity): string => {
    const first = e.facts?.[0];
    return first ? `${first.key}: ${first.value}`.slice(0, 60) : e.kind;
  };

  book.entries = ex.wiki.entities.map((e) => {
    const kind = KIND_MAP[e.kind] ?? "lore";
    return { id: e.id, kind, name: e.name, no: catalogueNo(kind), note: noteFor(e), summary: e.summary };
  });

  book.facts = ex.wiki.entities.flatMap((e) =>
    (e.facts ?? []).map((f, i): [string, string, string, string] => [
      `${e.id}-f${i + 1}`,
      e.id,
      f.key,
      f.value,
    ]),
  );

  const entityIds = new Set(ex.wiki.entities.map((e) => e.id));
  book.ties = ex.wiki.entities.flatMap((e) =>
    (e.ties ?? [])
      .filter((t) => entityIds.has(t.to))
      .map((t): [string, string, string] => [e.id, t.to, t.rel]),
  );

  // Owner is the entity whose arc this is. Prefer the explicit `owner` id (so
  // antagonist/side arcs are owned by their own character); fall back to the first
  // plotline entity whose NAME resolves to a character; else a standalone arc.
  const charIdByName = new Map(
    ex.wiki.entities.filter((e) => e.kind === "character").map((e) => [e.name, e.id]),
  );
  const ownerOf = (pl: ExPlotline): string | null => {
    if (pl.owner && entityIds.has(pl.owner)) return pl.owner;
    for (const name of pl.entities ?? []) {
      const id = charIdByName.get(name);
      if (id) return id;
    }
    return null;
  };
  // Hand-authored extractions carry an explicit lifecycle state; assembler output
  // (from raw observations) omits it. A missing/"ongoing" state means the arc is
  // still open. Never return undefined: the seed writes this into a NOT NULL column.
  const plotState = (s: string | undefined): string =>
    !s || s === "ongoing" ? "open" : s;

  book.plotlines = ex.plot.plotlines.map((pl) => ({
    id: pl.id,
    name: pl.title,
    label: pl.label ?? "main story",
    ownerEntryId: ownerOf(pl),
    state: plotState(pl.state),
    beats: (pl.beats ?? []).map((b) => ({
      chapterId: `${slug}-ch${b.chapter}`,
      summary: b.summary,
    })),
  }));

  return book;
}

// Discover every book in this folder by its `<slug>.chapters.json` and load it.
// The default book is placed first (it backs the default scope); the rest follow
// alphabetically for a stable seed order.
export function discoverBooks(): LoadedBook[] {
  const slugs = readdirSync(HERE)
    .filter((f) => f.endsWith(".chapters.json"))
    .map((f) => f.slice(0, -".chapters.json".length))
    .sort((a, b) => {
      if (a === DEFAULT_BOOK_SLUG) return -1;
      if (b === DEFAULT_BOOK_SLUG) return 1;
      return a.localeCompare(b);
    });
  return slugs.map(loadBook);
}



 
