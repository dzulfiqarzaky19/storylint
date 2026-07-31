# Code verify — docs vs src @ origin/dev

**When:** 2026-07-31 Task AD (pig)  
**Method:** `git show origin/dev:<path>` only — not worktree memory.  
**Head verified:** see merge commit that lands this file (report `origin/dev` after push).

## Special re-checks (moved today)

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | C5 graph kind chips still raw enums | **VERIFIED (still open debt)** | `RelationshipGraph.tsx:265` `{kind}` on filter buttons; `:343` `{node.kind}` on node text. No `SHEET_KIND_LABEL` import. Deer D4 worktree may fix later; **not on origin/dev yet**. |
| 2 | Binder renders when project loads (not only with active chapter) | **VERIFIED (fixed)** | `Shell.tsx:161-166` comment + `project.project ? <Binder…>` — navigator, not chapter-gated. |
| 3 | Rail widths 272/272/280/320; companion closed below 1366 | **VERIFIED in runtime tokens** | `tokens.css` `--size-binder/-agent` 272, lg 272, xl 280, 2xl 320. `useShellState.ts:6-10,106-107` `BP_DESK=1366`, `defaultRailsAt` → `agent: atDesk`. **STALE sketches fixed this pass:** TOKENS.md sample block still said 360; STITCH §0 said 300→420. |
| 4 | Sheet detail = push stack, list recoverable; Canon form | **VERIFIED (Task V shipped)** | `Binder.tsx:302-337` `data-binder-stack`, list stays mounted under detail, Back + `SheetEditor` in binder. Park/restore D9 still present. |
| 5 | Writing faces allow-list 5 with 3 primaries + More + Inbox | **VERIFIED** | `AgentPanel.tsx:37-38` FACES.writing 5; `:49-50` PRIMARY chat/write/check; `:113` overflow under More; `:297-307` inbox badge path. |

## Wrong-turns list (`docs/README.md`)

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | manuscript / Write / Draft are three things | **VERIFIED** | `Shell.tsx:37` mode `'manuscript'`; top label Draft `:332+`; `AgentPanel` face `write` ≠ ecosystem. |
| 2 | Sheet = binder L3 stack, not center | **VERIFIED** | `Binder.tsx` stack + IA §2/§4.4; center stays map/Draft/Lab. |
| 3 | Graph chips may still be raw enums (C5) | **VERIFIED** | See special #1 — still true on origin/dev. |
| 4 | @bible badge vs @canon vocabulary | **VERIFIED** | `AgentPanel.tsx:436,480` `@bible` Badge; vocab prefers @canon. |
| 5 | Face allow-list 5 ≠ ≤3 primaries | **VERIFIED** | See special #5. |
| 6 | density-audit historical | **VERIFIED** | Banner on `decisions/density-audit-qa3.md`; not live checklist. |
| 7 | Worktree ≠ truth | **VERIFIED** | Process rule (GIT_WORKFLOW §5); N/A code. |
| 8 | PRD phase lags BUILD through L | **VERIFIED** | BUILD status L done; PRD §3–§9 historical spine (rat ruling AD). |
| 9 | D4 map chrome may be topic-only | **VERIFIED @ this head** | No `docs/design/D4-CANON-MAP-CHROME.md` on origin/dev; D4 lives on topic worktree until merge. |

## DOCTRINE_AUDIT landmines

| Landmine | Verdict | Evidence |
|----------|---------|----------|
| Three ecosystems only | **VERIFIED** | `Shell.tsx` top switch Draft · Lab · Canon only (modes manuscript/lab/graph). |
| Max depth 3 | **VERIFIED (doctrine+IA)** | Structure lock; sheet stack is L3 region not L4 nav (`Binder` detail). |
| No fourth ecosystem | **VERIFIED** | Research/Graph/Review not top places; Research = face. |
| Continuity ≠ ecosystem / off top bar | **VERIFIED** | No Continuity top control; `runContinuity` via companion Check path in Shell agent wiring. |
| Draft = prose home | **VERIFIED** | Default `workspaceMode: 'manuscript'` + Draft label. |
| Chapters never become Canon | **VERIFIED** | Lab promote: beat → chapter-stub (Draft); sparks → sheet-proposal + Accept (`domain/lab.ts` PromoteAs). |
| Kind labels Characters/Lore/World/Organizations | **PARTIAL** | Binder `SHEET_KIND_LABEL` **VERIFIED** (`workspace.ts:7-12`, Binder uses it). Graph **STALE debt** (C5). |

## Never-true / dangerous category

| Claim found | Status | Action |
|-------------|--------|--------|
| TOKENS.md CSS sample `--size-binder: 360px` | **Never current after D1** — sample lagged runtime | Fixed sample → 272 + pointer to §4 table |
| STITCH.md §0 `binder=agent (300→420)` | **Never matched D1 tokens** | Fixed → 272→320 + desk companion note |
| CALM measure line “Rails in product **default open** state” | **Misleading** post rail-budget (agent closed &lt;1366) | Clarified: default **product** rails (binder open; agent open only ≥ desk) |
| density-audit “sheet swaps binder body / loses list” as live fault | **Was true; Task V changed code** | Already historical banner; verify note added that F1 list-under-detail **ships** |
| Docs claiming graph labels already fixed | **None on origin/dev** claiming fixed — good | C5 remains open |

## Fixes in this branch

- PRD top banner: intent-at-the-time vs BUILD/IA_MAP (rat ruling)
- TOKENS sample block rail widths
- STITCH §0 rail widths + Continuity-off-topbar in stale prompt text where unambiguous
- CALM measure default-rails wording
- docs/README wrong-turns: C5 still open with file:line; binder void fixed; rails/stack/faces cite code
- DOCTRINE_AUDIT C5 evidence lines refreshed; landmine table graph note
- IA_MAP §4.4 one line: stack ships list-under-detail (F1)
- density-audit-qa3: note Task V F1 shipped (history preserved)

No product code changes. Founder locks untouched.
