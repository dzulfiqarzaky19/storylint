# Personas & customer insight

**Purpose:** shared beachhead so **UX** (and coders) judge “easier for *whom*.”  
**Not** a runtime module, feature flags, analytics segmenter, or fifth agent role.  
**Not** code constants — keep this markdown. Revisit when dogfood or real users contradict it.

Source spine: [01-identity-market.md](./01-identity-market.md), [PRD.md](./PRD.md), [03-ux.md](./03-ux.md).

---

## Beachhead (v1)

| Id | Who | Primary jobs in product | Friction we refuse |
|----|-----|-------------------------|---------------------|
| `serial_worldbuilder` | Long-form / web-novel author, multi-POV, heavy continuity | Draft cleanly; Continuity → Accept; grow sheets without a second wiki; Focus stretch | Gen cockpit in the page; silent canon writes; note-app sprawl |
| `ide_agent_native` | Already uses Cursor / Claude Code / Copilot sidebar | Agent panel as pair; Apply/Accept like diff; project context always on | Shy hidden AI; chat that doesn’t know *this* book; mystery modes |
| `dogfood_zaky` | First real user — local, no auth, BYOK | Same as above + research/graph when useful; honest Saved/export | Auth walls; cloud lock-in; AI-blue chrome |

Out of beachhead (don’t optimize UX for them yet): pure format/EPUB factories, zero-AI authors, teams/SSO, unattended whole-book autopilot.

---

## Primary journeys

Full detail: [03-ux.md](./03-ux.md) § User journeys (locked).

| Id | Path | Who |
|----|------|-----|
| J1 | Open → **Draft** → write → Saved | serial_worldbuilder, ide_agent_native, return visits |
| J2 | Open → **Lab** → Send to Draft / Promote to Canon | dogfood_zaky finding the story; empty projects |
| J3 | Draft → Continuity → Accept/Edit/Reject (Canon if needed) | serial_worldbuilder continuity pass |

## Jobs UX must be able to finish (without a manual)

1. Open project → write chapter → **Saved** trust  
2. Run Continuity → read marks → Accept/Edit/Reject proposals  
3. Ask agent / co-write → **Apply** only on purpose  
4. Focus → write → leave Focus with rails back  
5. Switch or create project without losing the wrong draft  
6. (If shipped) Research cite → pin/propose; Graph read relationships; Export takeaway  

If a job needs tribal knowledge, that’s a **UX blocker**, not a nit.

---

## Insight rules (for agents)

- Prefer **one** primary action per surface; secondary tools collapse or group.  
- Manuscript stays sacred; power lives in agent/binder.  
- Errors and fixture/live mode must be **readable** when they change outcomes.  
- Density OK if scannable; button piles are not “power user,” they’re unfinished IA.  
- When personas conflict, **serial_worldbuilder draft flow** wins over novelty chrome.
