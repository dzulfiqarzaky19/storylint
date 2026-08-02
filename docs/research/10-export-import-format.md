# #10 Export/import format for local wiki safety

**Wayfinder map:** #6  
**Ticket:** #10  
**Date:** 2026-08-02  
**Status:** resolved (grilling)

## Question

What file format and scope should export/import use so a deep MC + magic wiki is not one clear away from death?

## Locked product context

- Local only; export/import for safety (not publish polish)
- Thin multi-book; one-novel dogfood
- dev2 starts empty; character + lore first cut
- No migrate-from-dev junk

## Decision summary

| Topic | Choice |
| --- | --- |
| Promise | **Lossless app restore** (not human-readable bible) |
| File | **Single JSON** per export |
| Scope | **Active book only** |
| Import collision | **Chooser: Replace current \| Import as new** (default bias: new) |
| Payload | **Full persisted book**: title, schemaVersion, cards/sheets + facts, proposals (all statuses), rejectedFingerprints, researchNotes |
| Ids | **Preserve internal ids**; import-as-new assigns a new library book id; replace keeps the active book id |
| Schema | **Migrate older → current; reject newer than running app** |
| Filename | `{slug(title)}-storylint.json` |
| Envelope | Wrapped: `format`, `schemaVersion`, `exportedAt`, `book` |
| Out-of-surface data | **Strip** chapters/lab/world-org/unknown after migrate; **warn** what was dropped |
| Habit | **Manual** export/import only (no auto-snapshots first cut) |
| Markdown/zip bible | **Drop** for first cut — JSON is the only Export |

## Envelope shape

```json
{
  "format": "storylint-book",
  "schemaVersion": 1,
  "exportedAt": "2026-08-02T04:30:00.000Z",
  "book": {
    "title": "…",
    "sheets": [],
    "proposals": [],
    "rejectedFingerprints": [],
    "researchNotes": []
  }
}
```

- `format` must be exactly `storylint-book` or import rejects.
- Live store files (`projects/<id>.json`) need not persist `format` / `exportedAt`; those are backup-file fields.
- `book` is the full persisted project document after first-cut trims (no chapters/lab required in dev2 domain).

## Round-trip requirements

1. Export active book → download envelope JSON named `{slug(title)}-storylint.json`.
2. Import file → validate envelope → migrate `schemaVersion` if older → strip disallowed kinds/fields with warning list → apply:
   - **Import as new:** create library entry with new book id; preserve all internal card/fact/proposal ids from file.
   - **Replace current:** confirm; keep active book id; replace content with imported `book` (internal ids preserved from file).
3. Reject files with unknown/newer `schemaVersion` than the running app (message: update app / re-export from compatible build).
4. Reject files missing `format: "storylint-book"` or failing project validation after migrate+strip.
5. No merge across books. No all-books bundle in first cut.

## API / UI hooks (for #15 spec)

| Surface | Behavior |
| --- | --- |
| Export control | Downloads active-book envelope (replaces markdown zip export) |
| Import control | File picker → chooser Replace \| New → apply |
| `GET` export (or equivalent blob route) | Build envelope from active store project |
| `POST /api/import` | Body = envelope (+ mode `replace` \| `new`); response includes applied book + strip warnings |

## Explicit non-goals (this ticket)

- All-books single-file backup
- Merge import
- Human markdown / zip bible export
- Automatic snapshot rotation
- Folder-on-disk / git working-copy UX
- Publishing or sell-packaging polish

## Rationale (short)

Death mode is losing a deep living wiki. That needs stable ids, proposal queue, and reject memory — the store document — not a pretty folder re-keyed by hand. One JSON per active book matches existing `ProjectStore` files and keeps multi-book scope for #14. Envelope separates backup metadata from live store shape. Strip+warn beats rejecting a whole backup over one out-of-surface card.

## Downstream

- #14 (multi-book): export remains **active book only**; switcher does not change this ticket.
- #15: cite this file for export/import acceptance criteria; do not re-open format.
- #12 inventory: import is new; markdown export reshape becomes **replace with JSON envelope**.
