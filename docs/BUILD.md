# Build slices — coder order

**Read first:** [PRD.md](./PRD.md) acceptance · [CLAUDE.md](../CLAUDE.md) hard rules · [design/TOKENS.md](./design/TOKENS.md)  
**Do not** start P1b/P2/P3 features before Slice D acceptance green.

Each slice: coder implements → reviewer (rules + diff) → verifier (commands + checklist below).  
One slice per coding session when possible.

---

## Tests before code? **Yes for logic — ordered, not dogma**

| Kind of work | Order | Why |
|--------------|-------|-----|
| **Domain gates / accept / fingerprint / reducers** | **Test first** (red → green → refactor) | Behavior is the product; locks Continuity without burning agent tokens re-deriving rules |
| **API contracts** (save project, accept proposal, continuity response shape) | Test first or **same PR as route** with failing case first | Prevents UI/server drift |
| **Fixture continuity path** | Tests use [fixtures/continuity-sample.md](./fixtures/continuity-sample.md) **before** live LLM wiring | No key required in CI |
| **UI shell / tokens / layout** | Implement + **verify visually** / build; unit-test only pure helpers | Pixel TDD is low ROI early |
| **Agent prompts / LLM wording** | Fixture + contract tests first; golden prompts optional later | Don’t unit-test prose vibes |

### Coder loop (logic slices B, C, …)

1. Write **failing** unit test for the gate/accept case (from BUILD / fixture).  
2. Implement minimum domain/API code to pass.  
3. Add UI only after domain is green (or thin UI stub).  
4. Run `npm test` + `npm run build` before handing to reviewer.  

### Verifier

- Fail slice if new domain behavior has **no** test.  
- Fail if tests only run against live LLM (must have fixture path).  

### Not required

- Full e2e before first button exists (e2e after shell+B path exists).  
- Snapshot testing every CSS tweak.

---

## Locked defaults (don’t re-litigate in chat)

| Topic | Default |
|-------|---------|
| Auth | None |
| Host | Web (Vite) only for P1 |
| Persistence | Single project JSON under `data/project.json`, `schemaVersion: 1`, atomic write |
| API | Local Express (or equivalent) on `127.0.0.1`, keys in server env |
| Editor P1 | `textarea` + mark overlay (no TipTap yet) |
| Styling | `src/design/tokens.css` from TOKENS.md; Tailwind only if theme is token-generated |
| Agent panel P1 | Real shell + chat UI; Continuity as first tool; co-write Apply can stub |
| LLM | OpenAI-compatible router via server-only `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MAX_TOKENS`; `POST {base}/chat/completions`; fixture mode when model/base are unset or `STORYLINT_FIXTURE_LLM=1` |
| Sheet kinds | `character` \| `lore` \| `world` \| `organization` (frozen P1) |
| Confidence default | `0.7` |
| Agent panel default | Open on desktop width ≥ `bp.lg` |
| Focus | Hides binder + agent |
| Name | Storylint (unless you rename later) |

Full ADR write-ups can follow; **coders treat this table as binding**.

---

## Slice 0 — Design system runtime

**In**

- [ ] `src/design/tokens.css` — every color/space/type token from TOKENS.md as CSS vars (dark default + `[data-theme=light]`)  
- [ ] `src/design/README.md` or comment pointer to docs  
- [ ] `src/components/ui/`: `Button`, `IconButton`, `Input`, `Textarea`, `Badge` minimum  
- [ ] Strip Vite demo chrome from `App.tsx`; app shell placeholder using tokens only  
- [ ] No hex outside `tokens.css`  

**Verify**

```bash
npm run build
# grep fail if features contain raw hex (optional script later)
```

- [ ] Button primary uses `var(--color-primary)` not `#243B63` in component file  

**Out:** product features, server, domain.

---

## Slice A — Shell IA (no LLM)

**In**

- [ ] Top bar, binder, manuscript, agent panel slots per [03-ux.md](./03-ux.md)  
- [ ] Collapse binder / agent; Focus mode  
- [ ] Responsive: `< bp.md` drawers OK  
- [ ] Local state OK; persistence can be in-memory until Slice B  

