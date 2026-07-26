# Storylint

**Fiction IDE** for serial / world-heavy novels — clean manuscript editor + **Claude-style agent panel** that knows your chapters and bible.

You draft. The agent helps (continuity, sheets, later co-write / review / research).  
**Nothing hits the book or canon unless you Apply / Accept.**

> Like VS Code + Claude, for your novel.

## Current status

**Wave 0:** product docs + bare Vite scaffold. App features not built yet.

## Docs (start here)

| Doc | |
|-----|--|
| [docs/PRD.md](docs/PRD.md) | MVP spine & acceptance |
| [docs/BUILD.md](docs/BUILD.md) | Implementation slices for coder |
| [docs/AGENTS_ROLES.md](docs/AGENTS_ROLES.md) | Coder / reviewer / verifier |
| [docs/01-identity-market.md](docs/01-identity-market.md) | Identity & market |
| [docs/02-steal-and-phases.md](docs/02-steal-and-phases.md) | Steal matrix & phases |
| [docs/03-ux.md](docs/03-ux.md) | UX / portable design system |
| [docs/design/README.md](docs/design/README.md) | Design system folders + Tailwind policy |
| [docs/design/TOKENS.md](docs/design/TOKENS.md) | **Concrete tokens** (primary, type, space…) for every port |
| [docs/design/REFERENCES.md](docs/design/REFERENCES.md) | URLs for Obsidian focus etc. — patterns, not copied hex |
| [docs/04-agents.md](docs/04-agents.md) | Agent model |
| [docs/05-tech.md](docs/05-tech.md) | Tech stub (ADRs next) |
| [CLAUDE.md](CLAUDE.md) | Agent entry rules |

## Scaffold

```bash
npm install
npm run dev      # Vite default
npm run build
```

## MVP constraints

- Single local user (no login)
- BYOK LLM when features land
- Continuity-first build; full agent vision documented up front
- **UI design system must be portable** — web first, same system targetable to Windows / macOS / Linux desktop and Android / iOS later (see docs/03-ux.md)
