# Runtime design system

`tokens.css` is the web port of [docs/design/TOKENS.md](../../docs/design/TOKENS.md) — the only
file in the repo allowed to contain raw hex or raw px.

Rules (full text in [docs/design/README.md](../../docs/design/README.md)):

1. Feature UI references `var(--token)` names, never literal values.
2. Missing token → add it to `docs/design/TOKENS.md` first, then mirror it here.
3. Patterns ("Obsidian focus") come from
   [docs/design/REFERENCES.md](../../docs/design/REFERENCES.md); the skin is always these tokens.
4. Tailwind is not enabled. If added, its theme must be generated from these tokens — no second
   palette.

Consumers: `src/components/ui/` primitives, then `src/components/shell/` and `src/features/`.
