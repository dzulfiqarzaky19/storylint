# Design tokens — source of truth for every port

**Purpose:** When we ship web, then Windows / macOS / Linux / Android / iOS, we **port these values**, not vibes.  
**Rule:** Feature UI never invents a hex, px, or font size. It only references token names.

See also: [README.md](./README.md) (folders + Tailwind) · [REFERENCES.md](./REFERENCES.md) (Obsidian/VS Code **patterns + URLs**, not their colors).

Implementation mapping (later code):

| Token name | Web | Desktop shell | iOS | Android |
|------------|-----|---------------|-----|---------|
| `--color-accent` | CSS variable | same CSS or theme JSON | UIColor / Asset | color resource |
| `--space-3` | `rem`/`px` | dp/pt via shared scale | pt | dp |
| `--text-body` | `rem` | sp/pt | UIFont size | sp |

**Canonical unit:** all raw sizes below are **px at 1×** (CSS px ≈ Android dp baseline).  
Scale: mobile font boost uses the same names, different density profile if needed — never rename.

---

## 1. Color

### 1.1 Neutrals (dark = default theme)

| Token | Hex | Role |
|-------|-----|------|
| `color.canvas` | `#0F1115` | App background behind panels |
| `color.surface` | `#161A22` | Binder, agent, top bar |
| `color.surfaceRaised` | `#1C2230` | Cards, inputs, elevated rows |
| `color.surfaceOverlay` | `#1C2230E6` | Drawers/modals (90% opacity) |
| `color.border` | `#2A3142` | Default borders / dividers |
| `color.borderStrong` | `#3D4660` | Focused well / active rail edge |
| `color.text` | `#E7ECF5` | Primary text |
| `color.textMuted` | `#8B95A8` | Secondary labels, meta |
| `color.textSubtle` | `#6B7588` | Placeholder, disabled label |
| `color.textInverse` | `#0F1115` | Text on accent solid buttons |

### 1.2 Neutrals (light theme)

| Token | Hex |
|-------|-----|
| `color.canvas` | `#F4F6FA` |
| `color.surface` | `#FFFFFF` |
| `color.surfaceRaised` | `#EEF1F7` |
| `color.surfaceOverlay` | `#FFFFFFE6` |
| `color.border` | `#D5DBE8` |
| `color.borderStrong` | `#A8B3C9` |
| `color.text` | `#141820` |
| `color.textMuted` | `#5C6578` |
| `color.textSubtle` | `#8B95A8` |
| `color.textInverse` | `#FFFFFF` |

### 1.3 Brand / action (same both themes unless noted)

| Token | Hex | Role |
|-------|-----|------|
| `color.accent` | `#6EA8FE` | Links, active tab, primary focus ring companion |
| `color.accentHover` | `#8BBCFF` | Hover/pressed primary |
| `color.accentMuted` | `#3D5A80` | Primary button border / dim accent |
| `color.accentSubtle` | `#6EA8FE22` | Selected row wash (dark); light use `#6EA8FE18` |
| `color.primary` | `#243B63` | Solid primary button fill (dark UI) |
| `color.primary` (light) | `#2F5AA8` | Solid primary button fill (light UI) |
| `color.onPrimary` | `#E7ECF5` | Label on `color.primary` fill (dark UI) |
| `color.onPrimary` (light) | `#FFFFFF` | Label on `color.primary` fill (light UI) |

**Primary vs accent:**  
- `primary` = filled button background  
- `accent` = ink/focus/link highlight  

**Why `onPrimary` exists:** neither `text` nor `textInverse` clears 4.5:1 on `primary` in *both* themes
(`text` fails on light `#2F5AA8`; `textInverse` fails on dark `#243B63`). `onPrimary` is the one
per-theme pair that passes both. Ports map it like any other color token.

### 1.4 Semantic (continuity + status) — **do not reuse for chrome**

