# Research turn → Propose-on-card (wayfinder #8)

**Status:** decided (grilling)  
**Ticket:** https://github.com/dzulfiqarzaky19/storylint/issues/8  
**Map:** https://github.com/dzulfiqarzaky19/storylint/issues/6  
**Date:** 2026-08-02

## Locked product context

- Hybrid research rail: chat for thinking + explicit Research turns.
- Results stay in rail until Propose.
- Sources required for real-world facts; optional for invented canon.
- Web when configured (`SEARCH_*` / #11); else unchecked model.
- Reuse existing LLM wire; author Accept/Reject only path to canon.
- UI word **Card** (code may still say sheet). First cut: character + lore only.

## Research-turn payload

```ts
type ResearchTurn = {
  mode: 'fixture' | 'live' | 'live_web'
  query: string
  results: ResearchResult[]
}

type ResearchResult = {
  id: string
  blurb: string
  grounding: 'sourced' | 'invented'
  sources: { title: string; url: string }[]  // required if sourced; may be [] if invented
  target: {
    kind: 'character' | 'lore'
    entityName: string
    // optional targetCardId when bound to open card
  }
  summary?: string
  fields: {
    key: string
    value: string
    statement: string
    claimKind: 'attribute' | 'relationship' | 'event' | 'existence'
  }[]
}
```

- Multi-target: one turn may return several `results[]`.
- Each result stays rail-only until an explicit Propose.

## Source rules

| grounding | sources |
| --- | --- |
| `sourced` | `length >= 1`; when web ran, URLs ⊆ provider set |
| `invented` | optional (empty allowed) |

## Propose → pending on card

1. **Resolve card:** open center card wins only if same `kind` + `entityName` (or result inherits open). Else match existing by kind+name. Else **create a draft Card**, add to wiki list, focus center.
2. **Stage pending (not canon):** optional summary patch + one proposal per `fields[]` entry, shared `packId`, `targetCardId` set, status `pending`. Reuse proposal accept/reject bones. No first-class section templates — summary + facts only.
3. **Author gate:** Accept commits; Reject drops pending (empty draft may be removed). No silent auto-canon.

## Grill decisions

| # | Choice |
|---|--------|
| Q1 unit | Structured draft fields up front (not note blob) |
| Q2 land | Open card if identity matches; else match/create |
| Q3 map | summary? + fact proposals |
| Q4 multiplicity | Multi-target results[]; Propose per result |
| Q5 sources | grounding sourced \| invented |
| Q6 empty project | Propose creates draft Card immediately |
| Q7 mismatch | Do not force onto wrong open card |
| Q8 shape | Confirmed as above |

## Relation to `dev` bones

Today (`src/research/run.ts` `researchProposal`): one lore fact `key: research_note` from title/summary. Too blunt for Propose-on-card. Keep proposal accept/reject + fingerprint pack idea; replace the research result shape and Propose mapping with the payload above on `dev2`.

## Out of scope

- UI layout (#9)
- Fact filter scene-vs-permanent (#7)
- Export (#10)
- Product implementation on `dev2`
