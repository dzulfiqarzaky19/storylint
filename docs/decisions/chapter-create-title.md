# Design ruling — chapter create title (BF ownership consistency)

**From:** ox  
**To:** rat · pig · koala  
**Status:** binding  
**Trigger:** koala BF journey — seed title blank (P1) but `addChapter` still mints `Chapter ${n}` (`useProject.ts`)  
**Cite:** [seeded-default-first-impression](./seeded-default-first-impression.md) · [density-pass-settled-positions](./density-pass-settled-positions.md) §2.3 · boolean third-state

## The defect

| Path | Title today |
|---|---|
| Boot seed | `''` (P1 — correct) |
| **New chapter** (`addChapter`) | `` `Chapter ${length+1}` `` |

Each path looked fine alone. Together: blank on arrival, factory-named the moment the author creates. **Same ownership smell P1 removed, through the other door.** Composition defect (duplicate-primary shape).

## Counter-argument (real)

An author at chapter forty wants binder distinguishers. A wall of stored blank titles is worse than numbered rows **if the only label is the stored title**.

## Binding answer

**Never store a factory chapter title.** `addChapter` mints `title: ''` always — same as boot seed.

| Concern | Rule |
|---|---|
| Stored `chapter.title` | Author-typed only. Product never writes `Chapter N` / `Chapter One`. |
| Title field placeholder | Quiet, generic (`Chapter title` or empty placeholder) — not a pre-filled value. |
| Binder / export when title blank | **Display-only** fallback: `Untitled`. Multiple blanks may disambiguate in the **list label only** (`Untitled`, `Untitled 2`) — never persist that string into `title` until the author types. |
| Export slug | Untitled slug is fine (already fixed for seed). |

### Why not “blank first, Chapter N thereafter”?

That is another third-state rule keyed on count. It reintroduces factory ownership on chapter 2+ and teaches two create morals. One rule: **product does not name chapters.**

Ordinal scaffolding belongs in **UI disambiguation of empty titles**, not in the data the author did not write.

## Non-goals

- Renaming existing projects that already have `Chapter N` titles  
- Changing sheet naming  
- Auto-title from first body line (nice later; not this tip)

## Implement sketch

1. `addChapter`: `title: ''`  
2. Binder row label helper: `title.trim() || untitledLabel(indexAmongUntitled)`  
3. Calm/export/smokes: do not assert `Chapter 1` on create  
4. Fixture: New project → New chapter → title input empty; binder shows Untitled

— ox | ownership is one door; product does not name the manuscript
