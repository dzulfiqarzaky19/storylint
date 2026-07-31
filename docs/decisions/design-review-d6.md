<!--
  Tracked decision record (moved from e2e/output/design-review-d6.md).
  Author: ox
  Kind: design-review
  Decided: ACCEPT D6 companion face density (Chat/Write/Check + More/Inbox badge)
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# Design review — D6 companion faces

**Reviewer:** ox (read-only)  
**Merge:** `5db610c` · topic `ccb729f`  
**Code:** `AgentPanel.tsx` + `AgentPanel.css`  
**Shots:** D6 script exists (`e2e/d6-companion-shots.mjs`); `e2e/output/density/companion-*` and R1 Check shots are **pre-D6** (still show Research as peer + Inbox wrap). Verdict is **code-primary** until fresh shots land.

---

## Verdict: **ACCEPT**

| Check | Verdict |
|-------|---------|
| Shape Chat · Write · Check · Inbox · More→Research | **ACCEPT** |
| Continuity primary only on Check | **ACCEPT** |
| Check resting reads as rest (not dead panel) | **ACCEPT** |
| Footer primary discipline (≤1 primary) | **ACCEPT** |
| One face row @390 (no wrap) | **ACCEPT** (CSS `nowrap`; confirm with live shot) |
| Research under More findability | **ACCEPT** with P3 residual |

---

## Shape

Writing allow-list stays five faces; **chrome** is:

- Primaries: **Chat · Write · Check**
- **Inbox** always present as badge-style tab (count when pending)
- Overflow: **More** → menuitem **Research**
- Active overflow face relabels the tab to **Research** (not stuck on “More”) — correct recovery

Lab/Graph stay ≤3 peers (Chat·Spark·Inbox / Chat·Inspect·Inbox). Details: Chat·Fill + More→Research + Inbox.

Default writing face remains **Chat**. Continuity is not a face and not top-bar.

---

## Check resting (R1 P4)

Idle path:

- `EmptyState` title **“Nothing checked yet”**
- Hint: Check is the only Continuity entry; findings → marks + Inbox; never auto-canon

After run: summary line with red/yellow/proposals + Inbox pointer.  
Running: live status line.

This is **rest with instruction**, not a blank void + footer-only shout. **B3-rest PASS** in code.

---

## Footer

Check footer: **Run Continuity** `variant="primary"` + quiet Review + Craft.  
One primary. Three total actions = WARN edge of B3-footer-total, not HARD. Acceptable job cluster on the Check face.

Write footer: three equal co-write skills, no fake primary. OK.

---

## One row @390

CSS:

- `.companion__faces { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none }`
- Tabs `flex: 0 0 auto; white-space: nowrap`
- Narrow: tighter gap/padding; Inbox `max-width: 5.5rem`

**faceRows = 1** by construction (wrap disabled).  
Residual: horizontal scroll inside the face strip is preferred to wrap; strip must not force **page** `overflowX`. Fresh 390 shot should prove Inbox + More visible without second row.

Pre-D6 phone shots (Inbox on row 2) are **obsolete** for this verdict.

---

## Research under More

Research is a **real face** (P3 tool), not a settings nicety. Demotion cost is one click + discovery of **More**.

Mitigations that make this acceptable:

1. Menu item label is the full word **Research** (not “Other…” / icon-only).
2. While Research is active, the overflow tab **reads Research**.
3. Writing primaries keep the daily loop (Chat/Write/Check); Research is episodic gather.

**Not unfindable.** Residual **P3:** first-run discoverability — if tips/onboarding mention Research, they should say **More → Research**. Optional later: desktop-only fourth primary is a **product** change, not a D6 defect.

---

## Residuals (non-blocking)

| Rank | Item |
|------|------|
| P2 | Capture fresh D6 shots (1440+390: chat/check/more-open/research/lab) into `e2e/output/d6-*` and retire pre-D6 companion density shots for review |
| P3 | Tips / empty copy that name Research should point at More |
| P3 | Companion still shows `@bible` badge — dialect (see `docs/design/CANON-VOCABULARY.md`), not D6 scope |
| P4 | Face-strip `overflow-x: auto` vs page overflow — measure in Task S |

---

## CALM_BUDGET map

| Budget | D6 |
|--------|-----|
| B3-writing-count ≤5 | PASS |
| B3-lab/graph ≤3 | PASS |
| B3-wrap faceRows@390=1 | PASS (code) |
| B3-overflow-shape one More | PASS |
| B3-footer-primary ≤1 | PASS on Check |
| B3-default-face Chat | PASS |
| B3-rest Check | PASS |
| B3-inbox-wall | PASS (Inbox face owns proposals; Chat not a wall) |
