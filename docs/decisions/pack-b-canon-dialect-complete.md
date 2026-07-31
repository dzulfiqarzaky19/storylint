# Pack B complete — bible → Canon dialect (one PR)

**From:** ox  
**To:** deer (implement) · rat (queue) · dolphin (writing badges already done — do not regress)  
**Authority:** Task T + CANON-VOCABULARY §3  
**Rule:** full sweep or none. Half-rename is a revert-class failure (People/Places lesson).

## Done means

`git grep -i bible -- src` shows **zero user-visible UI strings** in render paths, except the allowlist below.

### Must change (user-visible)

| ID | Surface | From | To |
|---|---|---|---|
| T-P1-1 | Chat/Fill badge | `@bible` | `@canon` (dolphin may have landed — verify both writing chips) |
| T-P1-2 | Lab Chat tip | “not bible” | “not Canon” |
| T-P1-3 | Graph lede `title` | “Accepted bible facts…” | Canon / links wording (D4 short lede stays; tooltip must not say bible) |
| T-P1-4 | Graph empty / filtered copy | “bible sheet” | “Canon sheet” / empty-P0 copy (no bible) |
| T-P1-5 | Graph aria-labels | “Bible relationship…” / “Bible family…” | “Canon relationship map” / “Canon family tree” |
| T-P1-6 | Agent user-visible message | “into the bible” | “into Canon” (`run.ts` message path if shown in transcript) |
| T-P2-5 | Graph kind chips + titles | raw enums | `SHEET_KIND_LABEL` (Characters, Lore, World, Organizations) — **C5 in same PR** |
| T-P2-11 | Graph notice | “agent panel” | “Companion Inbox” |
| Live | Lab tip / any remaining UI “bible” | bible | Canon |
| Live | continuity/cowrite/review **error strings** if toast/UI shown | “bible digest/context too large” | “Canon … too large” **only if user-visible** |

### Allowlist (may keep `bible`)

| Path | Why |
|---|---|
| `export/markdown.ts` path `bible/${kind}/…` | Internal export folder; Task T explicit |
| Tests asserting export zip paths | Match export |
| Code identifiers / comments (`bibleDigest`, var names) | Not UI — optional cleanup later, not Pack B gate |
| Domain test titles using word bible as fixture name | Not product chrome |

### C5 in this PR (not a follow-up)

Kind chips, `.graph__kind` text, node titles/aria that dump enums → **one** `SHEET_KIND_LABEL` helper. Binder and graph must agree. No `character` lowercase chip next to binder **Characters**.

### Out of Pack B (do not block)

- Binder empty narration (Pack C)
- Lab filtered-empty lost-work (Pack A — otter/Lab)
- Companion tip context (writing tip on Canon) — separate
- Family sparse layout — separate
- Agent **system** prompts that never render (flag only)

### Acceptance gate (deer self-check before ox eye)

1. `git grep -i bible -- src/components src/features` → only allowlisted non-UI or zero.  
2. `git grep -i bible -- src/agent/run.ts` → no user `message:` with bible.  
3. Graph chips show human labels, not enums.  
4. Empty + populated Canon shots still match empty-P0 + D4 ACCEPT (no chrome regression).  
5. No new synonym (“World bible”, “truth book”, etc.).

### Shots for ox

- Canon populated 1440: chips labeled, lede/tooltip no bible (hover title if changed)
- Lab Chat: tip “not Canon”; badge `@canon` if writing context shown
- Optional: aria via a11y tree dump or note in report

**Incomplete = do not merge.** If blocked on one string, park the PR; do not ship 80%.

— ox | inventory from Task T + `git grep bible` @ review time
