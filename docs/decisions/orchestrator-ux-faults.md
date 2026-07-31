<!--
  Tracked decision record (moved from e2e/output/orchestrator-ux-faults.md).
  Author: hamster
  Kind: review-handoff
  Decided: Priority UX fault queue for orchestrator (request changes)
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# Orchestrator handoff — UI/UX faults

**From:** hamster (UX review agent)  
**To:** orchestrator  
**Project:** storylint  
**Date:** 2026-07-31T16:12Z  
**Skill:** `.claude/skills/ui-ux-pro-max` (structure/a11y only; paint = `docs/design/TOKENS.md`)  
**Verdict:** **request changes**  
**Machine payload:** `e2e/output/orchestrator-ux-faults.json`  
**Full report:** `e2e/output/ux-report.md`

## Priority queue

| Pri | ID | Severity | Title | Owner |
|-----|----|----------|-------|-------|
| 1 | **B1** | critical | Network graph label collision | coder/graph |
| 2 | **B2** | critical | Phone family tree illegible | coder/graph |
| 3 | **S1** | high | Duplicate project title + overloaded topbar | coder/shell |
| 4 | **S3** | medium | Continuity flaky empty drive run | coder/continuity + e2e |
| 5 | **S2** | medium | Graph view toggle vs filter hierarchy | coder/graph |
| 6 | **S4** | medium | Phone craft-tag density | coder/manuscript |
| 7 | **S5** | low | Smoke UUID fixture names | e2e/fixtures |

## Blockers (fix first)

### B1 — Network label collision
- **Shot:** `e2e/output/ux-graph-03-network-full-all-kinds.webp`
- **Fault:** Multi-kind seed piles overlapping names/kinds; identity not readable without hover.
- **Skill:** chart network density + no hover-only identity; provide list alternative (binder already helps).
- **Fix direction:** truncate + tooltip/selection labels; collision avoid or hide labels above N; optional clustering/LOD.

### B2 — Phone family illegible
- **Shot:** `e2e/output/ux-graph-13-family-phone.webp`
- **Fault:** Nodes are ticks; labels gone; propose-edge form steals fold.
- **Skill:** responsive chart simplify; touch ≥44; content-priority on mobile.
- **Fix direction:** vertical tree / fewer gens / label-below or list fallback; disclose propose form.

## Should-fix

1. **S1 Topbar** — h1 duplicates ProjectSwitcher; collapse identity; overflow New/Export (`primary-action`, `overflow-menu`).
2. **S2 Graph chrome** — Network/Family same weight as kind filters; separate view vs filters.
3. **S3 Continuity** — drive WARN 0 proposals; stabilize fixture + empty/success feedback.
4. **S4 Craft tags @767** — wrap/scroll/collapse so manuscript wins.
5. **S5 Fixture names** — human names instead of `Smoke 1785…`.

## Keep (do not regress)

- Brass/paper doctrine, no AI blue  
- Apply/Accept gates  
- a11y basics (skip link, focus rings, aria icons, reduced motion)  
- Focus mode, seal/ribbon, export/research/multi-project  
- Graph **behavior** gates (pending hidden, accept edge, filters, open sheet)

## Orchestrator action

1. Assign **B1+B2** to graph coder.  
2. Assign **S1** to shell.  
3. Assign **S3** after or parallel with e2e fixture work.  
4. Do **not** apply skill-generated paint (amber/hand fonts). TOKENS own skin.
