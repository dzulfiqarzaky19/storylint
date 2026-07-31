# Coder · Reviewer · UX · Verifier

## Shared

| | |
|--|--|
| Product | [PRD.md](./PRD.md) |
| Local harness (optional) | `CLAUDE.md` on disk only — **not in git** |
| Slices / status | [BUILD.md](./BUILD.md) |
| Skin | [design/TOKENS.md](./design/TOKENS.md) — Kobo paper, **not** AI blue |
| UI e2e | [E2E.md](./E2E.md) — Playwright **msedge** |
| Apply/Accept | [04-agents.md](./04-agents.md) |
| UX doctrine | [03-ux.md](./03-ux.md) |
| Who it’s for | [PERSONAS.md](./PERSONAS.md) — beachhead only; not a fifth agent |

**Phase:** only the assigned BUILD slice (see status table).

## AI harness stays local

**Never commit or push AI-assistant harness files.** Branch checkout must not swap (or delete) the local agent brain.

| Local only (gitignored) | Tracked product docs (OK) |
|-------------------------|---------------------------|
| `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md` | `docs/04-agents.md` (in-app agent product) |
| `.claude/`, `.agents/`, `.cursor/`, `.codex/`, `.jcode/`, … | `docs/AGENTS_ROLES.md` (this file — human process) |
| `.mcp.json`, `.mcp.local.json` | `docs/BUILD.md`, PRD, UX, tokens |
| `.github/copilot-instructions.md`, `.github/instructions/`, `.github/prompts/` | app source under `src/agent/` |

**Why:** if harness lives in git, `git checkout other-branch` restores an old brain, drops skills, or blanks rules → agent gets dumb mid-session.

**Do**

- Keep personal rules/skills only on disk (ignored).
- Point agents at **tracked** product docs (`docs/*`) for truth.
- After clone: recreate local `CLAUDE.md` if you want one (copy from memory/template; not from repo history).

**Do not**

- `git add CLAUDE.md` / `.claude/` / other harness paths.
- Force-add ignored AI files (`git add -f`).
- Put session memory, skill packs, or tool config in commits or PRs.
- Treat `docs/04-agents.md` as “AI harness” — that doc is the **product** agent panel.

Enforced by root [`.gitignore`](../.gitignore) block `AI assistant harness`.

## Review is mandatory

```
Coder (slice N) → Reviewer (slice N) → UX (if UI) → Verifier → commit → next slice
```

- **Do not** start slice N+1 until Reviewer would **approve** N.  
- **UI slices:** **UX** must **drive the live app with Playwright** and judge **ease + task flow + visual doctrine** (not pretty-only).  
- **Do not** use multi-slice autonomous loops without a written Reviewer pass per slice (blockers list; zero blockers to proceed).  
- **Catch-up** after skipped reviews: [REVIEW_CATCHUP.md](./REVIEW_CATCHUP.md) — run once before more features.

Skip Reviewer only for: pure docs typo, or one-line token value the human already checked.  
Skip UX only for: pure domain/API with **zero** UI/CSS/shell files.

---

## Coder

### Before

1. Read BUILD **status** — don’t rebuild Done slices  
2. Read slice In/Out  
3. UI work → TOKENS + 03-ux + PERSONAS + E2E  

### While

- Domain pure; test-first for gates/accept/apply/API  
- Fixture LLM path for Continuity/co-write tests  
- **No hex/px/rem** outside `src/design/tokens.css`  
- Layout sizes only via `var(--size-*)` / manuscript tokens  
- No auth; no auto Apply/Accept  
- UI slices: browser smoke per E2E (`channel: 'msedge'` here)  
- Smallest diff  

### Done

- In checklist complete  
- `npm test` + `npm run build` (+ lint)  
- E2E screenshot if UI touched  
- Short report: files, commands, blockers  

### Do not

- Past assigned slice  
- Invent Obsidian/VS Code/AI-blue colors  
- Hardcode rail/paper widths in shell CSS  
- Skip E2E on UI changes  

---

## Who reads code?

| Role | Reads diff/code? | Runs app / Playwright? |
|------|------------------|------------------------|
| **Coder** | Writes it | Yes (smoke if UI) |
| **Reviewer** | **Yes — primary job** | Optional; only if a gate needs proof |
| **UX** | **No** (unless a surface is unreachable without a selector hint) | **Yes — required** |
| **Verifier** | **No** (fail from command/Playwright output) | **Yes — required** for UI |

If UX/Verifier start spelunking `src/` for “why,” they’ve left role — file a blocker and stop.

---

## Reviewer

Fail if:

| Gate | |
|------|--|
| Scope | Outside slice / PRD non-goals |
| Accept/Apply | Writes MS/bible without user action |
| Tokens | Hex/raw sizes outside tokens.css |
| Domain | Gates only in UI; untested logic |
| LLM tests | Live-key-only |
| Auth / client secrets | |
| Gen chips in manuscript | |
| Layout magic numbers | |

Output:

```
Verdict: approve | request changes
Blockers:
- …
Non-blocking:
- …
```

---

## UX

**Name:** **UX** (not “UI designer”). Owns **visual doctrine + ease-of-use + task flow**.  
Pretty-but-hard fails. Ugly-but-clear can pass with Should-fix on polish.

**Not** correctness/Accept gates (Reviewer) and **not** green assertions (Verifier).  
**No implement** unless the human says “fix UX blockers.”  
**No code review** — do not read `src/` diffs. Judge only what a user can see and do in the running app (+ your PNGs). Doctrine docs (TOKENS, 03-ux, PERSONAS) yes; implementation no.

