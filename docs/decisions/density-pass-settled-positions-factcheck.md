<!--
  Author: bk (fact-check lane)
  Kind: code-vs-doc claim matrix
  Against: docs/decisions/density-pass-settled-positions.md
  Tree: origin/dev @ 07bfabf
  Scope: falsifiable product claims only. Judgments / "therefore do not" policy out of scope.
  Does not edit ox's settled doc.
-->

# Density pass settled positions — fact check (BK)

**Voice:** bk (outside reader, code only)  
**Source doc:** [density-pass-settled-positions.md](./density-pass-settled-positions.md)  
**Code tree:** `origin/dev` @ `07bfabf`  
**Method:** every checkable claim → **VERIFIED** or **STALE** with `file:line`. Unfalsifiable product judgments skipped.  
**Companion:** BJ adversarial remains valid; this pass is evidence, not re-argument.

---

## Summary

| Result | Count |
|---|---|
| **VERIFIED** | 28 |
| **STALE** | 4 |
| **PARTIAL** (code half-matches; doc overclaims) | 3 |
| Out of scope (judgment / deferred product) | rest of §8–10 |

**P0 stale for ox absorb:** §2.3 boot seeds "Chapter One" (still U5).  
**P1 partials:** Lab Archive/Restore/Dismiss lifecycle (§5), Network@60 hairball framing (§6).

---

## Claim matrix

### §1 Structure of the desk

| # | Claim (paraphrase) | Verdict | Evidence |
|---|---|---|---|
| 1.1a | Top bar is **Draft · Lab · Canon** (three ecosystems) | **VERIFIED** | `src/components/shell/Shell.tsx:402` Draft · `:409` Lab · `:416` Canon. No Continuity peer in topbar actions. |
| 1.1b | Continuity is **not** a top-bar peer | **VERIFIED** | Continuity only as companion Check face: `AgentPanel.tsx:582–638` (`face === 'check'`); no Continuity control in `Shell.tsx` topbar block `:395–416`. |
| 1.1c | Canon center = map; sheet is **not** a second center app | **VERIFIED** | Graph workspace is map (`Shell.tsx:476+` RelationshipGraph). Sheet detail mounts in binder stack, not center: `Binder.tsx:433–475` `data-binder-stack` / `binder__stack-detail`. |
| 1.1d | Sheet = binder Level-3 stack (list stays mounted) | **VERIFIED** | `Binder.tsx:443–447` list stays mounted under detail (`hidden={sheetDetailOpen}`); detail layer `:452–475`. |
| 1.1e | Binder shows structure even when empty | **VERIFIED** | Empty chapters copy + New chapter: `Binder.tsx:297–327`. Empty sheets copy + New sheet: `:338–381`. Not a void rail. |
| 1.2a | Binder kinds: **Characters / Lore / World / Organizations** | **VERIFIED** | `workspace.ts:7–11` `SHEET_KIND_LABEL`; used `Binder.tsx:88,348`. |
| 1.2b | **People / Places / Groups** absent from product UI | **VERIFIED** | `git grep` People/Places/Groups over `src/` → no hits. Labels only via `SHEET_KIND_LABEL`. |
| 1.2c | Graph chips use `SHEET_KIND_LABEL` | **VERIFIED** | `RelationshipGraph.tsx:6` import; `:311` filter chips; `:377,388,396,450` node labels. |
| 1.2d | Product has **four** sheet kinds | **VERIFIED** | `domain/types.ts:1` `SHEET_KINDS = ['character','lore','world','organization']`. |
| 1.2e | User-facing bible → Canon full sweep (no half-rename in UI) | **VERIFIED** | No `bible`/`Bible` in `src/components` or `src/features` UI paths. Remaining `bible` is export path (`export/markdown.ts:35` `bible/${kind}/…`) and test prose — not chrome labels. UI chips use `@canon` (`AgentPanel.tsx:764`, `Shell.tsx:291`). |

