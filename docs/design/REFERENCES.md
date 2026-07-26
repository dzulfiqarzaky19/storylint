# Design references (for agents who don’t “know” the tools)

Agents must **not** rely on training-memory aesthetics (“make it look like Obsidian”).  
Use this file: **what the pattern is**, **official URL**, **how it maps to OUR tokens**.

**Skin = [TOKENS.md](./TOKENS.md) only.**  
**Pattern = below.**

---

## 1. Obsidian — “Focus” + later “Graph”

### Focus (editor-first chrome)

| | |
|--|--|
| **What people mean** | Hide sidebars / UI chrome; mostly the note; calm dark editor; write without binder noise |
| **Product docs** | [Help: Interface](https://help.obsidian.md/User+interface/Workspace/Appearance) · [Help home](https://help.obsidian.md/) · site [obsidian.md](https://obsidian.md/) |
| **Focus-related** | User toggles to reduce panes; tab/header minimal — see workspace/appearance docs above (UI evolves; don’t scrape hex from screenshots) |
| **Community context** | Forum/themes exist; **do not copy third-party theme hex** into Storylint |

### What Storylint steals (behavior only)

| Pattern | Our implementation |
|---------|-------------------|
| Focus = chrome away | **Focus mode** in [03-ux.md](../03-ux.md): hide binder + agent; manuscript full width |
| Calm dark editor | `color.canvas` / `color.surface` / `color.text` + `text.manuscript` from TOKENS |
| Local plain writing feel | Clean manuscript slot; no gen chips in editor |

### What Storylint does **not** steal

- Obsidian’s exact greys, purple accent, or community themes  
- Plugin DIY empty vault as onboarding  
- Their pricing/sync UI  

### Graph (P4 only — relationship canvas)

| | |
|--|--|
| **What people mean** | Network of notes/entities; click node to open; see who links to whom |
| **Docs** | [Obsidian Graph view](https://help.obsidian.md/plugins/graph) (URL/title may move — search “Obsidian graph view” on help.obsidian.md if needed) |
| **Our mapping** | Nodes = sheets (portrait/icon when set); edges = accepted relationship facts (father_of, member_of, …); skin = TOKENS; not their theme |

### If an agent has never used Obsidian

Read the URLs above for **interaction intent**, then implement Focus mode + TOKENS (graph only in P4).  
**Do not** open DevTools on obsidian.md and paste colors.

---

## 2. VS Code + Claude / Cursor — agent panel

| | |
|--|--|
| **What people mean** | Clean code editor center; **AI chat/tools in a side panel**; apply/accept diffs; project context |
| **VS Code** | [code.visualstudio.com](https://code.visualstudio.com/) · [Docs](https://code.visualstudio.com/docs) |
| **Claude in VS Code / Claude Code** | [Claude Code overview](https://docs.anthropic.com/en/docs/claude-code) · [code.claude.com](https://code.claude.com/) (product surface evolves — prefer official docs) |
| **Cursor** (same IA family) | [cursor.com](https://cursor.com/) |

### What Storylint steals

| Pattern | Ours |
|---------|------|
| Editor sacred | Manuscript center |
| Agent first-class sidebar | Agent panel (hideable, not ashamed) |
| Apply / accept | Apply → MS; Accept → bible ([04-agents.md](../04-agents.md)) |
| Diagnostics | Continuity marks via `color.markYellow` / `color.markRed` only |

### What we don’t steal

- VS Code blue exact hex, workbench layout pixels  
- Copilot inline ghost-text as P1 default in the manuscript  

---

## 3. Novelcrafter — codex while writing

| | |
|--|--|
| **Site** | [novelcrafter.com](https://www.novelcrafter.com/) |
| **Pattern** | Codex (characters/lore) + chapters/scenes; peek entity while drafting |

### Steal / don’t

- Steal: **codex concepts**, chapter/scene binder, context while working  
- Don’t: dense permanent dual sidebars as only mode; their brand colors  

Map chrome to `color.surface`, rails `size.binderWidth` / `size.agentWidth`.

---

## 4. Sudowrite — co-write capability location

| | |
|--|--|
| **Site** | [sudowrite.com](https://www.sudowrite.com/) |
| **Pattern** | Strong gen/brainstorm tools |

### Steal / don’t

- Steal: **skills** (continue, rewrite, brainstorm) **inside agent panel** (P1b)  
- Don’t: gen cockpit **inside** the manuscript column  

---

## 5. Calliope — continuity seriousness

| | |
|--|--|
| **Site** | [writecalliope.ink](https://writecalliope.ink) |
| **Pattern** | Companion that cares about continuity; human owns final prose by default |

### Steal / don’t

- Steal: continuity as a real job; human Apply/Accept ownership  
- Don’t: “AI must never co-write” as ideology (we allow Apply from agent panel)  

---

## 6. Novlr / calm type column

| | |
|--|--|
| **Site** | [novlr.org](https://www.novlr.org/) |
| **Pattern** | Distraction-light drafting surface |

Map: manuscript tokens + focus mode — not their marketing palette.

---

## Quick agent checklist

Before styling anything:

1. Open [TOKENS.md](./TOKENS.md) — pick token **names**  
2. If pattern name appears (“Obsidian focus”) → this file → behavior table  
3. Implement with `src/design/tokens.css` / ui primitives (when they exist)  
4. No `bg-[#…]`, no default Tailwind `slate-500` for brand surfaces  

### Wrong

```tsx
// BAD — hard-coded / memory palette
<div className="bg-[#1e1e1e] text-purple-400" />
<div style={{ background: '#0f1115', color: '#c9a227' }} />
```

### Right

```tsx
// GOOD — tokens only (class names must be wired from TOKENS)
<div className="bg-canvas text-accent" />
// or
div style={{ background: 'var(--color-canvas)', color: 'var(--color-text)' }}
```

Marks:

```tsx
// GOOD
mark style={{ background: 'var(--color-mark-yellow-bg)', borderBottomColor: 'var(--color-mark-yellow)' }}
```
