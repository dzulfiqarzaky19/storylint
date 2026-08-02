# Optional in-app web search path (wayfinder #11)

**Status:** research only (no product code)  
**Ticket:** https://github.com/dzulfiqarzaky19/storylint/issues/11  
**Map:** https://github.com/dzulfiqarzaky19/storylint/issues/6  
**Date:** 2026-08-02

## Locked product context

- Hybrid research: **model always**; **web when configured**; else **unchecked model**.
- Claude/jcode `websearch` is **not** the product path. Storylint must own search in-process or via its Node server.
- First cut is personal novel OS: research → living wiki (author accept/reject only).
- Reuse the existing OpenAI-compatible LLM wire (`LLM_*` in `.env.example`, `src/server/llmConfig.ts`, `src/server/llm.ts`, `src/llm/types.ts`).

## What exists today

| Piece | Behavior |
| --- | --- |
| `POST /api/research` | Loads project, calls `runResearch(..., llmConfig())` |
| `src/research/run.ts` | Fixture when no live LLM / fixture flag; else `completeJson` with a fiction-research system prompt that **requires** `sources[{title,url}]` |
| Citations | **Model-authored URLs**. No HTTP fetch of the open web. |
| UI (`ResearchPanel.tsx`) | Explicit copy: *“Model-provided citations — Storylint has not fetched or verified these links.”* |
| Config gate | `hasLiveLlm` = `Boolean(model && baseUrl)` (`src/llm/types.ts`) |

So “live research” today means live **LLM**, not live **web**.

## Design target for optional web

```
query + sheet context
        │
        ▼
  hasLiveSearch? ──no──► completeJson(model)     → mode: live (unchecked)
        │ yes
        ▼
  search provider (server-side)
        │
        ▼
  snippets / extracted pages (title, url, content)
        │
        ▼
  completeJson(model + evidence pack) → mode: live+web (or keep mode live + web:true flag later)
```

Constraints that matter for a personal dogfood loop:

1. **Server-owned** fetch (API key never in the browser).
2. **Optional**: missing config must not fail research; fall through to unchecked model (already locked).
3. **Citation honesty**: when web ran, sources should come from provider results (or verified extract), not invented URLs.
4. **Small surface**: one default provider for dogfood; adapter seam later if needed.
5. **Env shape** should feel like `LLM_*`, not a one-off secret name.

---

## Options (primary sources)

### 1. Tavily Search (+ optional Extract) — **recommended**

| | |
| --- | --- |
| **What** | RAG/agent-oriented search API: query in, ranked `results[{title,url,content,score}]` out. Optional Extract for cleaned page text. |
| **Wire** | `POST https://api.tavily.com/search` with `Authorization: Bearer <api_key>` and JSON body (`query`, `max_results`, `search_depth`, …). |
| **Fit** | Built for “give the model evidence,” not SERP chrome. Matches fiction research (motifs, institutions, craft references) better than raw SERP JSON. |
| **Dogfood cost** | Official docs: **1,000 free API credits/month, no card**. Basic search = **1 credit**/request; advanced = **2**. Extract: every 5 successful URLs = 1 (basic) or 2 (advanced) credits. |
| **Ops** | Hosted; single `fetch` from storylint server. No browser, no HTML scrape. |
| **Risks** | Vendor lock for default path; query + (if you send them) context leave the machine. Same class of privacy as live LLM. |

Sources:

- Search endpoint: https://docs.tavily.com/documentation/api-reference/endpoint/search  
- Credits & pricing: https://docs.tavily.com/documentation/api-credits  
- Plan overview: https://help.tavily.com/articles/8816424538-pricing  

### 2. Brave Search API (Web and/or LLM Context)

| | |
| --- | --- |
| **What** | Independent web index. Web Search: `GET https://api.search.brave.com/res/v1/web/search?q=…` with `X-Subscription-Token`. LLM Context endpoint packaged for agent grounding (`/res/v1/llm/context`). |
| **Fit** | Strong general search quality; LLM Context is closer to RAG than classic SERP. Good long-term alternative if Tavily quality/terms disappoint. |
| **Dogfood cost** | Marketing/docs: **$5 free credits every month**; Search plan listed at **$5 per 1,000 requests** (as of fetch date). |
| **Risks** | Snippets are shorter than Tavily’s multi-chunk content unless you add a second hop (fetch page yourself or use another extract tool). Two product surfaces (Web vs LLM Context) to pick. |

