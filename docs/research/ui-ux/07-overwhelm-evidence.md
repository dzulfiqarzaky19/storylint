# 07 — Overwhelm evidence pack

**Scope:** primary research + practitioner evidence on why UI overwhelms users, and what “good” complex-product UX does about it.  
**Storylint relevance:** power writing IDE that must stay calm by default.  
**Date:** 2026-07-31  
**Authority:** evidence for [01](./01-principles.md)–[06](./06-storylint-implications.md). Does not override [IA_MAP.md](../../IA_MAP.md).

---

## How to read this file

Each major source cluster has **~20 numbered data points** (findings, formulas, constraints, practices, or measured effects).  
Use them as **decision ammo**, not as sacred constants. Several effects are conditional (expertise, defaults, dominance of one option, time pressure).

**Product lens after every cluster:** what this means for Lab / Draft / Canon + Companion.

---

## Source cluster A — Cognitive Load Theory (Sweller lineage)

**Core refs**

- Sweller, J. (1988). *Cognitive Load During Problem Solving: Effects on Learning.* Cognitive Science, 12(2), 257–285.
- Sweller, van Merriënboer & Paas (1998). *Cognitive Architecture and Instructional Design.* Educational Psychology Review.
- Chandler & Sweller (1991/1992). Instruction format / split-attention studies.
- Paas & Van Merriënboer (1993). Relative condition efficiency (mental effort × performance).
- Wikipedia synthesis of CLT categories, effects, measurement (retrieved 2026-07-31).

### ~20 data points

1. **Working memory is the bottleneck.** Learning and task performance are constrained by limited concurrent WM capacity and short duration.
2. **Three load types (classic model):** intrinsic (task hardness), extraneous (how UI/materials present work), germane (schema-building effort).
3. **Design owns extraneous load.** Intrinsic load of “writing a novel / tracking continuity” cannot be wished away; chrome can.
4. **Additivity is imperfect.** Later work questions pure additive IL+EL+GL; types influence each other. Still useful as a design budget metaphor.
5. **Heavy load → errors and interference.** Under overload, people miss cues, use stereotypes/schemas poorly, and cut corners.
6. **Means–ends problem solving burns capacity.** Unstructured “figure out the app while writing” competes with actual writing.
7. **Worked-example effect:** showing completed paths (examples) often beats pure discovery for novices.
8. **Completion-problem effect:** partial scaffolds beat blank-slate discovery for many complex tasks.
9. **Split-attention effect:** forcing users to mentally integrate separated text + diagram (or marks + reason + action) raises extraneous load.
10. **Modality effect:** well-used dual channels (visual + auditory) can reduce overload vs stuffing one channel.
11. **Redundancy effect:** repeating the same info in poorly integrated forms can *increase* load.
12. **Expertise reversal:** scaffolds that help novices can slow experts. Power users need progressive depth, not permanent training wheels.
13. **Relative condition efficiency** combines mental-effort ratings with performance — design quality is not speed alone.
14. **Physiological correlates exist** (e.g. task-invoked pupillary response) but lab measures don’t always transfer cleanly to product analytics.
15. **Individual differences matter:** novices carry higher load on the same UI; experts chunk more.
16. **Elderly / children / low-experience users** often experience higher load for the same interface.
17. **Multitasking + social distraction** further reduces available WM for the primary task (classroom laptop/Facebook-class findings).
18. **Digital offloading** (search, notes, AI) can free WM *or* create illusion of knowledge / shallow encoding.
19. **Instructional implication for products:** structure the path so users spend WM on the *job* (story), not on decoding chrome.
20. **Storylint mapping:** Continuity marks + proposal cards + Inbox must stay spatially/temporally contiguous (mark ↔ reason ↔ Accept). Don’t split “finding” across top bar + chat vapor + graph filters at once.

### Practice rules derived

| Do | Don’t |
|----|-------|
| Cut extraneous chrome first | Add equal-weight buttons “for power” |
| Integrate related info (mark + card) | Force cross-screen mental glue |
| Scaffold novices; fade for experts | One dense cockpit for everyone always |
| Protect germane learning of Lab/Draft/Canon | Teach via blocking multi-step wizard |

---

## Source cluster B — Working memory limits (Miller → Cowan)

**Core refs**

