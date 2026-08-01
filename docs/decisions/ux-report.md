<!--
  Tracked decision record (moved from e2e/output/ux-report.md).
  Author: hamster
  Kind: review
  Decided: Full UX drive report; paint doctrine Kobo/brass not skill OLED
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# UX report

**Date:** 2026-07-31  
**Verdict:** request changes  
**Drives:** `node e2e/ux-drive.mjs` · `node e2e/ux-drive-graph.mjs` (fresh this session)  
**Progress:** `e2e/output/ux-progress.md` · `e2e/output/ux-graph-progress.md` · `e2e/output/ux-notes.json`  
**Skill:** local `.claude/skills/ui-ux-pro-max` (structure/a11y only — **paint = docs/design/TOKENS.md**)

### Skill note
`--design-system` suggested OLED slate + green CTA. **Ignore that paint.** Storylint doctrine is Kobo paper + brass/stone (`#C4A574` accent, charcoal primary). Skill still used for a11y, touch, density, nav, empty/loading, and graph readability checks.

---

## Jobs — shell

| Job | Result | Notes |
|-----|--------|-------|
| write → Saved | pass | Job1 OK; Saved indicator in topbar |
| Focus rails | pass | `data-focus=true`; binder/agent hidden |
| Continuity → Accept/Reject | **warn** | Fresh drive: 0 proposals after 20s (`shouldFix` in drive). Older drive + apply-card shot still show Accept/Edit/Reject cards — **fixture/race flaky**, not missing UI chrome |
| Co-write Apply | pass | body unchanged pre-Apply; Apply mutates body |
| Multi-project | pass | create/switch interacted |
| Research | pass | surface opened |
| Export | pass | download started |
| Seal/ribbon | pass | 1280 seal 44×44; 1440 ribbon 76 right-edge |
| No AI-blue / gen-in-MS | pass | accent `#c4a574`; no sky-blue; no gen chips in manuscript |

## Jobs — graph

| Job | Result | Notes |
|-----|--------|-------|
| Network empty (kinds off) | pass | calm empty + CTA copy; propose-edge form still available |
| Family empty | pass | sparse/empty OK |
| Network full multi-kind | **fail visual** | functional seed ≥6 nodes, but labels collide into unreadable pile (see Blockers) |
| Filter character/lore/world/org | pass | solo filters return expected non-empty counts |
| Pending edge hidden | pass | proposal not drawn as canon |
| Accept shows edge | pass | kinship edge/label after Accept |
| Family after kinship | pass | family stage after `parent_of` |
| Node opens sheet | pass | node → binder sheet |
| Narrow/phone family | **fail visual** | phone family labels effectively illegible (see Blockers) |

---

## ui-ux-pro-max checklist (Storylint-scoped)

### §1 Accessibility — mostly pass
| Check | Result | Evidence |
|-------|--------|----------|
| Focus rings | pass | `.ui-focusable:focus-visible` + bookmark focus; brass ring token |
| Skip link | pass | `Shell.tsx` → `Skip to workspace` → `#workspace` |
| Icon-only labels | pass | `IconButton` requires `label` / `aria-label` |
| Keyboard / aria | pass | graph nodes/edges labelled; drawers `aria-modal`; transcript `aria-label` |
| Reduced motion | pass | tokens + graph pointer parallax gated |
| Color-not-only | pass | proposal badges + text; Accept/Edit/Reject labelled |

### §2 Touch & interaction — pass with density caveats
| Check | Result | Evidence |
|-------|--------|----------|
| Desktop control 32 / coarse 44 | pass | `--size-control` + `@media (pointer: coarse)` |
| cursor-pointer | pass | buttons, list rows, bookmark, craft tags |
| Loading buttons | pass | Continuity `Running…` + disabled |
| Pressed/hover | pass | hover + `aria-pressed` on rails/modes |
| Craft-tag density on phone | should-fix | 8 chips stay full-row on 767 — competes with reading |

