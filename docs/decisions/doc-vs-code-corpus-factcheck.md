<!--
  Author: dromedary / bk lane (DOC-VS-CODE)
  Kind: corpus fact-check report (read-only)
  Against: docs/ @ origin/dev
  Method: git show origin/dev:<path> only — not worktree
  Does not edit product code or ox settled-positions.md
-->

# Doc-vs-code corpus fact-check

**Voice:** outside reader, evidence only  
**Tree:** `origin/dev` @ `4a451cd` (re-fetch before absorb; tip moves)  
**Sprint model:** [AGENT_PIPELINE.md](../AGENT_PIPELINE.md) § Sprint model — rat ranks; review → land → verify; coordinator is not a land gate  
**Scope:** load-bearing factual claims about product or harness. Judgments / “do not build” policy out of scope unless they assert a code fact.  
**Ox settled-positions:** not edited (BK report already covers it).

### Verdict key

| Verdict | Meaning |
|---------|---------|
| **VERIFIED** | Claim matches `origin/dev` code or scripts |
| **STALE** | Claim was once true or marked VERIFIED; code/docs disagree now |
| **UNVERIFIABLE** | No code predicate; process aspiration; or evidence insufficient |
| **PARTIAL** | Half-true or two docs disagree |

**Class (rule 12):** A doc mark that says **VERIFIED** while the code has moved is the same disease as a control that lies about itself. Count below.

---

## Summary counts (this pass)

| Bucket | n (approx) |
|--------|------------|
| **STALE** (doc lies or stale VERIFIED) | **18** |
| **VERIFIED** | **22** |
| **PARTIAL / UNVERIFIABLE** | **8** |

Highest blast: `docs/README.md` § new engineer (3 STALE VERIFIED marks), entire `docs/CODE_VERIFY.md` C5/@bible block, `docs/E2E.md` selector + networkidle sample, `e2e/helpers.mjs` Research-under-More contract comment, STANDING_RULES Chapter One.

---

## 1. `docs/README.md` — “What a new engineer still gets wrong”

Each row already carries a **VERIFIED** stamp. Stale VERIFIED is worse than no mark.

| # | Claim | Doc | Verdict | Evidence @ origin/dev |
|---|-------|-----|---------|------------------------|
| 1 | `manuscript` / Write / Draft are three different things | README:74 | **VERIFIED** | Mode `'manuscript'` `Shell.tsx:37`; top label Draft `:415`; face `write` in `AgentPanel.tsx:40,53`. |
| 2 | Sheet = binder push-stack; list mounted under detail | README:75 | **VERIFIED** | `Binder.tsx:434` `data-binder-stack`; `:440–454` list + detail layers. |
| 3 | Graph **still renders raw enums** until C5 | README:76 **VERIFIED open** | **STALE** | Graph imports and renders `SHEET_KIND_LABEL`: `RelationshipGraph.tsx:6,311,377,388,396,450`. No raw `{kind}` filter text. C5 debt is **closed in code**; doc mark is the lie. |
| 4 | Shipped `AgentPanel` still shows **`@bible`** badge | README:77 **VERIFIED** | **STALE** | UI badges are `@canon`: `AgentPanel.tsx:699,764`; Shell context `@canon` `:304`. Grep `@bible` in `src/components`+`src/features` → **0**. |
| 5 | Research under **More**; FACES 5 / PRIMARY 3 / Inbox badge | README:78 **VERIFIED** | **PARTIAL → STALE on More** | FACES/PRIMARY/Inbox **VERIFIED** (`AgentPanel.tsx:40,53`, inbox badge path). Writing overflow length is **1** (Research only) → **plain** `companion__face-secondary`, **not** More menu (`:457–467`). More only if `overflow.length > 1` (`:468+`). “Research under More” is the old D6 costume. |
| 6 | density-audit historical; binder-void notes not current | README:79 | **VERIFIED** (process) | File exists as history under `docs/decisions/density-audit-qa3.md`; not used as live checklist in code. |
| 7 | Working tree ≠ truth; `git show origin/dev:path` | README:80 | **VERIFIED** (process) | [GIT_WORKFLOW](../GIT_WORKFLOW.md) §5; STANDING_RULES §7. |
| 8 | PRD intent-at-the-time; BUILD ship; IA_MAP structure | README:81 | **VERIFIED** | PRD top banner: “Intent record, not current ship spec” + BUILD/IA_MAP pointers. |
| 9 | D4 Canon map chrome **not on origin/dev docs tree** until merged | README:82 **VERIFIED** | **VERIFIED** (narrow) | No `docs/design/D4-CANON-MAP-CHROME.md` on tree. (Product map chrome may exist in src; claim is about **docs file** absence.) |
| 10 | Rails 272/272/280/320; companion closed default &lt;1366 | README:83 | **VERIFIED** | `tokens.css:142–153`; `useShellState.ts:10,106–107` `BP_DESK` + `agent: atDesk`. |
| 11 | Binder mounts when `project.project` exists, not only active chapter | README:84 | **VERIFIED** | `Shell.tsx:221–226` comment + `project.project ? <Binder…>`. |

