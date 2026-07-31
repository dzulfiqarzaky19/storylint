# Design tokens — source of truth for every port

**Purpose:** When we ship web, then Windows / macOS / Linux / Android / iOS, we **port these values**, not vibes.  
**Rule:** Feature UI never invents a hex, px, rem, or font size. It only references token names (`var(--…)` / theme map).  
Layout chrome (rails, topbar, reading control) = `size.*` in this file → `src/design/tokens.css` → components. **No parallel magic numbers in CSS/TSX.**

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

**Doctrine:** Kobo / paper reader — not cool “AI IDE” blue-gray.  
Two layers: **chrome** (binder, agent, top bar) + **manuscript paper** (reading surface).

### 1.1 Reading profiles (manuscript page)

| Profile | Paper bg | Ink | When |
|---------|----------|-----|------|
| `day` | `#F4F1EA` Book White | `#2C2D30` soft charcoal | Default daylight |
| `sepia` | `#EFE6D5` aged page | `#2C2D30` | Cozy / dim indoor |
| `mint` | `#E5EADF` low-fatigue green | `#2C2D30` | Harsh fluorescent |
| `night` | `#121212` Obsidian | `#E3E5E8` milky silver | Dark room |

Tokens: `color.paper`, `color.paperInk` (set by `data-reading` on `<html>`).  
Never pure `#000` on cream; never pure `#FFF` body on night paper.

### 1.2 Chrome neutrals — night (default app shell)

| Token | Hex | Role |
|-------|-----|------|
| `color.canvas` | `#0E0E0E` | Desk behind panels |
| `color.surface` | `#1A1A1A` | Binder, agent, top bar |
| `color.surfaceRaised` | `#242424` | Cards, inputs |
| `color.surfaceOverlay` | `#1A1A1AE6` | Drawers |
| `color.border` | `#2E2E2E` | Dividers |
| `color.borderStrong` | `#3F3F3F` | Active edge |
| `color.text` | `#E3E5E8` | UI primary (matches night ink) |
| `color.textMuted` | `#9A9CA0` | Meta |
| `color.textSubtle` | `#6E7074` | Placeholder |
| `color.textInverse` | `#121212` | On light chips if needed |

Default manuscript in night shell: `paper` `#121212`, `paperInk` `#E3E5E8`.

### 1.3 Chrome neutrals — day shell (`data-theme="light"`)

| Token | Hex |
|-------|-----|
| `color.canvas` | `#E8E4DB` warm desk |
| `color.surface` | `#F7F4ED` |
| `color.surfaceRaised` | `#FFFFFF` |
| `color.surfaceOverlay` | `#F7F4EDE6` |
| `color.border` | `#D4CFC4` |
| `color.borderStrong` | `#B8B2A6` |
| `color.text` | `#2C2D30` |
| `color.textMuted` | `#5C5E62` |
| `color.textSubtle` | `#8A8C90` |
| `color.textInverse` | `#F4F1EA` |

Default manuscript in day shell: `paper` `#F4F1EA`, `paperInk` `#2C2D30`.

### 1.4 Brand / action — ink + stone (not muddy brown CTAs)

| Token | Night | Day | Role |
|-------|-------|-----|------|
| `color.accent` | `#C4A574` soft brass | `#6B6358` warm stone | Links, focus |
| `color.accentHover` | `#D4BC94` | `#4A453E` | Hover |
| `color.accentMuted` | `#5C5348` | `#B0A898` | Dim border |
| `color.accentSubtle` | `#C4A57422` | `#6B635818` | Selected wash |
| `color.primary` | `#2A2A2A` charcoal | `#2C2D30` ink | Filled button (print density) |
| `color.onPrimary` | `#E3E5E8` | `#F4F1EA` | Label on primary |

**Primary vs accent:** primary = ink block (Kobo-like), accent = quiet metal — **not** chocolate brown buttons. No `#6EA8FE`.

### 1.5 Semantic (continuity) — retuned for paper

