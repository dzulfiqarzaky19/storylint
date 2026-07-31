# Design system

| Doc | |
|-----|--|
| [TOKENS.md](./TOKENS.md) | **Paint source of truth** — Kobo paper + warm chrome |
| [CANON-VOCABULARY.md](./CANON-VOCABULARY.md) | **Words** — user-facing lexicon (kinds, places, @canon) |
| [LAB.md](./LAB.md) | **Slice L** — pre-canon Lab bench (shipped) |
| [COMPANION.md](./COMPANION.md) | Mode-shaped right rail — faces by context |
| [REFERENCES.md](./REFERENCES.md) | Patterns/URLs (behavior only) |
| [STITCH.md](./STITCH.md) | Stitch prompts — **outdated AI-blue**; do not ship skin from it |
| [../IA_MAP.md](../IA_MAP.md) | **Structure lock** (ecosystems, depth, gates) |
| [../03-ux.md](../03-ux.md) | Journeys + reading profiles (defers structure to IA_MAP) |
| [../CALM_BUDGET.md](../CALM_BUDGET.md) | Density HARD/WARN numbers |
| [../E2E.md](../E2E.md) | Browser verify |
| [../decisions/](../decisions/README.md) | Design reviews / adjudications (history) |

Corpus entry: [../README.md](../README.md).

## Doctrine (agents)

1. **Never hard-code** hex, px, or rem in `components/` / `features/`.  
2. **Never** restore sky-blue AI palette (`#6EA8FE` etc.).  
3. Change values in **TOKENS.md** then **`src/design/tokens.css`**.  
4. Manuscript uses `color.paper` / `color.paperInk`; chrome uses surface/canvas/text.  
5. Rails and paper width scale via size/measure/gutter tokens — uniformity over one-off CSS.  
6. Steal **patterns** from REFERENCES; skin always ours.  
7. Optional **local** skill (gitignored `.claude/…`) = structure/a11y **checklist only** — never copy its hex/OLED palettes over TOKENS. Never commit harness dirs.  
8. Product **structure** lives in **[../IA_MAP.md](../IA_MAP.md)**; journeys/skin narrative in **[../03-ux.md](../03-ux.md)** + this folder. Durable design **reviews** live under [../decisions/](../decisions/README.md) (history — not a second lock).

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
