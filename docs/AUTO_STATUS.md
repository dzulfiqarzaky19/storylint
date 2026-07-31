# Autonomous build status

Branch: `storylint/auto-i-to-k`  
Commits: local only. Pushes: never.

## Slice E — verified

- Continue / rewrite / brainstorm create panel Apply cards only.
- Insert / replace is server-authoritative and explicit.
- Stale-body precondition, loop-until-idle save flush, and Apply edit lock prevent overwrite races.
- Fixture/live use the existing OpenAI-compatible `LLM_*` adapter.
- Unit/API: 53 tests passed at E close.
- Edge smoke: `e2e/output/slice-e-smoke.png`.
- Fresh review: approved after save-race fixes.

## Slice F — complete

- Sheet portrait/icon string supports emoji, local path, or URL metadata without automatic remote fetch.
- Optional lore-aware hint chips fill freeform fact keys; no locked template.
- Manual closed-enum craft tags persist on chapters and hide in Focus mode.
- Existing Kobo paper/reading/profile polish preserved; not rebuilt.
- `npm test`: 55 passed.
- `npm run build`: passed (47 modules).
- `npm run lint`: passed.
- Edge smoke passed: `e2e/output/slice-f-wide.png`, `e2e/output/slice-f-narrow.png`.
- Accept/Apply boundaries unchanged; no model call required.

## Slice G — complete

- On-demand chapter Review returns plot, culture, and gap findings in neutral agent-panel cards.
- On-demand craft check returns coaching findings, never continuity red/yellow marks.
- Suggested closed-enum craft tags require explicit **Add suggested tags**; no auto-write.
- Review generation never changes manuscript, bible, proposals, or marks.
- Fixture/live use existing server-only OpenAI-compatible `LLM_*` adapter.
- `npm test`: 59 passed.
- `npm run build`: passed (48 modules).
- `npm run lint`: passed.
- Edge smoke passed: `e2e/output/slice-g-smoke.png`.

## Slice H — complete

- Dedicated Research mode in the right panel; separate from chat transcript.
- Fixture/live research queries require cited results.
- Pin persists a research note only; no manuscript or bible write.
- Propose creates a pending lore proposal; canon changes only through existing Accept.
- Invalid/uncited results cannot be pinned or proposed.
- `npm test`: 67 passed.
- `npm run build`: passed (50 modules).
- Final audit fixes: server chapter revisions reject stale tabs; local drafts survive immediate reload; sheet metadata saves preserve facts; citations are URL-validated and labeled unverified; Apply cards lock duplicate clicks.
- Final independent review: **APPROVE THROUGH H**; no remaining shared save/Accept/Apply blocker.
- `npm run lint`: passed.
- Edge smoke passed: `e2e/output/slice-h-research.png`, `e2e/output/slice-h-smoke.png`.

## Slice I — complete (landing)

- Dedicated center relationship graph projects bible sheets to nodes and accepted relationship facts to directed edges.
- Portrait/icon or accessible text fallback appears on nodes; sheet-kind filters are deterministic.
- Node mouse/keyboard activation opens the existing binder sheet editor.
- New/edit edge actions create pending relationship proposals only; existing Accept writes/replaces the canonical fact by identity.
- Pending proposals never render as edges; dangling facts produce diagnostics, not broken nodes.
- Graph geometry uses tokens (`--size-graph-view-w/h/radius/node`); no feature-local layout constants.
- Mobile topbar keeps Continuity; Graph/theme hide by explicit classes under compact width.
- `npm test`: 79 passed (includes queued `switchFile` race test).
- `npm run build`: passed (54 modules).
- `npm run lint`: passed.

## Slice J — complete (landing)

- Markdown export builds a standards-compatible ZIP with README, ordered chapters, and readable bible sheets/facts.
- Local project catalog creates, lists, switches, and remembers active schema-v1 projects under `data/projects/`.
- Existing `data/project.json` remains the default single-project dogfood path.
- Project IDs are slug-validated; duplicate creation conflicts; no auth/cloud sync/import added.
- Project-scoped recovery drafts (`projectId:chapterId`); switch/create restore drafts like boot.
- `editLock` freezes editor mutations across flush+activate; `trackMutation` awaits Accept/sheet/fact/Apply/agent/graph HTTP before path switch.
- Generation stamps drop late client merges after install; agent transcript/Apply cards reset synchronously before switch/create.
- Export flushes all chapters first.
- `npm test`: 79 passed.
- `npm run build`: passed (54 modules).
- `npm run lint`: passed.

## Slice K1 — complete (landing)

- Lean spacing only: `.panel__body` gap `space-4` → `space-3`; graph outer pad/margin `space-3`; graph max-width token corrected to `--manuscript-page-max-w-xl`.
- Colors, copy, and structural layout unchanged.
- `npm test`: 79 passed.
- `npm run build`: passed (54 modules).
- `npm run lint`: passed.
- Edge smoke: `e2e/output/k1-desktop.png`, `e2e/output/k1-narrow.png`.

## Slice K2 — complete (landing)

- Family view lays out character kinship as an orthogonal multi-generation tree (multi-parent/partner capable), separate from the radial network.
- Kinship vocabulary is explicit and tested (`parent_of`/`child_of`/`spouse_of`/`sibling_of` and aliases); non-kinship edges stay in Network.
- Subtle pointer-follow parallax on the family plane; disabled for touch and `prefers-reduced-motion`.
- Propose/Accept boundary unchanged: pending relationships never render before Accept.
- `npm test`: 85 passed.
- `npm run build`: passed (55 modules).
- `npm run lint`: passed.
- Edge smoke: `e2e/output/slice-k-desktop.png`, `e2e/output/slice-k-narrow.png`.

## Next

Shell adapter seams / further responsive hardening only if still needed after K1+K2; no native app scaffold.