- Miller, G. A. (1956). *The Magical Number Seven, Plus or Minus Two.* Psychological Review.
- Chase & Simon (1973). Chunking in chess perception.
- Cowan and later WM capacity work (often ~4 chunks for pure WM, context-dependent).
- Laws of UX — Miller’s Law summary (Yablonski).

### ~20 data points

1. Miller: immediate memory / absolute judgment often clusters around **7±2** items under classic conditions.
2. Modern caution: **do not treat “7” as a hard UI item cap** for every menu.
3. The durable lesson is **limited concurrent items**, not a magic number.
4. **Chunking** expands effective capacity by grouping into meaningful units.
5. Experts hold more because chunks are richer (chess masters, power authors with stable IA).
6. Phone numbers, nav groups, and binder sections work because of chunk structure.
7. Unstructured long lists force serial scanning → linear time, not “magical seven.”
8. Short-term store is fragile under interruption; users lose place easily.
9. Working memory ≠ long-term memory: recognition UI beats recall UI.
10. Icons without labels force recall of arbitrary mappings → load.
11. Face sets / ecosystems that stay small become learned chunks.
12. Too many simultaneous status chips exhaust scanning budget.
13. Forms and filters should stage fields (multi-step / sections) when many are required.
14. Visual grouping (Gestalt proximity/similarity) creates free chunks.
15. Hierarchy headers turn 30 actions into 4 groups × ~7 items.
16. “Everything visible” defeats chunking; “everything buried” defeats recognition.
17. Capacity varies by stress, sleep, age, novelty of domain.
18. Context switching flushes fragile WM contents (why Focus mode matters).
19. Product IA should present **few top chunks** users can name aloud.
20. **Storylint mapping:** top mental chunks = **Lab | Draft | Canon** (+ optional Companion). Binder groups should echo those labels. Companion faces stay a small learned set per context.

### Practice rules derived

- Prefer **3 ecosystems** over 6 peer modes (already locked).
- Group binder/actions under user language headers.
- Avoid unlabeled icon grammar in primary chrome.

---

## Source cluster C — Hick–Hyman Law (decision time vs choices)

**Core refs**

- Hick, W. E. (1952). *On the rate of gain of information.* QJEP.
- Hyman, R. (1953). Stimulus information and RT.
- Card, Moran & Newell (1983). *Psychology of Human–Computer Interaction.*
- Laws of UX — Hick’s Law; Parallel HQ 2026 synthesis; Wikipedia Hick’s law.

### ~20 data points

1. Decision/reaction time rises with number of alternatives.
2. Classic form: \(T = b \cdot \log_2(n + 1)\) for roughly equal options.
3. With unequal probabilities: \(T = bH\) (information entropy of the choice set).
4. Growth is **logarithmic**, not linear — doubling options does not double time, but still slows people.
5. Law is strongest for **unfamiliar, actively compared** choices.
6. Familiar / highly practiced choices shrink the effect (experts scan faster).
7. Stimulus–response compatibility speeds choices (control looks like outcome).
8. Exceptions: some verbal responses to familiar stimuli show weak n-dependence.
9. Exceptions: saccades can violate or reverse the simple law.
10. Random unordered word lists require **linear scan** — Hick’s log model does not magically apply.
11. Alphabetical / structured menus can enable subdividing strategies (~log time).
12. Grouping options into categories reduces effective n at each step.
13. Defaults reduce entropy (user can accept without full comparison).
14. Recommended/highlighted options shrink decision set psychologically.
15. Progressive disclosure reduces simultaneous n without deleting power.
16. Mobile needs stricter n reduction than desktop.
17. Startup bloated dashboards are a common Hick failure mode.
18. Measuring “a choice” in products is messy (lag, animation, network).
19. Myth to avoid: “always fewer steps” — one dense screen can be worse than three clear ones.
20. **Storylint mapping:** Draft · Lab · Canon is a low-n global switch. Continuity/Research/Export must not sit as equal n+ peers. Empty project: **two doors**, not a tool gallery.

### Practice rules derived

| Decision surface | Target simultaneous primary choices |
|------------------|--------------------------------------|
| Ecosystem switch | 3 |
| Empty project | 2 |
| Lab exits | 2 named |
| Companion faces (visible) | ≤ ~3–5 per context |
| Top-bar permanent actions | calm set only |

