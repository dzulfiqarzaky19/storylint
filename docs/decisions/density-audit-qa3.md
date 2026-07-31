<!--
  Tracked decision record (moved from e2e/output/density-audit.md).
  Author: dolphin
  Kind: audit
  Decided: Surface density fault list @ pre-fix head (historical). D5 center-sheet fix SUPERSEDED by adjudication-d5. Re-run before new D-tasks.
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

> **HISTORICAL SNAPSHOT (not a live worklist).** Captured pre-fix density head. Re-run `e2e/density-audit.mjs` before filing new D-tasks.  
> **D5 “sheet in center” is RETRACTED.** IA_MAP §2/§4.4 STANDS — sheet = binder Level-3 detail stack. See [adjudication-d5-sheet-binder.md](./adjudication-d5-sheet-binder.md) (ox) and [DOCTRINE_AUDIT.md](../DOCTRINE_AUDIT.md) C2. Residue = F1/F2/F3 (Task V), not center stage.

# QA3 — Surface density audit (step 4 worklist)

- **When:** 2026-07-31 ~17:57–18:00Z  
- **Base:** `dev` @ `5458cc4`  
- **Tool:** Playwright global via `e2e/density-audit.mjs` (read-only; no product fixes)  
- **Evidence:** `e2e/output/density/*.png` + `metrics.json` + `inventories.json`  
- **Refs:** `docs/IA_MAP.md` §12 chrome density · §14 inventory · `docs/03-ux.md` Design QA · `docs/research/ui-ux/` (esp. 01/02/06)  
- **Scope surfaces:** Draft page · Lab bench · Canon map · Canon sheet · Companion faces · Binder  
- **Viewports / themes:** 1440×900 + 390×844 · light + dark  

## Verdict

**Density work is justified.** Naming/entry/topbar IA (steps 1–3) hold, but **structured density is uneven**: dual rails dominate desktop, Continuity still reads as L0 primary, Lab/Canon job chrome is flat and duplicated, and narrow **drops the ecosystem switch**.

No raw inline hex in feature DOM this run. Light + dark both readable. Overflow OK on all captured surfaces.

## Metrics snapshot (desktop 1440 light, rails open)

| Surface | binder% | agent% | work% | topbar btns | notes |
|---------|--------:|-------:|------:|------------:|-------|
| Draft | 26 | 26 | 47 | 9 | Continuity **primary**; 8 craft tags |
| Lab | 26 | 26 | 47 | 8 | 14 kind chips (filter+composer) |
| Canon map | 26 | 26 | 47 | 8 | view=filter weight; propose form open |
| Canon “sheet” | 26 | 26 | 47 | 8 | sheet lives in **binder**, center stays map |

Narrow 390 Draft: craft collapses to **Tags +** (good). Topbar loses Draft/Lab/Canon (bad).

---

## Top 10 density faults (ranked by user pain)

### 1. Dual rails own the desk — manuscript is the minority
- **Pain:** High (every J1 session with default rails)
- **Fault:** Binder 380px + Companion 380px ≈ **53% chrome**; workspace ≈ **47%** (`metrics`: binderPct=26 agentPct=26 workPct=47). Airy paper doctrine loses to permanent dual rails. Empty binder fill often ~9% row content in a tall rail.
- **Type:** wasted rail space · cramped work column · airy/cramped imbalance
- **Shots:** `density/draft__1440__light.png`, `draft__1440__dark.png`, `lab__1440__light.png`
- **Anchors (§14):** `src/components/shell/Shell.tsx` (rail mount ~366–373); `src/components/shell/shell.css` (`.shell__rail*`, body grid); token rail widths in design tokens / `shell.css`
- **IA_MAP §12:** default calm; Focus returns purity (Focus OK separately) but **default** is not calm
- **Fix direction (for workers, not done here):** narrower default rails or one-rail default; collapse secondary rail earlier; don’t open both by default on mid widths

### 2. Continuity is louder than Draft · Lab · Canon
- **Pain:** High (hierarchy / Hick — every Draft visit)
- **Fault:** Continuity uses `variant="primary"` (solid) while ecosystem switches are ghost. Reads as **the** action, not L2 job chrome. Violates §12.3 (“Equal top weight forbidden for Continuity”) and control altitude map (Continuity ≠ L0).
- **Type:** competing chrome · oversized control weight
- **Shots:** `density/draft__1440__light.png`, `companion-check__1440__light.png` (also **Run Continuity** in Check)
- **Anchors:** `src/components/shell/Shell.tsx` ~328–344 (`shell__action-continuity`, `variant="primary"`); Check face run control in `src/components/shell/AgentPanel.tsx`
- **Fix direction:** demote Continuity to ghost/secondary; primary run lives in Check face only; or overflow under Check

