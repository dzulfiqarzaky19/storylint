<!--
  Tracked decision record (moved from e2e/output/design-review-l2.md).
  Author: ox
  Kind: design-review
  Decided: ACCEPT L2 kind-label revert → Characters/Lore/World/Organizations
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# Design review — L2 binder kind label revert

**Reviewer:** ox (read-only)  
**Merge:** `83a48e9` · topic `f98510d`  
**Shots:** `e2e/output/canon-kind-labels-revert/`  
**Probe:** `report.json` — `ok`, labels Characters/Lore/World/Organizations, `stillOpenGone: true`, `d9: true`

---

## Verdict: **ACCEPT**

| Item | Verdict |
|------|---------|
| Characters / Lore / World / Organizations restored | **ACCEPT** |
| People / Places & things / Groups gone | **ACCEPT** |
| “Still open: sheet detail parks…” removed | **ACCEPT** |
| Binder polish (counts, empty, current chapter) kept | **ACCEPT** (from L) |
| Dialect split binder ↔ sheet Kind closed | **ACCEPT** |
| Map filter chips title-case kinds | **Residual P3** (pre-existing; not introduced by L2) |

---

## Evidence

- `SHEET_KIND_LABEL`: character→Characters, lore→Lore, world→World, organization→Organizations  
- Binder 390 shot: CHARACTERS / LORE / WORLD / ORGANIZATIONS  
- Desktop sheet editor Kind: **Character** (singular field value — correct)  
- Park note node removed from Binder + CSS  

Closes the Task L reject. Implementer did the minimum correct fix.

---

## Residual dialect (not L2 fail)

Map filters still render raw enum strings: `character · lore · world · organization` (see binder-1440 Canon map chrome).  
Target: shared labels (Characters… or short title case) via one helper — track under `docs/design/CANON-VOCABULARY.md` §3, not a reopen of L2.
