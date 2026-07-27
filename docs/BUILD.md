# Build slices — coder order

**Read first:** [PRD.md](./PRD.md) · [../CLAUDE.md](../CLAUDE.md) · [design/TOKENS.md](./design/TOKENS.md) · [E2E.md](./E2E.md)  
One slice per coding session. Do not start G/H/I before F/E as listed.

Each slice: coder → reviewer → verifier ([AGENTS_ROLES.md](./AGENTS_ROLES.md)).

---

## Status (keep this honest)

| Slice | Status |
|-------|--------|
| **0** Design system runtime | **Done** |
| **A** Shell IA | **Done** |
| **B** Domain + persistence | **Done** |
| **C** Continuity + marks + proposals | **Done** |
| **D** Agent panel P1 bar | **Done** (= P1 acceptance) |
| **E** P1b Co-write Apply | **Done / landing** — verify before F |
| **F** Portraits, craft tags, shell polish | **Next** (partial polish already in tree: paper modes, snap layout, scrollbars, counts, binder empty rows) |
| **G** P2 Review + craft check | Not started |
| **H** P3 Research panel | Not started |
| **I** P4 Graph | Not started |
| **J** Export / multi-project | Not started |
| **K** Desktop/mobile shells | Not started |

---

## Tests before code

| Work | Order |
|------|--------|
| Domain gates / accept / apply / API | **Test first** |
| Continuity | Fixture path before live LLM |
| UI shell / tokens | Build + [E2E.md](./E2E.md) smoke when UI changes |

---

## Locked defaults

| Topic | Default |
|-------|---------|
| Auth | None |
| Host | Web (Vite) + local API `:4174` |
| Persistence | `data/project.json`, `schemaVersion: 1`, atomic write |
| Editor | `textarea` + mark overlay |
| Styling | `src/design/tokens.css` ⇔ TOKENS.md — **Kobo paper**, not AI blue |
| Reading | `data-reading=day\|sepia\|mint\|night` paper; `data-theme` chrome |
| Layout | Tokens for rails/paper; **&lt;1366** full-bleed paper + circle seal; **≥1366** desk page + ribbon; rails scale 1024→1920 |
| Agent | Continuity + sheet assist + co-write Apply cards |
| LLM | Server-only OpenAI-compatible `LLM_*`; fixture when unset / `STORYLINT_FIXTURE_LLM=1` |
| Sheet kinds | `character` \| `lore` \| `world` \| `organization` |
| Confidence | `0.7` |
| Focus | Hides binder + agent |
| No magic numbers | Widths/colors only via tokens |

---

## Shipped slices (reference — do not re-implement)

### 0 — DS runtime ✓
tokens.css, ui primitives, no hex outside tokens.

### A — Shell ✓
Top bar, binder, manuscript, agent; collapse; Focus; drawers; region visibility tests.

### B — Domain + persist ✓
Project/chapter/sheet/fact/proposal domain; server; atomic JSON; unit + API tests.

### C — Continuity ✓
Extract fixture/live; marks; proposals Accept/Edit/Reject; privacy copy.

### D — Agent P1 ✓
Transcript, chips, Continuity card, sheet packs, newbie tips, dogfood README.

### E — Apply (P1b) ✓ / verify
Continue / rewrite / brainstorm → Apply card → insert/replace only on Apply; domain `apply` + tests.

---

## Slice F — complete (portraits + craft tags + remaining polish)

**Already in tree (don’t redo blindly):** hidden scrollbars; manuscript page/paper; word/char count; no MS focus ring; reading profiles; light ink primary; binder empty rows (not pills); equal/scaling binder·agent; snap paper; responsive measure.

**Still In for F**

- [x] Sheet **portrait/icon** (local/URL/emoji placeholder)  
- [x] Lore field **hint chips** (optional, freeform facts underneath)  
- [x] Optional **manual craft tags** on chapter  
- [x] TOKENS/docs match runtime (seal&lt;1366 / ribbon≥1366, A4 **ratio** not mm, ink primary not muddy brown)  
- [x] E2E: reading profile/ribbon and paper under 1366 (`e2e/output/slice-f-*.png`)  

**Out:** P2 review fleet, research panel, graph.

**Verify:** `npm test` · `npm run build` · E2E.md screenshot · portraits don’t break Accept boundary.

---

## Later

| Slice | Content |
|-------|---------|
| G ✓ | P2 review agents + craft tag suggest + chapter craft check |
| H ✓ | P3 research panel (clean, cited) |
| I | P4 relationship graph/canvas |
| J | MD export, multi-project |
| K | Desktop/mobile shell adapters |

---

## Coder stop conditions

- Auth, default Tailwind palette, TipTap-without-need, SQL, collab, jump to G/H/I early  
- Missing token → edit **TOKENS.md + tokens.css** first  
- PRD conflict → stop  
