# Coder · Reviewer · Verifier

How to split work on Storylint without thrash.

---

## Shared

| | |
|--|--|
| Product truth | [PRD.md](./PRD.md) |
| Hard rules | [../CLAUDE.md](../CLAUDE.md) |
| Build order | [BUILD.md](./BUILD.md) |
| Skin | [design/TOKENS.md](./design/TOKENS.md) only |
| Patterns/URLs | [design/REFERENCES.md](./design/REFERENCES.md) |
| Apply/Accept | [04-agents.md](./04-agents.md) |

**Phase:** Only the active BUILD slice. No P2/P3 “while we’re here.”

---

## Coder

### Before coding

1. Name the slice (0 / A / B / C / D)  
2. Read PRD acceptance + BUILD slice **In/Out**  
3. Read TOKENS + design README if UI  
4. List files you will touch (confirm multi-file surface if large)

### While coding

- Domain pure; gates not copied into React  
- No hex/px outside `src/design/tokens.css`  
- No auth, no auto-apply  
- **Logic = test-first:** failing test → implement → green (see [BUILD.md](./BUILD.md) “Tests before code”)  
- Every new gate/accept/API contract ships **with** tests in the same slice  
- Fixture path for continuity — never CI-only live LLM  
- Smallest diff  

### Done means

- Slice **In** checklist complete  
- Commands in slice Verify pass  
- New domain behavior has tests that would fail if reverted  
- No known acceptance regression  
- Short note: what shipped + how to verify  

### Do not

- Expand scope to co-write/review/research  
- “Improve” identity away from IDE+agent panel  
- Guess Obsidian/VS Code colors  

---

## Reviewer

Fresh context. Diff + docs only — don’t re-implement.

### Always fail PR if

| Gate | |
|------|--|
| Scope | Files/features outside active slice or PRD non-goals |
| Accept boundary | Any path writes sheets/facts/MS without Accept/Apply/manual user edit |
| Tokens | New hex/raw palette in `features/` or components bypassing tokens |
| Domain leak | Lint rules only in UI; domain untested |
| Tests afterthought | New gate/accept/API behavior with zero tests, or tests added “later” |
| Live-LLM-only | Continuity tests require real API key / no fixture |
| Auth | Login/session added |
| Editor chrome | Gen buttons in manuscript surface |
| LLM config | Any `LLM_*` secret exposed to the client bundle/logs, or live calls bypassing the server-only OpenAI-compatible adapter |

### Also check

- Shell still has agent panel slot  
- Focus mode behavior preserved if shell touched  
- Naming/types strict (no `any` to silence)  
- Atomic save / schemaVersion if persistence touched  
- Privacy copy if live LLM path added  

### Output shape

```
Verdict: approve | request changes
Blockers:
- …
Non-blocking:
- …
```

---

## Verifier

Does not trust coder narrative. Runs commands + exercises path.

### Baseline commands

```bash
cd d:/dev/projects/storylint
npm run build
npm test                 # or test:unit when split
npm run typecheck        # when script exists
```

### Per-slice checks

Copy from [BUILD.md](./BUILD.md) Verify section for the slice.

### P1 full (after Slice D) — PRD §7

1. Cold start, no auth wall  
2. Type chapter → reload → persists  
3. Manual sheet + fact → persists  
4. Continuity without key → safe error or fixture  
5. Continuity fixture/live → marks and/or proposals  
6. Accept → bible grows; Reject → no write  
7. Agent panel toggle + Focus mode  
8. No gen chips in editor  
9. Spot-check: no `#` hex in `src/components` / `src/features` (allow only `src/design/tokens.css`)  

### Output shape

```
Verdict: pass | fail
Commands:
- build: pass/fail
- test: pass/fail (N tests)
Manual:
- … steps …
Failures:
- …
```

---

## Suggested delegation prompts

### Coder

> Implement BUILD.md Slice {N} only. Follow CLAUDE.md + PRD. Tokens from docs/design/TOKENS.md. No P1b/P2. For domain/API: write failing tests first, then code. Fixture for continuity. End with verify commands you ran.

### Reviewer

> Review diff for Slice {N}. Use docs/AGENTS_ROLES.md fail gates. Verdict first. No drive-by refactors.

### Verifier

> Verify Slice {N} per BUILD.md + AGENTS_ROLES.md. Run build/test; manual checklist. Pass/fail only with evidence.

---

## Human (you) before first coder

- [ ] Skim PRD §3–7 — acceptance matches what you want  
- [ ] Skim TOKENS — primary/accent OK  
- [ ] Confirm BUILD locked defaults table  
- [ ] Delegate **Slice 0** first (DS), not “build the whole MVP”  
