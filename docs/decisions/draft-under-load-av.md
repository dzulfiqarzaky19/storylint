# Design ruling — Draft under load (TASK AV)

**From:** ox  
**To:** rat · octopus · dolphin · badger  
**Status:** binding product answers (not a check redesign)  
**Evidence:** `e2e/output/draft-under-load-av.md` @ `170402a`  
**Cite:** companion-one-assistant · one-primary-door · empty/Inbox honesty

Density-pass measures; it does not invent Inbox IA. Two product calls below. Check honesty (B3 wrong surface) stays octopus/badger.

---

## 1. Inbox wall at 30 pending proposals

### What is wrong

- 30 cards × Accept/Edit/Reject in the first paint is a **decision wall**, not a calm queue.
- `scrollH === clientH` with 30 cards means the face **grows with content** instead of scrolling inside the rail. That is a **layout defect**, independent of batching IA.
- Chat clean is correct — proposals belong on Inbox only (check was wrong surface).

### Product answer (ordered)

| Priority | Move | Why |
|---|---|---|
| **P0 layout** | Inbox body **scrolls inside** the companion face. Fixed face chrome (tabs + optional header); list is the scrollport. Never grow the whole companion to fit N cards. | Without this, every density trick fails. Measure: `scrollH > clientH` when cards exceed fold. |
| **P1 orientation** | Quiet **summary line** when `pendingCount ≥ 1`: count + plain source hint if cheap (e.g. “12 pending · Continuity and Canon”). Not a second primary. | Author knows the job size before the first Accept. |
| **P1 density** | Prefer **~3–5 full cards in the fold**, rest via scroll. Card chrome stays Accept/Edit/Reject per item — **no bulk Accept**. | Canon acceptance is deliberate identity work. Batch-accept is a different product and a lie risk. |
| **P2 structure** | Keep **pack grouping** where `packId` already exists; optional quiet kind/section headers when many singles share a kind. Do not invent fake batches. | Structure over costume. |
| **Not now** | Cursor paging / “Load more” / virtualization until real books exceed ~50–100 pending *and* scroll+pack is insufficient. | 30 is a scroll problem, not a pager problem. |
| **Forbidden without new ruling** | **Accept all** / multi-select bulk Accept. | Settled world must not be batch-stamped. |

### What density-pass must not do

- Do not ship “summary dashboard Inbox” that hides Accept behind extra steps.
- Do not move proposals back into Chat to “clear” the wall.
- Do not raise calm thresholds to green-wash 30 solid action rows.

### Layout bug ownership

Treat `scrollH === clientH` at 30 cards as **implementable without IA redesign**. File with companion CSS / transcript scrollport. Product rule: **Inbox list is a scrollport; companion shell height is stable.**

---

## 2. Continuity ~20s and the one-assistant gate

### What AV proved

- Busy chrome honest the whole ~21.8s — no hang, no fake done. **Not a defect.**
- Live Continuity on long prose is **slow**. That is a characteristic, not a UI bug.
- Global gate means companion **mutation** is locked for that window. That interacts with author patience.

### Does this reopen single-lane vs parallel faces?

**No. One assistant, one job stands.** Do not add run ids. Do not run Chat/co-write/Research mutate beside Continuity.

AV is evidence to **sharpen the busy perimeter**, not to abandon the model.

### Busy perimeter (clarify / enforce)

| Allowed while Continuity runs | Blocked while Continuity runs |
|---|---|
| Switch companion **faces** (read Inbox, re-read Check status) | Start another companion **job** (Send, Run Continuity, co-write **generate**, Spark, Research **query**, Inspect agent ops) |
| **Scroll / read** any face | Second Continuity |
| **Author decisions:** Inbox Accept/Edit/Reject, Inbox **Apply**/Dismiss, Research **Pin** / **Propose to sheet** (local card/panel busy only) | Controls that **start** the agent/continuity/research-query pipeline |
| **Draft manuscript typing**, binder nav, place switch (Canon/Lab) | — |
| Idle composer **typing** before send (send still gated) | Send / Run |

**Lock axis = job vs decision (+ resource), not face layout.** Full table: `companion-lock-jobs-vs-decisions.md`. Rat confirmed; ox binding.

If code freezes **face tabs** or **Inbox decisions** (including Apply) for ~20s, that is **over-gating**. Do not invent parallel **jobs**.

### Two busy mechanisms — both correct (do not unify)

| Mechanism | Where | Gates | Verdict |
|---|---|---|---|
| **`assistantBusy`** | Face-level **job** controls | Send, cowrite generate, Spark, Review, Craft, Continuity, Research **query** | Correct global one-job gate |
| **Per-card / local `busy`** | ProposalCard, ApplyCard, decision buttons | That control’s in-flight **author write** only | **Correct and deliberate** for Accept **and** Apply **and** Pin |

**Do not** put Apply on `assistantBusy` because it “writes.” Accept also writes (Canon). Same shape → same lock class (local).  
**Do not** “tidy” ProposalCard local busy into `assistantBusy`.  
**Do not** define the perimeter by which rail the button sits in.

Research **query** raises `researchRunning` both ways. Pin/Propose after results do **not** hold the Continuity job lock.

### What we will not do

- Parallel Continuity + Chat to “use the 20s.”
- Fake progress that implies partial Canon results.
- Dropping global busy because latency is high — speed work is model/backend; chrome stays honest.

### Optional later (separate tips)

- **Cancel Continuity** control while running (author reclaim). New small product slice; not required to close AV.
- Backend/fixture performance — out of density-pass.
- Busy copy hygiene: avoid stacked “Continuity is working… Working…” if both read as peers (one primary busy string + one secondary detail — AL-4).

### Timing evidence disposition

Record AV ~20s as **known Continuity cost on long chapters**. Use it to defend:

1. honest full-duration busy,  
2. correct non-mutation allowances during busy,  
3. **not** multi-run companion architecture.

---

## Non-goals this ruling

- No Inbox redesign sprint inside check-fix PR.  
- No Continuity latency SLA from ox.  
- No craft-tag ceiling change (domain 8 is fine; B4 at ceiling OK).

## Implementation split

| Owner | Work |
|---|---|
| octopus / companion | Inbox **scrollport** + optional count summary; verify face switch + Inbox decide during Continuity |
| dolphin | Confirm busy gate matches perimeter table (AL model) |
| badger / octopus | B3 measures **Inbox** wall, not Chat; scroll signal = list scrollport |
| ox | Eye when Inbox density tip lands |

— ox | scroll the queue; don’t bulk-accept Canon; one job stands; don’t freeze author decisions
