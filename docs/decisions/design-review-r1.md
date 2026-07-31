<!--
  Tracked decision record (moved from e2e/output/design-review-r1.md).
  Author: ox
  Kind: design-review
  Decided: Round-1 accept/reject by surface @ 8911406; drives calm budget + density follow-ups
  Shots/probes stay under e2e/output/ (gitignored) — regenerable evidence.
-->

# Design review — round 1

**Reviewer:** ox (read-only)  
**dev head reviewed:** `8911406` (includes `5750714` density D3/D8/D9 + Continuity topbar removal)  
**Date:** 2026-08-01  
**Method:** code check + live UI probes + screenshots at **1440** and **390**, **dark** and **light**  
**Shots:** `e2e/output/design-review-r1/`  
**Probes:** `e2e/output/design-review-r1/probes.json`

---

## Verdicts (summary)

| Item | Commit / merge | Verdict |
|------|----------------|---------|
| Continuity leaves top bar | `8911406` / `27e3f49` | **ACCEPT** |
| D3 Lab filter dedupe | `5750714` / `019a727` | **ACCEPT** |
| D8 Desktop craft-tag collapse | `5750714` / `019a727` | **ACCEPT** |
| D9 Binder sheet park/restore | `5750714` / `019a727` | **ACCEPT** |

No reject on this round. Residual faults are listed below by user pain; none block these items.

---

## 1. Continuity removed from top bar — **ACCEPT**

**Ruling (not re-litigated):** Continuity is not a place. Top bar is places/wayfinding. Continuity lives under Companion **Check**.

### Execution check

| Expectation | Result |
|-------------|--------|
| Top bar has no Continuity control | **Pass.** Probe `hasContinuityButton: false`, `hasContinuityWord: false` on desktop + phone, light + dark. |
| Places remain: Draft · Lab · Canon | **Pass.** Ecosystem group present; pressed state on active place. |
| Binder · project · focus · theme · companion remain | **Pass.** Labels: Show/Hide binder, Project menu, Focus, Theme toggle, Companion. |
| Save still legible | **Pass as status, not a button.** `project-status` still renders Saved/Saving… (auto-save). Not a clickable Save control — correct for this product; do not treat absence of a Save *button* as a Continuity regression. |
| Continuity job not orphaned | **Pass.** `runContinuity` still wired; Companion writing faces include **Check**; Check body exposes **Run Continuity**, **Review**, **Craft**. |
| Check discoverable enough as sole entry | **Acceptable.** Desktop: Companion open → face row Chat · Write · **Check** · Research · Inbox. Empty-state tip on Chat still says “Run Continuity from Check.” Phone: same faces in drawer; Run Continuity visible on Check. |

### Evidence

- `dark-desktop-1440-draft-topbar.png` — places only on the right; no Continuity chip.
- `dark-desktop-1440-companion-check.png` — Check selected; Run Continuity / Review / Craft at foot of rail.
- `dark-phone-390-draft-topbar.png` / `light-phone-390-draft-topbar.png` — Draft·Lab·Canon kept; Continuity gone.
- `dark-phone-390-companion-check.png` — Check + Run Continuity in drawer.

### Nits (do not flip verdict)

1. **Check face is a cold empty panel** until the eye finds the footer actions. Works, but first-run confidence is weaker than a one-line prompt in the Check body (“Continuity marks this chapter; proposals land in Inbox”). Follow-up for companion faces polish, not a Continuity-removal fail.
2. **Phone face row wraps** (Inbox drops to a second line). Discoverability OK; density not. Track for companion / rail round 2.
3. **Phone topbar still clips** project name and can truncate Canon (`Ca` in shot). Continuity removal helped budget; clip remains a narrow-topbar fault (see ranked list).

---

## 2. D3 Lab filter dedupe — **ACCEPT**

| Expectation | Result |
|-------------|--------|
| Kind picker lives in composer | **Pass.** Empty lab: `composerKinds: 7`, `hasFilters: false`. |
| Filter appears only when cards exist | **Pass.** After one card: `hasFilters: true`, `filterMore: true`, filter chrome reads **All** + **Kinds**. |
| No duplicate full kind strip as always-on filter | **Pass.** Filter is All + overflow disclosure, not a second full chip row competing with composer by default. |

### Evidence

- `dark-desktop-1440-lab-empty.png` — composer kinds only.
- `dark-desktop-1440-lab-with-filter.png` — All · Kinds above composer; card on bench.
- `dark-phone-390-lab.png` / light lab shots — same pattern.

