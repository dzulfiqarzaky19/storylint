# Tickets (in-repo)

No external Jira. Markdown tickets agents can read, file, and priority-check.

| File | Role |
|------|------|
| [TEMPLATE.md](./TEMPLATE.md) | Field list + example frontmatter |
| [BACKLOG.md](./BACKLOG.md) | Living index sorted by priority |
| `T-###.md` | One ticket per file (YAML frontmatter + body) |
| `npm run tickets:check` | Parse, validate, recommend next |

Pipeline context: [AGENT_PIPELINE.md](../AGENT_PIPELINE.md).

## Priority model

| P | Name | Meaning | Land/start rule |
|---|------|---------|-----------------|
| **P0** | Blocker | Lose-work, broken core path, land/scripts broken, origin honesty | Drop other work; fix now |
| **P1** | Story-critical | Blocks current story/feature close or L2 gate | Next after any P0 |
| **P2** | Scheduled | Important, not blocking story close | After P1 clear for that story |
| **P3** | Backlog | Nice/polish/debt | Only when P0–P2 empty or explicit pull |

## Status lifecycle

```
open → assigned → in_progress → in_review → integrated → done
                 ↘ blocked
                 ↘ wontfix
```

| Status | Meaning |
|--------|---------|
| `open` | Triaged, not started |
| `assigned` | Owner named, not coding yet |
| `in_progress` | Active implement work |
| `in_review` / landing | L1 done or land in flight |
| `blocked` | Waiting on ruling/merge/repro; say unblock condition |
| `integrated` | On `origin/dev` (land bubble exists) |
| `done` | Story/L2 acceptance met; eligible for main with milestone |
| `wontfix` | Explicit close without ship |

`in_review` and `landing` are both accepted (landing = land script running).

## Priority check (procedure)

### Before start (implement work)

1. Run `npm run tickets:check` (optionally `--agent=<name>` `--story=<slug>`).
2. Must pick:
   - highest **open/assigned** **P0**, else
   - highest **P1** for the **assigned story**, else
   - the **assigned** ticket.
3. **May not** start a P3 (or lower than an open P0) while any **P0** is open/assigned/in_progress/in_review unless founder/rat **override** is noted on the ticket (`notes:` or `decision:`).

### Before land

1. Ticket must exist (create one if the work is real and untracked).
2. Status → `in_review` or `landing`.
3. Priority unchanged unless ox/rat re-ranks in writing.

### After L2 fail

1. Status back to `open` or `assigned` (reopen).
2. Priority **≥ prior** (never silent downgrade).
3. Link **shortest repro** on the ticket.

### After land to `origin/dev`

1. Status → `integrated`.
2. Story close only after **L2 pass** → `done`, then eligible for main.

## File format

Each ticket is `docs/tickets/T-###.md` with YAML frontmatter (see TEMPLATE). Keep ids unique. Update BACKLOG when priority/status changes.

## Script

```bash
npm run tickets:check              # list open by priority; validate schema
npm run tickets:check -- --agent=dolphin --story=lab-lifecycle
npm run tickets:check -- --strict  # exit non-zero if any P0 still open
node scripts/ticket-check.mjs --help
```

**Exit non-zero when:**

- Duplicate ids
- Invalid priority or status
- Missing required frontmatter fields
- Hard conflict: two `in_progress` tickets declaring the same `files:` path
- P0 open while another ticket is `in_progress` and no override on the lower work (fail)
- `--strict`: any P0 in an active status (`open|assigned|in_progress|in_review|landing|blocked`)

## Do not

- Silent priority downgrade after L2 fail
- Start polish while P0 burns
- Treat BACKLOG alone as source of truth without a `T-###.md` file
- Put secrets in tickets
