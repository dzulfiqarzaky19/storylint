# CONTEXT — storylint ubiquitous language

Glossary-only. One term, one crisp definition. Not a decisions log (that's
`docs/`), not architecture notes. Tracked and shared by every agent + the user, so
we all mean the same thing by the same word. Lazy: add a term the moment a second
agent could plausibly misread it. Discipline that maintains this file lives in
`.claude/skills/domain-modeling`.

## Product soul

- **recall (not ghostwriter)** — storylint's core stance: the AI is *memory and
  recall* over the writer's own world (surfacing continuity marks, contradictions,
  forgotten facts), never a **ghostwriter** that generates prose in the author's
  voice. Any feature that writes story text *for* the user violates the soul; a
  feature that helps the user remember or check their own world honors it. This is
  a terminology claim, so it is load-bearing, not marketing.

## Scope hierarchy

- **universe** — the top-level container a user selects (via `?u=` in the URL). The
  active universe is the source of truth for scope; everything below is derived
  from it.
- **world** — the scope one level under a universe, derived **1:1** from it
  (`world-${universeId}`). /wiki, /research, and /plot are world-scoped. "World"
  and "universe" are not interchangeable even though they map one-to-one today —
  keep them distinct because the hierarchy is designed to widen (a universe may
  hold more than one world later).
- **book** — the level under world in the intended universe → world → book(s)
  identity hierarchy. The user-visible three-level identity (e.g. the header) is
  the *feature*; a schema/query change that merely *enables* it is not the feature
  (non-negotiable #6). If a level the user named is dropped, that's a surfaced
  narrowing, not a silent amputation.

## Wiki nouns

- **gazetteer** — the wiki as the author's recorded canon of entities. The
  user-facing name for /wiki ("Back to the gazetteer"). Not the research helper
  `buildGazetteer()`.
- **entry** — one wiki entity (person, place, order, lore, or plotline). Row in
  `entries`. Soft-deleted (`deleted_at`); child facts/ties/appearances survive
  as tombstones.
- **fact** — a key/value detail on one entry (`facts`).
- **tie** — a named directional relationship from one entry to another (`ties`).

## Manuscript

- **chapter** — one manuscript unit of a book (`chapters`): number, title,
  ProseMirror body. Unique per book (`UNIQUE(book_id, number)`), not globally —
  two books can each have a Chapter 1.

## Marks and checking

- **mark** — a single agent-surfaced finding on one span of manuscript prose (a
  continuity issue, contradiction, missing entity, new entity). The `Mark` type is
  the unit the manuscript renders as a left-index dot and the sidebar lists.
- **severity** — a mark's rank, and the derived per-chapter left-index dot. A
  chapter's dot is the single strongest severity among its marks; **conflict beats**
  lower severities (`chapterSeverity`, `src/lib/check/severity.ts`). A dot renders
  only when the chapter has a severity AND it is not suppressed by the two-guard
  active-chapter rule — both guards are load-bearing, don't collapse them.
- **deterministic mark vs. AI mark** — marks come from two sources: the
  deterministic checker (rule-based, reproducible) and the AI checker (model-
  surfaced). `mergeMarks(deterministic, ai)` combines them and **deterministic wins
  on collision** (`src/lib/check/ai.ts`) — the reproducible source is authoritative
  when both flag the same span.
- **freshness / hash gate** — the resolver reuses a single `hashValue` over the
  wiki snapshot to decide whether a chapter's cached AI marks are still valid; a
  hash change means stale, so re-check (`src/lib/check/resolve.ts`). The resolver
  *only* decides freshness and merges — it does not itself run the checker.

## Surfaces

- **/write** — the manuscript editor; renders marks inline as left-index dots +
  sidebar.
- **/wiki** — the world-scoped gazetteer of the author's own entries.
- **/research** — the world-scoped research-thread surface; a thread reasons over
  its OWN world, not the whole universe.
- **/plot** — the fourth top-level surface, a peer of wiki / research / write.
  World-scoped. Read-only grid of plotlines × chapters. Answers "has this arc
  moved?" and "is it finished?" — questions the wiki cannot. Does not generate
  prose.
- **plotline** — a wiki entry of kind `plotline`. One lane on /plot. Not a
  separate table.
- **beat** — one chapter advancing one plotline (a filled /plot grid cell).
- **research-thread** — one investigative thread on /research, scoped to a world.
- **queries.ts** — the shared read/write data layer fanned across /wiki,
  /research, /write, and /plot. A change here has all four as its blast radius:
  any edit is driven live on every surface that reads it, never just the one you
  meant to touch (non-negotiable live-browser gate, question 2). Load `/codescratch`, then
  `codescratch explore` before editing.

## Chrome

Three unrelated things were all called "rail" until this entry existed — a comment
in `src/lib/check/index.ts` already warns about one of the collisions. Never say
"rail" unqualified.

- **index rail** — the LEFT standing index on /wiki, /write and /research: a mono
  uppercase title + count, an optional filter, a scrolling per-surface list, and
  below 1200px a chevron disclosure. The **wrapper is shared**
  (`components/shell/IndexRail.tsx`); the **contents are per-surface** (entries /
  chapters / threads). **/plot has no index rail** — its prototype uses a modal
  drill-down `drawer` instead, so plot is deliberately outside this seam.
  The component is `IndexRail`, never `Rail`, because of the collisions below.
- **signal rail** — the RIGHT panel that surfaces findings: `OutstandingRail` on
  /write, `KeptBoard` on /research, `PosterBand` on /wiki. Unrelated to the index
  rail; shares none of its chrome.
- **`Mark.rail`** — neither of the above. A *string field* on `Mark` holding the
  short reason shown beside a mark. Distinct again from `railLabel`, which is the
  kind LABEL rendered above that reason.

## Design source

- **cockpit prototype** — one standalone HTML file per surface in `prototypes/`
  (`wiki-c-cockpit.html`, `research-c-cockpit.html`, `write-c-cockpit.html`,
  `plot-c-cockpit.html`), each the **binding visual and interaction reference**
  for its same-named surface. Explicitly **not** a throwaway in the sense the
  `prototype` skill means — that skill's "commit to a branch, out of main" rule
  does not apply here. These are the app's one look (`globals.css` tokens are
  derived from them) and stay the reference until a surface is fully ported.
  Every control in them is faked in-page on purpose ("no backend, so a porting
  agent sees every control"), so a prototype control is evidence of **intent**,
  never evidence that a backend exists.

