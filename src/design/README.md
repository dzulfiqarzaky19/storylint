# Runtime design system

`tokens.css` is the single source of truth for palette and sizing, and the only file in the repo
allowed to contain raw hex or raw px values.

Rules:

1. Feature UI references `var(--token)` names, never literal values.
2. A missing value means adding a token here first, then using it.
3. Tailwind is not enabled. If added, its theme must be generated from these tokens so there is
   never a second palette.

Consumers: `src/components/ui/` primitives, then `src/components/shell/` and `src/features/`.
