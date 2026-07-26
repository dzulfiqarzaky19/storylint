# Design system

**Canonical values:** [TOKENS.md](./TOKENS.md)  
**External inspiration (URLs + what we mean):** [REFERENCES.md](./REFERENCES.md)  
**Product shell / IA:** [../03-ux.md](../03-ux.md)

## Agent rules (non-negotiable)

1. **Never hard-code** hex, raw `px` font sizes, or ad-hoc greys in feature UI.  
2. **Never invent** “Obsidian colors” / “VS Code purple” from memory.  
3. **Only** use token **names** from TOKENS.md (`color.accent`, `space.3`, `text.manuscript`, …).  
4. If a token is missing, **add it to TOKENS.md first**, then use it — don’t freestyle in a component.  
5. Tailwind (if enabled) is a **consumer** of tokens, not a second palette.  
6. “Steal from X” means **interaction/IA pattern** from REFERENCES.md — **skin is always ours**.

## Folder layout (code — create in tech wave)

```
docs/design/                 # this folder — human + agent truth
  README.md
  TOKENS.md                  # colors, type, space, radii (port bible)
  REFERENCES.md              # URLs + pattern definitions

src/design/                  # runtime design system (web)
  tokens.css                 # :root CSS vars 1:1 with TOKENS.md
  tokens.ts                  # optional typed map / theme helper
  tw-theme.ts                # optional: Tailwind theme.extend from tokens only
  index.ts                   # public exports

src/components/ui/           # primitives only (Button, Input, …) — token refs
src/components/shell/        # binder / editor / agent layout slots
src/features/                # product features — compose ui/*, no raw colors
```

**Do not** put one-off colors in `src/features/**` or `App.css`.  
**Do not** scatter `bg-[#0f1115]` / `text-gray-400` — map through tokens.

## Tailwind policy

| Allowed | Forbidden |
|---------|-----------|
| `bg-canvas`, `text-muted`, `p-3` if those utilities are **generated from TOKENS** | `bg-[#123]` / `text-sky-500` / default Tailwind palette for brand |
| `className` on primitives built on tokens | Feature files defining new hex |
| Changing TOKENS.md → regenerate theme | Forking a second grey scale in tailwind.config by eye |

Core brand **does not change** when Tailwind is added/removed. Tokens stay the core; Tailwind is optional sugar.

## Port

Android / iOS / desktop shells read **TOKENS.md names + values**.  
They do not read Tailwind class strings.
