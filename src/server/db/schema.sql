-- Source of truth for the database. `npm run db:reset` runs this file, which
-- drops everything and recreates it. There are no migrations.
--
-- Conventions:
--   * ids are text, minted by the app (crypto.randomUUID) or fixed by the seed.
--   * a foreign key that means "owned by" is ON DELETE CASCADE, so a row always
--     dies with its parent and nothing is left orphaned.
--   * every foreign key column is named <thing>_id and is indexed.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- ---------------------------------------------------------------------------
-- Structure: universe -> world -> book
-- ---------------------------------------------------------------------------

CREATE TABLE universes (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE worlds (
  id           text PRIMARY KEY,
  universe_id  text NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  name         text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0
);
CREATE INDEX worlds_universe_id_idx ON worlds (universe_id, sort_order);

CREATE TABLE books (
  id          text PRIMARY KEY,
  world_id    text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);
CREATE INDEX books_world_id_idx ON books (world_id, sort_order);

-- ---------------------------------------------------------------------------
-- Gazetteer: the writer's recorded canon
-- ---------------------------------------------------------------------------

-- Global, not per world. Built-in rows are never deleted; user rows are
-- soft-deleted, so entries.category_id always resolves.
CREATE TABLE categories (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  shelf       text NOT NULL CHECK (shelf IN ('people', 'places', 'orders', 'lore', 'plots')),
  sort_order  integer NOT NULL DEFAULT 0,
  is_builtin  boolean NOT NULL DEFAULT false,
  deleted_at  timestamptz
);

INSERT INTO categories (id, label, shelf, sort_order, is_builtin) VALUES
  ('character',    'People',    'people', 0, true),
  ('world',        'Places',    'places', 1, true),
  ('organization', 'Orders',    'orders', 2, true),
  ('lore',         'Lore',      'lore',   3, true),
  ('plotline',     'Plotlines', 'plots',  4, true);

-- An entry belongs to a universe and is visible in the worlds it is linked to
-- (world_entries). `shelf` is where the entry is filed; the writer can drag an
-- entry to another shelf, so it is not derivable from the category.
-- Soft-deleted: the row stays so its facts and ties survive until purged.
CREATE TABLE entries (
  id            text PRIMARY KEY,
  universe_id   text NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  category_id   text NOT NULL REFERENCES categories(id),
  name          text NOT NULL,
  catalogue_no  text NOT NULL DEFAULT '',
  note          text NOT NULL DEFAULT '',
  summary       text NOT NULL DEFAULT '',
  shelf         text NOT NULL CHECK (shelf IN ('people', 'places', 'orders', 'lore', 'plots')),
  sort_order    integer NOT NULL DEFAULT 0,
  deleted_at    timestamptz
);
CREATE INDEX entries_universe_id_idx ON entries (universe_id);
CREATE INDEX entries_category_id_idx ON entries (category_id);
CREATE INDEX entries_shelf_idx ON entries (shelf, sort_order);

CREATE TABLE world_entries (
  world_id  text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  entry_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY (world_id, entry_id)
);
CREATE INDEX world_entries_entry_id_idx ON world_entries (entry_id);

CREATE TABLE facts (
  id          text PRIMARY KEY,
  entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  fresh       boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0
);
CREATE INDEX facts_entry_id_idx ON facts (entry_id, sort_order);

CREATE TABLE ties (
  id             text PRIMARY KEY,
  from_entry_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  to_entry_id    text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  rel            text NOT NULL
);
CREATE INDEX ties_from_entry_id_idx ON ties (from_entry_id);
CREATE INDEX ties_to_entry_id_idx ON ties (to_entry_id);

-- ---------------------------------------------------------------------------
-- Manuscript
-- ---------------------------------------------------------------------------

CREATE TABLE chapters (
  id       text PRIMARY KEY,
  book_id  text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  number   integer NOT NULL,
  title    text NOT NULL,
  body     jsonb NOT NULL,
  UNIQUE (book_id, number)
);

-- ---------------------------------------------------------------------------
-- Plot: a plotline is an entry of category 'plotline'
-- ---------------------------------------------------------------------------

-- One chapter advancing one plotline.
CREATE TABLE beats (
  chapter_id   text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  plotline_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  summary      text NOT NULL DEFAULT '',
  PRIMARY KEY (chapter_id, plotline_id)
);
CREATE INDEX beats_plotline_id_idx ON beats (plotline_id);

-- Which entry (usually a character) a plotline belongs to.
CREATE TABLE entry_plotlines (
  entry_id     text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  plotline_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, plotline_id)
);
CREATE INDEX entry_plotlines_plotline_id_idx ON entry_plotlines (plotline_id);

-- ---------------------------------------------------------------------------
-- Research: thread -> turn -> proposition (card)
-- ---------------------------------------------------------------------------

CREATE TABLE research_threads (
  id          text PRIMARY KEY,
  world_id    text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title       text NOT NULL,
  subtitle    text NOT NULL DEFAULT '',
  scope       text NOT NULL DEFAULT 'chat'
              CHECK (scope IN ('chat', 'character', 'world', 'organization', 'lore')),
  sort_order  integer NOT NULL DEFAULT 0
);
CREATE INDEX research_threads_world_id_idx ON research_threads (world_id, sort_order);

CREATE TABLE research_turns (
  id         text PRIMARY KEY,
  thread_id  text NOT NULL REFERENCES research_threads(id) ON DELETE CASCADE,
  ordinal    integer NOT NULL,
  side       text NOT NULL CHECK (side IN ('them', 'you')),
  who        text NOT NULL,
  text       text NOT NULL
);
CREATE INDEX research_turns_thread_id_idx ON research_turns (thread_id, ordinal);

-- kept_at NULL = not kept. A card can only be in the wiki once it is kept.
CREATE TABLE propositions (
  id          text PRIMARY KEY,
  turn_id     text NOT NULL REFERENCES research_turns(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  as_kind     text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  kept_at     timestamptz,
  in_wiki     boolean NOT NULL DEFAULT false,
  CHECK (NOT in_wiki OR kept_at IS NOT NULL)
);
CREATE INDEX propositions_turn_id_idx ON propositions (turn_id, sort_order);

-- ---------------------------------------------------------------------------
-- Check state: what the consistency checker has cached or been told to ignore
-- ---------------------------------------------------------------------------

CREATE TABLE chapter_check_cache (
  chapter_id  text PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  body_hash   text NOT NULL,
  wiki_hash   text NOT NULL,
  marks       jsonb NOT NULL,
  checked_at  timestamptz NOT NULL
);

-- How often a candidate phrase appears in a chapter. Rebuilt on every save.
CREATE TABLE phrase_mentions (
  chapter_id  text NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  phrase      text NOT NULL,
  count       integer NOT NULL DEFAULT 1,
  PRIMARY KEY (chapter_id, phrase)
);
CREATE INDEX phrase_mentions_phrase_idx ON phrase_mentions (phrase);

-- mark_key hashes the rule, quote and entry, so one "leave it" covers the same
-- finding in every chapter of the book.
CREATE TABLE resolved_marks (
  book_id      text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  mark_key     text NOT NULL,
  resolution   text NOT NULL,
  resolved_at  timestamptz NOT NULL,
  PRIMARY KEY (book_id, mark_key)
);

CREATE TABLE dismissed_suggestions (
  world_id        text NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  suggestion_key  text NOT NULL,
  PRIMARY KEY (world_id, suggestion_key)
);