---

## Source cluster D — Choice overload / overchoice

**Core refs**

- Toffler, A. (1970). *Future Shock* — coins overchoice.
- Iyengar & Lepper (2000). *When choice is demotivating* (jam / essay classic).
- Scheibehenne, Greifeneder & Todd (2010). Meta-analysis: effect is conditional.
- Chernev, Böckenholt & Goodman (2015). Conceptual review + meta-analysis.
- Shah & Wolford (2007). Inverted-U satisfaction vs number of choices.
- Inbar, Botti & Hanko (2011). Decision speed and regret.
- Polman (2012). Choosing for others can reverse overload patterns.
- Gourville & Soman; Townsend & Kahn (visual vs verbal assortment).
- Laws of UX — Choice Overload.

### ~20 data points

1. **Overchoice:** too many roughly equal options can harm decision quality and follow-through.
2. Classic demotivation finding: larger assortments can reduce purchase / completion vs smaller curated sets.
3. Satisfaction vs n often follows an **inverted U**: none is bad, some is good, too many hurts.
4. Large sets can feel more enjoyable *during* browsing yet yield more **regret** after choosing.
5. Time pressure makes large sets feel worse and increases regret.
6. Preconditions: overload bites hardest when user has **no clear prior preference**.
7. Preconditions: no **clearly dominant** option in the set.
8. Preconditions: low familiarity/expertise with the domain.
9. Meta-analyses: effect is **not universal**; context and structure matter.
10. Filtering/search tools convert “compare 40” into “compare 3.”
11. Side-by-side comparison helps when comparison is necessary (pricing tiers).
12. Featured / recommended options reduce perceived set size.
13. Visual grids increase perceived variety (can help step 1 assortment pick, hurt step 2 item pick).
14. Verbal structure can reduce perceived complexity in large sets.
15. Responsibility feelings rise with larger sets → dissonance if choice feels wrong.
16. People may **defer choice entirely** under overload (no-purchase / no-promote).
17. Choosing for others can flip patterns (regulatory focus differences).
18. Economic assortment growth (historical brand explosion) correlates with longer decision times.
19. “Freedom of more choices” can become **unfreedom** (Toffler).
20. **Storylint mapping:** do not expose full power toolbox on first paint. Craft tags, graph filters, research pins, review tools = curated, job-timed sets. Promote paths stay **two exits**, not a promote mega-menu.

### Practice rules derived

- Curate defaults; put advanced behind intentional reveal.
- When many items must exist (chapters, sheets), rely on **binder structure + search**, not equal buttons.
- Avoid equal visual weight across rare and daily actions.

---

## Source cluster E — Information overload / filter failure

**Core refs**

- Gross / management literature 1960s; Toffler popularization 1970.
- Speier et al. (1999): input > processing capacity → lower decision quality.
- Roetzel (2019): time/resource framing of overload.
- Clay Shirky: “filter failure” framing (Web 2.0 era).
- Blair historical work: overload is old; organization is the recurring fix.
- Wurman “information anxiety”; Tufte organization/visual clarity tradition.
- Wikipedia *Information overload* synthesis (retrieved 2026-07-31).
- Coping literature: filtering, withdrawal, customize, save-for-later.

### ~20 data points

1. Overload = difficulty understanding/deciding when information exceeds processing resources.
2. Speier-class definition: input exceeds capacity → decision quality drops.
3. Roetzel: complexity + quantity + contradiction under scarce time/resources.
4. Causes include high production rate, easy duplication, many channels, low signal-to-noise.
5. Contradictions and inaccuracies force extra verification load.
6. Interruptions consume residual attention; recovery is incomplete.
7. Email is a canonical overload channel (volume + attachments + always-on).
8. Social feeds create “social information overload.”
9. Outcome overload = too many sources; textual overload = sources too long.
10. Search under overload becomes less systematic; people **satisfice**.
11. Coping: **filter** (criteria to ignore) and **withdraw** (fewer sources).
12. Coping: **customize/prioritize** and **save for later** (manage complexity, not only quantity).
13. Shirky: often the design problem is **filters**, not pure volume.
14. Organization underload (Wurman/Tufte angle): raw dumps feel like overload even at moderate volume.
15. Chartjunk / noise visuals add processing without decision value.
16. Attention economy dynamics amplify interruption load.
17. Multilevel phenomenon: individual, group, society mechanisms interact.
18. “Information anxiety” = gap between what is understood and what feels required.
19. Historical lesson: indexes, catalogs, taxonomies were invented as overload tech.
20. **Storylint mapping:** Companion is a **filter surface**, not another firehose. Inbox is the organization layer for pending truth. Research must be cards+citations, not chat sludge. Continuity summary counts beat raw log dumps.