**Subtotal README §:** 7 VERIFIED · 2 STALE · 1 PARTIAL/STALE · 1 narrow VERIFIED.

---

## 2. `docs/CODE_VERIFY.md` (Task AD pig — marked as live truth)

This file’s job is file:line truth. Several rows are **actively false** and still say VERIFIED.

| # | Claim | Doc locus | Verdict | Evidence |
|---|-------|-----------|---------|----------|
| CV1 | C5 graph kind chips still raw enums; **no** `SHEET_KIND_LABEL` import | CODE_VERIFY special #1 | **STALE** | Import + labels: `RelationshipGraph.tsx:6,311,396`. Cited lines `:265/:343` are stale coordinates. |
| CV2 | Binder renders when project loads | special #2 | **VERIFIED** | `Shell.tsx:221–226`. Line numbers in doc may drift; mechanism holds. |
| CV3 | Rails 272/…; companion closed &lt;1366 | special #3 | **VERIFIED** | tokens + `useShellState` as above. |
| CV4 | Sheet detail push stack | special #4 | **VERIFIED** | `Binder.tsx` stack. Doc lines `:302–337` drifted; structure holds. |
| CV5 | Writing faces 5 + 3 primaries + More + Inbox | special #5 | **PARTIAL** | 5+3+Inbox true. “overflow under More” false for single Research overflow (plain secondary). |
| CV6 | Wrong-turns #3 graph raw enums | wrong-turns #3 | **STALE** | Same as CV1 / README #3. |
| CV7 | `@bible` Badge at AgentPanel:436,480 | wrong-turns #4 | **STALE** | No `@bible`; `@canon` at `:699,:764`. Cited lines wrong era. |
| CV8 | D4 map chrome topic-only | wrong-turns #9 | **VERIFIED** (docs absence) | Same as README #9. |
| CV9 | Kind labels PARTIAL — graph STALE debt | landmines table | **STALE** | Graph debt closed; binder+graph both labeled. |
| CV10 | “Docs claiming graph labels already fixed — none — C5 remains open” | never-true table | **STALE** | C5 open claim false; STANDING_RULES §21 already says graph uses `SHEET_KIND_LABEL` (**internal corpus contradiction**). |

**Blast:** Any agent that trusts CODE_VERIFY over src will re-open C5 or re-introduce `@bible` “fixes.”

---

## 3. Process docs rat asked to stress-test

### 3.1 `docs/AGENT_PIPELINE.md` (ce1b3c7 era + tip)

| Claim | Verdict | Evidence |
|-------|---------|----------|
| Sprint model: rat holds priority; no clock; theme batches; `dev→main` at named milestone | **UNVERIFIABLE** (normative process) | Text only; no code clock. Consistent with roles docs. Not a code lie. |
| **Only `npm run land` writes `dev`.** Never `git push origin <topic>:dev` | **PARTIAL / aspirational** | **Script exists and is the house path:** `package.json` `"land": "node scripts/land.mjs"`; `scripts/land.mjs` pushes `HEAD:dev` after `--no-ff` bubble, no-worse gate, prints origin hash. **Not mechanically exclusive:** git still accepts `git push origin HEAD:dev` / topic tips; GIT_WORKFLOW still documents **manual land fallback** with `git push origin HEAD:dev`. No pre-receive hook in-repo forcing land-only. **Plain:** preferred and encoded; **not** the only thing that *can* write dev. |
| Land vehicle = `--no-ff` bubble, not squash-to-dev | **VERIFIED** (script) | `land.mjs` `merge --no-ff`, refuses non-merge result before treating success. |
| Land gate = **no-worse**, not absolute green | **VERIFIED** (script + GIT_WORKFLOW) | `land.mjs` header + identity compare; GIT_WORKFLOW § gate. |
| Coordinator is **not** an approval gate before land | **UNVERIFIABLE** (process) | No code path inserts rat. Claim is organizational. History note (83-commit drift) is narrative, not re-proven here. |
| L1 = owned-stack Playwright before land; L2 = composition on origin/dev | **UNVERIFIABLE** as enforcement | Documented; not a CI required-status check in this pass. Agents can still land without L1 if they bypass discipline. |
| E2E verify fail = bug ticket, not revert | **UNVERIFIABLE** (process) | Normative. |

