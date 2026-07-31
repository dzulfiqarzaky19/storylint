# Design system

| Doc | |
|-----|--|
| [TOKENS.md](./TOKENS.md) | **Source of truth** — Kobo paper + warm chrome |
| [REFERENCES.md](./REFERENCES.md) | Patterns/URLs (behavior only) |
| [STITCH.md](./STITCH.md) | Stitch prompts — **outdated AI-blue**; do not ship skin from it |
| [../03-ux.md](../03-ux.md) | IA, reading profiles, snap layout |
| [../E2E.md](../E2E.md) | Browser verify |

## Doctrine (agents)

1. **Never hard-code** hex, px, or rem in `components/` / `features/`.  
2. **Never** restore sky-blue AI palette (`#6EA8FE` etc.).  
3. Change values in **TOKENS.md** then **`src/design/tokens.css`**.  
4. Manuscript uses `color.paper` / `color.paperInk`; chrome uses surface/canvas/text.  
5. Rails and paper width scale via size/measure/gutter tokens — uniformity over one-off CSS.  
6. Steal **patterns** from REFERENCES; skin always ours.  
7. Optional skill `.claude/skills/ui-ux-pro-max` = structure/a11y **checklist only** — never copy its hex/OLED palettes over TOKENS.  
8. Product UX rules live in **[../03-ux.md](../03-ux.md)** + this folder — no separate review markdown files.

## Folders

```
docs/design/           truth
src/design/tokens.css  runtime vars
src/design/index.ts    applyTheme / applyReading
src/components/ui/     primitives → var(--*)
src/components/shell/  layout → var(--size-*) only
```

## Reading profiles

`data-reading=day|sepia|mint|night` on `<html>` → paper/ink only.  
Control is **on the paper** (not top bar):

| Viewport | Control | Tokens |
|----------|---------|--------|
| **&lt;1366** | Round **seal** top-right *inside* page | `--size-reading-seal` |
| **≥1366** | Right-edge **ribbon** (may peek) | `--size-reading-btn` |

Page = A4 **ratio** (`min-height: 100cqw × √2`), width `manuscript.pageMaxW*` — not physical mm.

## Port

Mobile/desktop adapters consume **token names**, not Tailwind or Stitch hex.
