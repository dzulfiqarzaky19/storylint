# TASK BF — End-to-end journey walk (report-only)

**From:** koala  
**To:** rat · ox  
**Status:** report-first · no product fix  
**Provenance:** owned-stack @ `e186f09` (merge of BA docs + origin/dev). Dirty: BF probes only.  
**Method:** Playwright walk J1/J2/J3 × 3 seeds × 2 viewports; fixture LLM; then focused rechecks that separate probe chrome from product. DOM/ARIA, not NVDA.  
**Artifacts:**  
- `e2e/bf-journey-walk.mjs` · `e2e/output/bf/report.json` · `summary.txt` · `parsed.txt`  
- `e2e/bf-recheck.mjs` · `e2e/output/bf/recheck.json`  
**IA:** `docs/IA_MAP.md` §9–12 · rulings: seeded-default, leave-guard, empty-canon-send, AU live, one-primary-door  

### Seeds
| Seed | Shape |
|---|---|
| **seeded** | 1 chapter, `title: ''`, `body: ''` (factory / BD P1) |
| **empty** | New project: 0 chapters, 0 sheets |
| **populated** | 2 chapters w/ prose, 1 Canon sheet, 2 Lab cards |

### Viewports
1440×900 (dual-rail desk) · 390×844 (phone drawers)

---

## Executive verdict

**Desk journeys mostly hold in composition on desktop.** J1 type→Saved, Lab round-trip persistence, J2 Promote→Inbox pending, J3 Continuity gate + run, dirty-sheet leave guard, skip-link activate, empty-title seed, Continuity demote on empty body — all **green @1440**.

**Composition defects that isolation missed show up mainly on phone and on first-boot focus teach vs chrome.** Ranked below by likelihood an author loses work or gives up.

---

## Ranked findings

### 1. Phone drawer backdrop blocks the job surface — **high** (give-up)

**Where:** @390, all seeds when Binder and/or Companion drawer is open.  
**Evidence:**  
- Walk: Lab `New card` click times out — `agent__transcript` / companion drawer intercepts pointer.  
- Walk: empty J1 `Write` click times out — `ui-drawer__backdrop` intercepts.  
- Recheck `C-dual-drawer-body-click`: Companion open → `.manuscript__body` click **fails** (backdrop).  
- Recheck `B-*`: with `dismissDrawers`, Write → body focus works; Lab New card works.

**Composition:** Each rail is correct alone (drawer focus trap, 44px faces, companion open). Together on phone, **opening Companion to run Check/Inbox or Binder to pick a chapter leaves a modal backdrop over the manuscript/Lab**. Author cannot type or create a card until they dismiss. No obvious “tap paper to dismiss” taught in the failure path.

**Not:** desktop dual-rail (rails don’t use blocking backdrop the same way).  
**Author risk:** Phone J1/J2 feels broken mid-journey (“I opened Check and now I can’t write”). High give-up, not silent data loss.

**IA tension:** Job tools live in Companion (Check) while primary work is center paper. Phone IA assumes drawer serialization; product doesn’t recover center affordance while drawer is up.

---

### 2. Body one-shot focus is real — but chrome steals it and it never returns — **medium-high** (first-boot teach)

**Corrected vs first walk:**  
First walk false-flagged “body focus miss” because it measured **after** `gotoWorkspace(Draft)` click + `ensureBinderOpen`. Those moves correctly leave focus on Draft button / Binder dialog.

**Recheck truth:**
| Check | Result |
|---|---|
| Pure reload seeded @1440 | **body active** (`Chapter text`) |
| Pure reload seeded @390 + dismiss drawers | **body active** |
| Empty → Write @390 | **body active** after create |
| After click Draft ecosystem | focus stays on **Draft** button; body does **not** reclaim (one-shot `didAutoFocusBody`) |
| Binder open @390 | focus on **Binder** drawer; body not active |

**So:** BD P1-3 **ships and works on cold load**. It does **not** fight leave-guard (Canon-only). It does **not** re-fire when body stays empty after chrome steals focus.

**Author risk:** Mild on desktop (mouse users click paper). Keyboard / phone: first teach can vanish as soon as they open Binder or tap Draft again, with no second teach.

**Skip link:** Present (`Skip to workspace`). Activate → `main#workspace`. Body focus does **not** re-steal after skip activation (good).  
**First Tab after body-focused load** lands on companion **Chat** tab (body is in tab order mid-page), not on skip. Skip remains `sr-only` until focused. Not a regression unique to body focus, but programmatic initial focus means keyboard users never encounter skip on first boot unless they Shift+Tab. Flag as **a11y composition note**, not critical loss.

---

### 3. New chapter still mints template title `Chapter 1` — **medium** (ownership / IA-adjacent)

**Factory seed:** empty title + placeholder `Name this chapter` — **PASS** (BD P1).  
**New project → Write / New chapter:** creates chapter titled **`Chapter 1`** (recheck `D-new-chapter-title`, empty@1440 `empty-create`).

Same ownership smell ox rejected for factory `"Chapter One"`, now on the **create** path. Seeded default is fixed; **empty-project first chapter** reintroduces a finished-looking label.

