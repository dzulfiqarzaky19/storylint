# DOCTRINE_AUDIT

**Status:** implementer hazard map (docs-only)  
**Date:** 2026-07-31  
**Branch work:** `storylint/doc-contradictions`  
**Authority:** [IA_MAP.md](./IA_MAP.md) rulings + founder decisions win. Shipped = `src` on audit head. Product forks → rat (not resolved here).  
**Why:** twice in one session a doc nearly caused a wrong build (faces ≤3; Canon sheet→center). Catch the rest before process luck runs out.

---

## How to read

| Field | Meaning |
|-------|---------|
| **Risk** | Likelihood an implementer builds the wrong thing soon |
| **Claim A / B** | Verbatim (or tight paraphrase) + `file:line` |
| **Shipped** | Verified in `src` this pass |
| **Locked** | IA_MAP / founder ruling if any |
| **Resolution** | Stale fix applied · flag to rat · leave |

**Known landmines (confirm matrix at bottom):** three ecosystems · max depth 3 · no fourth ecosystem · no new panels · Continuity = verb not ecosystem (off top bar) · Draft = prose home · chapters never become Canon · kind labels Characters/Lore/World/Organizations post-L2 revert.

---

## Ranked contradictions

### C1 — Companion face count: “≤3” vs allow-list of 5  
**Risk:** **Critical** (already almost deleted a working face)

| | |
|--|--|
| **Claim A** | `docs/03-ux.md:194` — “Rules: **≤3 face tabs**; ≤1 footer primary; …” |
| **Claim B** | `docs/design/COMPANION.md` Writing table lists Chat · Write · Check · Inbox (+ Research as optional 4th / More). `COMPANION.md:157` — “**≤3 face tabs** visible (4th = overflow/More if needed).” |
| **Also** | `docs/CALM_BUDGET.md` B3 — writing faces **≤5** total HARD ceiling; wrap/More shape HARD; **not** a ≤3 product gate (ox ACCEPT). |
| **Shipped** | `AgentPanel.tsx` `FACES.writing = ['chat','write','check','research','inbox']` (**5**). `PRIMARY_FACES.writing = ['chat','write','check']` (**3**). Inbox badge-style; Research under **More**. Default face **chat**. |
| **Locked** | No IA_MAP “delete Research/Write” ruling. D6 chrome density is shipped. Ox/CALM: ≤3 as **visible primaries**, not allow-list amputation. |
| **Resolution** | **Stale wording fixed** in `03-ux.md` + `COMPANION.md` this branch: allow-list may be 5; **≤3 primary face tabs** + Inbox badge + More overflow. CALM already correct. |

---

### C2 — Canon sheet: center workspace vs binder Level-3 stack  
**Risk:** **Critical** (D5 worker task directly opposes IA)

| | |
|--|--|
| **Claim A** | `e2e/output/density-audit.md:74` — “**Fix direction:** open sheet in center workspace (map collapses or splits); binder stays list…” · `:145` task **D5+D9** “Sheet opens in center…” |
| **Claim B** | `docs/IA_MAP.md:86` — “A sheet opened in the **binder detail stack** is still the Level-3 Canon thing… **No separate center sheet surface is required.**” · `:115` — “Only **one** center surface at a time. (Canon sheet is a Level-3 thing in the binder detail stack…)” · `:190–192` §4.4 — “**Where:** binder detail stack… **not a center surface.**” |
| **Shipped** | `Binder.tsx` mounts `SheetEditor` when `editingSheetId` set; center stays map/Draft/Lab (`Shell.tsx` workspace modes manuscript \| lab \| graph). |
| **Locked** | **IA_MAP §2 / §4.4** — binder stack. |
| **Resolution** | **Not a product call for pig.** Ox adjudicating (rat note). **Audit annotated** this branch: D5 marked **CONTRADICTS IA_MAP — do not implement pending adjudication**. Options for rat (below). |

**Options for rat (product):**  
1. **Keep IA** — fix density pain inside binder stack (park/clear on mode leave = D9 only; widen binder editor UX). Retract D5 center-stage.  
2. **Overturn IA** — sheet becomes center surface; rewrite §2/§4.4/depth examples; big Shell change.  
3. **Hybrid** — map remains default center; explicit “Stage sheet” expands center temporarily (new ruling required).

---

### C3 — Continuity on top bar (diagram / companion) vs final ruling  
**Risk:** **High** (re-adds L0 job CTA; fights CALM B2)

