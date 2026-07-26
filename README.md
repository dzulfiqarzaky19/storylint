# Storylint

Fiction IDE for serial and world-heavy novels: clean manuscript editor, project-aware agent panel, continuity diagnostics, and accept-gated bible changes.

Nothing enters the manuscript or canon without explicit Apply or Accept.

## Run locally

Requires Node.js 24+.

```bash
npm install
```

Start the local API and Vite app in separate terminals:

```bash
npm run dev:server
npm run dev
```

Open the Vite URL printed by the second command. There is no login.

## LLM configuration

Storylint uses an OpenAI-compatible HTTP adapter, so it works with 9-router, LM Studio, Ollama, OpenRouter, LiteLLM, and equivalent routers.

Copy `.env.example` to `.env` and configure:

```env
LLM_PROVIDER=9-router
LLM_MODEL=your-model-id
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_API_KEY=your-router-token
LLM_MAX_TOKENS=20000
STORYLINT_FIXTURE_LLM=0
```

`LLM_PROVIDER` is a diagnostic label; the live wire contract is `POST {LLM_BASE_URL}/chat/completions`. Local servers that do not require authentication may leave `LLM_API_KEY` empty.

Leave `LLM_MODEL` empty or set `STORYLINT_FIXTURE_LLM=1` for deterministic fixture mode. Tests never require a live model.

## Dogfood flow

1. Start both processes and open Storylint.
2. Create or select a chapter and type prose. Wait for the top bar to show **Saved**, then reload to confirm persistence.
3. Create a character, lore, world, or organization sheet in the binder. Add/edit/delete a fact and reload.
4. With no model configured, use **Continuity** from the top bar or agent panel. Fixture prose from `docs/fixtures/continuity-sample.md` produces a red `blue eyes` diagnostic and a Kael proposal.
5. Review proposal cards in the agent panel. **Accept** writes canon; **Reject** does not. Edit before accepting when needed.
6. Ask the agent: `Draft a character sheet for Kael`. Review the structured proposal pack; it remains non-canon until **Accept pack**.
7. Toggle binder and agent regions. Use **Focus** to verify the manuscript is the only content region.

## Privacy

Live Continuity sends the selected chapter and a bible digest to the configured model provider. Live sheet assistance sends the selected chapter, existing sheet names, and your request. Fixture mode sends nothing externally.

API keys stay in the server process. Never use `VITE_*` variables for secrets.

## Verify

```bash
npm test
npm run build
npm run lint
```

Product/build documentation lives under `docs/`; agent rules are in `CLAUDE.md`.
