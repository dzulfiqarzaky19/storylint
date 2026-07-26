# Google Stitch prompts — Storylint

Paste into [Google Stitch](https://stitch.withgoogle.com/) (or similar UI gen).  
**One screen per prompt** after the master style. Keep dark theme unless noted.

Product: fiction **IDE** for serial novels — clean manuscript + first-class **agent panel** (VS Code + Claude shape). Human **Accept/Apply** only into canon/book.

---

## 0 — Master style (paste first / pin as project style)

```
Design system for “Storylint”, a desktop web writing IDE for novelists (not a marketing site, not a chat app).

Aesthetic: calm IDE like VS Code + Obsidian focus — dense chrome, airy manuscript. No gamification, no neon cyberpunk, no purple AI cliché gradients, no upgrade banners, no stock “AI sparkle” overload.

Exact colors (dark default):
- canvas/background: #0F1115
- surface (sidebars, top bar): #161A22
- surface raised (cards, inputs): #1C2230
- border: #2A3142
- border strong: #3D4660
- text primary: #E7ECF5
- text muted: #8B95A8
- text subtle: #6B7588
- accent (links, focus): #6EA8FE
- primary button fill: #243B63
- primary button label: #E7ECF5
- success: #3DD68C
- danger / continuity HARD mark: #E35D6A
- continuity SOFT mark: #C9A227
- mark yellow bg wash: rgba(201,162,39,0.28)
- mark red bg wash: rgba(227,93,106,0.32)

Typography: system UI sans (Segoe UI / Inter). Manuscript body 17px, line-height 1.7, max measure ~70ch. UI body 14px. Section labels 12px uppercase tracking wide, muted.

Layout chrome: top bar height 48px; left binder ~220px; right agent panel ~360px; 1px borders; radius 6px controls, 8px cards. Spacing 4px grid (8/12/16/20).

Rules:
- Continuity yellow/red ONLY on text highlights — never as primary button colors.
- No generate buttons inside the manuscript column.
- Agent lives in the right panel.
- High contrast, accessible, professional indie-author tool.
```

---

## 1 — Desktop shell: write mode (P1 hero)

```
Using the Storylint master style, design a full desktop app screenshot (1440×900).

Layout:
1) Thin top bar (#161A22): left “Ashen Crown” project name; center chapter “Ch. 12 · The Gate”; right buttons: Continuity (primary #243B63), Focus (ghost), Agent toggle, small green “LLM ready” badge.
2) Left binder 220px: sections CHAPTERS (list Ch.10–13, Ch.12 selected #1C2230) and SHEETS (Character Aria, Org Silent Court, + New). Header “Binder” uppercase muted.
3) Center manuscript: chapter title input; body of fantasy prose ~2 paragraphs, 17px, max-width ~70ch, centered in pane, padding 20px. One phrase “blue eyes” has red underline wash (continuity hard). One phrase has yellow wash (soft drift). NO floating AI buttons on the text.
4) Right agent panel 360px: header “Agent”; context chips “@Ch.12” “@bible”; chat transcript — user “Run continuity”, assistant tool card “Continuity · 1 red · 2 proposals”; below a proposal card “Aria · eye_color amber→blue conflict” with Accept / Edit / Reject; composer at bottom with send.

Mood: focused writing session, IDE not landing page. Dark only.
```

---

## 2 — Focus mode (manuscript only)

```
Storylint master style. 1440×900. FOCUS MODE: hide left binder and right agent entirely. Only minimal top bar (project name + “Exit focus”) and full-width manuscript. Chapter title + long clean prose, 17px/1.7, ~70ch centered on #0F1115. No chips, no AI widgets, no side panels. Ultra calm Obsidian-focus energy. Dark.
```

---

## 3 — Agent panel detail (proposal + apply)

```
Storylint master style. Close-up or full app with agent panel emphasized (right 360–400px).

Show:
- Chat messages (user/assistant)
- Tool run card: “Continuity finished — 1 red, 1 yellow, 2 proposals”
- Proposal card (bible): “New character · Kael — wields a sword” · confidence 0.85 · buttons Accept (primary) Edit Reject (danger outline)
- Apply card (manuscript): draft paragraph preview in monospace-ish block · buttons Apply to cursor · Dismiss
- Composer: placeholder “Ask about this chapter or create a character…”

Left/center can be dimmed manuscript peek. No modal dialogs. Dark IDE UI.
```

---

## 4 — Character sheet detail

```
Storylint master style. Desktop: binder left, center shows CHARACTER SHEET (not manuscript).

Sheet “Aria Vale” · kind tag CHARACTER · aliases.
Fields: Summary short paragraph; Notes; Facts list as rows:
- appearance · eye color: amber
- faction · Silent Court
- relationship · mentor of Kael
Pending strip at bottom (muted card): “Suggested from manuscript” · “status: injured after the Gate” · Accept / Reject.

Optional empty portrait placeholder rounded square 64–80px (no photo required). Clean Novelcrafter-codex energy, our colors only. Dark.
```

---

## 5 — Empty / newbie state

```
Storylint master style. New project empty-ish: one empty chapter “Chapter 1”, no sheets.

Agent panel open with dismissible tips (not a modal wizard):
- “Write a scene, then run Continuity”
- “Ask me to draft a character sheet”
- “Sheets are canon — I only propose, you Accept”

Manuscript placeholder “Write the chapter…”. Calm, helpful, not onboarding carnival. Dark.
```

---

## 6 — Continuity marks legend (annotation callout)

```
Storylint master style. Manuscript zoom showing two highlights in body text:
1) red background wash + red bottom border on “blue eyes” — tooltip “Sheet says eye_color=amber”
2) yellow wash on a softer phrase — tooltip “Possible drift from sheet fact”

Small legend under editor: red = contradicts sheet · yellow = soft drift. Do not use yellow/red for sidebar buttons. Dark.
```

---

## 7 — Mobile / narrow (adaptive)

```
Storylint master style. Phone frame 390×844.

Screen: manuscript full width, top bar with hamburger + chapter title + Continuity icon.
Bottom nav or FAB: Binder | Write | Agent.
Show Agent as full-screen sheet overlay half-open: chat + one proposal card Accept/Reject.
Touch targets ≥44px. Same dark tokens. No desktop three-column.
```

---

## 8 — Research panel (P3 preview — optional)

```
Storylint master style. Desktop. Center or agent column replaced by RESEARCH panel (clean, powerful, not chat spam).

Layout: left pins/sources list; main results list with citation lines; each result [Pin] [Propose to sheet]. Sparse chrome, strong hierarchy, #161A22 surfaces. No auto-insert into manuscript. Dark.
```

---

## 9 — Relationship graph (P4 preview — optional)

```
Storylint master style. Full canvas on dark #0F1115.
Nodes as small cards: Aria (character), Kael (character), Silent Court (org) with thin borders #2A3142.
Edges labeled father_of / member_of / rival (muted text).
Click-selected node Aria with accent border #6EA8FE.
Obsidian-graph navigation energy but OUR palette only — no purple theme pack. Minimal toolbar: Filter · Fit · Open sheet.
```

---

## How to use

1. Paste **§0 Master style** into Stitch project instructions / first prompt.  
2. Generate **§1** as primary reference for engineering.  
3. Add **§2–6** for P1 states; **§7** for responsive; **§8–9** only as future vision (label them P3/P4 in filenames).  
4. Export screenshots into `docs/design/stitch/` (create when you have files).  
5. Coders match layout + tokens — Stitch is reference, **TOKENS.md** still wins on hex.

## Anti-prompts (if Stitch drifts)

```
Avoid: purple AI gradients, 3D robots, glassmorphism overload, light theme, Grammarly-style underlines in rainbow, crowded marketing hero, Comic Sans, huge rounded “Start creating” empty states, generate buttons over the prose.
```
