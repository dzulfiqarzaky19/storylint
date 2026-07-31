<!--
  Tracked decision record (moved from e2e/output/ia-step1-qa.md).
  Author: qa (ia-step1-qa.mjs)
  Kind: qa-record
  Decided: PASS with nits — IA step-1 naming/entry @ 67592a1/b68703e
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# IA step 1 QA

- **started:** 2026-07-31T17:22:32Z
- **finished:** 2026-07-31T17:23:36Z
- **HEAD:** `67592a1` (feat shell IA naming + empty entry) + `b68703e` (Lab promote split)
- **tool:** Playwright (global `D:/npm-global/node_modules/playwright`) via `e2e/ia-step1-qa.mjs`  
  (`playwright-cli` not on PATH; same engine as e2e smokes)
- **scope:** read-only visual/behavioral QA — **no src edits**
- **overall:** **PASS with nits** (core IA step-1 naming/entry behaviors ship; 2 product nits logged)

## Checklist

### a. Topbar says Draft · Graph · Lab (no Editor) — **PASS**

- Desktop topbar buttons: Draft, Graph, Lab present; **Editor absent**.
- Continuity still present as peer chrome (out of step-1 scope; step-2 calm top bar).
- shot: `e2e/output/ia-qa-01-topbar-desktop.png`

### b. Empty project shows two doors Write | Start in Lab — **PASS (product nit)**

- When chapters are empty, center shows **Start this project** with doors **Write** | **Start in Lab**.
- shot: `e2e/output/ia-qa-02-empty-two-doors.png`
- **Nit / fault:** UI **New project** still seeds `Chapter One`, so doors **do not appear on create**.  
  Driver had to `PUT /api/project` with `chapters: []` (`status 200`) then reload to see doors.  
  **First-run empty entry is not reachable via normal New project flow.**

### c. Binder groups labeled Draft / Canon / Lab — **PASS**

- When binder rail is open: section labels **DRAFT**, **CANON**, **LAB** are visible.
- Evidence shot after beat promote (binder open): `e2e/output/ia-qa-06-beat-send-to-draft.png`
- Automated check at lab-empty moment failed because binder was closed (`ia-qa-04-binder-groups.png` is lab with binder collapsed). Visual product check uses shot 06.

### d. Lab card buttons Send to Draft / Promote to Canon — **PASS**

- Beat card → **Send to Draft**
- Character spark → **Promote to Canon**
- Place → **Promote to Canon**
- No bare **Promote** on those cards.
- shot: `e2e/output/ia-qa-05-lab-promote-labels.png`

### e. Beat promote jumps to new chapter stub in Draft — **PASS**

- Click **Send to Draft** on beat:
  - Draft topbar `aria-pressed=true`
  - Manuscript/Draft main visible
  - New chapter title = beat title (`Breach beat-…`)
  - Binder DRAFT lists the new chapter
  - Chapter count 0→1
  - Body empty stub (`Write…`)
- shot: `e2e/output/ia-qa-06-beat-send-to-draft.png`

### f. No layout breakage at desktop + narrow — **PASS (metric nit)**

- Desktop 1440: no horizontal document overflow; layout intact (`ia-qa-08-layout-desktop.png`).
- Narrow 390×844 visual: readable Draft page, Tags disclosure, no crushed chrome (`ia-qa-09-layout-narrow.png`).
- **Metric nit:** `documentElement.scrollWidth` reported 454 vs client 390 (~64px). Wide elements listed were shell chrome/page wrappers, not a broken overlapping rail. No functional layout breakage observed in screenshot. Not blocking step-1 naming.

### g. Focus mode still pure page — **PASS**

- `data-focus=true`, manuscript paper visible, binder rail hidden, agent rail hidden.
- Center page remains the only work surface.
- shot: `e2e/output/ia-qa-07-focus-pure-page.png`

## Shots

- `e2e/output/ia-qa-01-topbar-desktop.png`
- `e2e/output/ia-qa-02-empty-two-doors.png`
- `e2e/output/ia-qa-03-lab-surface.png`
- `e2e/output/ia-qa-04-binder-groups.png` (binder closed; use 06 for groups)
- `e2e/output/ia-qa-05-lab-promote-labels.png`
- `e2e/output/ia-qa-06-beat-send-to-draft.png`
- `e2e/output/ia-qa-07-focus-pure-page.png`
- `e2e/output/ia-qa-08-layout-desktop.png`
- `e2e/output/ia-qa-09-layout-narrow.png`
- `e2e/output/ia-qa-10-topbar-narrow.png`

## Faults (report only — not fixed)

1. **New project seeds Chapter One** → empty two-doors entry never shows on create. Doors only after chapters cleared. Conflicts with IA_MAP §15.1 / empty-project two doors as first-run chooser.
2. **Topbar still peers Continuity** with Draft/Graph/Lab (step-2 calm top bar; not a step-1 rename fail).
3. Narrow `scrollWidth` metric > viewport by ~64px (watch in step-2/density; visual OK).

## Verdict table

| id | item | verdict |
|----|------|---------|
| a | Topbar Draft · Graph · Lab, no Editor | **PASS** |
| b | Empty two doors Write \| Start in Lab | **PASS** (nit: not on New project create) |
| c | Binder Draft / Canon / Lab | **PASS** |
| d | Send to Draft / Promote to Canon | **PASS** |
| e | Beat → Draft chapter stub | **PASS** |
| f | Desktop + narrow layout | **PASS** (metric nit) |
| g | Focus pure page | **PASS** |

**IA step 1 naming + entry: PASS with product nit on first-run empty doors.**