**Author risk:** Low data loss; medium “is this mine?” confusion on the path IA §10 advertises as Write door.

---

### 4. Multiple polite live regions after Continuity — **medium** (noise, not lost work)

After J3 Continuity @1440, simultaneous polite text included:  
`Saved` · `Inbox: N pending` · `Last Continuity (fixture): …` · Continuity card body copy.

AU fixed **same-fact double** (agent busy vs Continuity). Remaining issue is **many polite channels with durable text**, not a single busy dialect collision. Screen-reader users may hear a queue after one Check run.

**Author risk:** Confusion / fatigue, not wrong Accept. Not NVDA-verified.

---

### 5. Phone empty Draft can show two solid create primaries — **medium** (duplicate door family)

@390 empty, Binder open: solid **`Write`** (center) + solid **`New chapter`** (binder) in one frame (`land-draft` primaries).  
IA §10: two doors max (**Write** / **Start in Lab**). Binder New chapter + center Write is the known empty dual-rail recipe; on phone with binder drawer open it reads as **two equal solid creates for the same job**.

Desktop empty@1440: only binder **New chapter** solid in snapshot (center empty state may demote) — better.

**Cousin of** duplicate-primary defect class rat named. Not Continuity; create-door composition on phone.

---

### 6. Populated Draft still paints Canon **New sheet** as solid primary in the binder — **low-medium**

Populated@1440 Draft land: primaries include **`New sheet`** (enabled primary) while center is manuscript. Create-door demote rules are ecosystem-aware for Draft chapter create, but Canon **New sheet** stays solid in the binder group during Draft work.

**Author risk:** Wrong-job click into Canon sheet form while intending to write. Leave-guard protects dirty sheet exit (verified). Still a competing solid outside J1.

---

## What held (isolation → composition)

| Path | @1440 | @390 (drawers clear) |
|---|---|---|
| J1 type → Saved | PASS | PASS (after dismiss) |
| J1 Draft→Lab→Draft prose survives | PASS | PASS when J1 completed |
| Seeded empty title + `Name this chapter` | PASS | PASS |
| Continuity **disabled + ghost** on empty body | PASS | PASS |
| Continuity **primary** once prose exists | PASS | PASS |
| J2 create card + Promote → pending proposals (2) | PASS | PASS when drawers dismissed |
| J2 return Draft | PASS | — |
| J3 Check run (fixture) | PASS | PASS when manuscript exists |
| Inbox Accept pack primary when pending | PASS @1440 | often empty face if promote skipped |
| Dirty sheet leave guard on Draft switch | PASS (dialog) | not fully re-hit @390 |
| Skip → `#workspace` | PASS | PASS |
| Empty-canon Send omitted | PASS (`send: null`) | PASS |
| Focus mode toggle present | exercised | exercised |

**No critical “typed prose vanished”** event in any completed J1.  
**No leave-guard bypass** when dirty sheet identity edited then Draft clicked (@1440).  
**Body focus does not fight leave-guard** (different surfaces).

---

## False positives from the first matrix (do not file as product bugs)

| Flag | Why wrong |
|---|---|
| `BF-body-focus-miss` after walk land | Measured after Draft click / Binder open; pure reload passes |
| `BF-j1-threw` / `BF-j2-threw` @390 only | Drawer backdrop intercept; product path works after `dismissDrawers` |
| Treating dual-live `Saved` as Continuity double-speak | Separate save status live; AU dialect still split by job |

---

## IA_MAP contradictions / tensions

1. **§10 two doors** vs phone empty **Write + New chapter** both solid when binder open.  
2. **§12 job tools in journey** vs phone: opening Check **covers** the journey surface.  
3. **J1 must not require Lab/Graph/Research** — held; top chrome calm; Continuity only on Check face.  
4. **Seeded third state** — held for Continuity weight + empty title; create path `Chapter 1` weakens ownership story.  
5. **No silent Accept** — held (Inbox Accept pack explicit).

---

## Suggested fix order (not implementing)

1. **Phone drawer vs center job** — dismiss-on-outside / don’t block manuscript pointer when drawer is “assistant” not modal route; or auto-dismiss companion when focusing center. Highest author give-up.  
2. **Re-teach or restore body focus** when returning to empty Draft from chrome without making it fight skip/leave (optional; medium).  
3. **New chapter title** — empty title or `Untitled` + placeholder; stop minting `Chapter 1`.  
4. **Live region budget** after Continuity — one durable result channel; Saved/Inbox already have homes.  
5. **Demote Canon New sheet** while workspace is Draft (or only solid on Canon).  

Lab lifecycle (BA) remains **queued follow-on**, not BF.

---

## Method note

Walk used helpers (`gotoWorkspace`, `ensureCompanionOpen`, `ensureBinderOpen`) that **intentionally move focus and open drawers**. That is closer to “power user with rails open” than “cold first boot.” Rechecks cover cold boot and drawer-dismissed phone. Trust **recheck** for body-focus and phone create; trust **walk** for multi-step save/promote/guard.

— koala · TASK BF report-only @ `e186f09`
