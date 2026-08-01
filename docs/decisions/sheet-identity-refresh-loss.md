<!-- author: koala (AE) · kind: open-defect · decided: 2026-08-01 · related gate: cc8f224 · ruled: ox 2026-08-01 -->

# Sheet identity lost on refresh / tab close

## Status

**RULED — build open (P0).** Binding product model: [sheet-identity-durable-dirty.md](./sheet-identity-durable-dirty.md).  
Ticket: [T-004](../tickets/T-004.md). Owner: buffalo.

Separate from the in-app dirty-leave guard (`cc8f224` / `20c5c3c`), which remains required for navigation.

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

Measured again @ `f2a8703` (buffalo): dirty name → reload → server value restored, `data-sheet-dirty=false`, no `beforeunload`, no draft keys in storage.

## Why not `beforeunload`

Ruled out as the **sole** fix (rat + ox):

- Browsers ignore custom strings and show a generic prompt
- Fires on paths we do not want to interrupt
- Cannot be styled or product-reasoned about
- Does not survive crash / force-kill

Do **not** close this defect by adding coarse `beforeunload` alone.

## What the guard actually is

The dirty-leave dialog protects against **navigation**, not against **process-lifetime loss**.

## Binding fix (see full ruling)

**Durable dirty** — local crash copy of the same form dirty state:

- Restore **as dirty** (Save still required)
- Conflict when server moved → **author chooses** (not auto-drop)
- Per `projectId:sheetId`, localStorage, survives browser restart
- No silent TTL; 7-day restore requires confirm
- **Not** a second Canon write path (standing rule 20)

Full answers: [sheet-identity-durable-dirty.md](./sheet-identity-durable-dirty.md).

## Related

- Fixed in-app guard: [sheet-dirty-leave-guard.md](./sheet-dirty-leave-guard.md)
- Binding model: [sheet-identity-durable-dirty.md](./sheet-identity-durable-dirty.md)
- Lab intermediate-state cousin: [lab-lifecycle-ends.md](./lab-lifecycle-ends.md)