Sources:

- Product + plans: https://brave.com/search/api/  
- Web Search get-started: https://api-dashboard.search.brave.com/app/documentation/web-search/get-started  

### 3. SerpAPI (Google SERP scrape-as-a-service)

| | |
| --- | --- |
| **What** | `https://serpapi.com/search?engine=google&q=…&api_key=…` → structured organic results, knowledge graph, etc. |
| **Fit** | Excellent when you need “what Google shows.” Over-structured and over-priced for a single-author wiki research rail. |
| **Dogfood cost** | Free **250 searches/month**; Starter **$25 / 1,000**. |
| **Risks** | Heavier payload; legal/ToS surface is “scrape Google for me”; more than storylint needs for first cut. |

Sources:

- Search API: https://serpapi.com/search-api  
- Pricing: https://serpapi.com/pricing  

### 4. DuckDuckGo Instant Answer / unofficial HTML

| | |
| --- | --- |
| **What** | Historical Instant Answer JSON is **not** a full web SERP API. Organic results via HTML endpoints are unofficial and brittle. |
| **Fit** | Poor for reliable citation packs. |
| **Risks** | Anti-bot blocks (observed in tooling), no stable SLA, ToS/automation ambiguity. **Do not** build the product path on this. |

Source:

- https://duckduckgo.com/api (no usable product API surface for organic web results as of this note)

### 5. DIY: search hit list + browserless fetch + extract

| | |
| --- | --- |
| **What** | Provider (or self-hosted SearXNG) returns URLs; server `fetch`es pages; readability/trafilatura-style extract; pack into model context. |
| **Fit** | Maximum control and local-first potential. |
| **Risks** | JS-heavy sites, blocks, robots/ToS, timeout/size policy, XSS-ish HTML edge cases. Too much surface for first weekly dogfood. Revisit only if hosted search snippets are insufficient for lore depth. |

### 6. Self-hosted SearXNG (or similar meta-search)

| | |
| --- | --- |
| **What** | Local meta-search that fans out to engines. |
| **Fit** | Privacy-friendly power-user option later (`SEARCH_BASE_URL=http://127.0.0.1:8080`). |
| **Risks** | Ops, upstream CAPTCHAs, inconsistent JSON. Not the default dogfood path. |

---

## Comparison (dogfood lens)

| Option | Free tier enough for personal use? | Evidence quality for LLM | Implement size | Own the key path? |
| --- | --- | --- | --- | --- |
| **Tavily** | Yes (~1k basic searches/mo) | High (chunks + optional extract) | Small (one POST) | Yes |
| Brave | Yes (~$5 credits/mo) | Good (better with LLM Context) | Small | Yes |
| SerpAPI | Tight (250 free) | SERP-shaped, extra parsing | Medium | Yes |
| DDG unofficial | N/A | Poor/unstable | False economy | No |
| DIY fetch+extract | Infra cost only | High if it works | Large | Yes |
| SearXNG | Self-host | Variable | Medium+ops | Yes |

---

## Recommendation (one default)

**Default dogfood provider: Tavily Search (basic depth), server-side only.**

Why this one:

1. **Matches the job** — fiction research needs short grounded passages + real URLs, which is Tavily’s default response shape (`title`, `url`, `content`).
2. **Optional cleanly** — gate on API key; if unset, keep today’s unchecked model path (no error).
3. **Cost** — 1,000 free basic searches/month is ample for a novelist’s weekly wiki loop.
4. **Mirrors LLM wire** — one Bearer key, one base URL default, one `fetch` from `src/server` next to `llm.ts`.
5. **Escape hatch** — keep a thin `SearchProvider` interface so Brave (or SearXNG) can plug in later without rewriting research UI.
6. **Defer Extract** — first cut: search snippets only. Add `include_raw_content` / Extract only if summaries lack depth for magic-system / historical pattern work.

**Explicit non-goals for first cut**

- No Claude/jcode tool proxy.
- No browser extension.
- No silent auto-canon from web hits (still Pin / Propose → author).
- No multi-provider waterfall.

### Suggested runtime behavior

