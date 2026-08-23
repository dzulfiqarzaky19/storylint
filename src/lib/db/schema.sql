-- Ashkeld schema (Postgres). Deliberately portable:
--   text primary keys, timestamps as bigint epoch millis, snake_case columns.
-- 13 tables from HANDOFF §5 (+ categories, F9-B — replaces category_labels).
-- Drop in dependency order, recreate with FKs + indexes.

DROP TABLE IF EXISTS chapter_check_cache CASCADE;
DROP TABLE IF EXISTS phrase_mentions CASCADE;
DROP TABLE IF EXISTS entry_plotlines CASCADE;
DROP TABLE IF EXISTS chapter_plotlines CASCADE;
DROP TABLE IF EXISTS world_entities CASCADE;
DROP TABLE IF EXISTS dismissed_suggestions CASCADE;
DROP TABLE IF EXISTS resolved_marks CASCADE;
DROP TABLE IF EXISTS kept_cards CASCADE;
DROP TABLE IF EXISTS propositions CASCADE;
DROP TABLE IF EXISTS research_turns CASCADE;
DROP TABLE IF EXISTS research_threads CASCADE;
DROP TABLE IF EXISTS entry_facets CASCADE;
DROP TABLE IF EXISTS chapters CASCADE;
DROP TABLE IF EXISTS open_questions CASCADE;
DROP TABLE IF EXISTS chapter_appearances CASCADE;
DROP TABLE IF EXISTS ties CASCADE;
DROP TABLE IF EXISTS facts CASCADE;
DROP TABLE IF EXISTS entries CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS worlds CASCADE;
DROP TABLE IF EXISTS universes CASCADE;

-- F7 worlds hierarchy (W-6: series merged into worlds): Universe owns the wiki;
-- World groups Books; Book owns Chapters. Created FIRST so the scope FKs below can
-- reference them. STRUCTURAL tables (not wiki content) — no confirmWikiWrite token
-- gates them.
CREATE TABLE universes (
  id    text PRIMARY KEY,
  name  text NOT NULL
);

-- W-1/W-6: worlds — a world groups SHARED entities (via the world_entities
-- junction below), owns user categories (categories.world_id), and (W-6) OWNS its
-- books directly (books.world_id). A universe may hold many worlds. STRUCTURAL
-- (not wiki content) so no confirmWikiWrite token gates it. Created BEFORE books
-- and categories so their world_id FKs resolve.
CREATE TABLE worlds (
  id           text PRIMARY KEY,
  universe_id  text NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  sort_order   integer NOT NULL DEFAULT 0
);

