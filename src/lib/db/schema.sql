-- Ashkeld schema (Postgres). Deliberately portable:
--   text primary keys, timestamps as bigint epoch millis, snake_case columns.
-- 12 tables from HANDOFF §5. Drop in dependency order, recreate with FKs + indexes.

DROP TABLE IF EXISTS phrase_mentions CASCADE;
DROP TABLE IF EXISTS dismissed_suggestions CASCADE;
DROP TABLE IF EXISTS resolved_marks CASCADE;
DROP TABLE IF EXISTS kept_cards CASCADE;
DROP TABLE IF EXISTS propositions CASCADE;
DROP TABLE IF EXISTS research_turns CASCADE;
DROP TABLE IF EXISTS research_threads CASCADE;
DROP TABLE IF EXISTS chapters CASCADE;
DROP TABLE IF EXISTS open_questions CASCADE;
DROP TABLE IF EXISTS chapter_appearances CASCADE;
DROP TABLE IF EXISTS ties CASCADE;
DROP TABLE IF EXISTS facts CASCADE;
DROP TABLE IF EXISTS entries CASCADE;

-- entries: id, kind, name, catalogueNo, note, summary, shelf, sortOrder
CREATE TABLE entries (
  id            text PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('character', 'world', 'organization', 'lore')),
  name          text NOT NULL,
  catalogue_no  text NOT NULL,
  note          text NOT NULL DEFAULT '',
  summary       text NOT NULL DEFAULT '',
  shelf         text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0
);

-- facts: id, entryId, key, value, fresh, sortOrder
CREATE TABLE facts (
  id          text PRIMARY KEY,
  entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  fresh       boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0
);

-- ties: id, fromEntryId, toEntryId, rel (directional; seeded both ways)
CREATE TABLE ties (
  id             text PRIMARY KEY,
  from_entry_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  to_entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  rel            text NOT NULL
);

-- chapter_appearances: id, entryId, chapter, text, flag, flagText
CREATE TABLE chapter_appearances (
  id         text PRIMARY KEY,
  entry_id   text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  chapter    integer NOT NULL,
  text       text NOT NULL,
  flag       text CHECK (flag IN ('red', 'yellow')),
  flag_text  text,
  sort_order integer NOT NULL DEFAULT 0
);

-- open_questions: id, entryId, text, sortOrder
CREATE TABLE open_questions (
  id          text PRIMARY KEY,
  entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  text        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

-- chapters: id, number, title, body (ProseMirror JSON)
CREATE TABLE chapters (
  id      text PRIMARY KEY,
  number  integer NOT NULL,
  title   text NOT NULL,
  body    jsonb NOT NULL
);

-- research_threads: id, title, subtitle, sortOrder (Gemini-style thread list).
CREATE TABLE research_threads (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  subtitle    text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0
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
