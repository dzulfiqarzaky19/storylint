# UX pass — how to run without dying

**Role:** ease + task flow + visual. **No code. No implement** unless human says fix.  
**Canon:** [AGENTS_ROLES.md](./AGENTS_ROLES.md) · [PERSONAS.md](./PERSONAS.md) · [03-ux.md](./03-ux.md) · [design/TOKENS.md](./design/TOKENS.md) · [E2E.md](./E2E.md)

---

## Why agents die

Playwright stdout + **Read** of many PNGs overflows context (~500k).  
**Fix:** **phased drives** → checkpoint **to disk** → write **one report** → Read **≤4 PNGs total per session** → chat 3 lines → stop.  
New session resumes from progress files — **never** re-paste full logs.

---

## Phases (run separately if context is tight)

| Phase | Command | Covers |
|-------|---------|--------|
| **1 Shell** | `node e2e/ux-drive.mjs` | write/Saved, paper, Focus, Continuity via Check face (not top bar), Apply path, multi-project, research open, shallow graph open, widths |
| **2 Graph** | `node e2e/ux-drive-graph.mjs` | Network + Family; **empty** (kinds off) + **full seed** (character/lore/world/org); kind filters; pending→Accept edge; node→sheet; narrow |

**Rule:** One phase per agent session when near limits. Phase 2 does **not** require re-running phase 1 if `ux-progress` already has shell results.

### Graph must check (phase 2)

- [ ] Network empty / all kinds off → calm empty state  
- [ ] Family empty without kinship → “No family tree yet” (or clear sparse)  
- [ ] Seeded: character + lore + world + organization visible when filters on  
- [ ] Solo filter each kind: nodes make sense; empty state if none  
- [ ] Send proposal → edge **not** drawn until Accept  
- [ ] Accept → edge/label appears  
- [ ] Family after `parent_of` Accept  
- [ ] Node click opens sheet  
- [ ] 1024 / phone family still usable  

---

## Progress on disk

| File | What |
|------|------|
| `e2e/output/ux-progress.md` | Combined live phase (shell or graph) |
| `e2e/output/ux-progress.json` | `done`, `phase`, nested `results.shell` / `results.graph` |
| `e2e/output/ux-graph-progress.md` | Graph-only detail + SUMMARY |
| `e2e/output/ux-*.png` | Shell shots |
| `e2e/output/ux-graph-*.png` | Graph shots |
| `e2e/output/ux-report.md` | **Final** verdict (agent writes / merges) |

Drives rewrite progress after **every shot**.  
If chat dies: new session → Read `ux-progress.md` (+ `ux-graph-progress.md`) → finish report → **no re-drive** if phase `done`.

---

## Steps

### Session A — shell (or full if room)

```bash
cd d:/dev/projects/storylint
node e2e/ux-drive.mjs
```

Read `e2e/output/ux-progress.md`. Read ≤2 shell PNGs. Start or update `ux-report.md` shell jobs. Chat 3 lines. STOP if context heavy — leave graph for session B.

### Session B — graph (required; was underspecced)

```bash
node e2e/ux-drive-graph.mjs
```

Read `e2e/output/ux-graph-progress.md`. Read ≤3 `ux-graph-*.png` (empty, full network, family). Merge graph section into `ux-report.md`. Chat 3 lines. STOP.

### Session C — resume only

If drive finished but report missing: **no Playwright**. Read progress files + ≤2 PNGs → write report.

---

## Template → `e2e/output/ux-report.md`

```markdown
# UX report

**Date:** YYYY-MM-DD
**Verdict:** approve | request changes
**Drives:** ux-drive.mjs · ux-drive-graph.mjs
**Progress:** e2e/output/ux-progress.md · ux-graph-progress.md

## Jobs — shell

| Job | Result | Notes |
|-----|--------|-------|
| write → Saved | | |
| Focus rails | | |
| Continuity via Check face → Accept/Reject | | |
| Co-write Apply | | |
| Multi-project | | |
| Research | | |
| Export | | |
| Seal/ribbon | | |
| No AI-blue / gen-in-MS | | |

## Jobs — graph

| Job | Result | Notes |
|-----|--------|-------|
| Network empty (kinds off) | | |
| Family empty | | |
| Network full multi-kind | | |
| Filter character | | |
| Filter lore | | |
| Filter world | | |
| Filter organization | | |
| Pending edge hidden | | |
| Accept shows edge | | |
| Family after kinship | | |
| Node opens sheet | | |
| Narrow/phone family | | |

## PNGs read (≤4 per session)

- path — note

## Blockers
1. …

## Should-fix
1. …

## Nits
1. …
```

---

## Paste prompts

### Phase 1 shell

```
UX · phase 1 shell · NO implement · NO code · disk progress.

Follow docs/UX_PASS.md phase 1 only.
Run: node e2e/ux-drive.mjs
Read e2e/output/ux-progress.md. Read ≤2 PNGs.
Write/update e2e/output/ux-report.md shell section.
Chat 3 lines. STOP — leave graph for phase 2.
```

### Phase 2 graph (use this when shell finished but graph thin)

```
UX · phase 2 graph · NO implement · NO code · disk progress.

Follow docs/UX_PASS.md phase 2.
Run: node e2e/ux-drive-graph.mjs
Must cover: Network+Family, empty + full seed, kinds character/lore/world/organization,
pending→Accept, node→sheet, narrow.
Read e2e/output/ux-graph-progress.md. Read ≤3 ux-graph-*.png.
Merge graph jobs into e2e/output/ux-report.md. Final verdict.
Chat 3 lines. STOP.
```

### Resume after 500k death

```
UX resume · NO re-drive if progress phase *:done.

Read e2e/output/ux-progress.md and ux-graph-progress.md if present.
Read ≤2 PNGs only if a blocker is unclear.
Finish e2e/output/ux-report.md. Chat 3 lines. STOP.
```

---

## Human next

Open `e2e/output/ux-report.md`. Feed **Blockers** to coder only.