### §3–5 Layout / style / nav
| Check | Result | Evidence |
|-------|--------|----------|
| Token skin (not skill green) | pass | night canvas `#0E0E0E`, brass accent |
| Three-pane IDE + drawers | pass | desk rails; phone binder/agent drawers |
| Primary CTA clarity | should-fix | topbar packs title×2 + switcher + New + Export + breadcrumb + Graph + Continuity + 3 icon buttons |
| Responsive 767 / 1024 / 1280 / 1440 | pass jobs | seal vs ribbon correct |
| Network / Family readability | **blocker** | dense orbit labels overlap; phone family text ~unreadable |

### §8 Forms & feedback
| Check | Result | Evidence |
|-------|--------|----------|
| Empty states | pass | binder “None yet”; graph “No visible sheets…” + action hint |
| Agent tips empty | pass | “Start with one small step” + Dismiss |
| Proposal cards | pass | Accept / Edit / Reject near claim |
| Continuity reliability | should-fix | fresh drive empty outcome |

---

## PNGs read (4)

1. `ux-01-shell-default-desk.webp` — warm night shell OK; **duplicate project title** (h1 + select); agent tips good; paper clean  
2. `ux-16-width-767-phone.webp` — focus-ish phone manuscript readable; craft chips still dense; seal OK  
3. `ux-graph-03-network-full-all-kinds.webp` — **label collision / unreadable network**  
4. `ux-graph-13-family-phone.webp` — family tree present but **labels fail at phone width**  
(+ reference) `ux-10-apply-card.webp` — proposal cards + Apply gate chrome clear  

---

## Blockers
1. **Network graph label collision at real density** (`ux-graph-03`). Nodes stack; names/kinds overlap. Fails skill data-viz readability + “don’t rely on hover alone” for identity. Need truncation + title tooltip, collision avoidance, clustering, or “show labels on hover/selection only” above N nodes.  
2. **Phone family graph illegible** (`ux-graph-13`). Nodes shrink to ticks; names gone. Need phone layout: vertical tree, fewer generations, larger hit targets, label-below or list fallback.

## Should-fix
1. **Topbar IA / duplicate title** — `shell__project` h1 repeats `ProjectSwitcher` select value. Collapse to one identity control; move New/Export into overflow or project menu (skill: one primary CTA, overflow for excess).  
2. **Graph chrome hierarchy** — Network/Family (view) sits same weight as kind filters. Separate view toggle from filter chips.  
3. **Continuity flaky empty run** — drive WARN 0 proposals; UI path exists (apply-card). Stabilize fixture text + wait/ready signal so Continuity always surfaces cards or a clear “no issues” empty.  
4. **Phone craft-tag row** — wrap, horizontal scroll with fade, or collapse under “Tags” so manuscript measure stays first.  
5. **Smoke project titles** — `Project Smoke 1785…` / `K2 Parent 1785…` pollute hierarchy and graph labels; seed human names in dogfood fixtures so density bugs aren’t masked by UUID noise.

## Nits
1. Disabled **Send** is correctly dim; consider enabling only when composer has text (already) + stronger empty-composer helper.  
2. Agent panel stacks Continuity primary + many co-write actions — fine for power users; progressive disclosure (“More tools”) would calm first-run.  
3. Family phone still shows full “Propose new edge” form above the fold — demote under a disclosure when canvas is tiny.  
4. No shared `active:scale` press micro-interaction (skill optional); hover is enough for desk.  
5. Prior report noted `data-theme` null; **fresh drive samples `theme:"dark"`** — treat as fixed unless regression returns.

---

## Pass summary (keep)

- Kobo/paper doctrine held (no AI blue).  
- Apply/Accept gates respected; manuscript stays editor-clean.  
- Skip link, focus rings, aria on icon controls, reduced-motion hooks.  
- Focus mode, reading seal/ribbon breakpoints, export, research, multi-project.  
- Graph **behavior** gates (pending hidden, accept shows edge, filters, open sheet) pass even where **visual density** fails.

## Human next
Feed **Blockers** to coder first (graph label strategy + phone family layout). Then topbar de-dupe + Continuity fixture stability.
