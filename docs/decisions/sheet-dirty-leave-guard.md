<!-- author: koala (AE) · kind: defect-record · decided: 2026-08-01 · origin/dev gate: cc8f224 -->

# Canon sheet dirty leave — fixed lost-work defect

## Status

**FIXED (in-app exits)** on `origin/dev` @ `cc8f224`  
Product commit: `20c5c3c` — `fix(canon): guard dirty sheet leave with Save/Discard/Cancel`

## Defect (pre-existing)

Binder Back (and other place exits) unmounted the Canon sheet form without comparing draft identity to the loaded snapshot. Unsaved name/aliases/summary/notes/portrait/kind edits were discarded with no prompt. Authors could lose accepted-truth work through ordinary navigation.

This was not introduced by the a11y focus pass. It was a pre-existing lost-work hole that had to ship **before** Esc=Back and focus restore, because those make leave easier and would amplify silent discard.

## Fix

1. **Pure dirty diff** — `src/features/project/sheetIdentityDirty.ts`  
   Dirty = real identity diff vs open / last successful save. Whitespace and alias order normalize clean. False prompts are P0.

2. **One leave path** — `SheetEditor.requestLeave(proceed)`  
   Shared by:
   - binder detail Back chrome
   - binder sheet switch / New sheet while detail open
   - ecosystem Draft / Lab / Canon (`Shell.withSheetLeaveGuard`)

3. **Dialog contract** (ox):
   - Buttons: **Save · Discard · Cancel** only (no Accept/Reject, no autosave)
   - Esc on prompt = **Cancel** (never Discard)
   - Discard never default; Save gets initial focus
   - Title: `Save changes to {Name}?`
   - Body about Canon accepted truth
   - No ambient dirty chrome; companion face switch is **not** a leave path

## Evidence

- Unit: 9 cases in `sheetIdentityDirty.test.ts` (in `npm test` 115)
- Eye: `e2e/output/dirty-leave/` + `e2e/output/design-review-dirty-leave.md` (own server, not calm)

## What this does **not** fix

See [sheet-identity-refresh-loss.md](./sheet-identity-refresh-loss.md) — browser refresh / tab close / window close still drop dirty identity silently. This guard protects **navigation**, not **process lifetime**.

## Follow-ons (separate)

- Esc=Back on sheet detail (same `requestLeave` path)
- Binder open/Back focus restore
- Decision OPEN: refresh loss → draft persistence, not `beforeunload`