| | |
|--|--|
| **Claim A** | `docs/03-ux.md:89` ASCII — “top bar: project name · chapter · **Continuity** · Focus · Agent toggle”. `docs/design/COMPANION.md:47` — “**Top-bar Continuity** may remain a power shortcut…”. `:174` — “optional top-bar run”. |
| **Claim B** | `docs/03-ux.md:260` — “Run Continuity from Companion **Check** (no top-bar button — Continuity is a verb, not an ecosystem)”. `docs/IA_MAP.md:50` / `:238` — never in top bar; Check sole entry; **removed from top bar**. `docs/CALM_BUDGET.md` B2-job-primary = 0. |
| **Shipped** | `Shell.tsx` topbar ecosystem = Draft · Lab · Canon only; **no** Continuity button (`action-continuity` absent). `runContinuity` only via companion Check. |
| **Locked** | IA_MAP §6 Continuity ruling (user, final). |
| **Resolution** | **Stale fixed** in `03-ux` diagram + `COMPANION.md`. IA status rows still say historical milestone name “Continuity Draft-only” — **annotated** as step title, not current placement. `density-audit.md` historical snapshot **bannered**. |

---

### C4 — density-audit as live worklist vs frozen pre-fix snapshot  
**Risk:** **High** (implements fixed bugs again)

| | |
|--|--|
| **Claim A** | Audit faults: Continuity top primary; narrow ecosystems missing; writing 5 equal faces; craft 8; etc. (`e2e/output/density-audit.md` passim). |
| **Claim B** | Current dev: Continuity off topbar; narrow ecosystems retained; D6 faces; D3/D8 density; CALM scoreboard says re-measure ≥ `5db610c`. |
| **Shipped** | Matches Claim B for Continuity / Draft·Lab·Canon labels / D6 PRIMARY_FACES (spot-checked). |
| **Locked** | N/A (QA artifact). |
| **Resolution** | **Banner added** on audit: historical @ older head; not an implementer checklist without re-run. D2/D6/D7/D8 rows noted likely superseded. |

---

### C5 — Graph filter chips: raw enum vs CANON vocabulary  
**Risk:** **Medium–High** (L2 rename thrash already happened once)

| | |
|--|--|
| **Claim A** | `docs/design/CANON-VOCABULARY.md` — display **Characters / Lore / World / Organizations**; never invent People/Places&things/Groups in polish PRs. |
| **Claim B** | `docs/IA_MAP.md:176` lists “Kind filters (character/lore/world/org)” as **data** kinds (enums). |
| **Shipped** | Binder uses `SHEET_KIND_LABEL` → Characters… (`workspace.ts`). **Graph** `RelationshipGraph.tsx` filter buttons render **raw** `{kind}` (`character`, …). |
| **Locked** | Vocabulary doc + L2 revert: author-facing labels = Characters/Lore/World/Organizations. |
| **Resolution** | **Doc vs code gap** (not two docs fighting). Flag for implementer: map chips must use `SHEET_KIND_LABEL`. No product fork. Optional one-line IA note that filter **labels** follow vocabulary (enums stay lowercase). **IA note added** this branch. |

---

### C6 — IA “UI still says manuscript / Write” vs shipped Draft ecosystem  
**Risk:** **Medium**

| | |
|--|--|
| **Claim A** | `docs/IA_MAP.md:41` — Draft ships + “**rename** (UI still says manuscript / Write)”. |
| **Claim B** | Top ecosystem control label is **Draft** (`Shell.tsx`). Internal mode key remains `manuscript`. Companion face **Write** = co-write, not ecosystem. |
| **Shipped** | Ecosystem button text **Draft**; mode `'manuscript'`; face `write`. |
| **Locked** | User-facing ecosystem = Draft (naming backlog largely done). |
| **Resolution** | **IA status cell tightened** this branch: user-facing Draft ships; code mode `manuscript`; Write face ≠ ecosystem. |

---

### C7 — Research / 06 “temporary Continuity top shortcut”  
**Risk:** **Medium** (migration language read as permission)

| | |
|--|--|
| **Claim A** | `docs/research/ui-ux/06-storylint-implications.md` P1 — “Continuity as Check-primary; **top shortcut temporary**”. `02-progressive-disclosure.md` demote-over-time example names top Continuity. |
| **Claim B** | Final: Continuity **never** top bar (IA + shipped). |
| **Shipped** | No top Continuity. |
| **Locked** | IA final ruling. |
| **Resolution** | **Research notes updated** to past-tense / removed temporary shortcut. Research remains non-lock; still shouldn’t contradict. |

---

### C8 — `@bible` context chip vs Canon vocabulary  
**Risk:** **Low–Medium**