| Token | Hex | Role |
|-------|-----|------|
| `color.markYellow` | `#C9A227` | Soft continuity drift underline |
| `color.markYellowBg` | `#C9A22747` | ~28% wash on span |
| `color.markRed` | `#E35D6A` | Hard continuity conflict underline |
| `color.markRedBg` | `#E35D6A52` | ~32% wash on span |
| `color.success` | `#3DD68C` | Accept success, LLM ready |
| `color.successMuted` | `#2A5A44` | Success badge border |
| `color.danger` | `#E35D6A` | Destructive text/button (same hue family as mark red OK) |
| `color.dangerBg` | `#6B3038` | Danger button border/bg dark |
| `color.warning` | `#C9A227` | Non-mark warnings only if needed |
| `color.pending` | `#8B95A8` | Pending proposal meta |

Mark tokens are **diagnostics only**. Buttons use `primary` / `danger` / `accent`, not `markYellow`.

### 1.5 Focus / state

| Token | Value | Role |
|-------|-------|------|
| `color.focusRing` | `#6EA8FE` | Keyboard focus outline |
| `focus.ringWidth` | `2px` | |
| `focus.ringOffset` | `2px` | |
| `opacity.disabled` | `0.5` | Disabled controls |
| `opacity.muted` | `0.72` | De-emphasized icons |

---

## 2. Typography

### 2.1 Families

| Token | Stack | Use |
|-------|-------|-----|
| `font.ui` | `"Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif` | Chrome, binder, agent |
| `font.manuscript` | `"Segoe UI", system-ui, -apple-system, "Georgia", serif` optional later; **v1 = same as ui** | Chapter body (may swap to serif in settings later) |
| `font.mono` | `"Cascadia Code", "Fira Code", ui-monospace, monospace` | Keys, fingerprints, rare code |

Ports: map `font.ui` → San Francisco (iOS), Roboto/system (Android), Segoe UI (Windows).

### 2.2 Sizes (px @ 1×)

| Token | Size | Line-height | Weight | Use |
|-------|------|-------------|--------|-----|
| `text.xs` | 11 | 16 (1.45) | 500 | Badges, kind tags |
| `text.sm` | 12 | 18 (1.5) | 400 | Meta, timestamps, secondary |
| `text.smMedium` | 12 | 18 | 600 | Uppercase section labels (with tracking) |
| `text.body` | 14 | 20 (1.43) | 400 | UI body, chat, lists |
| `text.bodyMedium` | 14 | 20 | 600 | List titles, emphasis |
| `text.md` | 15 | 22 | 400 | Agent composer |
| `text.lg` | 16 | 24 (1.5) | 600 | Top bar project name |
| `text.manuscript` | 17 | 29 (1.7) | 400 | **Chapter body** |
| `text.manuscriptTitle` | 18 | 26 | 600 | Chapter title field |
| `text.xl` | 20 | 28 | 600 | Rare empty-state title |

### 2.3 Manuscript measure

| Token | Value | Role |
|-------|-------|------|
| `manuscript.measureMin` | `65ch` | Preferred min readable |
| `manuscript.measureMax` | `75ch` | Cap line length |
| `manuscript.paddingX` | `20px` (`space.5`) | Horizontal pad in editor |
| `manuscript.paddingY` | `18px` | Vertical pad |

### 2.4 Letter-spacing

| Token | Value | Use |
|-------|-------|-----|
| `tracking.section` | `0.06em` | UPPERCASE panel headers |
| `tracking.badge` | `0.04em` | Severity labels |

---

## 3. Spacing (4px base)

| Token | px | Use |
|-------|-----|-----|
| `space.0` | 0 | |
| `space.1` | 4 | Tight icon gaps |
| `space.2` | 8 | Compact padding |
| `space.3` | 12 | Default control padding Y-ish |
| `space.4` | 16 | Panel padding, card gap |
| `space.5` | 20 | Editor X pad |
| `space.6` | 24 | Section gaps |
| `space.8` | 32 | Large stack gaps |
| `space.10` | 40 | |
| `space.12` | 48 | |
| `space.16` | 64 | |