### 3. Lab kind chrome duplicated (filter row = composer row)
- **Pain:** High on J2 empty bench
- **Fault:** Same 7 kinds appear twice: `lab__filters` (All+kinds) and `lab__composer-kinds` (kinds again) before any card. Empty bench still shows **14 kind buttons** + New card + empty state + companion Spark presets (third kind picker).
- **Type:** competing chrome · no progressive disclosure
- **Shots:** `density/lab__1440__light.png`, `lab__390__light.png`
- **Anchors:** `src/features/lab/LabBench.tsx` ~156–172 (`lab__filters` + `lab__composer-kinds`); Spark presets in `AgentPanel` lab face
- **Research:** 02 progressive disclosure; 06 P3 surface density
- **Fix direction:** one kind control (segmented or select); filter only when cards exist; composer kind via select/dropdown

### 4. Canon map: view · filters · propose form share equal weight
- **Pain:** High when scanning relationships
- **Fault:** Network/Family sit **same visual weight** as kind filters (`character lore world organization`). Desktop **Propose new edge** form always expanded and steals lower half of a 680px workspace even when map empty (“No visible sheets”). Phone collapses propose (+ disclosure) — desktop does not.
- **Type:** competing chrome · hierarchy break · wasted center space
- **Shots:** `density/canon-map__1440__light.png`, `canon-map__390__light.png` (phone better)
- **Anchors:** `src/features/graph/RelationshipGraph.tsx` ~253–268 toolbar; ~232–241 `editorFields`; propose layout in `graph.css`
- **Prior:** orchestrator S2 (view vs filter hierarchy) still open as density
- **Fix direction:** separate view toggle (segmented) from filter chips; collapse propose behind “Propose edge” by default on desktop too

### 5. Canon sheet detail hijacks binder (center stays map)
- **Pain:** High for “open thing” journey
- **Fault:** Selecting/creating a sheet swaps binder body to `SheetEditor` (“Back to binder” + full form) while **center remains Relationships map**. User loses binder list and does not get a true center sheet stage. Depth feels like binder dig, not Home → Canon → sheet. Audit `canon-sheet` shots match map chrome because sheet never owns `#workspace`.
- **Type:** type hierarchy / IA density · wasted dual context
- **Shots:** `density/draft__1440__light.png` (binder showing Kael form during Draft!), `canon-map__1440__light.png`, `binder__390__light.png` (list OK when not editing)
- **Anchors:** `src/components/shell/Binder.tsx` ~162–176 (`editingSheetId` → `SheetEditor`); `src/features/project/SheetEditor.tsx`; Canon landing memory in shell/workspace
- **IA_MAP:** Canon → thing should be the work surface; binder is navigator
- **Fix direction:** **RETRACTED** (ox adjudication). Sheet stays binder L3. See docs/decisions/adjudication-d5-sheet-binder.md.

### 6. Companion faces: five equal permanent tabs (writing)
- **Pain:** Medium–High (constant right-rail noise)
- **Fault:** Writing context always shows Chat · Write · Check · Research · Inbox at equal weight. No collapse of rare faces. Combined with topbar Continuity, Check’s **Run Continuity** triples the Continuity story. Lab face set is calmer (Chat · Spark · Inbox).
- **Type:** competing chrome · progressive disclosure fail
- **Shots:** `density/companion-write__1440__light.png`, `companion-check__1440__light.png`, `companion-research__1440__light.png`
- **Anchors:** `src/components/shell/AgentPanel.tsx` `FACES.writing` ~35–40, face tab render; Check tools strip (Run Continuity / Review / Craft)
- **Fix direction:** default Chat + Inbox badge; park Research/Write under overflow or contextual reveal; single Continuity CTA

### 7. Narrow 390 drops Draft · Lab · Canon switch
- **Pain:** High for phone wayfinding (depth law)
- **Fault:** Topbar at 390 shows binder · project · **Continuity** · Focus · companion — **no ecosystem buttons**. User cannot switch Lab/Draft/Canon without an undiscoverable path (none visible in chrome). Continuity remains the only labeled job control.
- **Type:** competing chrome gone wrong · hierarchy · Design QA narrow
- **Shots:** `density/draft__390__light.png`, `lab__390__light.png`, `canon-map__390__light.png`
- **Anchors:** `src/components/shell/shell.css` (topbar narrow / hide `.shell__topbar-actions` ecosystem); `Shell.tsx` ~306–327
- **Fix direction:** keep segmented Draft/Lab/Canon on narrow (scroll or compact); Continuity into companion Check only on narrow

