# src map — four pages we own

Law for **every page we own**, not a wiki dump.

Pages: **wiki**, **write**, **research**, **plot**. Fifth when it exists: **wiki-manage**. Same buckets. Same owner rule. Do not invent that folder until the page exists.

Read this file before any split, move, or new file under `src/`. ADR-0002. Owner / drill / slot tests: `.claude/skills/codebase-design/FOLDERS.md` + ADR-0001.

## Buckets

```
src/
  app/            route only — one folder per page
    wiki/
    write/
    research/
    plot/

  features/       the page we own — one folder per page
    wiki/
    write/
    research/
    plot/

  components/     shared across pages (global UI)
    ui/           primitives only (button, dropdown, Modal)
    GlobalModal.tsx
    GlobalModal/  only if that component has children
      GlobalModal.tsx
      GlobalModalHeader.tsx

  lib/            shared across pages (global non-UI)
    consts/
    types/
    utils/

  hooks/          shared across pages (global hooks)
```

`app/<page>` mounts. `features/<page>` is the screen. Route file stays thin.

## Copy the bags below any owner

These four names are a **kit**. Same shape at `src/` and **inside any owner folder** that needs them. Do not invent a fifth bag. Do not rename `consts`.

```
components/
hooks/
lib/
  consts/
  types/
  utils/
```

| Where | Scope |
|---|---|
| `src/components` `src/hooks` `src/lib/{consts,types,utils}` | two or more pages |
| `features/<page>/components` (same for hooks, lib) | only that page |
| `features/<page>/Sidebar/components` (same for hooks, lib) | only that owner |

Copy **below**. Wiki may have `hooks/`. Sidebar may have `hooks/`. EntryDetail may have `lib/consts/`. Same kit, tighter owner.

**No file → no folder.** No util function → no `utils/`. No hook → no `hooks/`. No extra UI → no `components/`. No const → no `consts/`. No type file → no `types/`. No `consts`/`types`/`utils` → no `lib/`. Same at `src/` and inside every owner. Do not mkdir the kit "for later."

`src/components/ui` is primitives only. Header, pickers, page chrome are not primitives. Two pages share chrome → `src/components/Name.tsx` (or `Name/` if it has children), not `ui/`.

One page → stay in that feature. Do not put a wiki-only module in `src/components`. Do not put a write-only hook in `src/hooks`.

## Where does this file go?

Ask in this order. Do not skip. Do not park at Wiki because you only opened wiki.

1. **What is it?** UI → `components/`. React hook → `hooks/`. Plain function / fetch / AI → `lib/` as a **named file**. Glyph (trash, edit, chevron) → `src/components/ui`. Shared chrome (InlineText, Header) → `src/components`, **not** `ui/`.

   **Fetch is not a util. AI is not a util.** `lib/utils/` is only generic helpers (trim, debounce, format). A wiki fetch goes in `features/wiki/lib/`, not `lib/utils/`. One call, one owner → join that owner file; do not extract a `lib/` until a second caller exists.
2. **Who calls it?** List every parent. One parent → that parent's file, or that parent's kit copy. Two+ parents → **nearest common owner**, then that owner's kit copy.
3. **How wide?** That owner is one island → stay. Two islands on **one** page → that page (or that nested owner) kit. Two+ **pages** → `src/components` / `src/hooks` / `src/lib`.
4. **No file → no folder.**

Nearest common owner is **not** always the page:

| Callers | Nearest owner | Where |
|---|---|---|
| Sidebar **and** CategoryList (New Category) | Wiki | `features/wiki/components` |
| Details **and** Ties (Suggest, InlineText if wiki-only) | EntryDetail | `features/wiki/Main/EntryDetail/components` |
| Suggest AI function | EntryDetail | `features/wiki/Main/EntryDetail/lib` |
| Suggest hook | EntryDetail | `features/wiki/Main/EntryDetail/hooks` |
| InlineText on wiki **and** research **and** plot | international | `src/components/InlineText.tsx` |
| Trash / edit icon | primitive | `src/components/ui` |

Do not write it twice. Do not park under one parent (the other would import a grandchild). Do not lift to Wiki when EntryDetail already owns both callers. Do not lift to `src/` until a second page uses it. Do not dump chrome in `ui/`.

## Feature owner

Folder name = the page. Owner file = same name so you know who owns the folder.

```
features/wiki/
  Wiki.tsx                 ← owner
  Sidebar.tsx              ← no children → file
  Sidebar/                 ← has children → folder
    Sidebar.tsx
    SidebarEntries.tsx
    SidebarDelete.tsx
    hooks/                 ← only if Sidebar has a hook
  Main/ …
  lib/                     ← only if Wiki has consts/types/utils files
    consts/
```

Same pattern for `write/`, `research/`, `plot/`, and later `wiki-manage/`.

- No children → **file** (`Sidebar.tsx`).
- Has children → **folder** (`Sidebar/Sidebar.tsx` + those children).
- Child names tell the parent: `SidebarEntries` and `SidebarDelete` are children of Sidebar, siblings of each other.
- Bags inside an owner are **that owner's copy**. Not global.

## Look at the glass

Name files for what the writer sees, not for widgets (`Band`, `Screen`, `Index`). Parent JSX names the children. A strip that is a heading of a list lives **inside that list's folder**, not as a sibling of Main.

Wiki instance of this law (glass, not a second architecture):

```
features/wiki/
  Wiki.tsx
  Sidebar/
    Sidebar.tsx
    SidebarEntries.tsx
    SidebarDelete.tsx
  Main/
    Main.tsx
    EntryDetail/
      EntryDetail.tsx
      Profile.tsx
      Overview.tsx
      Timeline.tsx
      Details.tsx
      Ties.tsx
    CategoryList/
      CategoryList.tsx
      World.tsx          ← heading strip; child of CategoryList, not of Main
    Suggestions.tsx
  components/
    NewCategory.tsx      ← Sidebar + CategoryList both use it; one file
```

Write / research / plot / wiki-manage: same owner rule. Different glass. Do not copy the wiki tree onto them.

## Forbidden

- Copy-paste old files into new folders and call it the split.
- Park a grandchild as a sibling of Main / Wiki / the page so the tree looks flat.
- Pre-create empty `Sidebar/`, empty `hooks/`, empty `lib/` “for later.”
- Treat this file as wiki-only. Four pages. Five when wiki-manage exists.