### Component padding recipes

| Recipe | Value |
|--------|--------|
| Button padding | `space.2` × `space.3` → 8×12 |
| Input padding | `7px` × `space.3` (optical) → document as `space.2` + 1px if needed; **prefer 8×12** |
| Card padding | `space.3` (12) |
| Panel header padding | `10px` × `space.3` → use `space.3` all around OK |
| List row padding | `space.2` × `space.3` |

### Touch

| Token | px | Role |
|-------|-----|------|
| `size.touchMin` | 44 | Minimum hit target (mobile profile) |
| `size.rowMin` | 36 | Desktop list row min height |
| `size.rowMinTouch` | 44 | Touch list row |

---

## 4. Sizing (layout chrome)

| Token | px | Role |
|-------|-----|------|
| `size.topbarHeight` | 48 | Top bar |
| `size.binderWidth` | 220 | Default left rail |
| `size.binderWidthMin` | 180 | |
| `size.binderWidthMax` | 320 | |
| `size.agentWidth` | 360 | Default agent panel |
| `size.agentWidthMin` | 300 | |
| `size.agentWidthMax` | 480 | |
| `size.icon` | 16 | Default icon |
| `size.iconSm` | 14 | |
| `size.iconLg` | 20 | |
| `size.controlHeight` | 32 | Desktop button/input height |
| `size.controlHeightTouch` | 44 | Touch |

---

## 5. Radius

| Token | px | Use |
|-------|-----|-----|
| `radius.none` | 0 | |
| `radius.sm` | 4 | Marks, tiny chips |
| `radius.md` | 6 | Buttons, inputs |
| `radius.lg` | 8 | Cards, panels inner |
| `radius.xl` | 12 | Sheets/drawers mobile |
| `radius.pill` | 999 | Badges |

---

## 6. Elevation / shadow

Keep flat; max 2 levels.

| Token | Value | Use |
|-------|-------|-----|
| `shadow.none` | none | Default |
| `shadow.sm` | `0 1px 2px #00000040` | Raised control (dark) |
| `shadow.md` | `0 4px 16px #00000059` | Drawer / popover |
| `shadow.sm` (light) | `0 1px 2px #14182014` | |
| `shadow.md` (light) | `0 4px 16px #1418201F` | |

---

## 7. Breakpoints

| Token | Width px | Layout intent |
|-------|----------|---------------|
| `bp.sm` | 640 | Phone landscape / large phone |
| `bp.md` | 768 | Tablet / narrow window — drawers |
| `bp.lg` | 1024 | Dual rail OK |
| `bp.xl` | 1280 | Comfortable IDE |
| `bp.2xl` | 1536 | Wide |

**Rules:**

- `< bp.md`: binder + agent as overlays/sheets; editor full width  
- `≥ bp.lg`: three-slot IDE shell available  
- Focus mode: editor only at every width  

---

## 8. Z-index

| Token | Value | Layer |
|-------|-------|-------|
| `z.base` | 0 | Editor, panels |
| `z.rail` | 10 | Sticky panel headers |
| `z.dropdown` | 20 | Menus |
| `z.overlay` | 30 | Dim backdrop |
| `z.drawer` | 40 | Binder/agent drawer mobile |
| `z.modal` | 50 | Rare dialogs |
| `z.toast` | 60 | Errors only |

---

## 9. Motion

| Token | Value |
|-------|-------|
| `motion.fast` | 120ms |
| `motion.normal` | 180ms |
| `motion.slow` | 240ms |
| `easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` |

Prefer **no animation** on manuscript text. Respect `prefers-reduced-motion: reduce` → all durations 0.

---

## 10. Border width