**Verify**

- [ ] Focus = editor only  
- [ ] Agent panel is visible region (not missing)  
- [ ] Token-only styling  

**Out:** continuity, real chat backend.

---

## Slice B — Domain + persistence + manual bible

**In**

- [ ] `src/domain/`: types, project CRUD helpers, fingerprint, **lint gates**, accept/reject — pure, unit tested  
- [ ] `src/server/`: load/save project, chapter patch, sheet upsert, fact manual CRUD, proposal accept/reject  
- [ ] `data/project.json` atomic write + `schemaVersion`  
- [ ] UI wired: chapters list, editor debounce save, sheet create/edit, facts list  

**Tests (required) — write these first, then domain code**

- [ ] Hard conflict → red  
- [ ] Unknown high conf → proposal  
- [ ] Low conf → drop  
- [ ] Accept writes fact; Reject does not  
- [ ] Re-lint doesn’t dup pending same fingerprint  
- [ ] Cases grounded in [fixtures/continuity-sample.md](./fixtures/continuity-sample.md)  

```bash
npm test   # or npm run test:unit
npm run typecheck  # if script exists
```

**Out:** LLM extract (use fixture claims in tests).

---

## Slice C — Continuity tool + marks + proposals UI

**In**

- [ ] Extract path: real LLM when key set; **fixture extractor** when `STORYLINT_FIXTURE_LLM=1` or no key (tests/dev)  
- [ ] Continuity run from top bar **and** agent panel action  
- [ ] Marks overlay on manuscript (`markYellow` / `markRed` tokens only)  
- [ ] Proposals in agent panel (+ optional under-sheet pending) Accept/Edit/Reject  
- [ ] Privacy note in UI: run sends chapter + bible digest to provider when live  

**Verify**

- [ ] No key → clear error or fixture path; no corrupt project  
- [ ] With fixture: known red span + proposal appear  
- [ ] Accept/Reject paths  
- [ ] No gen chips in editor  

**Out:** multi-turn free chat brain, co-write Apply, review agents.

---

## Slice D — Agent panel chat shell (P1 bar)

**In**

- [ ] Chat transcript UI + composer  
- [ ] Context chips: current chapter (stub @bible)  
- [ ] Tool-run card for Continuity results  
- [ ] **Sheet help:** user can ask to create/fill a character/org → assistant returns structured proposal pack → same Accept path as continuity proposals  
- [ ] Empty-state / slash hint: newbie one-liners (“Run Continuity after a scene”, “Ask me to draft a character sheet”) — dismissible  
- [ ] Optional: dumb echo or thin “ask about selection” if cheap  
- [ ] README dogfood steps  

**P1 exit = PRD §7 checklist all checked** + Slice 0–D merged.  

**Still out of D:** portraits, research panel UI, graph canvas, live web research.

---

## Later (do not pull forward)

| Slice | Content |
|-------|---------|
| D+ | Sheet create-with-me proposal packs + newbie empty-state copy (if not already in C/D chat) |
| E | Co-write Apply (P1b) |
| F | Sheet portrait/icon + lore field hints (P1.5); optional **manual** craft tags on chapter |
| G | Review agents + craft tag suggest + **chapter craft check** (P2) |
| H | **Research panel** clean/cited (P3) |
| I | Relationship edges UX + **graph/canvas** (P4) |
| J | MD export, multi-project |
| K | Desktop/mobile shells |

**Graph-ready without graph UI:** in Slice B domain, keep `claimKind` / fact kind including `relationship`; store `fromSheetId`/`toSheetId` optional fields only if cheap — otherwise parseable statement+key is enough until P4.

---

## Coder stop conditions (escalate to human)

- Want to add auth, Tailwind default palette, TipTap, SQL, collab, or P2 review  
- TOKENS.md missing a value → **edit TOKENS.md first**  
- PRD conflict → stop, don’t invent scope  
