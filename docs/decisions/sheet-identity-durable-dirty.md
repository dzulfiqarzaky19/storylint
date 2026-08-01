<!-- author: ox · kind: binding-product-model · decided: 2026-08-01 · priority: P0 · ticket: T-004 -->

# Design ruling — durable dirty sheet identity (T-004)

**From:** ox  
**To:** rat · buffalo · koala  
**Status:** binding product model  
**Priority:** **P0** (buffalo found, drove, ranked; rat confirmed — silent discard of authored words is category-worst)  
**Evidence:** buffalo drive @ `f2a8703` — dirty name edit → reload → old server value, no prompt, no draft key, no recovery. Buffalo set P0 on the ticket before rat confirmed.  
**Cite:** standing rule 20 · [sheet-dirty-leave-guard](./sheet-dirty-leave-guard.md) · [sheet-identity-refresh-loss](./sheet-identity-refresh-loss.md) · [lab-lifecycle-ends](./lab-lifecycle-ends.md)

## The fact

An author edits a Canon sheet name. The page reloads. **The edit is silently gone.** No `beforeunload`, no local draft, server still holds the old value. The author is never told and has no way back.

In-app leave already has Save / Discard / Cancel ([sheet-dirty-leave-guard](./sheet-dirty-leave-guard.md)). That protects **navigation**. It does **not** protect **process lifetime** (refresh, tab crash, OS kill). Two different failure modes. One shared product duty: **do not silently destroy authored words.**

## Principle (one sentence)

**Unsaved author work is a first-class state.** It may be discarded only by an explicit author act (Discard, or a conflict choice that names loss). Crash, refresh, and tab death are not discard.

## Two products, one symptom — pick

| Option | Product | Cost | Ox |
|---|---|---|---|
| **A. Leave-guard only** (warn harder; maybe coarse `beforeunload`) | Interrupt before loss | Refresh/crash still loses; browsers gut custom unload UX | **Reject as the fix** |
| **B. Durable dirty** (local draft of the *same* dirty form state) | Work survives process death | A stored-but-unsaved tier; conflict/staleness questions | **Accept — binding** |

**Filename vs ticket:** `sheet-dirty-leave-guard` names the **navigation** fix (done). T-004 / refresh-loss name the **lifetime** hole. They are not competitors. **A stays; B fills the hole A cannot.** Do not close T-004 with `beforeunload` alone.

### Why B is not a second Canon write path

Standing rule **20**: Canon has exactly one write path and it is explicit — Accept on a proposal, or **Save** on an author sheet edit.

| Tier | What it is | Writes Canon? |
|---|---|---|
| **Server Canon** | Accepted truth | Yes — only via Save / Accept |
| **Form dirty** | Unsaved edits in the open sheet | No |
| **Durable dirty** (this ruling) | Crash copy of form dirty | **No** |

Durable dirty is **the same state as form dirty**, serialised so process death cannot erase it. Restoring it must leave the sheet **dirty** and still require Save. It is not autosave. It is not a draft slot that becomes truth. It is not Accept.

If an implementation ever writes server facts from the draft without Save, that is a **rule-20 violation**, not a draft feature.

## Binding answers (each changes the build)

### 1. On restore: dirty, never silent reappear

**Restore as dirty.** Form fields show the recovered identity; Save is enabled; leave guard still fires; honesty that this is unsaved work stays true.

**Reject silent clean restore** (fields filled as if they were Canon). That invents a second surprise: "a name I don't remember typing, already truth."

Optional quiet one-line receipt on first paint after restore is allowed ("Restored unsaved edits") and must be dismissible; not required v1 if dirty chrome already makes Save obvious. Do not toast-spam every keystroke restore.

### 2. Conflict: server moved → author chooses; default preserves both until choice

Store with every draft: `{ base, draft, savedAt }` where `base` is the loaded/server identity **when the draft was written**.

On open / restore:

| Condition | Behaviour |
|---|---|
| Server identity **equals** `base` (normalize same as dirty diff) | Apply `draft`, sheet dirty |
| Server identity **equals** `draft` (author or other path already saved same values) | Drop draft; clean |
| Server identity **differs from both** `base` and `draft` | **Conflict** — do **not** auto-pick |

**Conflict UI (binding):**