| Token | px |
|-------|-----|
| `border.width` | 1 |
| `border.widthStrong` | 2 | Active mark underline, focus |

Mark underline uses `border.widthStrong` + `color.mark*`.

---

## 11. CSS variable export names (web)

Use one naming scheme everywhere:

```css
:root {
  /* color */
  --color-canvas: #0f1115;
  --color-surface: #161a22;
  --color-surface-raised: #1c2230;
  --color-border: #2a3142;
  --color-border-strong: #3d4660;
  --color-text: #e7ecf5;
  --color-text-muted: #8b95a8;
  --color-text-subtle: #6b7588;
  --color-text-inverse: #0f1115;
  --color-accent: #6ea8fe;
  --color-accent-hover: #8bbcff;
  --color-accent-muted: #3d5a80;
  --color-accent-subtle: #6ea8fe22;
  --color-primary: #243b63;
  --color-on-primary: #e7ecf5;
  --color-mark-yellow: #c9a227;
  --color-mark-yellow-bg: #c9a22747;
  --color-mark-red: #e35d6a;
  --color-mark-red-bg: #e35d6a52;
  --color-success: #3dd68c;
  --color-danger: #e35d6a;
  --color-focus-ring: #6ea8fe;

  /* space */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* type */
  --font-ui: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif;
  --font-manuscript: var(--font-ui);
  --font-mono: "Cascadia Code", "Fira Code", ui-monospace, monospace;
  --text-xs: 11px;
  --text-sm: 12px;
  --text-body: 14px;
  --text-md: 15px;
  --text-lg: 16px;
  --text-manuscript: 17px;
  --text-manuscript-title: 18px;
  --leading-manuscript: 1.7;

  /* layout */
  --size-topbar: 48px;
  --size-binder: 220px;
  --size-agent: 360px;
  --size-touch-min: 44px;
  --size-control: 32px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --manuscript-measure: 70ch;

  --bp-md: 768px;
  --bp-lg: 1024px;
}
```

Light theme overrides only the color block under `[data-theme="light"]`.

---

## 12. Component → token map (examples)

| UI bit | Tokens |
|--------|--------|
| Top bar bg | `color.surface` + bottom `color.border` |
| Primary button | bg `color.primary`, border `color.accentMuted`, text `color.onPrimary`, radius `radius.md`, height `size.controlHeight` |
| Ghost button | bg transparent, border `color.border`, text `color.text` |
| Danger button | text/border from `color.danger` / `color.dangerBg` |
| List row active | bg `color.surfaceRaised`, border `color.border` |
| Section label | `text.smMedium` + `color.textMuted` + `tracking.section` |
| Chat bubble agent | bg `color.surfaceRaised`, text `text.body` |
| Proposal card | bg `color.surfaceRaised`, padding `space.3`, radius `radius.lg` |
| Mark yellow span | bg `color.markYellowBg`, underline 2px `color.markYellow` |
| Mark red span | bg `color.markRedBg`, underline 2px `color.markRed` |
| Manuscript | `text.manuscript`, leading 1.7, measure `manuscript.measureMax` |

---

## 13. Port checklist

When adding Android/iOS/desktop:

- [ ] Copy **token table**, not screenshots alone  
- [ ] Same names (`color.accent`, `space.3`, …)  
- [ ] 1× px → dp/pt with 1:1 for these values  
- [ ] Touch profile switches `size.controlHeight` → `size.controlHeightTouch`  
- [ ] Mark colors unchanged  
- [ ] No new ad-hoc greys  

---

## 14. Change control

- Token changes are **design PRs** — bump a short changelog at bottom of this file  
- Renames require updating every platform map  
- Prefer adding a token over overloading `accent` for marks  

### Changelog

| Date | Change |
|------|--------|
| 2026-07-26 | Initial concrete token set (Wave 0) |
| 2026-07-27 | Add `color.onPrimary` (per-theme primary-button label; contrast) — Slice 0 port |
