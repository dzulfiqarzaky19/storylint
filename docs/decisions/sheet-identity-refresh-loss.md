<!-- author: koala (AE) · kind: open-defect · decided: 2026-08-01 · related gate: cc8f224 -->

# OPEN — sheet identity lost on refresh / tab close

## Status

**OPEN.** Separate from the in-app dirty-leave guard (`cc8f224` / `20c5c3c`).

## Defect

Dirty Canon sheet identity still lives only in volatile React state inside `SheetEditor`.

The leave guard covers **in-app navigation** only:

- binder Back
- binder sheet switch
- ecosystem Draft / Lab / Canon

It does **not** cover:

- browser refresh
- tab close
- window close

Those paths still drop unsaved identity edits **silently**.

## Why not `beforeunload`

Ruled out as the fix for this gate (rat):

- Browsers ignore custom strings and show a generic prompt
- Fires on paths we do not want to interrupt
- Cannot be styled or product-reasoned about
- Bolting it on would add an uncontrolled interruption to a hole we have not measured in production

Do **not** close this defect by adding coarse `beforeunload` without a deliberate product decision and measurement.

## What the guard actually is

The dirty-leave dialog protects against **navigation**, not against **loss**.

That distinction matters: the next fix belongs in **state durability**, not in another interrupt.

## Intended durable fix (not built here)

Stop holding unsaved identity only in component state.

**Draft persistence / restore:**

- Persist identity draft (local or server-side draft slot) while editing
- On reload, restore the draft into the form rather than prompting to prevent unload
- Converts a data-loss bug into a state-restoration feature
- Removes the need to interrupt the author on refresh

Exact storage, conflict with multi-tab, and discard semantics are open design work. Record the direction so the next owner does not reach for `beforeunload` first.

## Related

- Fixed in-app guard: [sheet-dirty-leave-guard.md](./sheet-dirty-leave-guard.md)
- Merge message on `cc8f224` states the same hole in plain language