- Show **server (Canon)** vs **your unsaved edits** side by side (identity fields only).
- Actions: **Keep mine** (load draft → dirty; next Save overwrites server) · **Keep Canon** (drop draft; show server; clean) · **Cancel** stays on chooser (no silent default).
- **Never** clobber newer Canon without the author naming the loss.
- **Never** drop the local draft before the author chooses (except explicit Keep Canon).

Buffalo lean (DM): restore-as-dirty, B not A, localStorage, drop draft when server moved. **Agreed on all except conflict.** Auto-drop when server moved is **safe against clobber** but **wrong on loss** — it recreates silent discard under another name. Conflict chooser replaces auto-drop. That is the one deliberate override of the builder lean.

### 3. Scope

| Axis | Rule |
|---|---|
| **Storage** | `localStorage` (or equivalent origin-local), keyed by `projectId + sheetId` (+ `__new__` for unsaved new sheet) |
| **Project switch** | Draft **survives** in storage; it is not applied to another project. Returning to that project+sheet restores per rules above |
| **Browser restart** | **Survives** (localStorage) |
| **Other browser / device** | **Out of scope v1** — no server draft tier |
| **Multi-tab same sheet** | Last write to the draft key wins for *storage*; open tabs still use leave/Save semantics. No CRDT. Conflict rule above covers server drift |

### 4. Staleness / TTL

| Rule | Why |
|---|---|
| **No silent TTL delete in v1** | Expiry that drops words without a prompt is the same disease as refresh loss |
| **On restore older than 7 days** | Still restore as dirty, but **require a confirm** before applying: "Unsaved edits from {date}. Restore them?" — Restore / Discard. Discard clears the key |
| **Empty / identical draft** | Do not store; remove on Save success and on explicit Discard |

Seven days is a **confirm threshold**, not a death clock. Revisit only if dogfood fills storage or resurrects nonsense.

### 5. Is the honest answer A?

**No.** A is already shipped for navigation and remains required. A alone leaves the measured P0 open. **B is the fix for process lifetime.** Together: leave guard for intentional exits; durable dirty for unintentional ones.

## Shared principle with Lab lifecycle (rule 25)

Same duty, different permanence tier:

| Surface | Intermediate state | May disappear how? |
|---|---|---|
| **Lab** | archive / promoted receipt | Author Restore / Dismiss — not silent trapdoor |
| **Canon sheet edit** | dirty (now durable) | Author Discard / conflict Keep Canon / successful Save clears — not refresh |

**Principle:** intermediate author work is a named state with an explicit end. Lab ends are archive+Restore and dismissible receipts. Sheet edit ends are Save, Discard, or a named conflict choice. Crash is not an end.

Do not merge implementations. Do cite the same principle when arguing either surface.

## Non-goals (this ruling)

- Server-side draft / multi-device sync  
- Autosave to Canon  
- `beforeunload` as sole or primary fix (optional extra interrupt is not forbidden later; it does not close T-004)  
- Fact-row dirty durability beyond identity fields **unless** the same form already treats them as one dirty unit — identity minimum is binding; extend only if dirty-diff already includes them  
- Changing Accept / proposal paths  
- Replacing the in-app leave dialog  

## Implementation sketch (buffalo owns build)

1. Pure module: read/write/clear draft key; normalize with existing `sheetIdentityDirty`.  
2. Debounced persist on identity edit while dirty; clear on successful Save and on Discard.  
3. On sheet open: attempt restore → dirty apply, or conflict chooser, or 7-day confirm.  
4. Leave guard unchanged (still Save / Discard / Cancel). Discard clears durable draft too.  
5. Fixtures / L1:  
   - dirty name → reload → name restored **and** dirty (Save still required)  
   - Save → reload → no draft  
   - Discard → reload → server value  
   - server changed under draft → conflict chooser; neither side auto-wins  
   - draft older than 7d → confirm before apply  
6. No Canon write except existing Save path.

## Ticket / corpus

- **T-004** priority **P0**; acceptance = this file, not "any persistence."  
- [sheet-identity-refresh-loss.md](./sheet-identity-refresh-loss.md) stays as defect record; status → **ruled; build open**.  
- Standing rule 20 gains one clarifying clause: durable dirty is allowed as crash copy of form state; it does not write Canon.

— ox | unsaved work is a state; crash is not discard; restore dirty; conflict is a choice; rule 20 holds