| Config | LLM | Search | Research behavior |
| --- | --- | --- | --- |
| No LLM | — | — | Fixture (existing) |
| LLM, no search | live | off | Model-only JSON + model citations; UI keeps “not verified” honesty |
| LLM + search | live | on | Server search → evidence pack in user/system prompt → model synthesizes; **sources must be subset of provider URLs** (drop or repair invented ones) |
| Search, no LLM | — | on | Still fixture/fail closed for synthesis, or return raw hit cards without model prose (product choice at implement time; prefer require LLM for synthesis) |

Recommended honesty flag for later UI (not implementing here): `mode: 'fixture' | 'live' | 'live_web'` or `web: boolean` on `ResearchResult`.

---

## Config shape (mirror `LLM_*`)

Existing LLM pattern (from `.env.example` / `llmConfig`):

```env
LLM_PROVIDER=9-router
LLM_MODEL=
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_API_KEY=
LLM_MAX_TOKENS=20000
STORYLINT_FIXTURE_LLM=0
```

**Proposed search env (implement later):**

```env
# Optional web search for hybrid research.
# Omit SEARCH_API_KEY (or set SEARCH_PROVIDER=) → model-only unchecked path.
SEARCH_PROVIDER=tavily
SEARCH_API_KEY=
SEARCH_BASE_URL=https://api.tavily.com
SEARCH_MAX_RESULTS=5
# Optional knobs (defaults fine for dogfood):
# SEARCH_DEPTH=basic
# STORYLINT_FIXTURE_SEARCH=0
```

### Config module sketch (not implemented)

```ts
// parallel to llmConfig / hasLiveLlm
export type SearchConfig = {
  provider: string // 'tavily' | 'brave' | '' 
  apiKey: string
  baseUrl: string
  maxResults: number
  depth: 'basic' | 'advanced'
  fixture: boolean
}

export function searchConfig(env = process.env): SearchConfig { /* trim, defaults */ }

/** Live web path only when explicitly configured. */
export function hasLiveSearch(config: SearchConfig): boolean {
  // tavily/brave: API key is the real gate; baseUrl has a documented default
  return Boolean(config.provider && config.apiKey && config.baseUrl)
}
```

**Why these names**

| Choice | Reason |
| --- | --- |
| `SEARCH_*` prefix | Parallel to `LLM_*`; avoids overloaded `WEB_*` / `TAVILY_*` hardcoding. |
| `SEARCH_PROVIDER` | Same role as `LLM_PROVIDER`; enables Brave/SearXNG without env rename. |
| `SEARCH_BASE_URL` | Same override story as local LLM routers; default official Tavily host. |
| `SEARCH_API_KEY` | Same secret pattern as `LLM_API_KEY` (Bearer). |
| `SEARCH_MAX_RESULTS` | Caps tokens and credits; default 5 matches Tavily’s documented default. |
| Unset key ⇒ off | Matches locked “web when configured; else unchecked.” |

Tavily call shape for the adapter (from official docs):

```http
POST {SEARCH_BASE_URL}/search
Authorization: Bearer {SEARCH_API_KEY}
Content-Type: application/json

{
  "query": "<user research query>",
  "search_depth": "basic",
  "max_results": 5,
  "include_answer": false,
  "include_raw_content": false
}
```

Map each `results[i]` → evidence line `{ title, url, content }` injected into the existing research completion. Do **not** send the full novel manuscript; sheet names/summaries already go to the model today—keep that scope.

---

## Privacy / product notes

- Live search sends the **research query** (and only whatever context you choose) to the search vendor; live LLM already leaves the machine when configured.
- Panel copy should distinguish:
  - model-only: citations unverified (current),
  - web: “Retrieved via configured search; summaries still model-written.”
- Author Pin/Propose remains the only path toward wiki/canon (map #6).

## Out of scope (this note)

- Product implementation, UI polish, provider SDK dependency choice (`fetch` is enough).
- Choosing export format, fact filters, or dev2 shell (other wayfinder tickets).

## Decision for map #6

**Optional web path = server-side Tavily Search behind `SEARCH_*` env, gated by `hasLiveSearch`; unconfigured behavior remains unchecked model research.**

Implement when building the hybrid research turn (likely after/with tickets that shape research → propose-on-card).