### Practice rules derived

| Overload smell in Storylint | Fix |
|----------------------------|-----|
| Top bar as tool dump | Calm L0 set |
| Chat as only structured UI | Cards + Inbox |
| Graph filters as destinations | Filters with the map view |
| Always-on diagnostics while typing | On-demand Check |
| Duplicate project titles / statuses | Single identity + save state |

---

## Source cluster F — Progressive disclosure

**Core refs**

- Nielsen Norman Group — Progressive Disclosure (classic pattern article).
- Kristina Hooper Woolsey (1985) selective informing of system understanding.
- macOS print dialog “Show Details” archetype.
- UXPin / LogRocket practitioner taxonomies (conditional, contextual, staged, enabling).
- Wikipedia *Progressive disclosure* (retrieved 2026-07-31).
- Theme-park queue analogy: only a segment of complexity visible at once.

### ~20 data points

1. Definition: defer advanced/rare features until relevant.
2. Goal: easier learning + fewer errors without deleting power.
3. Secondary screens / “more” panels are legitimate homes for advanced controls.
4. Workflows should reveal info when the task needs it.
5. Classic example: simple print dialog → Show Details.
6. Physical analogy: queues hide total length to reduce abandonment anxiety.
7. Early HCI insight: give well-chosen bits that build a general system model.
8. Types used in practice: conditional, contextual, progressive enabling, staged.
9. Staged wizards help rare complex setup; hurt daily creative flow.
10. More than ~3 nested disclosure layers usually signals IA failure.
11. Hover-only disclosure fails accessibility and touch.
12. Hidden navigation improves calm but reduces discoverability — compensate with IA labels and empty states.
13. Defaults must complete the primary job without opening advanced UI.
14. Power should be **one intentional step** away, not zero and not seven.
15. Migration strategy: temporary dual entry while users learn the better home, then demote.
16. Mobile forces disclosure; desktop should still use hierarchy.
17. Face/tab sets are disclosure of *modes of help*, not new places.
18. Advanced filters belong with the view they affect.
19. Teaching should be embedded (empty states, first-run two doors), not blocking tours for writers.
20. **Storylint mapping:** max depth 3 is progressive disclosure as architecture. Companion faces = contextual disclosure. Continuity only in Check. Graph under Canon. Focus = hard hide of secondary chrome.

### Checklist (any new control)

1. Which journey (J1/J2/J3)?
2. Primary or secondary for that moment?
3. Can it live in companion / overflow / surface?
4. Does it add a nav level?
5. Can a new user ignore it and still succeed?

---

## Source cluster G — Split attention, contiguity, multimedia load

**Core refs**

- Chandler & Sweller split-attention experiments.
- Tarmizi & Sweller; Ward & Sweller worked-example diagram studies.
- Mayer multimedia principles: coherence, signaling, redundancy, spatial/temporal contiguity.
- Moreno & Mayer ambient sound / music as extraneous auditory load.
- Schroeder & Cenkci (2018) meta-analysis on spatial contiguity / split attention.

### ~20 data points

1. Separating mutually referring materials forces costly mental integration.
2. Integrated diagrams + text beat split layouts for learning/performance.
3. Learners in integrated conditions often spend less time and score higher.
4. Split attention is a major **extraneous load** mechanism.
5. Spatial contiguity: put related items near each other.
6. Temporal contiguity: present related pieces close in time.
7. Coherence principle: remove interesting but irrelevant fluff.
8. Signaling principle: cues that guide attention reduce search load.
9. Redundancy: duplicative poorly integrated streams can hurt.
10. Ambient music/noise can tax auditory channel during learning tasks.
11. Animation + on-screen text + narration can overload if poorly combined.
12. Chunked symbolic drawings improve recall vs unchunked displays.
13. Deaf/HoH classroom research shows visual split costs when attention must jump speaker ↔ materials.
14. Marks without nearby explanations recreate split attention.
15. Tool output in a distant panel from the affected object raises errors.
16. “Open three places to finish one Accept” is a product split-attention bug.
17. Progress + result should land in one understandable object (card).
18. Graph pending edges must not look true (false integration).
19. Sheet proposals should name target fields near the sheet context.
20. **Storylint mapping:** Continuity mark on Draft + proposal card + Inbox item must feel like one object family. Apply cards stay tied to chapter. Don’t require Graph open to understand a continuity hit.

