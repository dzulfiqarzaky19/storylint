<!--
  Tracked decision record (moved from e2e/output/ia-final-qa.md).
  Author: qa (ia-final-qa.mjs)
  Kind: qa-record
  Decided: PASS 14/14 J1/J2/J3 + Canon entry @ 6a2a74b
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# IA final QA — J1 / J2 / J3 + Canon entry

- **started / finished:** 2026-07-31 ~17:40–17:41Z
- **HEAD:** `6a2a74b` (empty create two doors + narrow topbar)  
  atop `5bfe65e` Canon entry, `55b9033` Continuity Draft-only, `67592a1` naming/entry, `b68703e` promote split
- **tool:** Playwright global via `e2e/ia-final-qa.mjs` (read-only; no src product edits)
- **overall:** **PASS** (14 / 14)

## Summary table

| Area | Item | Verdict |
|------|------|---------|
| **6** | Topbar calm Draft · Lab · Canon; no Graph/Editor; Export/New in Project menu; single identity | **PASS** |
| **J1** | Open → Draft last chapter → type → Saved → Focus purity | **PASS** |
| **J2** | New project two doors (no chapter clear) | **PASS** |
| **J2** | Start in Lab → cards → beat Send to Draft → stub | **PASS** |
| **J2** | Spark Promote to Canon stays Lab; Accept pack → sheet | **PASS** |
| **J3** | Continuity visible only on Draft with chapter | **PASS** |
| **J3** | Continuity hidden on Lab (and Canon) | **PASS** |
| **J3** | Run → Inbox Accept/Edit/Reject gates | **PASS** |
| **4** | Canon first visit → map; crumb "Canon" not Graph | **PASS** |
| **4** | Open sheet; leave; re-enter → last sheet | **PASS** |
| **5** | Narrow 390 Draft/Lab/Canon no H-overflow | **PASS** |

## Detail

### 6 — Regression / calm topbar — PASS
- Buttons: Draft=1 Lab=1 Canon=1; Graph=0 Editor=0
- Project menu: New project + Export present
- Single `Active project` select
- Shots: `ia-final-06-topbar-calm-desktop.png`, `ia-final-06-project-menu.png`

### J1 — Write path — PASS
- Landed last Draft chapter (`Breach beat-…`)
- Typed prose → **Saved**
- Focus: `data-focus=true`, paper on, binder/agent rails off
- No Lab/Canon/Research required
- Shots: `ia-final-j1-01-type-saved.png`, `ia-final-j1-02-focus.png`

### J2 — Lab promote path — PASS
- **New project** `QA J2-…`: `chaptersOnCreate=0`, doors **Write | Start in Lab** immediately (fix from QA1 nit)
- Shot: `ia-final-j2-01-two-doors-on-create.png`
- Start in Lab → bench; beat **Send to Draft**; spark **Promote to Canon**
- Beat → Draft stub title match; chapters 0→1
- Spark promote: stayed Lab (`aria-pressed=true`); sheets unchanged until **Accept pack** in Inbox; sheets 0→1 after accept
- Shots: `j2-02`…`j2-06`

### J3 — Continuity — PASS
- Continuity **visible** on Draft with chapter; **hidden** on Lab; **hidden** on Canon (canon-first cont=0)
- Continuity run: Inbox showed Accept/Edit/Reject gates (counts ≥4 each). Inline manuscript marks were 0 this fixture run — gates still present (pass per Accept/Edit/Reject criterion).
- Shots: `ia-final-j3-01-marks.png`, `ia-final-j3-02-inbox-gates.png`

### 4 — Canon entry — PASS
- First visit (cleared localStorage canon keys): map visible; breadcrumb **Canon** (not Graph)
- Opened sheet from binder; crumb = sheet name
- Draft → Canon re-entry restored last sheet (name field + crumb)
- Shots: `ia-final-canon-01-first-map.png`, `02-sheet-open.png`, `03-reenter-memory.png`

### 5 — Narrow 390 — PASS
- Draft 390/390; Lab 390/390; Canon 390/390 (no horizontal overflow)
- Shots: `ia-final-narrow-draft.png`, `narrow-lab.png`, `narrow-canon.png`

## Faults

**None blocking.** Optional nit (not fail):
- J3 fixture run produced Inbox proposals without yellow/red manuscript marks this pass. Gates work; mark paint may depend on fixture extract content. Worth a dedicated continuity mark smoke if product cares about Y/R paint every run.

## Shots index

- `e2e/output/ia-final-06-topbar-calm-desktop.png`
- `e2e/output/ia-final-06-project-menu.png`
- `e2e/output/ia-final-j2-01-two-doors-on-create.png`
- `e2e/output/ia-final-j2-02-lab-entry.png`
- `e2e/output/ia-final-j2-03-cards-labels.png`
- `e2e/output/ia-final-j2-04-beat-to-draft.png`
- `e2e/output/ia-final-j2-05-spark-promote-stays-lab.png`
- `e2e/output/ia-final-j2-06-accept-inbox.png`
- `e2e/output/ia-final-j1-01-type-saved.png`
- `e2e/output/ia-final-j1-02-focus.png`
- `e2e/output/ia-final-j3-01-marks.png`
- `e2e/output/ia-final-j3-02-inbox-gates.png`
- `e2e/output/ia-final-canon-01-first-map.png`
- `e2e/output/ia-final-canon-02-sheet-open.png`
- `e2e/output/ia-final-canon-03-reenter-memory.png`
- `e2e/output/ia-final-narrow-draft.png`
- `e2e/output/ia-final-narrow-lab.png`
- `e2e/output/ia-final-narrow-canon.png`

**Verdict: IA steps 1–3 + QA fixes — PASS for final walkthrough.**
