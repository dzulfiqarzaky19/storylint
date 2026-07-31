# 04 — Writing apps and IDE+agent patterns

**Scope:** what successful writing tools and coding IDEs teach Storylint.  
**Storylint relevance:** “VS Code + Claude, for your novel.”

---

## Two traditions Storylint joins

| Tradition | Heroes | Superpower | Failure mode |
|-----------|--------|------------|--------------|
| **Long-form writing suite** | Scrivener, Ulysses, iA Writer | Binder/project structure + focus drafting | Scrivener: cockpit overwhelm; pure focus apps: weak world model |
| **IDE + agent** | VS Code + Copilot/Claude-class sidebars | Clean editor + assistant with apply/diff discipline | Chat that overwrites; mystery AI panels; gen chips in the page |

Storylint’s bet: **Scrivener-scale project memory + iA-like sacred page + IDE apply discipline.**

---

## Lessons from writing software

### Scrivener-class (project manager for books)

**Steal**

- Binder as the spine of the project (chapters/docs as objects)
- Research/scratch areas that are **not** the manuscript
- Corkboard / card thinking for structure (Lab-adjacent)
- Compile/export as a deliberate exit, not the identity of the app

**Don’t steal blindly**

- Full always-on inspector clutter
- Deep preference mazes
- Teaching required before first sentence

**UX takeaway:** separate **planning/research objects** from **draft objects**. Storylint’s Lab vs Draft is the clean modern cut.

### Ulysses-class (library + clean draft)

**Steal**

- Fast resume into writing
- Groups/sheets with less chrome than Scrivener
- Markdown/plain portable feel

**Don’t steal**

- Assuming Apple-only mental model
- Under-powered continuity/world tools (our differentiator)

### iA Writer-class (focus sanctuary)

**Steal**

- Focus mode that truly removes chrome
- Typography and reading comfort as first-class
- No generative junk in the type column
- Paper-like calm (aligns with Kobo paper doctrine)

**Don’t steal**

- Minimalism that refuses project structure

**UX takeaway:** Focus is not a theme toggle; it is a **job mode** (J1 purity).

---

## Lessons from IDE + agent tools

### Sacred editor column

In VS Code-like tools, the editor is the product. Sidebars assist; they don’t own the buffer.

Rules that transfer:

1. **No gen widgets inside the prose surface**
2. Agent suggestions enter via **explicit Apply** (diff/card), not silent insert
3. Context is project-aware (@file / @chapter / @bible)
4. User can hide the agent and still work fully
5. Transcript + tool runs are inspectable (trust)

### Sidebar agent patterns that work

| Pattern | Why |
|---------|-----|
| Persistent companion rail | Always available, not a modal chatbot |
| Tool cards in transcript | Continuity/review results are objects, not chat vapor |
| Apply / Discard on proposals | Matches developer diff psychology authors already learn from IDEs |
| Context chips | User sees what the agent can see |
| Mode/faces for jobs | Write vs Check vs Inbox without leaving the rail |

### Sidebar agent patterns that fail

| Anti-pattern | Why |
|--------------|-----|
| Autopilot rewrite of the open doc | Destroys trust |
| Chat as only UI for structured results | Can’t Accept/Reject cleanly |
| Agent-only workflows with no manual path | Traps non-AI moments |
| Multiple competing AI panels | Fourth/fifth kingdoms |

---

## Sandbox vs production (Lab vs Draft/Canon)

Creative tools that let users experiment safely share a pattern:

| Zone | Rules |
|------|-------|
| **Sandbox** | Mess OK; not source of truth; easy discard |
| **Production** | Clean; versioned-in-spirit; gated entry from sandbox |

Analogues:

- Design: draft artboard vs published component
- Code: branch vs main
- Docs: scratch vs wiki
- Storylint: **Lab** vs **Draft/Canon**

Critical UX for sandbox exits:

- Exits are **named and few**
- Production entry is **reviewable**
- User is never surprised that sandbox became truth

Storylint exits (locked):

- Lab → Draft: **Send to Draft**
- Lab → Canon: **Promote to Canon** (still Accept)

---

## Binder + paper layout (proven shell)

The three-region shell is a known durable pattern:

```
binder | work surface | assistant/inspector
```

Why it works:

- Object navigation left (recognition)
- Creation center (flow)
- Help/meta right (optional)

Storylint already ships this. Research says: **keep it**, calm the top bar, don’t add a fourth permanent region.

---

## Reading comfort is UX, not skin

Long-session tools win on:

- Stable paper measure
- Reading profiles (day/sepia/night)
- Low chroma chrome
- Marks that don’t scream “error software”

Storylint’s Kobo paper direction matches best practice for multi-hour reading/writing better than “AI blue SaaS.”

---

## Competitive positioning (UX angle)

| User need | Typical tool | Storylint answer |
|-----------|--------------|------------------|
| Just write | iA / Docs | Draft + Focus |
| Organize book | Scrivener | Binder chapters + Canon sheets |
| Messy ideation | Notes apps | Lab |
| Continuity | Manual / memory | Continuity marks + Accept |
| AI help | ChatGPT tab | In-project companion with gates |
| World map | Obsidian-ish | Canon map (not a second app) |

UX risk: looking like **all of them at once** on first paint. Mitigation: journeys + progressive disclosure + three-ecosystem switch.

---

## Practical do/don’t for Storylint UI

**Do**

- Land writers in Draft fast
- Keep Lab clearly “not true yet”
- Keep agent apply/accept visible and boringly consistent
- Preserve Focus as a hard chrome kill switch
- Use binder groups labeled in user language

**Don’t**

- Put Research/Graph/Review as equal top ecosystems
- Auto-write manuscript or bible
- Teach via blocking wizard
- Let graph labels or filters become the product identity
- Trade paper calm for dashboard energy

---

## Sources

- Writing app comparisons and workflow breakdowns (Scrivener project manager vs Ulysses clean library vs iA focus sanctuary; 2024–2026 practitioner roundups)
- IDE+agent interaction norms: sidebar assistant, apply/diff, editor sanctity (VS Code / Copilot-class patterns)
- Sandbox vs production patterns in creative and engineering tools
- Storylint PRD one-liner and IA_MAP shell skeleton