---

## Source cluster H — Practitioner synthesis (Krug, Smashing, Laws of UX)

**Core refs**

- Steve Krug, *Don’t Make Me Think* (web usability classic).
- Danny Halarewich, Smashing Magazine (2016), *Reducing Cognitive Overload…*
- Mishra et al., IJRASET (2025), *Reducing Cognitive Load in UI Design* (review + small checkout experiment claims).
- Jon Yablonski, Laws of UX: Cognitive Load, Hick, Miller, Jakob, Doherty, Fitts, Peak-End, Tesler, Serial Position, Aesthetic-Usability, Choice Overload.
- Norman, *Design of Everyday Things*; Nielsen heuristics tradition.
- Tuch et al. (2012) visual complexity & first impressions (cited widely; users prefer simpler first looks).

### ~20 data points

1. **Don’t make me think:** each pause to decode UI steals WM from the goal.
2. Users **satisfice** — first reasonable path wins, then becomes habit.
3. Self-explanatory pages/screens beat multi-step orientation requirements.
4. Common overload causes: unnecessary actions, overstimulation, too many options, too much content, ambiguous UI, hard-to-find features, inconsistency.
5. Remove steps; autofocus and smart defaults compound.
6. Competing motion/color is multi-talker distraction.
7. Users often prefer simpler first impressions over complex visual density.
8. Chunk content; multi-step only when all fields are truly required.
9. Familiar affordances beat clever icons.
10. Onboarding should teach novel models, then get out of the way.
11. IA via card sort / tree test beats designer intuition alone.
12. Inconsistency (link styles, labels, patterns) causes micro-pauses that add up.
13. **Jakob’s Law:** users expect your app to work like apps they already know (binder+editor+assistant is legible).
14. **Doherty Threshold:** feedback under ~400ms keeps flow; else show progress.
15. **Fitts’s Law:** primary actions need adequate size/spacing/placement; ≥44px-class targets on touch.
16. **Peak-End Rule:** people remember peaks and endings — empty success (“0 issues”), clean Accept, Focus exit matter.
17. **Serial position:** first/last items in chrome/lists are better remembered — put primary ecosystems at strong positions.
18. **Tesler’s Law:** irreducible complexity must be paid by system or user — Storylint should pay (gates, defaults, IA), not authors mid-sentence.
19. **Aesthetic-usability effect:** calm paper UI increases perceived usability — and can mask real faults, so still test tasks.
20. Small controlled comparisons often show simplified flows faster and more satisfying (e.g. reported checkout simplifications ~25% faster / higher satisfaction in secondary reviews — treat magnitudes as directional, not universal constants).

### Seven Smashing-class failure modes → Storylint tells

| Failure | Storylint tell |
|---------|----------------|
| Unnecessary actions | Extra confirms on non-destructive nav |
| Overstimulation | Neon AI, multi-animation chrome |
| Too many options | Equal top buttons for rare tools |
| Too much content | Unscoped agent walls / research dumps |
| Ambiguous UI | Icon-only primary nav |
| Hard to find | Continuity only in folklore |
| Inconsistency | Accept means different things in different places |

---

## Source cluster I — Trust, gates, and AI-era load (product-critical)

**Core refs**

- Staged change analogues: PR review, CMS draft/publish, suggestion mode.
- Storylint PRD / gates doctrine + existing pack [05](./05-gates-and-trust.md).
- Emerging AI cognition concerns (deskilling / over-reliance literature summarized in CLT discussions).
- IDE+agent norms: apply/diff, editor sanctity.

### ~20 data points

