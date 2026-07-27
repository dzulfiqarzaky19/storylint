# Coder · Reviewer · Verifier

## Shared

| | |
|--|--|
| Product | [PRD.md](./PRD.md) |
| Rules | [../CLAUDE.md](../CLAUDE.md) |
| Slices / status | [BUILD.md](./BUILD.md) |
| Skin | [design/TOKENS.md](./design/TOKENS.md) — Kobo paper, **not** AI blue |
| UI e2e | [E2E.md](./E2E.md) |
| Apply/Accept | [04-agents.md](./04-agents.md) |

**Phase:** only the assigned BUILD slice (see status table).

---

## Coder

### Before

1. Read BUILD **status** — don’t rebuild Done slices  
2. Read slice In/Out  
3. UI work → TOKENS + 03-ux + E2E  

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

## Verifier

```bash
cd d:/dev/projects/storylint
npm test
npm run build
npm run lint   # if present
```

UI slices: [E2E.md](./E2E.md) — boot servers, Playwright **msedge**, smoke Focus/paper/Continuity/Apply as relevant, `e2e/output/*.png`.

```
Verdict: pass | fail
Commands:
- …
Manual / e2e:
- …
Failures:
- …
```

No fixes in verifier role.

---

## Prompt stubs

**Coder:** `BUILD slice {F|G|…} only. CLAUDE + TOKENS. Test-first domain. E2E if UI. Report commands.`

**Reviewer:** `Slice {N}. AGENTS_ROLES fail gates. Diff only.`

**Verifier:** `Slice {N}. BUILD + E2E evidence. Pass/fail only.`