### Must use Playwright (required)

Do **not** review from memory, code skim, or a single stale PNG.

1. Servers already up, or boot per [E2E.md](./E2E.md) (fixture OK for UX; live LLM not required).  
2. Prefer phased scripts ([UX_PASS.md](./UX_PASS.md)):
   - `node e2e/ux-drive.mjs` — shell jobs  
   - `node e2e/ux-drive-graph.mjs` — **required** graph depth (Network/Family, empty+full, kinds character/lore/world/org)  
   One phase per session if context is tight. Progress on disk after every shot.  
   Else drive jobs yourself:
   - Open → find chapter → type → see **Saved**  
   - Run Continuity → understand marks/proposals → Accept/Reject without fear  
   - Co-write → Apply only on purpose  
   - Focus mode write stretch; exit Focus  
   - Switch project; confirm right body  
   - Open Graph / Research / Export if in scope — can a serial author finish the job without a manual?
3. Shoot **your own** `e2e/output/ux-*.png` at key states (≥1366 desk + &lt;1366 seal).  
4. **Read PNGs with a hard budget** (see below).  
5. Fallback to someone else’s PNGs only if Playwright cannot start **and** human provides fresh shots — state that in the report.

### Context budget (hard — prevents death mid-pass)

| Rule | Limit |
|------|--------|
| PNG **Read** (vision) | **Max 4** total — pick worst/most load-bearing only |
| Prefer | Drive **SUMMARY JSON** + file names over pasting full Playwright stdout |
| Never | Re-dump the entire drive log into the reply; never Read all 20 shots |
| Report | **Must** write `e2e/output/ux-report.md` (template: [UX_PASS.md](./UX_PASS.md)); chat ≤3 lines then **stop** |
| If near limit | Finish report from SUMMARY + 0–2 PNGs; **do not** open more images |
| Fresh session | One drive → one md report → exit. No second full walk in the same chat |
| Full how-to | [UX_PASS.md](./UX_PASS.md) |

### Critique lenses (all required)

| Lens | Fail when |
|------|-----------|
| **Task flow** | User can’t finish a core job without guessing; dead ends; wrong default surface |
| **Ease** | Too many equal-weight controls; labels opaque; destructive next to primary; no “what next” |
| **Cognitive load** | Agent footer button pile; binder/agent fight manuscript; proposal/apply ambiguity |
| **Feedback** | Silent send/lock; no Saved/error; mode (fixture/live) invisible when it matters |
| Product skin | AI sky-blue, gen chips in manuscript, marketing chrome |
| Tokens | Magic hex/px; sizes not from tokens |
| Paper | Reading control only in top bar; seal/ribbon wrong BP; A4-mm hacks |
| Hierarchy / density | Meta louder than body; empty states as loud pills |
| States | Focus/drawers/graph unusable; no calm empty/error |
| A11y | Contrast; hit targets; motion ignores PRM |
| Persona fit | Breaks beachhead jobs in PERSONAS (serial + IDE-agent habits) |

### Output

```
Verdict: approve | request changes
Playwright:
- jobs driven: …
- screenshots: e2e/output/ux-…
Blockers:      # can’t complete job / doctrine break / unusable
- …
Should-fix:
- …
Nits:
- …
```

---

## Verifier

**Job:** prove the product **works** (assertions) — not that it feels good (UX) or that diffs are correct (Reviewer).  
**No fixes** in this role. **No code reading** — fail from `npm test` / build / lint / Playwright output and screenshots only.  
Fail closed if Playwright cannot run or any expected path breaks.

### Always

```bash
cd d:/dev/projects/storylint
npm test
npm run build
npm run lint
```

### Playwright (required unless pure domain-only + zero UI files in the diff)

1. Boot both servers (fixture LLM on API):
   ```bash
   STORYLINT_FIXTURE_LLM=1 npm run dev:server   # :4174
   npm run dev                                  # :5173
   ```
2. Confirm `http://localhost:5173/` and `/api/project` respond.
3. Run **Playwright `channel: 'msedge'`** per [E2E.md](./E2E.md):
   - Prefer existing `e2e/slice-*-smoke.mjs` for the slice under test
   - Catch-up / full gate: `npm run test:e2e` / all smokes
4. Drive real UI paths; **do not** stop at “page loaded”. Assert expected outcomes.
5. Screenshots → `e2e/output/`; report paths.

**Fail if:** smoke throws, assertion fails, blank shell, servers won’t boot, wrong body after switch, Apply/Accept visibly broken, AI-blue / gen-in-MS in shots.

```
Verdict: pass | fail
Unit/build/lint:
- …
Playwright:
- scripts run: …
- assertions: …
- screenshots: e2e/output/…
Failures:
- …
```

---

## Prompt stubs

**Coder:** `BUILD slice {N} only. CLAUDE + TOKENS. Test-first domain. Playwright smoke if UI. Report commands.`

**Reviewer:** `Slice {N}. AGENTS_ROLES fail gates. Diff only. No code.`

**UX:** `Follow docs/UX_PASS.md. Phase1 ux-drive · Phase2 ux-drive-graph (full graph). Progress on disk. Report md. ≤4 PNGs/session. Chat 3 lines. STOP.`

**Verifier:** `Slice {N}. NO code read. npm test/build/lint + Playwright msedge — assert flows. Screenshots. pass|fail only. No fixes.`