| | |
|--|--|
| **Claim A** | `docs/design/CANON-VOCABULARY.md` prefers `@canon` over `@bible` on writing + Fill. |
| **Claim B** | Shipped `AgentPanel.tsx` still shows `<Badge>@bible</Badge>` in writing. |
| **Shipped** | `@bible` badge present. |
| **Locked** | Vocabulary intent = `@canon`; not a hard IA depth rule. |
| **Resolution** | **Flag only** — copy rename, not structure. No silent product change in this docs task. |

---

### C9 — UX_PASS Continuity row without Check home  
**Risk:** **Low–Medium**

| | |
|--|--|
| **Claim A** | `docs/UX_PASS.md` shell drive lists “Continuity” among shell checks without “Check face only”. |
| **Claim B** | IA / 03-ux: Continuity entry = Check face. |
| **Shipped** | Check face run. |
| **Resolution** | **UX_PASS clarified** this branch: Continuity via Companion Check (not top bar). |

---

### C10 — COMPANION “research” as a center context  
**Risk:** **Low**

| | |
|--|--|
| **Claim A** | `COMPANION.md:25` contexts include “(+ `research` focus)”. |
| **Claim B** | Shipped `CompanionContext = 'writing' \| 'lab' \| 'details' \| 'graph'` only; Research is a **face**. IA: Research not ecosystem #4. |
| **Resolution** | **COMPANION tightened**: research is a face, not a fifth center context. |

---

## Consistent (no contradiction found)

| Landmine | Docs | Shipped |
|----------|------|---------|
| Three ecosystems only | IA §1, 03-ux, CALM, research | Draft · Lab · Canon top controls |
| Max depth 3 | IA §2, 03-ux | Home → ecosystem → thing; sheet = L3 in binder |
| No fourth ecosystem | IA §13, 03-ux | Research/Graph/Review not top places |
| No new panels | IA QA banner, research 06 | No fourth permanent region |
| Continuity ≠ ecosystem | IA §6 (after fixes above) | Off top bar; Check entry |
| Draft = prose home | IA §4.1, J1 | `workspaceMode: 'manuscript'` + Draft label |
| Chapters never become Canon | Lab promote: beat → `chapter-stub` (Draft); sparks → `sheet-proposal` + Accept | `domain/lab.ts` `PromoteAs` |
| Kind labels Characters/Lore/World/Organizations | CANON-VOCABULARY; binder `SHEET_KIND_LABEL` | Binder OK; **graph chips still raw** (C5) |

`docs/GIT_WORKFLOW.md` — process only; no product IA fight found this pass.  
`docs/design/TOKENS.md` / STITCH / REFERENCES — no ecosystem/depth fights found.  
`docs/CALM_BUDGET.md` r2 — aligned with ox ACCEPT; not a source of C1/C2.

---

## Fixes applied this branch (no product judgment)

| File | Change |
|------|--------|
| `docs/03-ux.md` | Top-bar ASCII: Continuity removed; face rule = ≤3 **primary** tabs + More + Inbox badge; allow-list may include Research/Write. |
| `docs/design/COMPANION.md` | Remove top-bar Continuity shortcut; ≤3 **visible primaries**; research = face not center context; mapping table updated. |
| `docs/IA_MAP.md` | Milestone “Continuity Draft-only” annotated historical; Draft rename status tightened; kind **labels** → vocabulary pointer. |
| `docs/research/ui-ux/06-storylint-implications.md` | Continuity top shortcut → removed / Check-only. |
| `docs/research/ui-ux/02-progressive-disclosure.md` | Demote example no longer implies live top Continuity. |
| `docs/UX_PASS.md` | Continuity path = Check face. |
| `e2e/output/density-audit.md` | Historical banner + D5 blocked note applied in working tree (`e2e/output` is **gitignored** — re-apply on next audit run or read C2/C4 here as source of truth). |

**Not changed (need rat/ox):** Canon sheet center vs binder (C2 options); `@bible` → `@canon` code (C8); graph chip label code (C5 implementer fix).

---

## Process recommendation (for rat)

1. **IA_MAP wins** on structure; audits/research/COMPANION never spawn worker tasks that oppose §2/§4/§6 without an explicit overturn.  
2. Any density “Fix direction” that moves a surface must cite IA section or be labeled **proposal**.  
3. Face-count language must distinguish **allow-list** vs **visible primaries** vs **CALM HARD**.  
4. Re-run `e2e/density-audit.mjs` before filing new D-tasks; freeze old output as `density-audit-YYYYMMDD.md` or banner it (done).

---

## One-line

**Docs nearly deleted Research and nearly restaged Canon sheets; face chrome ≠ face allow-list, and density fix directions are not IA. Remaining product fork: C2 sheet stage (ox/rat).**
