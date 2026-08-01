# Blank save chip on failed save — measure report (horse)

**When:** 2026-08-01  
**Tip measured:** `d6fcd00` (origin/dev at branch start)  
**Scope:** measure + report only. No product fix. Wording is ox’s call.  
**Probe:** `e2e/_measure_save_chip.mjs` (local, untracked) — force chapter PUT 500, type into Draft.

## Code facts (not inferred)

| Layer | Fact |
|-------|------|
| Domain | `SaveState = 'idle' \| 'saving' \| 'saved' \| 'error'` (`useProject.ts` L6) |
| Error path | `setSaveState('error'); setError(message)` on chapter persist fail (L196–199) and add-chapter fail (L314–315) |
| Chip render | `Shell.tsx` L405–407: `saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''` |
| Alert | `Shell.tsx` L561: `project.error ? <div className="project-error" role="alert">{project.error}</div>` |
| Chip CSS | `.project-status` — muted xs text in topbar (`project.css` L179) |
| Alert CSS | `.project-error` — fixed bottom toast, danger color (`project.css` L185) |

**Mapping disease:** four domain states, three chip strings. Both `idle` and `error` render as `''`. Standing-rule-14 at the **render** layer, not the model: domain is honest (`setSaveState('error')` fires on chapter L198 and sheet/add-chapter L314); the Shell ternary throws the information away. Usual form of standing 14 is a boolean in the data. Here the data is right and the view collapses it. Related family: ox 25a unsaved work as first-class state.

**Worse than under-signals — false idle:** a failed save does not merely show nothing. It shows **the same thing as a clean idle sheet**. An author who typed, saw "Saving…", glanced away, and looked back sees precisely what they would see if they had never typed. The chip is not silent. It is **wrong** — it asserts a resting state that is not true. That is a correctness question, not only a chrome/label question.

## Live drive (forced save fail)

| Step | chipText | alert / project-error |
|------|----------|------------------------|
| baseline after seed | `""` | none |
| after click editor | `""` | none |
| immediate after type | `Saving…` | none |
| t+300ms | `Saving…` | none |
| **t+800ms (fail settled)** | **`""`** | **`forced-save-fail-for-chip-measure`** (`role=alert`, class `project-error`) |
| t+2000ms | `""` | same alert still present |

**Confirmed:** on failed chapter autosave, topbar chip goes blank (same visual as idle). Failure is not silent — bottom toast alert carries the error string — but the status chip under-signals at the moment the author most needs a durable status cue.

## What this does / does not claim

Claims:
1. Blank chip on `saveState === 'error'` is real under owned stack.
2. Alert surfaces the failure string; chip does not.
3. Domain already has `'error'`; UI ternary drops it.

Does not claim:
- Product wording for the fourth chip state (ox).
- Whether alert alone is “enough” accessibility (open product judgment).
- Sheet Save path (no Save button on Draft-only path in this drive; chapter autosave only).

## Ask for ox (wording / state shape)

Domain already has four states. Chip needs a fourth visible state or an explicit ruling that error belongs only on the toast and chip may stay blank.

Questions for ox (do not invent the word):
1. Should the topbar chip show a fourth label when `saveState === 'error'`? (correctness: chip currently claims false idle)
2. If yes, what exact string? (candidates are ox’s, not horse’s — **ox picks**.)
3. Does idle remain blank?
4. **Should idle paint something too?** Cheapest shape that makes error distinguishable even before an error word is chosen — different from “add a fourth label,” may be the smaller change.
5. Any binding to standing 14 / 25a that forbids toast-only error without chip state?

## Acceptance bar for whatever ox rules (test shape)

The test that matters: **assert the chip differs between `idle` and `error`.**  
A test that only checks “the error string appears” would pass on an implementation that also shows that string at rest. Do not ship that weaker test.

## Outcome

- Ox ruled: docs/decisions/save-chip-error-not-idle.md @ origin/dev df7b2cf
- Built: saveChipLabel + Shell call site; error → `Not saved`; idle stays blank
- Gate tests: src/features/project/saveChipLabel.test.ts (idle≠error + Shell wiring)
- Probe e2e/_measure_save_chip.mjs remains local MANUAL DIAGNOSTIC (not a gate)
