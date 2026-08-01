# Save chip must paint error (not false idle)

**From:** ox (binding; horse measure; rat sharpen)
**Kind:** product chrome / state honesty
**Status:** **Accept — binding** on `origin/dev`
**Measure:** horse owned-stack @ `d6fcd00` (forced chapter PUT 500) — report `e2e/proofs/save-chip-blank-on-error-measure.md` (local measure branch)

## Facts (measure, not opinion)

| Layer | Truth |
|---|---|
| Domain `SaveState` | `'idle' \| 'saving' \| 'saved' \| 'error'` — four states ([useProject.ts](../../src/features/project/useProject.ts)) |
| Fail path | `setSaveState('error')` on save fail (project + sheet/add-chapter) |
| Chip paint today | `saving → 'Saving…'`, `saved → 'Saved'`, **else → `''`** ([Shell.tsx](../../src/components/shell/Shell.tsx) ~L406) |
| Alert | `project.error` → `role=alert` toast still fires |

**Standing 14 at render, not model.** Domain is honest. The view throws `error` away and paints the same empty chip as clean idle.

## What is wrong (correctness, not chrome taste)

Failed save does not merely under-signal. After `Saving…`, the chip returns to **exactly the resting idle mark** (blank). Author who glances away and back sees what they would if they never typed.

That is **false idle**: the chip asserts a resting state that is not true. Toast does not repair the lie in the save-status slot — different face, different job.

## Binding answers

| # | Question | Ruling |
|---|---|---|
| 1 | Fourth chip label when `saveState === 'error'`? | **Yes. Required.** |
| 2 | Exact string | **`Not saved`** |
| 3 | Idle stays blank? | **Yes.** Idle = no in-flight status. Blank is honest for rest. |
| 4 | Idle also paint a mark so error is distinguishable? | **No.** Cheapest honest shape is error-only fourth paint. Do not costume idle. |
| 5 | Toast-only enough? | **No.** Toast carries the error **message**. Chip carries continuous **SaveState**. Collapsing chip error→idle violates standing **14** at the save-status face. Keep both. |

### Why that string

- Pairs with existing chip family: `Saving…` / `Saved` / **`Not saved`** (outcome of the write, not a severity costume).
- State language, not event panic (`Error`, `Failed!!!`).
- Short enough for the chip slot.
- Author-facing truth: the write did not land.

Do not use: bare `Error`, `Failed`, `Save error`, or reuse the toast body in the chip.

## Standing hooks

- **14** — multi-state domain must not collapse at render. Four `SaveState` values ⇒ four distinguishable chip paints (idle may be empty string; empty is a paint choice for rest only, not shared with error).
- **25a** — unsaved author work is first-class; process must not misrepresent resting vs at-risk. False idle after a failed Save is the same disease family (silent mis-state), different surface from durable-dirty discard. 25a does not by itself pick the chip word; it forbids treating failed-save as "nothing happened."
- **§3 / measure** — absence of an error mark on the chip is not a pass for "author knows save failed."

## Non-claims

- Does not change toast / `role=alert` behaviour (keep).
- Does not require sticky error chrome after the next successful save or explicit dismiss of the condition — builder picks clear-back-to-idle when domain already does (next save attempt / recovered path). Chip must track `saveState`.
- Does not invent a fifth SaveState.
- Does not require idle glyph/dot.

## Build acceptance (whoever builds)

1. Chip text when `saveState === 'error'` is exactly **`Not saved`**.
2. Chip text when `saveState === 'idle'` remains **`''`**.
3. **Test bar (load-bearing):** assert chip **differs** between idle and error. A check that only hunts an error substring is too weak if that string also appeared at rest (8c object: paint the real chip; 8c/horse brief).
4. Prefer driving the real Shell/save-status node (or the pure label helper **and** its call site — do not unit-test only an extracted mapper while the ternary stays collapsed).
5. Forced-fail path (or equivalent) must show: type → `Saving…` → fail → **`Not saved`** + alert still present.

## Shape (minimal)

```text
saveState === 'saving' → 'Saving…'
saveState === 'saved'  → 'Saved'
saveState === 'error'  → 'Not saved'
else                   → ''          // idle only
```

— ox | false idle is a lie, not a missing flourish
