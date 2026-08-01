# Storylint

Fiction IDE for serial and world-heavy novels: clean manuscript editor, project-aware agent panel, continuity diagnostics, and accept-gated bible changes.

Nothing enters the manuscript or canon without explicit **Apply** or **Accept**.

**Look:** Kobo-style paper reading profiles (Day / Sepia / Mint / Night) and warm chrome, not cool AI-blue. Palette and sizing live in `src/design/tokens.css`.

## Run locally

Requires Node.js 24+.

```bash
npm install
```

Two terminals:

```bash
npm run dev:server   # API on http://127.0.0.1:4174, loads .env
npm run dev          # UI on http://localhost:5173/
```

No login.

## LLM configuration

OpenAI-compatible adapter (LM Studio, Ollama, OpenRouter, any compatible router).

```bash
cp .env.example .env
# edit LLM_MODEL / LLM_BASE_URL / LLM_API_KEY
```

```env
LLM_PROVIDER=openai-compatible
LLM_MODEL=your-model-id
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_API_KEY=your-router-token
LLM_MAX_TOKENS=20000
STORYLINT_FIXTURE_LLM=0
```

Live wire: `POST {LLM_BASE_URL}/chat/completions`.

**Real agent chat** needs `LLM_MODEL` and `LLM_BASE_URL`, with `STORYLINT_FIXTURE_LLM` not set to `1`. An empty model or base URL, or fixture mode, falls back to canned Continuity and chat replies and the panel shows a fixture notice. Keys stay on the server, never in `VITE_*` variables.

## Using the app

1. Start the API and Vite, then open Storylint.
2. Edit a chapter, wait for **Saved**, reload.
3. Sheets and facts appear in the binder; canon changes go through Accept or Reject only.
4. **Continuity** produces marks using paper-safe mark tokens.
5. Agent **Send** is freeform project chat. Sheet requests return proposal packs. Continue, Rewrite and Brainstorm return Apply cards only.
6. **Review chapter** and **Craft check** return neutral panel findings; suggested tags are added explicitly.
7. **Research** mode returns cited cards. Pin stores a note, Propose creates a pending lore proposal, and only Accept changes canon.
8. **Paper color** is the bookmark on the manuscript (Day / Sepia / Mint / Night). The theme icon changes chrome only.
9. **Focus** shows the manuscript alone. Below 1366px the paper is full-bleed; from 1366px it is a centered page with a ribbon.

## Verify

```bash
npm test
npm run build
npm run lint
```

## Privacy

Live Continuity and agent calls send the chapter plus a bible digest to the configured endpoint. Fixture mode sends nothing.
