# Google Stitch prompts — Storylint

**⚠️ Palette in older prompts below is LEGACY (cool AI blue).**  
**Ship skin = [TOKENS.md](./TOKENS.md) only** (Kobo paper: cream/sepia/mint/night + warm charcoal chrome + bronze/stone accent).

Use Stitch for **layout/IA** reference. When pasting colors into Stitch, **replace** the master style with the block in §0.

---

## 0 — Master style (current — use this)

```
Design system for “Storylint”, desktop web writing IDE for novelists.

Aesthetic: Kobo e-reader + calm IDE. Warm paper manuscript, soft charcoal chrome. No AI sky-blue, no purple gradients, no neon, no upgrade banners.

Chrome night:
- canvas #0E0E0E, surface #1A1A1A, raised #242424
- border #2E2E2E, text #E3E5E8, muted #9A9CA0
- primary button #2A2A2A, on-primary #E3E5E8
- accent soft brass #C4A574 (links/focus only)

Manuscript paper profiles:
- day #F4F1EA ink #2C2D30
- sepia #EFE6D5 ink #2C2D30
- mint #E5EADF ink #2C2D30
- night #121212 ink #E3E5E8

Marks (text only): soft #A67C2A, hard #B54A4A washes translucent.

Type: UI system sans; manuscript Georgia/serif 17px+/1.7.
Layout: topbar 48px; binder=agent (300→420 by breakpoint). Paper: full-bleed + round reading seal below 1366; centered A4-ratio page + right ribbon from 1366. Reading control on paper only (not top bar). Words/chars under title.
No gen buttons in the prose column. Agent = right panel. Continuity marks only on spans.
```

---

## 1 — Desktop shell (IA — ignore old hex in any cached gens)

```
Storylint master style (§0). 1440×900 desktop (≥1366 desk).
Top bar: project, chapter, Saved, Continuity, Focus, theme (chrome only), agent toggle — NO reading control in top bar.
Left binder (~380px): chapters, sheet kinds, empty = dashed list rows not pills.
Center: A4-ratio paper card on dark desk; title + words/chars under title; body; right-edge ribbon bookmark (Day/Sepia/Mint/Night colors); continuity marks on spans only.
Right agent (~380px): Continuity, transcript, proposals Accept/Edit/Reject, Apply cards, Continue/Rewrite/Brainstorm, composer.
Also show compact variant &lt;1366: full-bleed paper, round seal top-right on page, no hanging ribbon.
No sky blue. Light mode primary = ink charcoal not muddy brown.
```

## 2 — Focus mode

```
§0 style. Focus: only manuscript paper full area; minimal top bar. No binder/agent.
```

## 3 — Agent proposals

```
§0 style. Agent panel: Continuity result card, bible proposal cards, co-write Apply preview card (Insert/Replace/Dismiss). Manuscript has no gen chips.
```

## 4–9

Prefer regenerating from §0 + [../03-ux.md](../03-ux.md) rather than old blue prompts. Historical blue-hex prompts deleted to avoid agent confusion.

## Anti-prompts

```
Avoid: #6EA8FE, cool gray IDE skins, purple AI glow, pure black text on cream, pure white night text, chocolate brown CTAs, pill empty states, gen buttons over prose, unequal random sidebar widths, huge empty gutters on ultrawide without scaling paper.
```
