# Storylint

Fiction IDE for serial and world-heavy novels: clean manuscript editor, project-aware agent panel, continuity diagnostics, and accept-gated bible changes.

Nothing enters the manuscript or canon without explicit **Apply** or **Accept**.

**Look:** Kobo-style paper reading profiles (Day / Sepia / Mint / Night) + warm chrome — not cool AI-blue. Tokens: [docs/design/TOKENS.md](docs/design/TOKENS.md).

## Run locally

Requires Node.js 24+.

```bash
npm install
```

Two terminals:

```bash
# Dogfood chat (live LLM) — needs .env with LLM_* and NO fixture flag:
npm run dev:server                           # loads .env via --env-file-if-exists
# Verifier / CI only:
STORYLINT_FIXTURE_LLM=1 npm run dev:server   # canned replies — not real chat
npm run dev                                  # UI http://localhost:5173/
```

No login.

## LLM configuration

OpenAI-compatible adapter (9-router, LM Studio, Ollama, OpenRouter, etc.).

```bash
cp .env.example .env
# edit LLM_MODEL / LLM_BASE_URL / LLM_API_KEY
```

```env
LLM_PROVIDER=9-router
LLM_MODEL=your-model-id
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_API_KEY=your-router-token
LLM_MAX_TOKENS=20000
STORYLINT_FIXTURE_LLM=0
```

Live wire: `POST {LLM_BASE_URL}/chat/completions`.  
**Real agent chat** needs `LLM_MODEL` + `LLM_BASE_URL` and `STORYLINT_FIXTURE_LLM` not `1`.  
Empty model/base or fixture → canned Continuity/chat (panel shows fixture notice). Keys stay on the server — never `VITE_*` secrets.

## Dogfood flow

1. Start API + Vite; open Storylint.  
2. Edit a chapter; wait for **Saved**; reload.  
3. Sheets/facts in binder; Accept/Reject proposals only.  
4. **Continuity** (fixture or live); marks use paper-safe mark tokens.  
5. Agent **Send** = freeform project chat (live LLM). Sheet asks → proposal packs. Continue / Rewrite / Brainstorm → **Apply** cards only.   

6. **Review chapter** / **Craft check** → neutral panel findings; add suggested tags explicitly.
7. **Research** mode → cited cards; Pin stores a note, Propose creates a pending lore proposal, Accept alone changes canon.
8. **Paper color:** bookmark/seal on the manuscript (Day/Sepia/Mint/Night). Theme icon = chrome only.
9. **Focus** = manuscript only. Under 1366 paper is full-bleed; from 1366 centered page + ribbon.

## Verify

```bash
npm test
npm run build
npm run lint
```

UI browser smoke: [docs/E2E.md](docs/E2E.md) (Playwright + system **msedge** on this machine).

## Docs

**Start here:** [docs/README.md](docs/README.md) — map of locks, process, decisions, and common wrong turns.

| Doc | |
|-----|--|
| [docs/README.md](docs/README.md) | **Corpus map** (entry point) |
| [docs/IA_MAP.md](docs/IA_MAP.md) | **Product structure lock** — ecosystems, depth, shell, gates |
| [docs/design/CANON-VOCABULARY.md](docs/design/CANON-VOCABULARY.md) | **Words lock** — user-facing labels |
| [docs/CALM_BUDGET.md](docs/CALM_BUDGET.md) | **Density bar** — HARD/WARN numbers |
| [docs/PRD.md](docs/PRD.md) | Product spine / why |
| [docs/BUILD.md](docs/BUILD.md) | Slices + next work |
| [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) | Branch / merge / push; origin hash is truth |
| [docs/AGENT_PROTOCOL.md](docs/AGENT_PROTOCOL.md) | Swarm reporting cadence, handoffs |
| [docs/AGENTS_ROLES.md](docs/AGENTS_ROLES.md) | Coder / reviewer / verifier + **AI harness local-only** |
| [docs/decisions/](docs/decisions/README.md) | Decision history (adjudications, reviews) |
| [docs/DOCTRINE_AUDIT.md](docs/DOCTRINE_AUDIT.md) | Contradiction / wrong-build hazard map |
| [docs/design/TOKENS.md](docs/design/TOKENS.md) | Palette + sizes (paint source of truth) |
| [docs/03-ux.md](docs/03-ux.md) | Journeys + reading profiles (structure → IA_MAP) |
| [docs/04-agents.md](docs/04-agents.md) | In-app agent panel (product) |
| [docs/E2E.md](docs/E2E.md) | UI e2e |

**AI harness is local-only.** Never commit/push `CLAUDE.md`, `.claude/`, or other assistant config. See [docs/AGENTS_ROLES.md](docs/AGENTS_ROLES.md) § "AI harness stays local". Checkout must not swap the agent brain.

## Privacy

Live Continuity / agent calls send chapter + bible digest (and related context) to the configured endpoint. Fixture mode sends nothing.
