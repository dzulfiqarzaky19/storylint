# B3-inbox-wall measures Inbox at volume

**Status:** landed (check). Product Inbox fold/scrollport still open (ox AV).

## Problem

`B3-inbox-wall` was named for Inbox but asserted `chatProposalsWall = false` on the **Chat** face. It passed while Inbox at 30 pending was a wall (TASK AV). Bear rule 5 costume: predicate did not cover the property in the check's name.

## Ruling (rat AV)

1. Fix the **check** first. Do not redesign Inbox product inside the density pass.
2. Seed **30 pending proposals** (PUT `/api/project`; fixture Continuity cannot produce volume).
3. Measure the **Inbox** face. Fail when it is a wall.
4. Keep Chat-clean as a **separate** check (`B3-chat-proposals-wall`).

## Check shape

- `B3-chat-proposals-wall@{1440,390}` HARD — Chat has no proposal dump (previous letter).
- `B3-inbox-wall@volume` HARD — private project, 30 pending, Inbox face:
  - wall if `cardVisible >= 12` **or** (`cardVisible >= 8` and panel does not internally scroll).
  - pass when `inboxWall=false` (internal scrollport + calm fold).

Current product is expected **HARD-red** until ox P0/P1 (internal scrollport; ~3–5 cards in fold) lands.

## Product (ox — not this commit)

See `docs/decisions/draft-under-load-av.md`: P0 scrollport, P1 quiet count + fold, no bulk Accept, no Chat wall.
