# Ticket template

Copy to `T-###.md`. Keep the next free id (check [BACKLOG.md](./BACKLOG.md)).

```markdown
---
id: T-000
title: short imperative summary
priority: P1
status: open
story: story-or-feature-slug-or-none
owner: unassigned
branch: —
origin_dev_at_open: <sha>
acceptance: observable user/system outcome
shortest_repro: path + check id, or steps
l1_proof: command or —
l2_required: yes
blocks: []
blocked_by: []
files: []
decision: —
notes: |
  optional free text
---

## Context

Why this exists. Link audits/rulings.

## Acceptance detail

- [ ] …

## Repro

1. …
```

## Fields

| Field | Values / notes |
|-------|----------------|
| `id` | `T-###` unique |
| `title` | One line |
| `priority` | `P0` \| `P1` \| `P2` \| `P3` |
| `status` | `open` \| `assigned` \| `in_progress` \| `in_review` \| `landing` \| `blocked` \| `integrated` \| `done` \| `wontfix` |
| `story` | slug or `none` |
| `owner` | agent name or `unassigned` |
| `branch` | `storylint/<topic>` or `—` |
| `origin_dev_at_open` | sha when filed |
| `acceptance` | observable |
| `shortest_repro` | path + check, or steps |
| `l1_proof` | command or `—` |
| `l2_required` | `yes` \| `no` |
| `blocks` / `blocked_by` | list of ticket ids |
| `files` | optional paths this ticket touches (conflict detect) |
| `decision` | `docs/decisions/…` link or `—` |
| `notes` | free text; put **override: founder/rat** here if starting lower work under open P0 |
