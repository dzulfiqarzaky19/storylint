# Tech

**Status:** P1 + Apply shipped in tree. Defaults in [BUILD.md](./BUILD.md). BUILD wins on conflict until ADRs exist.

---

## Constraints

| | |
|--|--|
| Auth | None |
| API | Local Node HTTP `:4174`, Vite proxy `/api` |
| UI | Vite + React, `localhost:5173` |
| Persist | `data/project.json`, schemaVersion 1, atomic |
| LLM | Server OpenAI-compatible `LLM_*`; fixture flag |
| Design | TOKENS.md ⇔ `src/design/tokens.css`; paper + chrome split |
| Tests | `npm test` (node:test); UI → [E2E.md](./E2E.md) |
| DB | None yet; plain SQL if ever |

---

## Module map (as implemented)

```
docs/design/          TOKENS, REFERENCES, STITCH (legacy prompts)
src/design/           tokens.css, index.ts (theme + reading profiles)
src/components/ui/    primitives
src/components/shell/ binder, manuscript, agent, shell state
src/features/         project, agent, continuity client glue
src/domain/           pure project/lint/proposals/apply
src/server/           http, store, llm adapter
src/continuity/       extract + fixture
src/cowrite/          co-write generate
src/agent/            chat / sheet-pack runner
e2e/output/           screenshots (gitignored)
```

UI must not import server internals. Domain has no React/fs.

---

## Theme / reading (runtime)

| Attr | Sets |
|------|------|
| `data-theme="light"` \| default dark | Chrome neutrals + default paper |
| `data-reading="day\|sepia\|mint\|night"` | `color.paper` + `color.paperInk` only |

Helpers: `applyTheme`, `applyReading`, `nextReading` in `src/design/index.ts`.

---

## Layout tokens (do not hardcode in shell)

| Token family | Role |
|--------------|------|
| `--size-binder*`, `--size-agent*` | Rails; `-lg`≥1024, `-xl`≥1440, `-2xl`≥1920 |
| `--manuscript-page-max-w*` | Page max width (rem) |
| `--manuscript-page-ratio` | A4 portrait **ratio** √2 — `min-height: 100cqw * ratio` |
| `--manuscript-gutter*` | Desk pad around page when floating |
| `--size-reading-seal` | Circle control &lt;1366 |
| `--size-reading-btn` | Ribbon width ≥1366 |
| `--bp-desk: 1366px` | Desk paper+ribbon breakpoint |

Shell `@media` only uses these vars — no magic numbers.

**&lt;1366:** paper full-bleed + in-page seal. **≥1366:** centered page on canvas + ribbon.

---

## ADR backlog (optional)

| ID | Topic | Lean |
|----|-------|------|
| 001 | SPA + local API | done |
| 002 | JSON persist | done |
| 003 | schemaVersion | done |
| 004 | textarea editor | done for now |
| 005 | agent tools | continuity + chat + cowrite |
| 006 | mark anchors | offsets + spanText |
| 007 | tokens / Kobo palette | done — maintain TOKENS |
| 008 | Playwright e2e | E2E.md; optional npm script later |
| 009 | no telemetry | yes |
| 010 | SQL | only if needed |

---

## Privacy

Live runs send chapter + bible digest (etc.) to `LLM_BASE_URL`. Documented in README.
