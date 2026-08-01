# Citation existence sweep

HEAD checked: `afcd2e9`
Generated: 2026-08-01T01:56:12.109Z

## Method

- Scope: `docs/decisions/*`, `docs/tickets/*` (excludes this report file)
- Existence only against `git ls-tree HEAD`
- Extracts: repo-rooted paths (`docs|src|e2e|scripts|...`), markdown local links, bare `*.md` cross-refs
- Does **not** treat bare `Foo.tsx` basenames as path claims (prose component names)
- Bare `*.md` resolves: same directory → `docs/` → `docs/decisions|tickets|design/`
- `e2e/output/**`, `data/**` → **GITIGNORED** (local artifacts by design)
- Not doc-vs-code claim checking

## Totals

| metric | n |
|--------|---|
| files scanned | 64 |
| citations RESOLVES | 286 |
| citations MISSING | 9 |
| unique MISSING paths | 7 |
| citations GITIGNORED | 60 |
| unique GITIGNORED | 58 |
| basename rescue | 0 |
| GLOB | 4 |

## Unique MISSING (actionable)

### design-doc-missing (1)

| path | cited in |
|------|----------|
| `docs/design/D4-CANON-MAP-CHROME.md` | `docs/decisions/design-review-r1.md:124`<br>`docs/decisions/doc-vs-code-corpus-factcheck.md:56` |

### probe-script-not-shipped (3)

| path | cited in |
|------|----------|
| `e2e/density-audit.mjs` | `docs/decisions/density-audit-qa3.md:9,17,180` |
| `e2e/ia-final-qa.mjs` | `docs/decisions/ia-final-qa.md:14` |
| `e2e/ia-step1-qa.mjs` | `docs/decisions/ia-step1-qa.md:14` |

### throwaway-or-worktree-probe (2)

| path | cited in |
|------|----------|
| `e2e/_t003_arrival_probe.mjs` | `docs/tickets/T-003.md:72` |
| `e2e/_t004_refresh_probe.mjs` | `docs/decisions/sheet-identity-refresh-loss-t004-measure.md:39` |

### tooling-not-in-repo (1)

| path | cited in |
|------|----------|
| `.claude/skills/ui-ux-pro-max` | `docs/decisions/orchestrator-ux-faults.md:15`<br>`docs/decisions/ux-report.md:15` |

## GITIGNORED (not broken tracked citations)

Count: **58** unique paths (**60** citations). Roots: `e2e/output/`, `data/`.

A decision that *requires* a reader to open a gitignored screenshot is a process smell, but it is not the same disease as citing a tracked path that does not exist.


## Fixes landed with this report

| was MISSING | fix |
|-------------|-----|
| `tickets/README.md` via `../../tickets/...` | `pipeline-gate-vocabulary.md` → `../tickets/README.md` |
| bare `calm-budget-run.md` | `docs/decisions/README.md` → `e2e/output/calm-budget-run.md` |
| bare `ux-graph-progress.md` / `ux-notes.json` | `ux-report.md` → `e2e/output/...` prefixes |

Remaining unique MISSING are **not** link typos: missing design doc, unshipped probe drivers, throwaway probes already labelled not-shipped, tooling path outside repo.

## Class

Same disease as ticket-cited probes that live only in a worktree: a reader cannot open the evidence.
Existence is cheaper than execution.

| subclass | meaning |
|----------|---------|
| throwaway-or-worktree-probe | `_t00x_*`, `falcon-mut*` not on origin/dev |
| probe-script-not-shipped | audit drivers named in decisions, absent from tree |
| design-doc-missing | `docs/design/...` cited, not present |
| tooling-not-in-repo | `.claude/...` paths |
| GITIGNORED | local output by design (separate bucket) |

## Tickets re-pass note

T-007/T-008 probe scripts: if still missing after falcon land, they remain throwaway-or-worktree-probe.
T-009 `e2e/proofs/t009-rule11a-no-check/probe.mjs` should RESOLVE if on tip.
