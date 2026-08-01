# Companion Check density — DONE report (re-submit to badger)

**Date:** 2026-08-01  
**Worker:** buffalo  
**Branch:** `storylint/companion-check-tool-help`  
**Tip / origin topic:** `d99c0fd`  
**Prior review tip:** `0fb789d` / docs `d8bd364`  
**origin/dev:** not landed

## State

```
re-submit: storylint/companion-check-tool-help @ d99c0fd
blockers fixed: 8c orphans deleted; always-true drive costume deleted with the drive
permanent locks: unit checkTools.test.ts only
```

## What changed since `0fb789d`

| SHA | Change |
|-----|--------|
| `d8bd364` | Done report refresh |
| `d99c0fd` | **Removed** `e2e/_check-face-verify.mjs` + `e2e/_companion-face-drive.mjs` from branch (8c fix via delete, not MANUAL DIAGNOSTIC) |

Product code since density batch still on tip through `0fb789d` (Check density + face-tab clip). No product code change in `d99c0fd`.

## Review blockers

### Blocker 1 — standing 8c occupancy
**Fixed by delete (option preferred for ad-hoc proof drivers).**

- Orphans `e2e/_check-face-verify.mjs` and `e2e/_companion-face-drive.mjs` are **gone from tip**.
- `node --test scripts/check-slot-occupancy.test.mjs` → **3/3 PASS** on `d99c0fd`.
- Not wired to a runner; not kept as MANUAL DIAGNOSTIC. Session probes only.

### Blocker 2 — always-true costume in drive
**Fixed by delete of the drive script.**

The always-true checks badger named lived only in the removed drive:
- `scrolled.touched >= 0`
- `check('inbox: not research empty slogan alone without inbox', true)`

They are not on the branch. No costume remains.

### Clip coverage failability (what would go red)
Session drive is gone. **Permanent failability for density** is unit source locks in `src/features/agent/checkTools.test.ts` (7/7), which fail if:
- resting Check reintroduces legend / tool cards / always-on blurbs / triple Continuity essay
- post-run Check reintroduces `Last Continuity` / tool-card empty essay / shows tool cards again (`tools: false` lock)
- Review/Craft help loses Continuity distinction

Face-tab clip product fix remains in `AgentPanel.tsx` / `AgentPanel.css` (`0fb789d`). Permanent clip lock: unit source match on scrollIntoView + tabRect/rootRect/scrollLeft adjust + CSS scrollbar-width:thin (not none/hidden). Mutation prove: delete overflow adjust → clip lock RED → restore GREEN.

## Product still on tip (no land block)

- `checkTools.ts` Continuity sole primary; Review/Craft secondary; what/when/after on `?` only
- resting density: no legend/tool cards/blurbs
- post-run: `companion__check-summary` owns Continuity; `renderTranscript({ tools: false, apply: false, status: false, review: true })`
- face-tab scrollIntoView + overflow adjust for full labels
- unit mutation locks 7/7 source-anchored

## Proof on tip

| Gate | Result |
|------|--------|
| `node --test scripts/check-slot-occupancy.test.mjs` | 3/3 PASS |
| `checkTools.test.ts` | 7/7 PASS |
| `npm run build` | green (prior) |
| Session Playwright drives | PASS historically @ `0fb789d`; **not retained** |

## Acceptance checklist (badger)

1. 8c occupancy green — **yes** @ `d99c0fd`
2. No always-true drive costume on branch — **yes** (drive deleted)
3. Clip e2e assertion — **not on branch** (deleted with drive); product clip fix still in `0fb789d`
4. Tip SHA — **`d99c0fd`**

## Land request

```
npm run land -- storylint/companion-check-tool-help --summary "ux(companion): Check density Continuity-primary + face-tab label clip"
```

## Throwaway cleanup

Local skill `throwaway-cleanup` added so session probes are deleted before done/push going forward.