### §2 Primaries, solids, and doors

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 2.1a | One solid primary per job across regions (empty Draft dual-rail) | **VERIFIED** (mechanism + gate) | Binder empty: New chapter `primary` `Binder.tsx:326–327`. Companion empty chapter CTAs demote to `ghost` (`AgentPanel.tsx` Write/Check first-chapter buttons). Calm gate `e2e/calm-budget.mjs` `B6-primary-per-job@draft-empty` / `@canon-empty` (~L993–1059). |
| 2.1b | Empty Canon: binder New sheet demotes; map owns create | **VERIFIED** | Binder `variant={sheets.length === 0 ? 'ghost' : 'primary'}` `Binder.tsx:378–381`. Map empty CTA solid New sheet `RelationshipGraph.tsx:329`. |
| 2.2a | Empty-body Continuity must not look runnable | **VERIFIED** | `continuityRunnable = hasChapter && hasProse` `AgentPanel.tsx:132`. Button `variant` ghost when not runnable `:630`; `disabled` `:631`; `data-continuity-runnable` `:634`. |
| 2.2b | Empty Canon must not wear solid Send that cannot complete | **VERIFIED** | `canProposeEdge = project.sheets.length >= 2` `RelationshipGraph.tsx:270`. Send primary only when true `:279–280`; else status hint `:282`. |
| 2.3a | **New project stays empty** (no seeded manuscript) | **VERIFIED** | POST create: `http.ts:158` `chapters: []` (also empty sheets/lab). |
| 2.3b | **Boot may seed Chapter One** | **STALE** | Boot factory: `server/index.ts:10` `chapters: [{ id: 'chapter-1', title: '', body: '', … }]`. Title is **empty string**, not `"Chapter One"`. Test comment confirms intentional blank seed (`server.test.ts:14–15` "not 'Chapter One'"). Same U5 as BJ. |
| 2.3c | Seeded-default is a third arrival (blank title / empty body possible) | **VERIFIED** | Boot seed has `title: ''`, `body: ''` (`index.ts:10`). Continuity gates on prose (`AgentPanel.tsx:132`). |
| 2.3d | Full Canon restores navigator primary (New sheet solid once sheets exist) | **VERIFIED** | `Binder.tsx:378` solid when `sheets.length !== 0`. |

### §3 Companion

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 3.1a | One assistant in-flight job via `assistantBusy` | **VERIFIED** | `assistantBusy = sending \|\| continuityRunning \|\| researchRunning` `AgentPanel.tsx:203`. Comment `:201–202`. |
| 3.1b | Jobs blocked both ways while one runs | **VERIFIED** | Shell gates Continuity start on agent/Research (`Shell.tsx:159–161` area; cowrite/send guards `:310+`). Research query takes `assistantBusy` (`ResearchPanel.tsx:25–26,111`). Continuity/agent buttons use `disabled={assistantBusy…}`. |
| 3.1c | Decisions free under jobs: Accept/Edit/Reject, Apply/Dismiss, Pin/Propose — local busy only | **VERIFIED** | ApplyCard local `busy` only, comment "never assistantBusy" `ApplyCard.tsx:14–15,39–42`. ProposalCard local `busy` `:17,46–61`. Research Pin/Propose local busy `:35,60,76,146–157`; query uses `assistantBusy` `:111`. AgentPanel comment `:202`. |
| 3.1d | Research is two kinds of work (query=job; pin/propose=decisions) | **VERIFIED** | Same as 3.1c — `ResearchPanel.tsx:25–28,45,60,76`. |
| 3.2a | Writing chrome: Chat · Write · Check primaries; Inbox badge; Research quiet | **VERIFIED** | `FACES.writing` five faces `AgentPanel.tsx:40`. `PRIMARY_FACES.writing = ['chat','write','check']` `:53`. Inbox always badge rail `:443–454`. Research in overflow `:127,457–467`. |
| 3.2b | ≤3 primary peers (allow-list may be 5) | **VERIFIED** | `PRIMARY_FACES` max 3 entries per context `:52–57`. Writing allow-list length 5 `:40`. |
| 3.2c | Continuity lives **only** as Check | **VERIFIED** | Single Run Continuity control under `face === 'check'` `AgentPanel.tsx:582–638`. No other Continuity entry control in shell topbar. |
| 3.2d | One overflow → plain control, not one-item More menu | **VERIFIED** | `overflow.length === 1` → `companion__face-secondary` plain button `:457–467`. More menu only when `overflow.length > 1` `:468–494`. Comment `:49–50,458`. |
| 3.3a | Inbox fold ~4 + quiet count; no bulk Accept | **VERIFIED** | `foldAt = 4` `AgentPanel.tsx:273–275`; tail in closed `<details>` `:293–301`. Summary `N pending` `:514`. Grep `Accept all` / `bulkAccept` over tree → docs only, no UI control. |
| 3.3b | Continuity multi-run stays reviewable without dumping the rail | **PARTIAL / unfalsified here** | Mechanism exists (Inbox fold + tool cards in transcript). No runtime load proof in this pass — measurement claim, not a static code contradiction. Not marked STALE. |

