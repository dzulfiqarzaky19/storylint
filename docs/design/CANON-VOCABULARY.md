# CANON-VOCABULARY

**Status:** design authority (docs-only)  
**Date:** 2026-07-31  
**Owner:** design sign-off required to change any **user-facing noun** in this file  
**Depends on:** [IA_MAP.md](../IA_MAP.md) §1 · §11 · [CALM_BUDGET.md](../CALM_BUDGET.md) (density only) · [03-ux.md](../03-ux.md)

This doc stops agents from inventing product words.  
IA owns structure. CALM_BUDGET owns density. **This file owns the lexicon.**

---

## 1. Authorship rule

Storylint speaks like a **novelist’s desk**, not like a CRM, CMS, or generic productivity app.

| Prefer | Avoid |
|--------|--------|
| Author craft words (chapter, character, canon, lore) | App/data words (people, records, entities, items) |
| One word per concept across surfaces | Half-renames that teach two languages |
| Honest umbrella when the model is one kind | Compound titles that paper over two jobs (“X & Y”) |

**Test:** would a serial fantasy author say this out loud about their book? If not, reject.

### Accept / reject (from shipped decisions)

| Candidate | Verdict | Why |
|-----------|---------|-----|
| **Canon** (over bible / Graph-as-place) | **Accept** | Author destination for settled truth; bible is internal/export metaphor |
| **Draft** (over Manuscript as place) | **Accept** | Place to write; manuscript is the artifact |
| **People** (for `character`) | **Reject** | Census/CRM word; flattens non-human cast |
| **Places & things** (for `world`) | **Reject** | Compound bucket = model lump smell, not a craft term |
| **Groups** (for `organization`) | **Reject** | Workshop-generic; keep Organizations (or later **Factions** only as a full pass) |
| **Lab** | **Accept** | Messy think bench; already author-clear |

---

## 2. Shipped lexicon

Internal enums / code names may differ. **UI strings must match the User word column.**

### 2.1 Places (ecosystems)

| User word | Means | Surfaces | Code may still say |
|-----------|--------|----------|--------------------|
| **Draft** | Clean write surface; chapters live here | Top place switch, binder group, empty doors | `manuscript`, Write (face ≠ place) |
| **Lab** | Pre-canon bench; try / brainstorm | Top place switch, binder boards, Lab bench | `lab` |
| **Canon** | Settled world truth | Top place switch, binder group, sheet home | sheets, bible, graph mode |

Companion, Research, Continuity, Review, Export are **not** places. See IA_MAP §1.

### 2.2 Things inside places

| User word | Means | Surfaces |
|-----------|--------|----------|
| **Chapter** | Ordered Draft unit | Binder Draft list, paper title, Continuity scope |
| **Sheet** | One Canon entity record | Binder under kind, sheet editor, map node → sheet |
| **Fact** | Accepted claim on a sheet | Sheet facts, Continuity source, map edges from facts |
| **Board / card** | Lab containers / atoms | Lab binder + bench |
| **Map** (Canon map) | View of accepted relationships | Canon center (`RelationshipGraph`) — not a fourth ecosystem |
| **Proposal** | Pending change awaiting a gate | Inbox, cards, map “Send proposal” |
| **Mark** | Continuity highlight on Draft prose | Manuscript marks after Continuity |

### 2.3 Sheet kinds (locked labels)

| Enum | User word (binder + any kind chrome) | Sheet editor Kind field |
|------|--------------------------------------|-------------------------|
| `character` | **Characters** (section) | **Character** (singular value OK) |
| `lore` | **Lore** | **Lore** |
| `world` | **World** | **World** |
| `organization` | **Organizations** (section) | **Organization** (singular value OK) |

Source of truth for binder section titles: `SHEET_KIND_LABEL` in `src/components/shell/workspace.ts`.  
Do not invent parallel maps.

### 2.4 Gates and jobs