| Token | Hex | Role |
|-------|-----|------|
| `color.markYellow` | `#A67C2A` | Soft drift (less neon) |
| `color.markYellowBg` | `#A67C2A33` | Wash on paper |
| `color.markRed` | `#B54A4A` | Hard conflict |
| `color.markRedBg` | `#B54A4A2E` | Wash |
| `color.success` | `#5A8F6A` | Accept / ready |
| `color.successMuted` | `#2F4A38` | Badge border night |
| `color.danger` | `#B54A4A` | Destructive |
| `color.dangerBg` | `#5C2A2A` | Danger chrome night |
| `color.warning` | `#A67C2A` | Non-mark warn |
| `color.pending` | `#9A9CA0` | Proposal meta |

Marks = diagnostics only — never primary buttons.

### 1.6 Focus / state

| Token | Value |
|-------|-------|
| `color.focusRing` | same as `color.accent` |
| `focus.ringWidth` | `2px` |
| `focus.ringOffset` | `2px` |
| `opacity.disabled` | `0.5` |
| `opacity.muted` | `0.72` |

### 1.7 How themes combine

| Attr on `<html>` | Meaning |
|------------------|---------|
| (default) | Night chrome + night paper |
| `data-theme="light"` | Day chrome + day paper defaults |
| `data-reading="day\|sepia\|mint\|night"` | Overrides **paper + paperInk only** (and manuscript text) |

Reading profile can differ from chrome (e.g. night shell + sepia page later); v1 toggle cycles reading on both.

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
| `size.readingBtn` | 76 | Desk ribbon width (Day/Sepia/Mint/Night) |
| `size.readingSeal` | 44 | Compact in-paper circle control |
| `size.binderWidth` | 300 | Base left rail (snug) |
| `size.binderWidthLg` | 340 | ≥1024 |
| `size.binderWidthXl` | 380 | ≥1440 |
| `size.binderWidth2xl` | 420 | ≥1920 |
| `size.agentWidth` | 300 | Base right rail (= binder) |
| `size.agentWidthLg` | 340 | |
| `size.agentWidthXl` | 380 | |
| `size.agentWidth2xl` | 420 | |
| `manuscript.pageMaxW` | 36rem | Max page width (not physical A4 mm) |
| `manuscript.pageMaxWLg` | 40rem | ≥1366 desk |
| `manuscript.pageMaxWXl` | 44rem | ≥1440 |
| `manuscript.pageMaxW2xl` | 48rem | ≥1920 |
| `manuscript.pageRatio` | 1.414… | A4 portrait **ratio** — `min-height: 100cqw * ratio` |
| `manuscript.gutter` | 16px | Desk pad around page |
| `manuscript.gutterLg` | 20px | |
| `manuscript.gutterXl` | 28px | |
| `manuscript.gutter2xl` | 36px | |
| `size.icon` | 16 | Default icon |
| `size.iconSm` | 14 | |
| `size.iconLg` | 20 | |
| `size.controlHeight` | 32 | Desktop button/input height |
| `size.controlHeightTouch` | 44 | Touch |
| `size.graphViewW` | 800 | Relationship graph viewBox width |
| `size.graphViewH` | 520 | Relationship graph viewBox height |
| `size.graphRadius` | 185 | Radial node orbit radius |
| `size.graphNode` | 76 | Graph node diameter |

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
  --size-reading-btn: 76px;
  --size-binder: 360px;
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
| 2026-07-27 | Kobo/paper doctrine: kill AI blue; stone/brass accent; paper/ink + 4 reading profiles |
| 2026-07-27 | Responsive rails/paper tokens; snap gutter; reading-btn size token; docs agent-sync |
| 2026-07-27 | Bookmark ribbon right-edge; full swatch+ink per reading profile |
| 2026-07-27 | Desk breakpoint **1366**; seal&lt;1366; A4 ratio via cqw; docs fully synced |
| 2026-07-27 | Light chrome: ink primary not muddy brown; `size.readingBtn` token; binder empty rows not pills |
| 2026-07-27 | Add `color.onPrimary` (per-theme primary-button label; contrast) — Slice 0 port |