### §4 Canon write path and truth

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 4a | Canon write path = **Accept** on proposal **or** **Save** on author sheet edit | **VERIFIED** (explicit paths present) | `acceptProposal` domain `proposals.ts:32` + API/useProject. Sheet Save `SheetEditor.tsx:316` / `useProject.saveSheet`. Continuity/Lab promote create **pending** proposals, not silent sheet writes (Lab promote → proposals; graph Send → pending notice `RelationshipGraph.tsx:230`). |
| 4b | In-app dirty leave guarded (Save/Discard/Cancel) | **VERIFIED** | `SheetEditor.tsx:28,61,79,380–417` leave dialog with Save / Discard / Cancel. Binder shares leave guard (`Binder.tsx:35–36,109+`). |
| 4c | Refresh/tab-close draft loss is open; fix ≠ `beforeunload` | **VERIFIED** (code + decision alignment) | No `beforeunload` in `src/`. Decision docs explicitly reject it (`sheet-identity-refresh-loss.md`). Code has in-app guard only. |
| 4d | No silent bible/Canon write; no Accept costume on author sheet edits | **VERIFIED** (UI) | Sheet editor actions are Save sheet / Save fact / leave Save-Discard-Cancel — not Accept/Reject (`SheetEditor.tsx:316,369,404–417`). |

### §5 Lab

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 5a | Lab is a transient bench (promote/archive exist; not second forever Canon) | **VERIFIED** (partial product) | Promote + archive domain `lab.ts`; UI Archive on live cards `LabBench.tsx:292`; promoted section is receipt list `:301–308`. Promote does not write sheets until Accept (server test pattern). |
| 5b | **Promoted = dismissible history (receipts)** — Dismiss/Clear removes Lab receipt only | **STALE** (implementation gap) | Doc §5 and §9 say ruled; UI has **no** Dismiss/Clear on promoted list (`LabBench.tsx:301–308` badges only). Domain has no `dismissPromoted` / `clearPromoted`. §9 correctly lists "Lab archive Restore + Promoted dismiss" as open follow-on — **§5 body overclaims shipped dismiss**. |
| 5c | **Archive is a state (list + Restore), not a trapdoor** | **STALE** (implementation gap) | Domain `archiveLabCard` sets `status: 'archived'` `lab.ts:125–135`. UI exposes **Archive** only (`LabBench.tsx:292`). **No archived list, no Restore/unarchive** in UI or domain API grep. Archived cards drop out of `live` filter (`LabBench.tsx:83`) with no recovery chrome. §9 again admits follow-on; §5 states it as position as if present. |
| 5d | No hard delete of Lab cards in v1 | **VERIFIED** (no delete API in lab domain path checked) | Archive soft-status only; no deleteLabCard in `lab.ts` surface used by UI. |

### §6 Canon under load

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 6a | Network dense mode exists (honest hairball mitigation) | **VERIFIED** | `NETWORK_DENSE_NODE_THRESHOLD = 8` `RelationshipGraph.tsx:11`; `denseNetwork` `:150`; `data-graph-dense` `:293`; label suppression when dense `:357,369`. |
| 6b | Network at full cast **(~60+)** is known hairball; dense mode addresses it | **PARTIAL** | Dense mode trips at **≥8 nodes**, not ~60. Claim that 60+ is a hairball is a product observation (AZ), not contradicted — but code threshold is 8, so "dense mode at full cast" is not a 60-specific switch. Filters exist `:309+`. |
| 6c | Binder list scroll restores after sheet detail Back | **VERIFIED** (mechanism) | `listScrollTopRef` save/restore `Binder.tsx:69,103,124,160,234–242,261–280`. AZ comment at `:236`. (Probe honesty is e2e concern; product code intends restore.) |
| 6d | Binder navigable with kind sections @ scale | **VERIFIED** (structure) | Kind sections via `SHEET_KINDS` map `Binder.tsx:344–348`. No search UI required by claim. |

### §7 Measurement positions

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 7a | Provenance or refuse (unowned / wrong HEAD) | **VERIFIED** | `e2e/README.md` provenance rules; `calm-budget.mjs` refuse exit 2; `owned-stack.mjs`. |
| 7b | Absence is not a pass — PASS / FAIL / **NOT-MEASURED** | **VERIFIED** | `calm-budget.mjs:129,149,208–216` NOT-MEASURED first-class; summary counts `:1649+`; fingerprint kind includes `N`. |
| 7c | Never infer visibility from geometry — `checkVisibility` + closed details | **VERIFIED** | `e2e/helpers.mjs:447–483` `isVisibleEl`; self-test refuse; calm README § visibility. |
| 7d | Citable green = `npm run test:green` only | **VERIFIED** | `package.json:20` `"test:green": "node e2e/guard-helpers.mjs && npm run build && npm test && node e2e/all-smoke.mjs && node e2e/calm-budget.mjs"`. |

### §8 Deliberately rejected (code-checkable subset)

