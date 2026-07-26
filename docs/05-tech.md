# Tech (stub — fill after product lock)

**Status:** defaults locked for coding in [BUILD.md](./BUILD.md) (“Locked defaults”).  
Formal ADR files still optional; **BUILD table wins** if conflict until ADR supersedes.

---

## Hard constraints (from product)

| Constraint | MVP |
|------------|-----|
| Auth | **None** — local, you are first user |
| Multi-tenant | No |
| LLM | Provider-neutral OpenAI-compatible router (`LLM_*` env); local or hosted |
| Agent UI | First-class panel in shell |
| Canon / MS writes | Accept / Apply only |
| Tests | Unit + integration + local e2e — lock behavior so coding agents don’t re-derive |
| DB | Optional later; if any → **normal SQL**, thin layer, numbered migrations |
| Design system | Tokens + primitives before feature chrome; **portable** web → desktop (Win/macOS/Linux) → mobile (Android/iOS) — see [03-ux](./03-ux.md) |

---

## Proposed module map (to ADR)

```
docs/design/     TOKENS + REFERENCES + DS rules (agents read first)
src/design/      tokens.css / tokens.ts / optional tw-theme from TOKENS only
src/components/ui/     primitives (token refs only)
src/components/shell/  binder · editor · agent slots
src/features/          product features — compose ui/*, no raw color
src/domain/            pure types, lint gates, accept/apply — unit tests
src/server/            local API, persistence, LLM proxy (keys here)
src/agents/            prompts, tools, runners
```

Deep modules, small surfaces. UI does not import server internals. Domain has zero React/fs.  
**Tailwind:** optional; must bind to `src/design` tokens — core palette never lives in default Tailwind colors.

---

## ADR backlog (write in Wave 2)

| ID | Topic | Lean |
|----|-------|------|
| 001 | SPA + local API vs other | Local API keeps keys off browser |
| 002 | Persistence | JSON project file(s) first; SQL if needed |
| 003 | Schema versioning | `schemaVersion` + migrations |
| 004 | Editor engine | textarea+marks first; CM/TipTap if required |
| 005 | Agent runner | single runner + tools |
| 006 | Mark anchoring | offsets + spanText; reattach rules |
| 007 | Styling | CSS tokens; portable design system (no web-only traps) |
| 007b | Cross-platform shell | Web MVP; later Tauri/RN/Capacitor — **shared ui/**, shell adapters only |
| 008 | Test pyramid | domain unit P0; API integration P1; e2e smoke P1/P2 |
| 009 | Telemetry | none by default |
| 010 | SQL layer | plain queries if DB appears |

---

## Test strategy (intent)

| Layer | Covers | Why |
|-------|--------|-----|
| Unit | Lint gates, accept/reject, fingerprint ledger | Fast, token-cheap for agents |
| Integration | Continuity HTTP path, persistence, apply APIs | Wiring |
| Local e2e | Open app → write → continuity → accept | Dogfood path |

Scripts: `test`, `test:unit`, `test:integration`, `test:e2e` (names flexible).

**Order:** test-first for domain + API contracts; UI shell can follow build+manual verify.  
**Detail:** [BUILD.md](./BUILD.md) § Tests before code. Fixture: [fixtures/continuity-sample.md](./fixtures/continuity-sample.md).

---

## BE / FE practice (intent)

**FE:** design-system primitives; shell layout; no business gates duplicated from domain.  
**BE:** thin routes; validate inputs; never log secrets or full prose by default; bind localhost.  
**Shared:** zod/types for claim schemas; one contract.

---

## Privacy copy (must ship with P1 UI)

Continuity / agent runs send chapter text + bible digest to the configured `LLM_BASE_URL` OpenAI-compatible endpoint. Sheet assistance sends the selected chapter, sheet names, and user request. Document in README + settings.

---

## Wave 2 exit

- [ ] ADRs 001–010 drafted  
- [ ] Token file + shell wireframes match [03-ux](./03-ux.md)  
- [ ] Test scripts stubbed  
- [ ] Ready to implement P1 against PRD acceptance  
