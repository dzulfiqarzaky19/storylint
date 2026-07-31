# Catch-up review (post-loop debt)

**Why this exists:** Autonomous loops (F→H, I→K) shipped with weak or skipped **independent** reviewer gates.  
This is a **one-time full-tree review** to repay that debt before more features.

**Not a substitute for per-slice review going forward.** After this passes: every new slice = Coder → **Reviewer** → Verifier → commit.

---

## Prompt — paste into a fresh agent session

```
You are the CATCH-UP REVIEWER for Storylint at d:\dev\projects\storylint.
Independent eyes. DO NOT implement. DO NOT start new slices.

## Why
We skipped proper independent review while using autonomous loops through K2.
Your job: adversarial review of EVERYTHING landed after phase-1 baseline through K2
(graph network+family, export, multi-project, research, chapter review/craft,
Apply/cowrite, continuity, Kobo UI, project switch races).

## Baseline
- Early: f4d1209 / e4230b9 / 0b0de72 (phase 0–1) if present
- Recent: fd0ae61, 029cd7d, plus ALL uncommitted changes
- Read: docs/AUTO_STATUS.md, docs/BUILD.md, docs/AGENTS_ROLES.md,
  docs/04-agents.md, docs/design/TOKENS.md, docs/03-ux.md, docs/E2E.md, README.md
  (optional local-only CLAUDE.md if present on disk — not in git)

## Commands (read-only / evidence)
git log --oneline -20
git status
git diff 0b0de72...HEAD
git diff
git diff --stat
# Optionally re-run (report only, don’t “fix”):
npm test
npm run build
npm run lint

## Mission
Find real defects. Prefer:
- Correctness / data loss / race
- Accept/Apply boundary holes
- Security (path traversal, zip slip, project id, secrets)
- Canon pollution (pending as truth)
- Token/layout policy breaks
Ignore pure taste unless it breaks product doctrine (gen-in-MS, AI-blue restore).

## Blockers (must list with file path + why)

### A. Canon & manuscript boundaries
- [ ] Any path writes chapter body without explicit Apply
- [ ] Any path writes sheet/fact/bible without Accept or explicit manual save UI
- [ ] Graph edges or export treat pending proposals as accepted canon
- [ ] Research pin writes canon; propose bypasses proposal Accept
- [ ] Review/craft check mutates MS or bible silently
- [ ] Continuity extract auto-accepts

### B. Multi-project & persistence races
- [ ] switch/create project can lose in-flight chapter drafts
- [ ] Late HTTP merge from project A applies onto project B
- [ ] editLock / trackMutation missing on mutate paths that race switch
- [ ] Recovery drafts not project-scoped (chapterId alone)
- [ ] Export without flushing dirty chapters
- [ ] schemaVersion broken; corrupt JSON on crash
- [ ] Path traversal: project id, export zip paths, portrait file paths

### C. Apply / cowrite
- [ ] Double-click Apply double-writes
- [ ] Stale expectedBody not rejected
- [ ] Apply during debounce overwrites newer local typing
- [ ] Apply cards survive project switch and apply to wrong project

### D. Graph (I + K2)
- [ ] Pending relationship proposals drawn as solid edges
- [ ] Family tree mutates facts without Accept
- [ ] Dangling sheet refs crash or corrupt state
- [ ] Parallax not disabled for touch / prefers-reduced-motion
- [ ] Graph layout magic numbers outside tokens.css
- [ ] Filter by kind broken / hides all with no empty state

### E. Tokens / UI doctrine
- [ ] Hex or px/rem in components/features (not tokens.css)
- [ ] AI sky-blue (#6EA8FE etc.) restored
- [ ] Gen chips in manuscript column
- [ ] Reading control only in top bar (should be on paper: seal<1366, ribbon≥1366)
- [ ] Client bundle contains LLM keys

### F. Tests & honesty
- [ ] New domain behavior without tests
- [ ] Live-LLM-only tests (no fixture)
- [ ] AUTO_STATUS / BUILD claim Done but code missing or broken
- [ ] npm test/build currently red

## Output format (strict)

# Catch-up review

**Verdict:** APPROVE | REQUEST CHANGES

## Blockers (ordered by severity)
1. **[area]** `path` — what — failure mode — suggested fix direction (no code)

## Non-blocking
1. …

## Re-verify commands
- npm test
- npm run build
- npm run lint
- Boot: STORYLINT_FIXTURE_LLM=1 npm run dev:server + npm run dev
- Playwright (msedge): **all** e2e/slice-*-smoke.mjs — pass only if flows assert OK + screenshots in e2e/output/
- …

## Slice risk map
| Slice | Risk | Notes |
|-------|------|-------|
| E Apply | | |
| F portraits/tags | | |
| G review | | |
| H research | | |
| I graph | | |
| J export/multi | | |
| K1/K2 | | |

## Gate for future work
After this review is clean (blockers fixed + re-reviewed):
NO new feature slice without Coder → Reviewer → Verifier per docs/AGENTS_ROLES.md.

Do not implement fixes in this session unless the human explicitly says "fix blockers."
```

---

## After catch-up passes

Mandatory forever ([AGENTS_ROLES.md](./AGENTS_ROLES.md)):

```
Coder (slice N) → Reviewer (slice N) → Verifier → commit → Coder (N+1)
```

Overnight loops must **simulate Reviewer in writing** (blockers list); **zero blockers** before N+1. Prefer two sessions when human is present.
