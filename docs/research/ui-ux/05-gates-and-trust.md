# 05 — Gates, trust, and staged changes

**Scope:** UX for propose → review → apply/accept → done.  
**Storylint relevance:** Apply / Accept / Reject are product identity, not chrome nits.

---

## Why gates exist

AI and automation increase **speed** and **blast radius** at the same time.

Without gates:

- Canon corrupts quietly
- Users stop trusting suggestions
- Undo becomes archaeology
- “Helpful” feels hostile

With gates:

- Machine proposes, human commits
- Review is a first-class moment
- Trust compounds across sessions

Storylint one-liner depends on this: **you accept what becomes real.**

---

## Staged change model (universal)

```
Idea / analysis
    → Proposal (pending, reversible)
        → Human decision
            → Apply/Accept (commits)
            → Edit then accept
            → Reject/Dismiss (discard)
```

This is the same family as:

- Git PR review
- CMS “draft → publish”
- Design “suggest edit → approve”
- Docs “suggestion mode”

Authors who know IDE tools already understand **Apply**. Authors who know editorial tools understand **Accept**. Use both words where they match the target:

| Target | Verb |
|--------|------|
| Manuscript body | **Apply** |
| Canon / bible facts | **Accept** |
| Lab card elevation | **Send** / **Promote** then Accept if canon |

Don’t invent a third commit verb without need.

---

## Trust requirements for gates

### 1. Proposals are objects

Not only chat sentences. Cards with:

- What will change
- Where it will land (chapter vs sheet)
- Why / source (continuity span, research cite, lab card)
- Actions: Accept / Edit / Reject (or Apply / Dismiss)

### 2. Pending is visible in one place

Inbox pattern:

- User always knows where to clear debt
- Pending count can badge, but not shame
- Empty inbox is a success state

### 3. No partial silent commit

Accept means the stated change landed.  
Reject means nothing landed.  
Never “half-wrote the sheet and also tweaked the chapter.”

### 4. Preview beats surprise

Where possible show:

- Span highlight for continuity
- Diff-ish summary for co-write Apply
- Sheet fields that will be created/updated

### 5. Edit path exists

Binary only Accept/Reject is brittle. **Edit then Accept** prevents reject spirals and keeps user agency.

### 6. System status during runs

Continuity/review running must show progress and completion summary (counts, empty success). Flaky empty results destroy confidence (Storylint S3 class faults).

---

## Severity and tone

Diagnostics in creative tools should inform, not humiliate.

| Severity | Use | UI tone |
|----------|-----|---------|
| Red | Hard contradiction / break | Clear, rare, actionable |
| Yellow | Soft conflict / check | Notice, not alarm spam |
| Info | Suggestion | Easy to ignore |

Avoid always-on “shame bars” while typing. On-demand check (Storylint craft/continuity posture) matches best practice for deep work tools.

---

## Copy patterns that build trust

**Good**

- “Nothing is canon until Promote → Accept.”
- “Apply inserts into the chapter. Undo by edit.”
- “3 proposals ready in Inbox.”
- “Last Continuity: 0 issues found.”

**Bad**

- “AI updated your bible.”
- “Fixed automatically.”
- “You have failures.” (for soft craft notes)
- Mystery toasts with no object to open

---

## Placement of gate UI

| Pattern | Pros | Cons |
|---------|------|------|
| Inline on page | Fast for marks | Can clutter Draft |
| Companion transcript cards | Tied to run history | Can scroll away |
| **Inbox face** | Durable queue | Needs discoverability |
| Modal confirm every time | Safe | Fatiguing if overused |

Best combo for Storylint-class apps:

- Inline marks for orientation  
- Cards at creation time  
- **Inbox** as durable queue  
- Modals only for destructive rare ops  

---

## Lab promote is a double gate (correct)

Lab mess must cross **two** trust boundaries when becoming canon:

1. **Promote** = “I’m elevating this out of sandbox”  
2. **Accept** = “This is true in the world”

Draft send can be single-step into a stub (still user-initiated), because Draft is editable prose, not settled truth. Canon needs the harder gate.

Locked navigation:

- Send to Draft → jump to stub  
- Promote to Canon → stay in Lab; Accept in Inbox  

That matches sandbox psychology: keep flowing in Lab while canon review queues.

---

## Anti-patterns

- Auto-apply agent text into manuscript  
- Auto-accept high-confidence facts into bible  
- Accept buttons that don’t say the target  
- Pending edges drawn as if true (graph)  
- Mixing Apply and Accept on the wrong target  
- Gate actions only in ephemeral chat scroll  
- Blocking the whole app on one proposal  

---

## Evaluation checklist

A gated flow is good if a user can answer:

1. What is being proposed?  
2. What becomes true if I confirm?  
3. Can I change it first?  
4. Where do I find pending items later?  
5. What happens if I ignore it? (safe no-op)

If any answer is fuzzy, fix copy or IA before adding more AI power.

---

## Sources

- Staged review patterns from PR/suggestion UIs (propose → review → merge)
- CMS draft/publish and editorial suggestion-mode norms
- Trust/UX guidance for AI features: human control, visible state, reversible defaults
- Storylint PRD Accept boundary + IA_MAP gates table
