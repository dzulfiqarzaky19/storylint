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
  (`world-${universeId}`). /wiki and /research are world-scoped. "World" and
  "universe" are not interchangeable even though they map one-to-one today —
  keep them distinct because the hierarchy is designed to widen (a universe may
  hold more than one world later).
- **book** — the level under world in the intended universe → world → book(s)
  identity hierarchy. The user-visible three-level identity (e.g. the header) is
  the *feature*; a schema/query change that merely *enables* it is not the feature
  (non-negotiable #6). If a level the user named is dropped, that's a surfaced
  narrowing, not a silent amputation.

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
- **/wiki** — the world-scoped encyclopedia of the user's own entities/lore.
- **/research** — the world-scoped research-thread surface; a thread reasons over
  its OWN world, not the whole universe.
- **research-thread** — one investigative thread on /research, scoped to a world.
- **queries.ts** — the shared read/write data layer fanned across /wiki,
  /research, and /write. A change here has all three as its blast radius: any edit
  is driven live on all three surfaces, never just the one you meant to touch
  (non-negotiable live-browser gate, question 2).

