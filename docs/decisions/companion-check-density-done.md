# Companion Check density — DONE report (for rat)

**Date:** 2026-08-01  
**Worker:** buffalo (improvement mode)  
**Branch:** `storylint/companion-check-tool-help`  
**Topic HEAD / origin topic:** `150b9d2`  
**origin/dev:** not landed (topic only)

## State

```
done: branch=storylint/companion-check-tool-help topic=companion-check-density origin/topic=150b9d2
scope: Companion Check face density + Continuity/Review/Craft hierarchy
next: review → land → E2E verify; rat may file follow-on tickets from open list below
```

## Shipped (3 commits)

| SHA | Summary |
|-----|---------|
| `83d64a2` | Check tool list + `?` What/When/After popups |
| `82640ae` | Thin resting Check: primary Continuity, quiet Review/Craft; no legend/cards/blurbs |
| `150b9d2` | Post-run density: summary owns Continuity; hide tool cards on Check; compact copy |

## Product outcome

- Resting Check: **Run Continuity** (primary) · Review · Craft · help on `?` only
- Post-run: one line `Continuity: no issues (fixture)` — no double Continuity essay, no tool-card privacy dump
- Continuity remains sole gate path; Review/Craft panel-only coaching

## Proof

| Gate | Result |
|------|--------|
| Unit `checkTools.test.ts` | 7/7 (incl. post-run density mutation lock) |
| `npm run build` | green |
| Playwright Edge owned-stack `e2e/_check-face-verify.mjs` | 11/11 PASS @ `150b9d2` |
| Browser bridge (Firefox) live drive @ `150b9d2` | PASS — resting sparse + post-run `Continuity: no issues (fixture)` |

Shots: `e2e/output/check-face-tools.png`, `e2e/output/check-face-craft-help.png`, bridge shot in session temp.

## Stop condition

Improvement mode hit diminishing returns on Check face density. No further Check chrome polish in this batch.

## Suggested tickets for rat (not filed — coordinator owns ticket ids)

1. **P2 land/review** — Review + land `storylint/companion-check-tool-help` → `origin/dev` (`npm run land`). Acceptance: topic commits on `origin/dev`; post-land E2E intent verify.
2. **P3 optional** — Promote `e2e/_check-face-verify.mjs` into named smoke (or fold checks into calm-budget) so density locks ride CI, not ad-hoc.
3. **P3 optional** — Playwright Firefox channel install/docs: system Firefox + bridge works; Playwright-managed `firefox-1497` was incomplete/`__dirlock` mid-install; headless system FF crashed under juggler. Not product-blocking.
4. **Unchanged leftovers (pre-existing)** — T-004 7d stale; T-009 optional tripwire; GATE A noise from local unstamped `T-004-*.log`.

## Out of scope / not done

- No Inbox / land / Review surface redesign
- Not merged to `origin/dev`
- No new product tickets created by worker (rat owns ranking/filing)