| User word | Means | Where |
|-----------|--------|-------|
| **Promote to Canon** | Lab → pending sheet path (still needs Accept) | Lab card exit |
| **Send to Draft** | Lab → chapter/stub path | Lab card exit |
| **Accept / Edit / Reject** | Canon gate on proposals | Inbox + proposal cards |
| **Apply / Dismiss** | Manuscript gate on co-write cards | Inbox + Apply cards |
| **Continuity** | Contradiction scan vs accepted truth | Companion **Check** only (not top bar) |
| **Run Continuity** | Explicit start of that job | Check footer primary |
| **Research** | Cited gather tool | Companion face (overflow under **More** on writing) |
| **Inbox** | Pending proposals + Apply cards | Companion face (badge count OK) |
| **Check** | Draft job face for Continuity / Review / Craft | Companion primary face |
| **Write** | Co-write face (not the Draft place) | Companion primary face |
| **Chat** | Default companion transcript | Companion primary; writing default |

---

## 3. Known dialect splits (fix or flag)

Same concept, different words today. Prefer the **Target** column in product UI.

| Concept | Target user word | Still says (bug/partial) | Where |
|---------|------------------|--------------------------|--------|
| Settled truth place | **Canon** | bible, Bible | Graph header/empty (“bible facts”, “bible sheet”), companion `@bible` badge, agent copy, export paths `bible/…` (export path may stay) |
| Canon relationship view | **Map** / under Canon | Graph, Relationships title, “Graph view” aria | `RelationshipGraph`, Inspect empty “node in Graph” |
| Sheet kinds in filters | **Characters** etc. (or shared label helper) | raw enum `character` `lore` `world` `organization` | Map filter chips + node kind text |
| Draft place | **Draft** | manuscript (code/aria OK if hidden) | Prefer no user-visible Manuscript |
| Context chips | `@chapter` / `@canon` / `@lab` | `@bible` on writing + Fill | `AgentPanel` badges |
| Continuity home | Check only | — | Top bar Continuity must stay **gone** (IA + CALM B2) |

**Rule when fixing:** change **all** user-visible peers in one pass, or don’t start. A half-done rename is worse than the old word.

Singular Kind dropdown (**Character**) vs plural binder section (**Characters**) is **not** a dialect bug.

---

## 4. License to rename

| Change type | Who decides | May ride inside polish/density PR? |
|-------------|-------------|-------------------------------------|
| User-facing noun (place, kind, gate, face label) | **Design sign-off** (ox / design role) | **No** |
| Internal enum / code identifier | Eng, if UI labels unchanged | Yes |
| Copy tone on an existing locked word | Eng within lexicon | Yes |
| New product word | Design + update **this file** in the same change | No |

### Failure mode (hard lesson)

An implementer renamed binder kinds to People / Places & things / Groups while sheet Kind and map filters stayed Character / `character`.  
**Two languages taught at once.** Reverted in `f98510d` / `83a48e9`.

**Never:** “plain-language cleanup” of kinds inside binder polish.  
**Always:** design accept → full surface sweep → then merge.

IA_MAP §11 is the structural naming backlog (Draft/Lab/Canon/Promote). **Kind labels and craft nouns live here**, not only in §11.

---

## 5. Open modeling question (not a rename)

### Does `world` mean setting, artifact, or both?

Today one kind **`world`** holds places **and** things.  
“Places & things” as a **label** was rejected because it papers over that lump.

| Option | Tradeoff |
|--------|----------|
| Keep **World** umbrella | Honest one kind; authors sort mentally; simpler map/filters |
| Split later (e.g. place vs thing) | Clearer craft piles; more kinds, filters, empty states, migration |

**Do not split because a label felt awkward.**  
Split only if **product behavior** needs different sheets, facts, graph rules, or Continuity treatment. Until then UI word stays **World**.

---

## 6. Enforcement checklist (PR / review)

Before merge, if the diff touches user-visible strings:

1. Word appears in §2 lexicon (or this file is updated in the **same** PR with design accept).  
2. No second synonym introduced for the same concept on another surface.  
3. Kind strings go through `SHEET_KIND_LABEL` (or one shared helper) — not a one-off binder map.  
4. Density PRs cite [CALM_BUDGET.md](../CALM_BUDGET.md); they do **not** invent nouns.  
5. Map/Graph user copy trends to **Canon map** language when touched (no new “bible/Graph place” strings).

---

## 7. One-line bar

**Author words, one dialect, design-owned nouns; never rename kinds in a polish PR; World stays World until the model splits.**
