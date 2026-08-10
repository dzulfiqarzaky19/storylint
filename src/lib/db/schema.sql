-- Ashkeld schema (Postgres). Deliberately portable:
--   text primary keys, timestamps as bigint epoch millis, snake_case columns.
-- 13 tables from HANDOFF §5 (+ category_labels, F6). Drop in dependency order, recreate with FKs + indexes.

DROP TABLE IF EXISTS category_labels CASCADE;
DROP TABLE IF EXISTS phrase_mentions CASCADE;
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
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS series CASCADE;
DROP TABLE IF EXISTS universes CASCADE;

-- F7 worlds hierarchy: Universe owns the wiki; Series groups Books; Book owns
-- Chapters. Created FIRST so the scope FKs below can reference them. These are
-- STRUCTURAL tables (not wiki content) — no confirmWikiWrite token gates them.
CREATE TABLE universes (
  id    text PRIMARY KEY,
  name  text NOT NULL
);

CREATE TABLE series (
  id           text PRIMARY KEY,
  universe_id  text NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  name         text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0
);

CREATE TABLE books (
  id          text PRIMARY KEY,
  series_id   text NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

-- entries: id, kind, name, catalogueNo, note, summary, shelf, sortOrder.
-- deleted_at: soft-delete marker (epoch millis). NULL = live; non-NULL = "deleted"
-- but the ROW stays so ON DELETE CASCADE on child tables never fires and every
-- referencing fact/tie/appearance/question survives as a dangling tombstone.
CREATE TABLE entries (
  id            text PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('character', 'world', 'organization', 'lore')),
  name          text NOT NULL,
  catalogue_no  text NOT NULL,
  note          text NOT NULL DEFAULT '',
  summary       text NOT NULL DEFAULT '',
  shelf         text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  deleted_at    bigint,
  -- F7: the universe (canon) this entry belongs to. Nullable in the S1a EXPAND
  -- shape (matches a just-migrated live DB pre-contract); S1b enforces NOT NULL.
  universe_id   text REFERENCES universes(id)
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
  -- and the book must be carried explicitly. Nullable in S1a; NOT NULL in S1b.
  book_id    text REFERENCES books(id)
);

-- open_questions: id, entryId, text, sortOrder
CREATE TABLE open_questions (
  id          text PRIMARY KEY,
  entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  text        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

-- chapters: id, number, title, body (ProseMirror JSON)
-- `number` is UNIQUE: it is the natural key the app looks chapters up by
-- (getChapter/saveChapterBody WHERE number=$1, getNextChapterNumber MAX(number)+1).
-- UNIQUE both prevents duplicate chapter numbers (a correctness hole: getChapter's
-- one<>() would silently take rows[0], and concurrent createChapter could mint the
-- same MAX+1) AND auto-creates the supporting index that turns those hot-path
-- lookups from seq-scans into index probes as the book grows.
-- F7: `book_id` is nullable in the S1a EXPAND shape (matches a just-migrated live
-- DB pre-contract). `number` keeps the OLD global UNIQUE here in S1a; S1b flips it
-- to UNIQUE(book_id, number) so each book restarts at Chapter 1.
CREATE TABLE chapters (
  id      text PRIMARY KEY,
  number  integer NOT NULL UNIQUE,
  title   text NOT NULL,
  body    jsonb NOT NULL,
  book_id text REFERENCES books(id)
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
  -- F7: a universe is a canon; research sees that universe's wiki. Nullable in
  -- S1a; NOT NULL in S1b.
  universe_id text REFERENCES universes(id)
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

-- category_labels: per-kind display-name override. kind is the fixed entry enum;
-- label is what the shelf/category header renders (reads coalesce label ?? default).
-- Independent table (no FK to entries): renaming a category never touches entries.
CREATE TABLE category_labels (
  kind   text PRIMARY KEY
         CHECK (kind IN ('character', 'world', 'organization', 'lore')),
  label  text NOT NULL
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
CREATE INDEX idx_series_universe           ON series (universe_id);
CREATE INDEX idx_books_series              ON books (series_id);