### 8. Desktop craft tags always fully expanded
- **Pain:** Medium (Draft header clutter)
- **Fault:** Eight craft chips (`char-dev` … `breather`) always visible on desktop above prose. Narrow correctly uses **Tags +** collapse (S4 done). Desktop still competes with title/meta for attention before first sentence.
- **Type:** competing chrome · type hierarchy
- **Shots:** `density/draft__1440__light.png` vs `draft__390__light.png`
- **Anchors:** `src/components/shell/Manuscript.tsx` (craft tag row / collapse breakpoint); `shell.css` / manuscript craft rules
- **Fix direction:** collapse to Tags+ below ~1100 or when >3 selected; show selected only

### 9. Sheet editor stuck open across modes (binder state leak)
- **Pain:** Medium–High (mode confusion)
- **Fault:** After seeding sheet, binder remains on SheetEditor while user is in **Draft** or **Lab** (shots show Kael form + chapter/lab center). Navigator replaced by form outside Canon job. Wasted rail + wrong mental model.
- **Type:** wasted rail · competing chrome
- **Shots:** `density/draft__1440__light.png`, `lab__1440__light.png`
- **Anchors:** `Binder.tsx` `editingSheetId` state; shell mode change handlers in `Shell.tsx` / `useShellState.ts`
- **Fix direction:** clear or minimize sheet edit when leaving Canon; or only allow sheet edit in Canon mode

### 10. Touch / hit targets under 44px on narrow chrome
- **Pain:** Medium (touch profile)
- **Fault:** Icon buttons commonly **32×32** (binder, focus, theme, companion). Metrics `touchFail` high on 390 (e.g. draft 13/14). Design QA: “touch targets adequate on narrow profile”; tokens define `--size-touch-min` ~44 used in graph but not topbar icons.
- **Type:** oversized/undersized controls · Design QA
- **Shots:** `density/draft__390__light.png`, inventories topbar 32×32 icons
- **Anchors:** `src/components/ui` IconButton sizes; `shell.css` topbar icon buttons; `docs/design/TOKENS.md` touch min
- **Fix direction:** narrow profile bump icon hit area to ≥44 without growing visual glyph if needed

---

## Notable non-faults / already good

| Check | Result |
|-------|--------|
| Tokens / no raw feature hex | PASS (inline hex 0; hex only in token sheets / mask stops) |
| Light + dark sanity | PASS both themes |
| Horizontal overflow 1440/390 | PASS |
| Continuity hidden on Lab/Canon topbar | PASS (desktop) |
| Craft tags collapse @390 | PASS (`Tags +`) |
| Canon propose collapse @390 | PASS (details/`+`) |
| Companion context faces shrink on Lab/Canon | PARTIAL good (Lab 3 faces; graph Chat·Inspect·Inbox) |
| Focus purity | Not re-walked this audit (QA2 passed); leave unless regressed |

## Class-name nit (low)

Ecosystem buttons still use class `shell__action-graph` (`Shell.tsx` ~308–322). Naming debt only; not user-visible.

---

## Suggested worker split (for rat)

| # | Task | Primary files | Est. |
|---|------|---------------|------|
| D1 | Default rail width / one-rail default | `shell.css`, `useShellState.ts`, tokens | M |
| D2 | Continuity weight demote + single CTA | `Shell.tsx`, `AgentPanel.tsx` | S |
| D3 | Lab kind control unify | `LabBench.tsx`, `lab.css` | S |
| D4 | Graph view vs filter hierarchy + propose collapse | `RelationshipGraph.tsx`, `graph.css` | M |
| D5+D9 | **D5 RETRACTED (IA).** **D9 / F1–F3:** stack recoverability, quiet map chrome while sheet open, no Draft bleed | binder/shell/sheet | L |
| D6 | Writing companion face disclosure | `AgentPanel.tsx` | S |
| D7 | Narrow ecosystem switch retained | `shell.css`, `Shell.tsx` | M |
| D8 | Desktop craft Tags+ | `Manuscript.tsx` | S |
| D10 | Narrow touch targets | ui IconButton + shell.css | S |

**Recommended order:** D7 + D2 (wayfinding/hierarchy) → D3 + D4 (job chrome) → D5/D9 (Canon sheet stage) → D1 + D6 + D8 + D10.

---

## Shot index

Desktop light: `draft`, `binder`, `companion-{write,check,inbox,research}`, `lab`, `canon-map`, `canon-sheet`, `canon-family`  
Desktop dark: `draft`, `companion-{check,inbox}`, `lab`, `canon-map`, `canon-sheet`  
Narrow light: `draft`, `binder`, `companion-{write,check,inbox}`, `lab`, `canon-map`, `canon-family`, `canon-sheet`  
Narrow dark: `draft`, `lab`, `canon-map`, `canon-sheet`  

Path prefix: `e2e/output/density/`.

## Machine payload

- `e2e/output/density/metrics.json`  
- `e2e/output/density/inventories.json`  
- Driver: `e2e/density-audit.mjs`  

**No src product edits. No commits.** Standing by for worker task split.