### 3.2 `docs/AGENTS_ROLES.md`

| Claim | Verdict | Evidence |
|-------|---------|----------|
| Pipeline restates land + two verification lanes; coordinator not land gate | **VERIFIED** as pointer | Defers to AGENT_PIPELINE; does not invent a second land path. |
| AI harness local-only / gitignored | **VERIFIED** (intent) | Claims root `.gitignore` block; not line-audited every pattern this pass — **PARTIAL** if you need full ignore proof. |
| Verifier: Playwright `channel: 'msedge'`; no code read | **VERIFIED** as role text | Matches E2E stack table intent. |
| Review → land → E2E verify sequence | **UNVERIFIABLE** enforcement | Same as pipeline. |

### 3.3 Citable green vs land gate (rat’s three claims)

| Claim | Verdict | Evidence |
|-------|---------|----------|
| **`npm run test:green` is the only citable green** | **VERIFIED** (as definition) | `package.json`: `test:green` = guard + build + unit + all-smoke + calm. STANDING_RULES Gate section: “Citable green = `npm run test:green` only.” |
| Land does **not** require absolute green | **VERIFIED** | `land.mjs` no-worse vs baseline identities; pre-existing reds allowed. |
| Tension | **None if distinguished** | **Cite green** = full suite identity. **Land** = no-worse vs that suite on fresh origin/dev. Docs that say “must be green to land” without no-worse are STALE; AGENT_PIPELINE correctly says treat absolute-green as land gate is forbidden. |

**Contradiction check on rat’s own edit:** AGENT_PIPELINE “Only land writes dev” is **stricter than git reality**. Prefer wording: “Only `npm run land` is the **authorized** writer; manual `HEAD:dev` is fallback/understanding and is how the script itself pushes.”

---

## 4. `docs/E2E.md` (vs badger networkidle / step work)

| Claim / snippet | Doc | Verdict | Evidence |
|-----------------|-----|---------|----------|
| Minimal smoke: `waitUntil: 'networkidle'` | E2E.md:81 | **STALE** | Suite direction: never networkidle on owned stacks (`e2e/README.md` Nav waitUntil; helpers `reloadApp` uses `domcontentloaded`; smokes comment “never networkidle”). First-goto networkidle still debated in milestone notes, but **teaching sample in E2E.md is the wrong default** post dd53071/b495537. |
| `getByRole('main', { name: 'Manuscript' })` | E2E.md:82,96 | **STALE** | Product main is **`Draft`**: `Shell.tsx:463,526` `aria-label="Draft"`. Helpers use `/^Draft$/` (`helpers.mjs` WORKSPACE_MODES.draft). |
| Continuity button `/^Continuity$|^Running/i` | E2E.md:99 | **STALE** | Button label **`Run Continuity`** / busy **`Working…`**: `AgentPanel.tsx:638`. No bare `Continuity` / `Running` primary label. |
| Checklist “Manuscript main” | E2E.md:34 | **STALE** | Same Draft rename. |
| Scripts e…k only (omits l) | E2E.md:43 | **STALE** | `constants.mjs` `ALL_FEATURE_SMOKES` includes `slice-l-smoke.mjs`. |
| Full gate `npm run test:e2e` → all-smoke | E2E.md:45 | **VERIFIED** | package.json + constants. |
| Boot two processes fixture server | E2E.md boot | **VERIFIED** (shape) | Matches package scripts. |
| msedge channel | E2E.md stack | **VERIFIED** as house default text | |

### Related harness docs (same class)

| Claim | Locus | Verdict | Evidence |
|-------|-------|---------|----------|
| “Research is a role=menuitem under More (not a top tab)” | `e2e/helpers.mjs:10–11` | **STALE** (writing) | Product: one overflow → plain secondary tab (`AgentPanel.tsx:457–467`). Helper still **falls back** More→menuitem (`:386–401`) which is correct for multi-overflow contexts, wrong as the writing contract blurb. |
| Example `goto` still `networkidle` | `e2e/README.md` “Writing a new measurement script” ~L249 | **STALE** | Contradicts same file “Never `waitUntil: 'networkidle'` on owned stacks” (~L275). |
| networkidle SAFE first / DANGEROUS reload | e2e/README + helpers | **PARTIAL** | Guard bans **reload**+networkidle (`guard-helpers` `reload-networkidle`). Post-badger practice comments say never on owned stacks even first nav. Doc half-updated. |
| Step labels survive stall | e2e/README diagnostic | **VERIFIED** (artifact claim) | Points at `e2e/prove-step-stall.mjs` / proofs (landed with b495537 class). Not re-run this pass. |

