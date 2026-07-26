# Storylint — PRD (MVP spine)

**Status:** Wave 0 product lock  
**First user:** you (local dogfood)  
**Auth:** none — no login, no session, no multi-tenant  

Related: [01-identity-market](./01-identity-market.md) · [02-steal-and-phases](./02-steal-and-phases.md) · [03-ux](./03-ux.md) · [04-agents](./04-agents.md) · [05-tech](./05-tech.md)

---

## 1. Problem

Serial / world-heavy fiction breaks when:

- Chapter N contradicts the bible or chapter 6  
- The author drowns in manual notes instead of drafting  
- AI tools either **write over the page** or **ignore canon**

Writers who already like **VS Code + Claude / Cursor** want that shape for a novel: clean editor, project-aware agent, apply/accept — not a second ChatGPT tab and not a gen cockpit inside the prose.

---

## 2. Product

**Storylint** = a **writing IDE** for serial fiction with a **first-class agent panel**.

| Surface | Role |
|---------|------|
| Manuscript editor | Clean draft (like the VS Code editor) |
| Binder | Chapters + bible sheets (project tree) |
| Agent panel | Claude-extension-like companion: chat, tools, runs |
| Apply / Accept | Agent output enters MS or canon only on explicit user action |
| Continuity marks | Inline yellow/red diagnostics after a continuity run |

**One-liner:**  
Like VS Code + Claude, for your novel — clean page to write; agent that knows your world and helps for real; you accept what lands in the book or bible.

---

## 3. Goals (MVP / P1)

1. Local single-project workspace (chapters + sheets) you can reopen  
2. Clean chapter editor (no gen chips in the type column)  
3. **Agent panel shell** in the IA (chat + tool runs) — not a lint-only toolbar app  
4. Continuity pipeline: extract claims → gates → Y/R marks + sheet **proposals**  
5. Manual sheet create/edit always available  
6. Author can **ask the agent to help create/fill** character and other sheets → proposals → Accept (not silent canon)  
7. Light **newbie recommendations** via agent (optional, non-blocking)  
8. Bible changes only via **Accept / Edit / Reject** (or manual edit)  
9. Provider-neutral OpenAI-compatible router config (`LLM_*`, local or hosted); no account system  
10. Tests for domain continuity so behavior is locked without re-prompting agents  
11. **Portable design system foundation** (tokens + primitives + adaptive shell slots) so UI can later ship on Windows / macOS / Linux / Android / iOS without a redesign rewrite — web is MVP host only  

**Documented post-P1 (not MVP blockers):** sheet portrait/icon; lore-informed field hints; **craft tags** + on-demand chapter craft check (char-dev / plot / twist…); **Research panel** (clean/powerful/cited); relationship **graph/canvas** (Obsidian-like father/org links).

---

## 4. Non-goals (MVP)

- Login, cloud sync accounts, multi-user collab  
- Unattended “write the whole novel”  
- Auto-apply agent text into manuscript or bible  
- EPUB/print factory as identity  
- Forced plot methodology wizard / forced RPG character sheets  
- Full research panel + external book research (P3 — document only; design intent in UX/agents)  
- Deep E2E plot/culture review fleet (P2 — document only; shell may stub entry points)  
- Graph/canvas relationship view (P4 — domain stays relationship-friendly)  
- Always-on craft grading / sticky shame bar while typing (craft check is **on-demand**, P2)  
- Shipping native iOS/Android/desktop **binaries** in P1 (design system must still be portable-ready)

---

## 5. Users

| | |
|--|--|
| Primary | You — serial / world-heavy fiction, local machine |
| Beachhead later | Authors who like IDE+agent workflows; multi-POV / long continuity |
| Not now | Teams, publishers’ design desks, zero-AI purists as primary |

---

## 6. User stories (P1)

1. As an author, I open a local project and write a chapter in a clean editor.  
2. As an author, I create character/world/org sheets by hand.  
3. As an author, I ask the agent to **help create or flesh out a sheet**; I get a proposal pack and Accept/Edit/Reject.  
4. As a newbie, I can ask the agent what to do next and get short recommendations without a forced tutorial.  
5. As an author, I run **Continuity** (agent tool or command); I see yellow/red marks on spans that fight the bible.  
6. As an author, I see proposed sheet facts/stubs and **Accept / Edit / Reject** them — nothing auto-writes canon.  
7. As an author, I chat with the agent panel with project context (@chapter / @bible) even if early tools are limited.  
8. As an author, I hide the agent panel (focus) and get a full-width editor.  

**Later stories (not P1 acceptance):** portrait on character; research panel pins with citations; graph “show Aria’s father and order.”

---

## 7. Acceptance criteria (P1 done)

- [ ] Fresh install: no auth wall; project loads locally  
- [ ] Create chapter, type, reload → content persists  
- [ ] Create sheet + fact manually → persists  
- [ ] Continuity run without `LLM_MODEL` / `LLM_BASE_URL` → deterministic fixture path, no corruption  
- [ ] Continuity run with key → marks and/or proposals from prose  
- [ ] Accept proposal → bible updates; Reject → no bible write  
- [ ] Agent-assisted **sheet create/fill** produces proposals only until Accept  
- [ ] Newbie help is optional (no blocking wizard on first launch)  
- [ ] Agent panel visible in shell, toggle hide/show; focus mode hides chrome  
- [ ] No gen widgets inside manuscript surface  
- [ ] Unit tests cover lint gates + accept boundary  
- [ ] README explains `LLM_*` router setup and that continuity sends prose + bible digest to the configured endpoint  

---

## 8. Success (dogfood)

You use it for a real serial chapter for a week:

- Fewer manual note interruptions  
- At least one real continuity catch you care about  
- Agent panel feels like “Claude on this book,” not a toy chat  

---

## 9. Phased delivery (summary)

| Phase | Outcome |
|-------|---------|
| **P1** | IDE shell + continuity tools + accept-gated bible + tests |
| **P1b** | Co-write in agent panel → **Apply** to manuscript |
| **P2** | Review agents (plot, culture, gaps ∉ sheets) |
| **P3** | Research agent + richer export/bible UX |

Detail: [02-steal-and-phases](./02-steal-and-phases.md), [04-agents](./04-agents.md).

---

## 10. Open questions — **defaults locked for P1** (override only by human edit)

| # | Question | P1 default |
|---|----------|------------|
| 1 | Agent panel default | **Open** at width ≥ `bp.lg`; user can hide |
| 2 | Sheet kinds | **Frozen:** character, lore, world, organization |
| 3 | Confidence threshold | **0.7** |
| 4 | Product name | **Storylint** |
| 5 | First build slice | **Slice 0** design tokens ([BUILD.md](./BUILD.md)) |

Build/verify roles: [AGENTS_ROLES.md](./AGENTS_ROLES.md).
