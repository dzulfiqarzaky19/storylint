# Autonomous build status

Branch: `storylint/auto-f-to-h`  
Commits/pushes: disabled by latest user instruction.

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
- `npm test`: 65 passed.
- `npm run build`: passed (50 modules).
- `npm run lint`: passed.
- Edge smoke passed: `e2e/output/slice-h-smoke.png`.

## Complete

Autonomous build is complete through H. Stopped before I (graph), J (export/multi-project), and K (native shells) per scope lock. No commits and no push per latest user instruction.