---

## 5. Standing rules / product echoes (high blast, not ox settled file)

| Claim | Locus | Verdict | Evidence |
|-------|-------|---------|----------|
| Boot may seed **Chapter One** | STANDING_RULES §22 | **STALE** | `server/index.ts:10` `title: ''`. Same U5/BK S1. |
| Graph kinds use `SHEET_KIND_LABEL` | STANDING_RULES §21 | **VERIFIED** | Matches code; **contradicts** CODE_VERIFY/README C5 rows. |
| Lab Promoted dismissible; Archive+Restore | STANDING_RULES §25 | **PARTIAL** | Domain archive exists; UI Archive only; **no Restore / Promoted dismiss** (BK S2–S3). Ruled ≠ shipped. |
| Citable green = test:green | STANDING_RULES Gate | **VERIFIED** | package.json. |
| Worktree ≠ truth | STANDING_RULES §7 | **VERIFIED** | process. |

Ox `density-pass-settled-positions.md` not re-matrixed here; see [density-pass-settled-positions-factcheck.md](./density-pass-settled-positions-factcheck.md) (BK).

---

## 6. Class inventory (rule 12–13)

**Mechanism:** “Doc (or VERIFIED stamp) asserts product/harness fact; `origin/dev` src disagrees.”

| Mechanism instance | Sites (this pass) | Fix ownership (suggested) |
|--------------------|-------------------|---------------------------|
| Stale **VERIFIED** stamp on moved UI | README #3 #4 #5; CODE_VERIFY CV1 CV5–7 CV9–10 | Docs owner: strip/fix marks; delete or rewrite CODE_VERIFY rows |
| E2E teaching samples vs suite law | E2E.md networkidle + Manuscript + Continuity regex; e2e/README sample goto | E2E owner (badger lane): align samples to helpers |
| Helper contract comment vs D6 overflow cardinality | helpers.mjs Research/More blurb | E2E: “plain secondary when one overflow; More when ≥2” |
| Chapter One proper name | STANDING_RULES §22; settled-positions §2.3 (BK) | ox absorb |
| “Only land writes dev” absolute | AGENT_PIPELINE rule 4 | rat: authorized vs possible |
| Lab lifecycle stated as present | STANDING §25; settled §5 | product follow-on or “ruled not shipped” |

**Count of STALE load-bearing marks found:** **18** (table rows marked STALE above, including PARTIAL→STALE More).  
**Count of internal corpus contradictions:** ≥2 (STANDING §21 vs CODE_VERIFY C5; e2e/README networkidle do/don’t).

---

## 7. What was not done (explicit non-claims)

- Did not re-run `npm run test:green` or Playwright.
- Did not exhaust every file under `docs/` (prioritized blast list).
- Did not line-audit IA_MAP / CALM full tables vs CSS.
- Did not verify GitHub branch protection / whether land is the only *remote* writer in practice beyond script existence.
- Did not edit any doc or product code.
- Did not touch `density-pass-settled-positions.md`.

---

## 8. Bottom line for rat

1. **README “VERIFIED” list is no longer safe.** #3 graph enums and #4 `@bible` are **false**. #5 More/Research is **false for writing**.  
2. **`CODE_VERIFY.md` should be treated as contaminated** until rewritten against current `origin/dev` — it currently teaches the opposite of STANDING_RULES §21 and of the graph source.  
3. **Your pipeline edit is mostly sound:** `test:green` definition and no-worse land are real in `package.json` / `land.mjs`. **“Only land writes dev” is aspirational**, not exclusive. Coordinator-not-gate is process, not code.  
4. **`docs/E2E.md` is the worst agent foot-gun after CODE_VERIFY:** `networkidle` + `Manuscript` + `^Continuity$|^Running` will fail or hang against current product.  
5. **helpers.mjs still documents Research-as-More-menuitem** while product ships plain Research secondary — same false-affordance class in the harness contract.

Fixes intentionally not applied. Assign after you see the count.

— dromedary  
method: `git show origin/dev:…` only  
tree at write: `4a451cd` (re-fetch on absorb)
