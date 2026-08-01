# Citation existence sweep

HEAD checked: `3a7a52e`
Generated: 2026-08-01T02:04:30.750Z

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
| files scanned | 67 |
| citations RESOLVES | 318 |
| citations MISSING | 7 |
| unique MISSING paths | 6 |
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

## GITIGNORED (not broken tracked citations)

Count: **58** unique paths (**60** citations). Roots: `e2e/output/`, `data/`.

A decision that *requires* a reader to open a gitignored screenshot is a process smell, but it is not the same disease as citing a tracked path that does not exist.

## Follow-up (harness-path class)

A TRACKED DOC MUST NOT CITE A LOCAL-ONLY HARNESS PATH. Distinct from the other six: those could exist; a harness path must not. Fixed in this land: removed `.claude/skills/ui-ux-pro-max` from `orchestrator-ux-faults.md` and `ux-report.md` (plain structure/a11y description; paint still `docs/design/TOKENS.md`). Rule: `docs/AGENTS_ROLES.md` § AI harness stays local.

This report quotes the banned path as evidence of the class it fixed. Describing a violation is not committing one. A mechanical re-run that hits the string here is looking at the sweep, not a dependency — leave it.

## Class

Same disease as ticket-cited probes that live only in a worktree: a reader cannot open the evidence.
Existence is cheaper than execution.

| subclass | meaning |
|----------|---------|
| throwaway-or-worktree-probe | `_t00x_*`, `falcon-mut*` not on origin/dev |
| probe-script-not-shipped | audit drivers named in decisions, absent from tree |
| design-doc-missing | `docs/design/...` cited, not present |
| harness-path-in-tracked-doc | tracked doc cites local-only AI harness (must not; never ship to fix) |
| GITIGNORED | local output by design (separate bucket) |

## Tickets re-pass note

T-007/T-008 probe scripts: if still missing after falcon land, they remain throwaway-or-worktree-probe.
T-009 `e2e/proofs/t009-rule11a-no-check/probe.mjs` should RESOLVE if on tip.
