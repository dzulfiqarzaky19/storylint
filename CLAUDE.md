# Storylint

Writing **IDE** for serial / world-heavy fiction + **project-aware agent panel**  
(VS Code + Claude extension shape). Human owns Apply/Accept into manuscript and canon.

## Read first (agents)

| Doc | Use when |
|-----|----------|
| [docs/PRD.md](docs/PRD.md) | Scope, MVP acceptance, non-goals |
| [docs/BUILD.md](docs/BUILD.md) | **Coder slices 0→D** + locked tech defaults |
| [docs/AGENTS_ROLES.md](docs/AGENTS_ROLES.md) | Coder / reviewer / verifier gates + prompts |
| [docs/01-identity-market.md](docs/01-identity-market.md) | Positioning, beachhead |
| [docs/02-steal-and-phases.md](docs/02-steal-and-phases.md) | Phases P1→P3, steal/leave |
| [docs/03-ux.md](docs/03-ux.md) | Shell IA, design system requirements |
| [docs/design/README.md](docs/design/README.md) | Design-system folder + Tailwind policy |
| [docs/design/TOKENS.md](docs/design/TOKENS.md) | **Canonical** colors, type, space, radii — port this |
| [docs/design/REFERENCES.md](docs/design/REFERENCES.md) | URLs + pattern defs (“Obsidian focus” etc.) — **not** their hex |
| [docs/04-agents.md](docs/04-agents.md) | Agent capabilities + apply boundaries |
| [docs/05-tech.md](docs/05-tech.md) | Tech stub / ADR backlog |
| [docs/fixtures/continuity-sample.md](docs/fixtures/continuity-sample.md) | Fixture prose for continuity QA |

## Hard rules

1. **Manuscript:** agent text enters only via user **Apply**  
2. **Bible/canon:** only via user **Accept** (or manual edit)  
3. Editor stays clean — no gen cockpit in the type column  
4. Agent panel is first-class IA (not an afterthought button-only app)  
5. MVP: **no auth / no multi-user** — local dogfood  
6. Domain logic pure; **test-first** for gates/accept/API contracts (see docs/BUILD.md); don’t re-implement gates in UI; fixture LLM path for CI  
7. Smallest change; no suite creep ahead of phase  
8. **Design tokens only:** colors/spacing/type from [docs/design/TOKENS.md](docs/design/TOKENS.md) — never hard-code hex/px; never invent “Obsidian/VS Code colors” from memory  
9. **Patterns ≠ paint:** “Obsidian focus”, “Cursor agent panel” = behavior in [docs/design/REFERENCES.md](docs/design/REFERENCES.md) (with URLs); skin always TOKENS  
10. **Tailwind optional sugar:** if used, theme must be generated from tokens (`src/design/`); no default palette for brand surfaces; features use tokenized utilities or `var(--*)` only  
11. **DS folders:** docs in `docs/design/`; runtime in `src/design/` + `src/components/ui/` — see design README

## Repo state (Wave 0)

Bare Vite React-TS scaffold + docs only.  
**Implementation order:** [docs/BUILD.md](docs/BUILD.md) Slice 0 → A → B → C → D.  
Do not one-shot “whole MVP.”

## Dev (scaffold)

```bash
npm install
npm run dev
npm run build
```

## Delegation

See [docs/AGENTS_ROLES.md](docs/AGENTS_ROLES.md). First coder task = **Slice 0** (tokens + ui primitives), not continuity.