| # | Rejection | Verdict | Evidence |
|---|---|---|---|
| 8.1 | People/Places/Groups rename | **VERIFIED absent** | See 1.2b. |
| 8.2 | Sheet as center workspace | **VERIFIED absent** | See 1.1c–d. |
| 8.3 | Hard ≤3 faces deleting Inbox/Research | **VERIFIED absent** | Allow-list keeps both (`AgentPanel.tsx:40`). |
| 8.4 | Continuity on top bar | **VERIFIED absent** | See 1.1b. |
| 8.5 | Fourth ecosystem | **VERIFIED absent** | Three topbar places only. |
| 8.6 | Global mutex tying Apply/Pin to jobs | **VERIFIED absent** | See 3.1c. |
| 8.7 | Bulk Accept | **VERIFIED absent** | See 3.3a. |
| 8.8 | Product-seeded manuscript prose on New project | **VERIFIED absent** | `http.ts:158` empty chapters. |
| 8.9–8.10 | Lab Promoted forever log / fixed-height scroll "fix" | **PARTIAL** | No dismiss yet (5b) — risk of forever list remains in code. No fixed-height nested scroll fix found as product "solution"; open follow-on matches §9. |
| 8.11–8.12 | Search/cluster / noun invention | Out of scope (absence of features + process rule). |

### §9 Honest edge (doc self-audit vs code)

| Open item in doc | Code status @ 07bfabf |
|---|---|
| Binder scroll restore | Mechanism present (6c). |
| Lab archive Restore + Promoted dismiss | **Not implemented** — matches open row; conflicts with §5 wording that states Archive+Restore and dismissible Promoted as positions without "not shipped" qualifier. |
| Seeded-default P1 / B6-runnable-solid proof | Runnable gate in UI (2.2a). Calm has B6-primary-per-job; B6-runnable-solid as named calm id not re-grepped exhaustively this pass — entitlement letter in UI is real. |
| Refresh identity loss | Open (4c). |
| Network@scale model | Dense@8 + filters only (6b). |
| Pin/Propose local Working… | **Shipped** local Working on Pin/Propose (`ResearchPanel.tsx:146–157`) — doc §9 still lists as P2 polish; **STALE open-item** (done in code, still listed open). |
| PASS-on-absence audit | NOT-MEASURED machinery landed (7b); ongoing hardening is process. |

---

## STALE detail (fix targets for ox, not BK)

### S1 — §2.3 "Boot may seed Chapter One" (P0, BJ U5)

| Doc | Code |
|---|---|
| "Boot may seed **Chapter One**" | `src/server/index.ts:10` `title: ''` |
| | `src/server/server.test.ts:14–15` explicitly not `'Chapter One'` |

**Repair options (ox):** say "Boot may seed one blank chapter (`chapter-1`, empty title/body)" or drop the Chapter One proper name.

### S2 — §5 Archive is list + Restore (P1)

Domain archives; UI archives; **no Restore list/API**. §9 already knows. §5 table should read as **ruled direction**, not shipped chrome — or gain "not shipped" parity with §9.

### S3 — §5 Promoted dismissible receipts (P1)

No Dismiss/Clear control or domain helper. Same doc tension as S2.

### S4 — §9 "Pin/Propose local Working… P2 polish" (P2)

Code already shows local `Working…` on Pin/Propose. Open-row is stale; close or re-scope.

---

## PARTIAL notes (not full STALE)

1. **Network@60 vs dense@8:** Hairball observation can stand; do not imply dense mode is a 60-node threshold. Actual constant: `RelationshipGraph.tsx:11` `= 8`.
2. **§5 Lab lifecycle:** Direction verified in domain statuses (`active|pinned|promoted|archived`); dismiss/restore chrome missing.
3. **Canon "exactly one" write path:** Explicit Accept + Save verified. Exhaustive proof of *no other* write (every server route) not fully audited this pass; no contradictory UI costume found.

---

## Out of scope (as briefed)

- "Therefore do not build X" policy rows without a code predicate.
- Family multi-gen "usable" qualitative close (AZ measurement).
- "~20s continuity path" timing.
- Class-over-instance inventory philosophy.
- §10 narrative paragraph.

---

## Method gaps (honest empty)

- Did not re-run `npm run test:green` (static fact-check only).
- Did not open browser / calm artifacts for this matrix.
- Did not line-audit every server mutation for silent Canon writes beyond known promote/continuity/accept/save paths.
- `git grep` for People/Places/Groups and Accept-all used path-limited `src/` + tree docs; export/test strings ignored for UI dialect.

---

## Bottom line for rat / ox

Code largely matches the settled desk: three ecosystems, binder stack, four kind labels, jobs-vs-decisions busy split, Continuity-as-Check, runnable Continuity gate, empty-Canon Send gate, Inbox fold, measurement NOT-MEASURED/refuse.

**Still lying relative to `origin/dev` src:**

1. **Chapter One** boot wording (S1 / U5) — definite STALE.  
2. **Lab Restore + Promoted dismiss** stated as position without shipped code (S2–S3) — STALE vs §5, honest in §9.  
3. **Pin/Propose Working** still listed open (S4).

No edit made to ox's settled doc. Report only.

— bk  
`origin/dev` @ `07bfabf`
