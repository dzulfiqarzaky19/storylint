<!--
  SUPERSEDED IN PART: kind renames REJECTED — see design-review-l2.md + design/CANON-VOCABULARY.md. Binder polish ACCEPTs still stand.
  Tracked decision record (moved from e2e/output/design-review-task-l.md).
  Author: ox
  Kind: design-review
  Decided: Task L binder polish + Canon labels review (later partly reverted in L2)
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# Design review — Task L (binder polish + Canon kind labels)

**Reviewer:** ox (read-only)  
**Merge:** `e64da20` (`1e422bd` feat)  
**Shots:** `e2e/output/binder-canon-labels/`  
**Probe report:** `report.json` (`ok`, `d9: true`, `currentChapter: true`)

---

## Verdicts

| Item | Verdict |
|------|---------|
| Sheet-kind renames (People / Places & things / Groups) | **REJECT — revert labels** |
| Binder polish: section counts | **ACCEPT** |
| Binder polish: empty states | **ACCEPT** |
| Current-chapter marker + scroll-into-view | **ACCEPT** |
| Long list readiness (structure) | **ACCEPT** (80-chapter scale not re-simulated here; scroll-into-view + list wrapper are correct) |
| D9 park/restore still holds | **ACCEPT** (probe + code path intact) |
| In-binder note “Still open: sheet detail parks…” | **REJECT — remove** |

**Product decision:** keep Task L’s **Canon/binder structure and polish**. **Revert** `SHEET_KIND_LABEL` to author-facing **Characters / Lore / World / Organizations** (or prior shipping labels). Internal enums stay `character|lore|world|organization`.

---

## 1. Vocabulary judgment (the product word decision)

New binder labels:

| Enum | New UI | Verdict |
|------|--------|---------|
| `character` | **People** | **Reject** |
| `lore` | **Lore** | **Accept** (unchanged) |
| `world` | **Places & things** | **Reject** |
| `organization` | **Groups** | **Reject** (weaker than World/Characters fails, but still not right) |

### 1.1 Author words vs app words

Storylint’s voice for Canon should sound like a novelist’s bible tabs, not a CRM.

- **People** — generic app/HR word. Authors say **characters**, cast, principals. “People” flattens dragons, AIs, POV animals, and named forces into census language. It also collides with plain English “people in the scene” vs “character sheets.”
- **Places & things** — reads as a **UI compound bucket**, not a craft term. Authors say **world**, setting, places, artifacts — usually as separate mental piles. The ampersand is a tell: the label is doing taxonomy apology.
- **Groups** — softer fail. Better than a pure enterprise “Orgs,” but craft language is closer to **organizations**, **factions**, **houses**, **orders**. “Groups” is workshop-generic.
- **Lore** — fine; already author-native.

**Characters / Lore / World / Organizations** (previous plain set) is more author-native than this pass. If we ever rename organizations, prefer **Factions** only after a deliberate craft pass — not as part of a binder polish PR.

### 1.2 “Places & things” = modeling smell, not only naming

Yes. A compound label usually means **one kind is doing two jobs**:

1. **Setting / place** (cities, regions, rooms)  
2. **Object / artifact / prop** (swords, relics, documents-as-things)

If both live under `world` today, **Places & things** papers over that. Options (design, not this PR):

- Keep enum `world` with label **World** (honest umbrella), or  
- Split kinds later (e.g. place vs thing) when the product needs distinct sheets/facts/graph behavior.

Do **not** “fix” a modeling lump with a longer binder title.

### 1.3 IA_MAP / license

IA_MAP locked **Draft / Lab / Canon** and Promote split. It did **not** license sheet-kind vocabulary changes. Kind renames are a **product word decision** and needed design authority **before** merge. Treat this as out-of-scope creep inside an otherwise good binder PR.

### 1.4 Consistency break (extra reject reason)

Even if the words were good, the sweep is incomplete and teaches two dialects:

| Surface | Still says |
|---------|------------|
| Binder kind headers | People / Places & things / Groups |
| Sheet editor Kind field | **Character** (shot) |
| Canon map filters | **character · lore · world · organization** |
| Lab / tips / graph node kind text | character-oriented |

So the rename does not deliver a coherent author language; it splits Binder from Canon map and sheet form. **Revert** until a full vocabulary pass (binder + sheet editor + graph filters + empty copy) is designed on purpose.

Phone CSS uppercases sublabels → **PLACES & THINGS** is especially app-y and wide (shot `binder-390.png`).

---

## 2. Rest of Task L (non-vocab)

### 2.1 Section counts — **ACCEPT**

Draft / Canon / Lab heads show counts; per-kind counts on Canon. Quiet, useful, matches calm-budget “chunk the list” intent. Desktop + phone shots confirm.

### 2.2 Empty states — **ACCEPT**

- Draft: “No chapters yet…”  
- Canon total empty: “World truth lives here…”  
- Per-kind: “None yet”  
- Lab: boards empty copy  

Tone is fine. Canon empty correctly points at sheet / Lab promote.

### 2.3 Current chapter marker + scroll-into-view — **ACCEPT**

Code: `binder__chapter--current`, `data-binder-chapter="current"`, `scrollIntoView` when Draft active. Probe `currentChapter: true`. Correct Draft job; doesn’t fight Canon-first ordering when `canonMode`.

### 2.4 Long lists — **ACCEPT** (qualified)

`binder__chapter-list` + scroll-on-active is the right structure for 80 chapters. Full 80-chapter visual soak not in provided shots; no design fault in the mechanism. If scroll container max-height is missing in CSS under some shell heights, that’s a follow-up eng check — not a vocab issue.

### 2.5 D9 park/restore — **ACCEPT**

`wasCanonRef` / `parkedSheetId` path unchanged in spirit; probe `d9: true`. Do not regress.

### 2.6 “Still open: sheet detail parks…” — **REJECT copy**

This is **implementer/meta chrome** in the product surface (“parks when you leave Canon”). Users don’t need a release-note about D9 in the binder. Remove the note entirely. Behavior can stay silent.

---

## 3. What to ship vs revert

| Keep | Revert |
|------|--------|
| Counts, empty states, current chapter + scroll | `SHEET_KIND_LABEL` People / Places & things / Groups |
| D9 behavior | Binder note “Still open…” |
| Canon/bible wording fixes elsewhere in the sweep if they only say Canon not bible | Any half-applied kind string only in binder |

**Recommended labels post-revert:**

```ts
character: 'Characters',
lore: 'Lore',
world: 'World',
organization: 'Organizations',
```

---

## 4. Ranked residual faults from this review

| Rank | Fault | Action |
|------|--------|--------|
| P0 | Kind renames without design license + split dialect | **Revert labels** |
| P1 | “Still open…” meta note | **Delete** |
| P2 | Sheet editor / graph filters still old kind words after rename | Moot if reverted; required if ever re-attempted |
| P3 | Canon map still control-panel (D4) visible in same 1440 shot | Separate track (deer) |

---

## 5. Process note

Implementers must not land **user-facing vocabulary** on ecosystem or kind labels without design accept. Structure polish (counts, scroll, empty) is in-scope for binder PRs; **naming is not “plain language cleanup” by default.**
