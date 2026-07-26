# Agents

One **project-aware companion** in the agent panel (IDE extension model).  
Capabilities unlock by phase; all share context and apply rules.

---

## Shared context (like a repo)

Agent can use:

- Current chapter body + title  
- Selection / cursor anchor when provided  
- Full or digested bible (sheets + facts)  
- Chapter list / outlines  
- Prior proposals and marks (as state)  
- (P3) external research sources user attaches or configures  

---

## Apply boundaries (non-negotiable)

| Target | Agent may… | Lands when |
|--------|------------|------------|
| **Panel** | Draft freely, explain, list findings | Immediately (ephemeral UI) |
| **Manuscript** | Propose text, continue, rewrite | User **Apply** (diff/snippet) |
| **Bible / sheets** | Propose new sheets/facts, edits | User **Accept** (or Edit→Accept) |
| **Marks** | Emit continuity diagnostics on Continuity run | On run (recomputed; not “canon”) |

Agent is **main helper**, not unsupervised publisher of canon or final book text.

---

## Capabilities by phase

### P1 — Continuity + sheet assist (+ panel shell)

| Skill | Behavior | Output |
|-------|----------|--------|
| **Continuity extract** | Structured claims from chapter vs bible | Claims |
| **Lint gates** | Deterministic: consistent / yellow / red / propose / drop | Marks + proposals |
| **Sheet assist (from prose)** | Suggest facts/stubs found in chapters | Proposals under sheet + inbox |
| **Sheet create-with-me** | Author asks: “make a deuteragonist”, “draft an order/org”, “fill this char” → structured **sheet proposal pack** (name, kind, summary, starter facts). May use genre/lore *patterns* as **suggestions**, never silent canon | One Accept creates/updates sheet; Edit-before-accept required for bulk |
| **Newbie coach (light)** | On request or empty-project: short recommendations (what a sheet is, when to run Continuity, don’t over-note). Not a blocking tutorial wizard | Panel messages only |
| **Chat** | Answer about current project context | Panel messages only |

**Product goal:** fewer manual notes — agent pulls canon from prose **and** helps author **invent/structure** sheets on demand, always Accept-gated.

**Create-with-me rules**

1. Author can always create sheets manually (no agent required).  
2. Agent may interview lightly (“POV? faction? one wound?”) then emit a **proposal pack**.  
3. Lore/legend/archetype knowledge = **inspiration labels** on suggested fields (e.g. “common in epic rivalry arcs”) — not forced templates.  
4. No auto-fill of manuscript. No auto-canon.

### P1b — Co-write

| Skill | Behavior | Output |
|-------|----------|--------|
| Continue | Draft next beats/paragraphs | Apply card → MS |
| Rewrite | Alt wording for selection | Apply card → MS |
| Brainstorm | Beats, names, twists (non-canon until accepted) | Panel; optional proposal |

### P2 — Review (E2E) + richer sheets + craft check

| Skill | Behavior | Output |
|-------|----------|--------|
| Plot review | Sense, causality, forgotten threads | Findings report |
| Culture / world logic | Consistency with sheets + implied culture | Findings |
| Gap finder | Important facts in prose **not** on sheets | Proposals + findings |
| Cross-chapter (stretch) | Contradictions across MS | Marks or findings |
| **Sheet depth coach** | “What’s thin on this character vs your lore?” | Checklist + optional proposals |
| **Craft tag suggest** | Propose chapter tags (`char-dev`, `plot-progress`, `twist`, …) from prose | Tag proposals → user Accept |
| **Chapter craft check** | On demand (“before I end this chapter” / end-of-chapter Review): e.g. little character pressure, no plot move, twist tagged but missing, all-breather streak | Findings in **agent panel** — not blocking modal, not red continuity marks unless also a canon conflict |

**Craft check rules**

1. **On demand** (button / agent command) — not every keystroke, not forced on save in P2 default.  
2. Tone = coach (“consider…”), not exam failure.  
3. Uses tags + prose + prior chapters lightly; never auto-rewrites the chapter.  
4. May offer co-write Apply suggestions only if user asks to fix.  
5. Continuity red/yellow stays **canon-only**; craft issues use neutral finding cards / optional non-mark icons.

Runs are **on demand** (like starting a Claude task), not keystroke spam.

### P3 — Research panel + graph seeds

| Skill / surface | Behavior | Output |
|-----------------|----------|--------|
| **Research panel** | Clean, powerful, dedicated mode (or full-height tool in agent column): query, sources, pins — **not** chat clutter. Author pulls legend/lore/comparable works into **cited** notes | Research notes; optional sheet/MS proposals still Accept/Apply |
| Research agent | Other books/topics user points at; legend motifs; world analogues | Cited notes + proposals |
| Inspire-not-paste | Patterns/tropes with attribution | Panel; never silent MS dump |
| **Relationship seeds** | From sheets/facts (“father of”, “member of org”) emit edges for later graph | Edge proposals (Accept) |

### P4 — Canvas / graph view (roadmap)

| Surface | Behavior |
|---------|----------|
| **Graph / canvas** | Obsidian-like: nodes = sheets (char/org/place…); edges = relationships (father, rival, serves, founded…). Click node → sheet. Layout freeform or auto |
| Filters | By kind, by book/arc, by “appears in chapter” |
| Edit | Creating an edge may propose a fact on both sheets (Accept) |

**Not P1.** Domain should still allow `relationship`-shaped facts early so graph is not a rewrite later.

---

## Continuity loop (P1 core tool)

```
chapter (+ bible digest)
  → extract claims (LLM)
  → domain gates (pure, tested):
       known+consistent → silence
       known+hard conflict → RED mark
       known+soft drift → YELLOW mark
       unknown+high conf → proposal
       unknown+low conf → drop
  → user Accept/Edit/Reject proposals
  → ledger fingerprints reduce re-nag
```

Same accept DNA as retrospect/memory-style systems: **record cheap, apply only with human**.

---

## UX inside the panel

- Transcript with tool-run cards (“Continuity finished: 3 red, 2 proposals”)  
- Proposal cards with Accept / Edit / Reject  
- Apply cards with Insert at cursor / Replace selection / Dismiss  
- Optional sheet-local “Suggested” strip still allowed — must call same Accept APIs  

---

## What agents must not do

1. Type into the manuscript without Apply  
2. Write sheets/facts without Accept  
3. Spam modals per claim  
4. Claim “canon updated” when only a proposal exists  
5. Send API keys to the client bundle or logs  

---

## Implementation note (for later tech)

Prefer **tools/skills** behind one agent runner over separate micro-apps.  
Domain gates stay pure and unit-tested; LLM only on extract/review/co-write paths.