1. AI raises **speed and blast radius** together.
2. Ungated writes convert help into corruption risk.
3. Trust compounds when machine proposes and human commits.
4. Proposals must be **objects**, not only chat sentences.
5. Pending work needs one durable place (Inbox).
6. Accept/Apply semantics must be stable across surfaces.
7. Preview reduces surprise load (span, diff, field list).
8. Edit-then-accept prevents reject spirals.
9. Empty success feedback is as important as findings.
10. Severity inflation (everything red) creates alarm fatigue.
11. Always-on shame chrome mid-draft raises extraneous load and avoidance.
12. Human-in-the-loop is a cognitive design, not only a safety policy.
13. Silent graph edges “as if true” create false mental models.
14. Lab sandbox without hard exits confuses truth state.
15. Double gate Lab→Canon (Promote + Accept) matches high-stakes truth.
16. Draft Apply can be lighter than Canon Accept because prose is editable.
17. Agent-only paths trap non-AI moments and raise dependency load.
18. Multiple competing AI panels create multi-kingdom overload.
19. Context chips reduce uncertainty about what the model can see.
20. **Storylint mapping:** keep Apply/Accept/Reject sacred; Companion faces by context; no gen chips in Draft type column; Research propose ≠ auto-canon.

---

## Source cluster J — Complex creative tools & IDE patterns (comparative practice)

**Core refs**

- Writing suites: Scrivener (project manager), Ulysses (library+draft), iA Writer (focus sanctuary).
- IDE+agent: VS Code editor sanctity + sidebar assistant + explicit apply.
- Sandbox vs production patterns (branch/main, draft/publish).
- Existing pack [04](./04-writing-ide-patterns.md).

### ~20 data points

1. Long-form tools fail by **cockpit overwhelm** (too much inspector always on).
2. Focus-only tools fail by weak project/world model.
3. Winning combo for Storylint class: project memory + sacred page + gated assistant.
4. Binder-as-spine is a recognition structure users already know.
5. Research/scratch must not silently equal manuscript truth.
6. Compile/export is an exit ritual, not identity.
7. Focus mode is a job mode, not a theme paint.
8. Editor column must remain free of generative widgets.
9. Sidebars assist; they don’t own the buffer.
10. Diff/apply psychology transfers from coding to prose co-write.
11. Users must be able to hide the agent and still work.
12. Transcript + tool runs support inspectability/trust.
13. Sandbox needs few named exits.
14. Production entry must be reviewable.
15. Three-region shell (nav | work | assist) is durable.
16. Fourth permanent region is usually a density smell.
17. Reading comfort (measure, paper profiles, low chroma) is multi-hour UX.
18. Competitive risk: looking like all tools at once on first paint.
19. Mitigation: journeys + disclosure + three-ecosystem switch.
20. **Storylint mapping:** keep shell; calm top bar; Lab vs Draft/Canon hard; Focus kills rails; no fourth ecosystem.

---

## Cross-source synthesis — mechanisms of overwhelm

| Mechanism | What users feel | Primary countermeasure |
|-----------|-----------------|------------------------|
| Extraneous cognitive load | “App is hard” while task is writing | Hierarchy, consistency, contiguity |
| Choice overload | Freeze at tool wall | Low-n defaults, curation, disclosure |
| Information overload | Can’t decide what matters | Filters, Inbox, summaries |
| Split attention | Ping-pong across panels | Keep cause/effect co-located |
| Decision time (Hick) | Slow every click | Fewer equal peers; group; defaults |
| Interruption / residual attention loss | Flow broken | Focus mode; fewer toasts; on-demand checks |
| Ambiguous models | “Is this canon?” | Lab/Draft/Canon language + gates |
| Trust uncertainty | Fear of AI writes | Explicit Apply/Accept objects |

---

## Storylint control budget (evidence → chrome)

| Altitude | Budget rule | Evidence basis |
|----------|-------------|----------------|
| **L0 Global calm** | Only controls needed most sessions | Hick + choice overload + J1 ≤5s |
| **L1 Job chrome** | Appears with ecosystem/job | Progressive disclosure contextual |
| **L2 On demand** | Check / Research / filters / export | Filter failure + expert fade |
| **L3 Gates** | Always explicit, never ambient auto | Trust + blast radius |

**L0 candidates (keep scarce):** binder toggle · project identity · save · Draft/Lab/Canon · Focus · theme · companion.

