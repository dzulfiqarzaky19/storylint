# Storylint

Writing **IDE** for serial / world-heavy fiction + **project-aware agent panel**  
(VS Code + Claude extension shape). Human owns Apply/Accept into manuscript and canon.

**Visual doctrine:** Kobo / paper reader — warm chrome + paper manuscript profiles. **Not** cool AI-blue IDE. Skin = [docs/design/TOKENS.md](docs/design/TOKENS.md) only.

## Read first (agents)

| Doc | Use when |
|-----|----------|
| [docs/PRD.md](docs/PRD.md) | Scope, acceptance, non-goals |
| [docs/BUILD.md](docs/BUILD.md) | Slices, locked defaults, **what’s shipped vs next** |
| [docs/AGENTS_ROLES.md](docs/AGENTS_ROLES.md) | Coder / reviewer / verifier |
| [docs/01-identity-market.md](docs/01-identity-market.md) | Positioning |
| [docs/02-steal-and-phases.md](docs/02-steal-and-phases.md) | P1→P4 roadmap |
| [docs/03-ux.md](docs/03-ux.md) | Shell IA, reading profiles, responsive layout |
| [docs/design/TOKENS.md](docs/design/TOKENS.md) | **Canonical** colors, type, space, radii, rail/paper sizes |
| [docs/design/README.md](docs/design/README.md) | DS folders + no magic numbers |
| [docs/design/REFERENCES.md](docs/design/REFERENCES.md) | Patterns/URLs (not third-party hex) |
| [docs/design/STITCH.md](docs/design/STITCH.md) | Stitch prompts — **legacy AI-blue; prefer TOKENS** |
| [docs/04-agents.md](docs/04-agents.md) | Agent capabilities + Apply/Accept |
| [docs/05-tech.md](docs/05-tech.md) | Stack / modules |
| [docs/E2E.md](docs/E2E.md) | Playwright UI smoke (`msedge` on this box) |
| [docs/fixtures/continuity-sample.md](docs/fixtures/continuity-sample.md) | Continuity fixture |

## Hard rules

1. **Manuscript:** agent text enters only via user **Apply**  
2. **Bible/canon:** only via user **Accept** (or manual edit)  
3. Editor stays clean — no gen cockpit in the type column  
4. Agent panel is first-class IA  
5. MVP: **no auth / no multi-user** — local dogfood  
6. Domain logic pure; **test-first** for gates/accept/API; fixture LLM for CI  
6a. **LLM:** OpenAI-compatible `POST {LLM_BASE_URL}/chat/completions`; server-only `LLM_*`; no client keys  
7. Smallest change; no suite creep past assigned slice  
8. **Tokens only:** no hard-coded hex/px/rem in features/shell — change **TOKENS.md + `src/design/tokens.css`** first  
9. **Patterns ≠ paint:** REFERENCES for behavior; skin always TOKENS (Kobo paper, not sky blue)  
10. **UI e2e** on shell/manuscript/agent/Continuity/Apply/Focus/save changes — [docs/E2E.md](docs/E2E.md); screenshots → `e2e/output/`  
11. **Layout sizes** in tokens only. Paper: full-bleed + **seal &lt;1366**; desk page + **ribbon ≥1366**. A4 **ratio** (`cqw×√2`), not physical mm. Reading control on paper, not top bar.

## Repo state (current)

**Shipped:** P1 (slices 0–D) + P1b Apply (E in progress / landing) + shell polish (paper modes, snap layout, hidden scrollbars, word count).

**Next (BUILD later table):** finish E if open → **F** (portraits, craft tags, remaining polish) → G → H → …

Do not one-shot the whole roadmap. One BUILD slice per coding pass.

## Dev

```bash
npm install
npm run dev:server    # API :4174 — use STORYLINT_FIXTURE_LLM=1 for fixture
npm run dev           # Vite — open http://localhost:5173/
npm test
npm run build
npm run lint
```

## Delegation

See [docs/AGENTS_ROLES.md](docs/AGENTS_ROLES.md). Assign **one** BUILD slice (E/F/G/…).