-- W-6: a book belongs directly to a WORLD (was series_id). Deleting a world
-- cascades its books (ON DELETE CASCADE).
CREATE TABLE books (
  id          text PRIMARY KEY,
  world_id    text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

-- categories (F9-B): user-extensible entry categories. REPLACES category_labels.
-- The 4 built-ins are seeded with ids EQUAL to the historic entries.kind enum
-- strings ('character'/'world'/'organization'/'lore'), so entries.kind already
-- points at a valid category id with no backfill. `label` is the single source
-- for the shelf/category header text (folds in the old category_labels override).
-- shelf: which shelf the category renders under. is_builtin: the 4 seeded rows
-- (never hard-deletable). deleted_at: soft-delete marker (epoch millis; NULL =
-- live) for user-created categories. Created BEFORE entries so the FK resolves.
CREATE TABLE categories (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  shelf       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_builtin  boolean NOT NULL DEFAULT false,
  deleted_at  bigint,
  -- W-1: owning world for VISIBILITY/ownership. NULL = GLOBAL (the 4 built-ins
  -- stay NULL so a shared entity kind always resolves in any world); user cats are
  -- per-world. ON DELETE CASCADE: a user category dies with its world. id stays
  -- globally-unique PK; is_builtin + soft-delete (TCK-008) untouched.
  world_id    text REFERENCES worlds(id) ON DELETE CASCADE
);

-- Seed the 4 built-in categories. ids MUST equal the historic kind enum strings
-- so entries.kind (the soft FK below) needs no rewrite. Labels are the shelf
-- defaults (SHELF_TITLES); a rename overwrites `label` in place.
INSERT INTO categories (id, label, shelf, sort_order, is_builtin) VALUES
  ('character',    'People', 'people', 0, true),
  ('world',        'Places', 'places', 1, true),
  ('organization', 'Orders', 'orders', 2, true),
  ('lore',         'Lore',   'lore',   3, true);

-- TCK-PLOT: the 'plotline' entry kind (reuse-wiki, Option A). A plotline is a wiki
-- entry of this kind, so it inherits entry CRUD/cards/confirm-gate + soft-delete.
-- shelf 'plots' is off the 4 wiki shelves (the Shelf union does not yet include it;
-- see plot-plotlines-expand.mts follow-up). world_id NULL = global, like the 4 above.
INSERT INTO categories (id, label, shelf, sort_order, is_builtin) VALUES
  ('plotline',     'Plotlines', 'plots', 4, true);

-- entries: id, kind, name, catalogueNo, note, summary, shelf, sortOrder.
-- deleted_at: soft-delete marker (epoch millis). NULL = live; non-NULL = "deleted"
-- but the ROW stays so ON DELETE CASCADE on child tables never fires and every
-- referencing fact/tie/appearance/question survives as a dangling tombstone.
CREATE TABLE entries (
  id            text PRIMARY KEY,
  -- F9-B: kind is a soft FK to categories(id) (was an inline CHECK enum). No
  -- ON DELETE action — deleting a category soft-deletes its ENTRIES (stamps
  -- their deleted_at), never removes the category row, so this FK never cascades.
  kind          text NOT NULL REFERENCES categories(id),
  name          text NOT NULL,
  catalogue_no  text NOT NULL,
  note          text NOT NULL DEFAULT '',
  summary       text NOT NULL DEFAULT '',
  shelf         text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  deleted_at    bigint,
  -- F7: the universe (canon) this entry belongs to. NOT NULL as of the S1b
  -- CONTRACT phase (f7a stamped every row, incl. soft-deleted, to universe-1).
  universe_id   text NOT NULL REFERENCES universes(id)
);

-- W-1 (world-model epic): world_entities — M2M membership junction (ITEM grain).
-- An entity is SHARED across a universe worlds via this junction (the entry stays
-- home to its universe_id; membership is additive). Composite PK dedupes a
-- (world, entity) pair; both FKs CASCADE so deleting a world or an entry row
-- cleans its membership edges. Created AFTER entries so the entity_id FK resolves.
CREATE TABLE world_entities (
  world_id   text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  entity_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY (world_id, entity_id)
);

-- facts: id, entryId, key, value, fresh, sortOrder
CREATE TABLE facts (
  id          text PRIMARY KEY,
  entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  fresh       boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  -- F7 list-divergence scope: NULL = universe canon (shown in every book);
  -- non-NULL = book-only facet fact. STAYS nullable (never enforced).
  book_id     text REFERENCES books(id)
);

-- ties: id, fromEntryId, toEntryId, rel (directional; seeded both ways)
CREATE TABLE ties (
  id             text PRIMARY KEY,
  from_entry_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  to_entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  rel            text NOT NULL,
  -- F7 list-divergence scope: NULL = universe canon; non-NULL = book-only facet
  -- tie. STAYS nullable (never enforced).
  book_id        text REFERENCES books(id)
);

-- chapter_appearances: id, entryId, chapter, text, flag, flagText
CREATE TABLE chapter_appearances (
  id         text PRIMARY KEY,
  entry_id   text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  chapter    integer NOT NULL,
  text       text NOT NULL,
  flag       text CHECK (flag IN ('red', 'yellow')),
  flag_text  text,
  sort_order integer NOT NULL DEFAULT 0,
  -- F7: the book whose Chapter `chapter` this appearance belongs to. Two books
  -- can each have a "Chapter 1", so (entry_id, chapter) is ambiguous across books
  -- and the book must be carried explicitly. NOT NULL as of the S1b CONTRACT phase.
  book_id    text NOT NULL REFERENCES books(id)
);

-- open_questions: id, entryId, text, sortOrder
CREATE TABLE open_questions (
  id          text PRIMARY KEY,
  entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  text        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

-- chapters: id, number, title, body (ProseMirror JSON)
-- `number` is the natural key the app looks chapters up by within a book
-- (getChapter/saveChapterBody WHERE number=$1 scoped to a book, getNextChapterNumber
-- MAX(number)+1 WHERE book_id=$1).
-- F7 CONTRACT (S1b): uniqueness is per-book UNIQUE(book_id, number) — each book
-- restarts at Chapter 1 — NOT a global UNIQUE(number). `number` stays NOT NULL.
-- book_id is NOT NULL as of S1b (f7a stamped every chapter to book-1). The
-- table-level UNIQUE also creates the supporting index for the per-book hot-path
-- lookups (getChapter/saveChapterBody) that grow with the book.
CREATE TABLE chapters (
  id      text PRIMARY KEY,
  number  integer NOT NULL,
  title   text NOT NULL,
  body    jsonb NOT NULL,
  book_id text NOT NULL REFERENCES books(id),
  UNIQUE (book_id, number)
);

-- entry_facets: sparse per-book SCALAR override of an entry. A row exists only
-- when a book diverges from canon on a scalar field; the merged book view is
-- COALESCE(facet.field, entry.field). A NULL column = no override for that field
-- in that book. PK(entry_id, book_id) = at most one facet row per entry per book.
CREATE TABLE entry_facets (
  entry_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  book_id   text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name      text,
  summary   text,
  note      text,
  PRIMARY KEY (entry_id, book_id)
);

-- TCK-PLOT (plotlines reuse-wiki, Option A): the two edge junctions. A plotline is
-- an entries row of kind 'plotline'; the ONLY net-new storage is these edges. Both
-- mirror the world_entities junction convention: text FKs, ON DELETE CASCADE, no
-- soft-delete column (a junction is a pure edge that dies with either endpoint; the
-- plotline entry's own soft-delete lives on entries.deleted_at). Created AFTER
-- chapters + entries so both FKs resolve. Live-DB path: plot-plotlines-expand.mts.
--
-- chapter_plotlines: the per-chapter tag / neglect spine. `summary` = the per-beat
-- note (what the chapter did to the arc); '' for a bare tag. chrono_order/chronology
-- carry STORY-TIME position (distinct from the chapter's READING position) so a
-- plotline's beats can be sorted by when they actually happen — flashbacks and loop
-- stories read out of chronological order. chrono_order = sortable rank (0 = unset,
-- falls back to chapter order); chronology = human label (e.g. "2020-05-08 (loop 1)").
CREATE TABLE chapter_plotlines (
  chapter_id   text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  plotline_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  summary      text NOT NULL DEFAULT '',
  chrono_order integer NOT NULL DEFAULT 0,
  chronology   text NOT NULL DEFAULT '',
  PRIMARY KEY (chapter_id, plotline_id)
);

-- entry_plotlines: a character (or any entry) OWNS an arc; BOTH ends FK entries(id)
-- (the one-graph model). No row for a plotline = a standalone world-level arc.
CREATE TABLE entry_plotlines (
  entry_id     text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  plotline_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, plotline_id)
);

-- research_threads: id, title, subtitle, sortOrder, scope (Gemini-style thread
-- list). `scope` decides the wiki context the AI sees: 'chat' = none (broad),
-- a wiki kind = all entries of that kind (F4-P2).
CREATE TABLE research_threads (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  subtitle    text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  scope       text NOT NULL DEFAULT 'chat'
    CHECK (scope IN ('chat', 'character', 'world', 'organization', 'lore')),
  -- F7: a universe is a canon; research sees that universe's wiki. NOT NULL as of
  -- the S1b CONTRACT phase (f7a stamped every existing thread to universe-1).
  universe_id text NOT NULL REFERENCES universes(id),
  -- T-RESEARCH-2: a thread is grounded in ONE world (not just its universe), so
  -- the AI's gazetteer is that world's linked entries via loadWorldSnapshot. NOT
  -- NULL: a null would silently fall back to the default world (the exact bug this
  -- fixes). Fresh dbs seed world_id directly; the live-DB add+backfill+SET NOT NULL
  -- lives in migrations/research-world-expand.mts (mirrors w6a). ON DELETE CASCADE:
  -- deleting a world takes its threads (and their turns) with it.
  world_id text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE
);

-- research_turns: id, threadId, ordinal, side, who, text
CREATE TABLE research_turns (
  id         text PRIMARY KEY,
  thread_id  text NOT NULL,
  ordinal    integer NOT NULL,
  side       text NOT NULL CHECK (side IN ('them', 'you')),
  who        text NOT NULL,
  text       text NOT NULL
);

-- propositions: id, turnId, kind, title, body, asKind
CREATE TABLE propositions (
  id       text PRIMARY KEY,
  turn_id  text NOT NULL REFERENCES research_turns(id) ON DELETE CASCADE,
  kind     text NOT NULL,
  title    text NOT NULL,
  body     text NOT NULL,
  as_kind  text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- kept_cards: propositionId PK, keptAt, inWiki
CREATE TABLE kept_cards (
  proposition_id  text PRIMARY KEY REFERENCES propositions(id) ON DELETE CASCADE,
  kept_at         bigint NOT NULL,
  in_wiki         boolean NOT NULL DEFAULT false
);

-- resolved_marks: markKey PK, resolution, resolvedAt
CREATE TABLE resolved_marks (
  mark_key     text PRIMARY KEY,
  resolution   text NOT NULL,
  resolved_at  bigint NOT NULL
);

-- dismissed_suggestions: suggestionKey PK
CREATE TABLE dismissed_suggestions (
  suggestion_key  text PRIMARY KEY
);

-- phrase_mentions: a book-wide index of candidate phrases per chapter, used by
-- the check engine to rank an unrecorded mark by CROSS-CHAPTER recurrence (a
-- phrase the author leans on across several chapters is more likely important).
-- Refreshed on every chapter save (see saveChapterBody). `count` is the number
-- of times the phrase occurs in that one chapter; the engine sums / counts
-- chapters across rows. RANKING data only, never gates a mark.
CREATE TABLE phrase_mentions (
  phrase          text NOT NULL,
  chapter_number  integer NOT NULL,
  count           integer NOT NULL DEFAULT 1,
  PRIMARY KEY (phrase, chapter_number)
);

-- chapter_check_cache (T-AICACHE): persists the LAST AI cross-check result per
-- chapter so the Write rail rehydrates instantly on open instead of re-firing the
-- (network) AI call every navigation. body_hash + wiki_hash are the invalidation
-- signal: the row is FRESH only while BOTH still match the chapter's current body
-- and the wiki snapshot the AI last saw; a mismatch on either re-runs the AI.
-- Deterministic marks are NOT cached (cheap, re-derived every load) — only the
-- expensive AI Mark[] (jsonb). One row per chapter (PK) so ON DELETE CASCADE
-- cleans it with the chapter. Runtime cache only: starts empty, never seeded.
CREATE TABLE chapter_check_cache (
  chapter_id  text PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  body_hash   text NOT NULL,
  wiki_hash   text NOT NULL,
  marks       jsonb NOT NULL,
  checked_at  bigint NOT NULL
);

-- Indexes for the reads the screens need.
CREATE INDEX idx_entries_shelf_sort       ON entries (shelf, sort_order);
CREATE INDEX idx_entries_kind             ON entries (kind);
CREATE INDEX idx_facts_entry              ON facts (entry_id, sort_order);
CREATE INDEX idx_ties_from                ON ties (from_entry_id);
CREATE INDEX idx_ties_to                  ON ties (to_entry_id);
CREATE INDEX idx_appearances_entry        ON chapter_appearances (entry_id, chapter, sort_order);
CREATE INDEX idx_open_questions_entry     ON open_questions (entry_id, sort_order);
CREATE INDEX idx_research_turns_thread    ON research_turns (thread_id, ordinal);
CREATE INDEX idx_propositions_turn        ON propositions (turn_id, sort_order);
-- F7 scope indexes (mirror the ALTER-path indexes in f7a-worlds-expand.mts).
CREATE INDEX idx_entries_universe          ON entries (universe_id);
CREATE INDEX idx_chapters_book             ON chapters (book_id);
CREATE INDEX idx_appearances_book_chapter  ON chapter_appearances (book_id, chapter);
CREATE INDEX idx_research_threads_universe ON research_threads (universe_id);
CREATE INDEX idx_facts_book                ON facts (book_id);
CREATE INDEX idx_ties_book                 ON ties (book_id);
CREATE INDEX idx_books_world               ON books (world_id);
-- F9-B: category header ordering (shelf grouping + sort_order).
CREATE INDEX idx_categories_sort           ON categories (sort_order, id);
-- W-1 (world-model epic): world-by-universe (tree read) + membership reverse
-- lookup (which worlds is this entity in — W-3/W-4 read path).
CREATE INDEX idx_worlds_universe           ON worlds (universe_id);
CREATE INDEX idx_world_entities_entity     ON world_entities (entity_id);
-- TCK-PLOT reverse lookups: PKs already index the leading column, so only the
-- trailing plotline_id side is net-new ("which chapters/entries touch this arc").
CREATE INDEX idx_chapter_plotlines_plotline ON chapter_plotlines (plotline_id);
CREATE INDEX idx_entry_plotlines_plotline   ON entry_plotlines (plotline_id);