**Not L0:** Continuity, Review, Craft, Research, Graph filters, Export, New project, gen actions.

---

## Journey tests reinforced by evidence

| Journey | Evidence-backed success bar |
|---------|-----------------------------|
| **J1 Write** | First keystroke fast; no forced secondary kingdoms; Focus possible |
| **J2 Lab** | Mess allowed; truth model verbalizable; two exits only |
| **J3 Continuity** | Mark↔proposal contiguous; Accept path obvious; 0-issues trusted |

Dogfood scripts stay as in [06](./06-storylint-implications.md). Add quantitative probes when possible:

1. Time-to-first-keystroke (return visit)
2. Misclick rate on top bar
3. Time-to-first Continuity Accept
4. Pending Inbox age
5. % sessions using Focus
6. Promote→Accept conversion
7. Subjective mental effort (Paas-style 1–9) after each journey

---

## Anti-patterns blacklist (multi-source agreement)

1. Fourth ecosystem (Research/Graph/Review/Agent-as-place)
2. Equal-weight rare actions in top bar
3. Auto-apply / auto-accept
4. Gen chips in Draft type column
5. Hover-only identity for primary objects
6. Depth-4 dig paths for core jobs
7. Blocking wizard before writing
8. Diagnostics shame bar while typing
9. Pending graph edges drawn as truth
10. Chat-only structured results with no Inbox object
11. Duplicate orientation chrome (two titles, two homes for one tool)
12. “Simplify” that hides the only path without teaching

---

## Confidence & limits

| Claim class | Confidence | Note |
|-------------|------------|------|
| WM is limited; extraneous load hurts | **High** | Decades of CLT/HCI |
| More equal choices slow decisions | **High** | Hick + practice |
| Choice overload always hurts | **Medium** | Conditional (meta-analyses) |
| Exact “7 items” menu rule | **Low as hard law** | Use as chunking heuristic |
| Specific % gains from case studies | **Directional** | Context-bound |
| Storylint three-ecosystem lock | **High product fit** | Aligns with multiple mechanisms |

---

## Source index (URLs / citations used this pass)

1. Sweller (1988) Cognitive Science — CLT origin paper  
2. Sweller, van Merriënboer & Paas (1998) Educational Psychology Review  
3. Miller (1956) Psychological Review — 7±2  
4. Hick (1952) QJEP; Hyman (1953) JEP — Hick–Hyman  
5. Card, Moran & Newell (1983) — HCI models  
6. Iyengar & Lepper (2000) JPSP — choice demotivating  
7. Scheibehenne et al. (2010) JCR meta-analysis — choice overload conditions  
8. Chernev et al. (2015) J Consumer Psych — choice overload review  
9. Shah & Wolford (2007) Psych Science — inverted-U choices  
10. Speier et al. (1999) — information overload & decision quality  
11. Roetzel (2019) — overload time/resources framing  
12. Toffler (1970) *Future Shock* — overchoice / overload popularization  
13. Chandler & Sweller (1991/1992) — split attention / instruction format  
14. Mayer multimedia principles / Moreno & Mayer coherence work  
15. Schroeder & Cenkci (2018) Educational Psych Review meta-analysis — spatial contiguity  
16. Nielsen Norman Group — Progressive Disclosure; usability heuristics tradition  
17. Krug — *Don’t Make Me Think*  
18. Halarewich (2016) Smashing Magazine — cognitive overload practical taxonomy  
19. Yablonski Laws of UX — Cognitive Load, Hick, Miller, Jakob, Doherty, Fitts, Peak-End, Tesler, Serial Position, Aesthetic-Usability, Choice Overload  
20. Mishra et al. (2025) IJRASET — CLT UI review + simplification experiment claims  
21. Wikipedia entries retrieved 2026-07-31: Cognitive load; Overchoice; Hick’s law; Information overload; Split attention effect; Progressive disclosure  
22. Storylint locked docs: PRD, 03-ux, IA_MAP, design companion/lab  

---

## Bottom line

Overwhelm is not a taste complaint. It is a **resource failure**: limited working memory hit by extraneous chrome, excess equal choices, unstructured information, and split attention — then worsened by untrusted automation.

Good UI/UX for Storylint-class tools:

> **Pay complexity in the system (IA, defaults, gates, filters). Keep the author’s working memory for the story.**
