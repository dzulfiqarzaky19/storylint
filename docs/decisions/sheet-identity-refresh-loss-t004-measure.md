# T-004 measure report — dirty sheet identity lost on refresh

**From:** buffalo  
**To:** ox · rat  
**When:** 2026-07-31  
**Head driven:** `f2a8703` (topic claim tip; product same as `origin/dev` for SheetEditor)  
**Ticket:** [T-004](../tickets/T-004.md) — re-ranked **P0** (silent authored-work loss)  
**Related decisions:**
- [sheet-identity-refresh-loss.md](./sheet-identity-refresh-loss.md) — OPEN; direction = draft persistence, not beforeunload
- [sheet-dirty-leave-guard.md](./sheet-dirty-leave-guard.md) — FIXED in-app navigation only; explicitly does **not** cover refresh

## What I drove (not inferred)

Owned-stack Playwright @ `f2a8703`, rail@1440:

1. Seed sheet `Kael` (id `sheet-kael`) via PUT.
2. Open Canon binder → open sheet → form shows Name=`Kael`, `data-sheet-dirty=false`.
3. Type Name → `Kael Dirty Refresh` (second text input in `.sheet-editor__form`).
4. Observe `data-sheet-dirty=true`, Name field holds dirty value. **No Save.**
5. `page.reload()`.
6. Re-open sheet `Kael`.

### Result

| check | value |
|---|---|
| name after type | `Kael Dirty Refresh` |
| dirty after type | `true` |
| name after reload + reopen | `Kael` |
| dirty after reload | `false` |
| server `GET /api/project` sheet name | `Kael` (unchanged) |
| `beforeunload` dialog | **none** |
| localStorage keys | only `storylint.canonLastOpened.v1` |
| sessionStorage keys | none |
| draft keys matching sheet/dirty | **none** |

**Verdict: LOST.** Silent data loss. Author is not told, not asked, and has no recovery path.

Throwaway probe (not shipped): `e2e/_t004_refresh_probe.mjs` in worktree. Transcript shape above is the claim.

## Code read (matches the drive)

`SheetEditor` holds identity in React state only:

- `const [draft, setDraft] = useState<Sheet>(...)`
- `const [loaded, setLoaded] = useState(() => normalizeSheetIdentity(sheet))`
- no `localStorage` / `sessionStorage` / `beforeunload` in `SheetEditor.tsx`

Chapter manuscript already has local draft recovery in `useProject.ts` (`storylint:chapter-draft:`). Sheet identity does **not**.

In-app leave guard (`requestLeave` → Save/Discard/Cancel) covers binder Back, sheet switch, Draft/Lab/Canon place change. It does **not** run on browser refresh/tab close. That matches [sheet-dirty-leave-guard.md](./sheet-dirty-leave-guard.md) § What this does not fix.

## Classification (same shape as T-003)

| Possibility | Verdict |
|---|---|
| 1. Ticket stale — already fixed | **No** — drive loses dirty name |
| 2. Partial / leave-guard covers some paths | **In-app leave covered; refresh not** — different defect class |
| 3. Measurement wrong | **No** — dirty flag flipped true before reload; server unchanged; storage empty of drafts |

## Why this is P0 (re-rank)

T-004 opened as P2 “persistence nicety.” Measured behaviour is **silent loss of authored Canon identity** on ordinary reload. That is the worst class of writing-tool failure. Re-ranked to **P0** by buffalo with rat concurrence (coordinator DM).

## What is **not** decided here (needs ox)

The open decision doc leans **draft persistence / restore**, and rules out coarse `beforeunload` as the sole fix. That is **intent**, not a locked product model. Building without a ruling would invent a storage tier next to Canon’s explicit write path (Save / Accept).

### Questions for ox

1. **Restore UX:** On reload, does the draft reappear as **dirty** (author sees unsaved work and can Save/Discard), or silently land as if never left?  
   - Buffalo lean: **restore as dirty**. Silent clean restore invents a second “accepted” surface the author did not confirm.

2. **Server moved while draft sat:** If canon identity changed (other tab, Accept, external edit) after the draft was written, what wins?  
   - Buffalo lean: **drop draft when base ≠ current server identity** (conflict = discard local draft, keep accepted truth). Never clobber newer canon.

3. **Lifetime / scope:** Survive project switch? Browser restart? Forever?  
   - Buffalo lean: **same browser profile, per `projectId:sheetId`, until Save or explicit Discard**. Drop on project switch optional; no multi-day resurrection without dirty chrome.

4. **Stale draft from days ago:** Resurrect over fresh canon?  
   - Buffalo lean: **no** — same base-match rule as (2). Optional max-age is secondary.

5. **Is draft persistence even the right fix vs a stronger interrupt?**  
   - Decision doc rejects `beforeunload` as the product fix. Leave-guard already covers in-app exits. Refresh has no navigation hook except unload.  
   - Buffalo lean: **local identity draft restore (dirty)** is the right class — mirrors existing chapter draft pattern in `useProject`, does not add a second canon write path (Save still explicit). Not autosave to server. Not beforeunload-only.

## Non-goals (unless ox expands)

- Server-side draft slots / multi-device sync  
- Autosave identity to canon without Save  
- Fact-row drafts (facts already save per-action)  
- Changing leave-dialog button set  

## Stop line

**No product implementation on this tip until ox rules.** Measure → report → ruling → then ticket build. Incomplete draft-module stubs were removed from the worktree after coordinator stop.

— buffalo | drove loss; waiting on ox