### Nit

- Composer still shows **seven** kind chips on every empty bench. Correct for create, still a dense strip. Acceptable for D3 scope (dedupe filter vs composer). Further quieting is optional later, not D3 fail.

---

## 3. D8 Desktop craft tags (≤5 + “n tags”) — **ACCEPT**

| Expectation | Result |
|-------------|--------|
| Desktop shows ~5 chips then overflow | **Pass.** Probe: five tag chips + dashed **`3 tags`** more control (`hasMore: true`). |
| Phone keeps full collapse | **Pass.** `disclosure: true`, summary **Tags**, collapsed by default; no desktop “n tags” chip on phone. |
| Reading still wins | **Pass.** Overflow is one control; body remains primary. Light + dark both fine. |

### Evidence

- `dark-desktop-1440-manuscript-tags.png` / light desktop tags — five + `3 tags`.
- `dark-phone-390-manuscript-tags.png` / light phone — `Tags +` disclosure only.

No reject. Optional later: active tags could sort first more aggressively when many actives exceed five (not verified as broken).

---

## 4. D9 Binder sheet park/restore — **ACCEPT**

| Expectation | Result |
|-------------|--------|
| Open sheet editor in Canon | **Pass.** `opened: true` (sheet “R1 Aria-…”). |
| Leave Canon → editor clears (binder not stuck in sheet form) | **Pass.** `duringDraft: false` (no Back-to-binder sheet chrome while on Draft). |
| Re-enter Canon → parked sheet restores | **Pass.** `afterReturn: true`; shot shows sheet editor + breadcrumb sheet name restored beside map. |

### Evidence

- `dark-desktop-1440-binder-sheet-open.png`
- `dark-desktop-1440-binder-after-leave-canon.png`
- `dark-desktop-1440-binder-after-return-canon.png` — editor restored with **Back to binder** + sheet fields.

Behavior matches density intent (park on leave, restore on re-enter). No reject.

---

## New / residual design faults (ranked by user pain)

These are **not** grounds to reject the four items above. They are the backlog signal for later rounds.

| Rank | Fault | Pain | Notes / owner hint |
|------|--------|------|--------------------|
| **P1** | **Canon map still reads as control panel** — Propose always open; kind filters compete with Network/Family | High on Canon entry | Spec ready: `docs/design/D4-CANON-MAP-CHROME.md`. Visible in binder-return shot. Do not blame D9. |
| **P2** | **Phone topbar truncation** — project title and Canon label clip (`Harbor Dr…`, `Ca`) | Medium on 390 every session | Continuity removal improved budget; still not calm. Ecosystem + icons + switcher fight one row. Round: topbar/rail budget. |
| **P3** | **Phone Companion faces wrap** — Inbox on second row; Check tools OK but chrome feels stacked | Medium on 390 Companion open | Companion faces / density round 2. |
| **P4** | **Check face empty middle** — Run Continuity only in footer; no orientation copy on Check itself | Low–medium first run | Easy copy win inside Check body; not a topbar regression. |
| **P5** | Lab empty composer = 7 equal kind chips | Low | Intentional create affordance; watch if Lab onboarding still feels loud. |

---

## Screenshot index

| File | What it shows |
|------|----------------|
| `dark-desktop-1440-draft-topbar.png` | Places-only topbar; craft `3 tags` |
| `dark-desktop-1440-companion-check.png` | Check sole Continuity entry |
| `dark-desktop-1440-lab-empty.png` | D3 empty: no filter row |
| `dark-desktop-1440-lab-with-filter.png` | D3 All + Kinds |
| `dark-desktop-1440-manuscript-tags.png` | D8 desktop collapse |
| `dark-desktop-1440-binder-*.png` | D9 park leave/return |
| `light-desktop-1440-*.png` | Light parity |
| `dark-phone-390-draft-topbar.png` | Phone places; truncation |
| `dark-phone-390-companion-check.png` | Phone Check + Run Continuity |
| `dark-phone-390-manuscript-tags.png` | D8 phone Tags disclosure |
| `dark-phone-390-lab.png` | D3 on phone |
| `light-phone-390-*.png` | Light phone parity |

---

## Round 1 close

**Ship standing:** Continuity topbar removal and density D3/D8/D9 are **design-accepted** on current `dev`.

**Next review (round 2), when landed:** companion faces (dolphin), rail budget (bear), canon map D4 (implementer on `storylint/canon-map-chrome`), binder/naming (octopus).

No code commits from this review.
