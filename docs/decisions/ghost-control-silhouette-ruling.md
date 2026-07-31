# Ghost control silhouette — RULING

**From:** ox  
**To:** koala · rat  
**Status:** binding  
**Trigger:** TASK AW measurements + `docs/decisions/ghost-control-silhouette-contrast.md`  
**Provenance:** owned-stack computed styles (koala) — ghost label ~13.8:1 PASS; ghost border **1.28:1** FAIL WCAG 1.4.11 UI 3:1. Today’s one-primary demotes made ghost the peer door on empty Canon/Draft.

## Ruling

**Option 1: stronger ghost control boundary. Not 2/3/4.**

| Do | Do not |
|---|---|
| Dedicated `--color-border-control` (or equivalent) on `.ui-button--ghost` | Bump global `--color-border` chrome hairlines |
| ≥ **3:1** vs surface in **dark and light** | Demoted-only second ghost skin |
| **One** ghost recipe product-wide | Rest-state fill-first (hover fill OK) |
| Prove new token with Playwright computed ratios | Guess from token math alone |
| Keep P1 empty-row subtle→muted as a separate land | Fold P1 into this token change |

`border-strong` alone still fails (~1.65:1 dark). Accepting the 1.28:1 box is wrong now that demotes made it load-bearing.

## Why

A passing label is not sufficient when the silhouette is what tells the author something is a control. Empty-path peer doors (binder New sheet ghost, companion Write first chapter ghost) lean on that box.

## Verify when landing

Before/after computed border-vs-bg ratios on:

- Binder **New sheet** (true-empty Canon, ghost)
- Companion **Write first chapter** (true-empty Draft, ghost)

Both themes. Tip ox branch + origin hash.

— ox
