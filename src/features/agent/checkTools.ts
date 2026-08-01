/**
 * Companion Check face — tool copy and hierarchy.
 *
 * Research bar (docs/research/ui-ux): one primary job, recognition over recall,
 * progressive disclosure for secondary tools. COMPANION.md: Continuity · Review ·
 * Craft as a short tool list (one line each), not three equal bare buttons.
 *
 * Continuity is the only gate-producing check. Review and Craft are panel-only
 * coaching and must never be read as Continuity synonyms.
 */

export type CheckToolId = 'continuity' | 'review' | 'craft'

export type CheckToolCopy = {
  id: CheckToolId
  /** Short face label on the run control */
  actionLabel: string
  /** One-line recognition under the tool name */
  blurb: string
  /** Popup: what it is */
  what: string
  /** Popup: when / where to use it */
  when: string
  /** Popup: what happens after run */
  outcome: string
  /** Hierarchy: only Continuity is the Check primary */
  primary: boolean
}

/** Locked user-facing Check tool list (order = visual order). */
export const CHECK_TOOLS: readonly CheckToolCopy[] = [
  {
    id: 'continuity',
    actionLabel: 'Run Continuity',
    blurb: 'Find contradictions against accepted Canon.',
    what: 'Continuity scans this chapter’s prose against accepted Canon facts. It is the only Continuity entry in the app.',
    when: 'Use when the draft may disagree with settled world truth — names, ages, relationships, established rules.',
    outcome: 'Findings land as marks on the page and proposals in Inbox. Nothing writes Canon until you Accept.',
    primary: true,
  },
  {
    id: 'review',
    actionLabel: 'Review',
    blurb: 'Story coaching: plot, culture, gaps.',
    what: 'Review is an on-demand story panel. It coaches plot pressure, cultural clarity, and world gaps. It is not Continuity.',
    when: 'Use when you want a second reader on the scene — resistance, custom, missing world detail — without changing Canon.',
    outcome: 'Findings stay in Companion as a Review card. Optional craft-tag suggestions never auto-apply.',
    primary: false,
  },
  {
    id: 'craft',
    actionLabel: 'Craft',
    blurb: 'Scene craft: pressure, change, tags.',
    what: 'Craft is a scene-level craft coach. It looks at character pressure, change, and pacing — not bible contradictions.',
    when: 'Use when the scene moves but feels flat, or you want craft-tag ideas for this chapter.',
    outcome: 'Findings stay in Companion as a Craft card. Suggested tags only apply when you click Add.',
    primary: false,
  },
] as const

export function checkToolById(id: CheckToolId): CheckToolCopy {
  const tool = CHECK_TOOLS.find((entry) => entry.id === id)
  if (!tool) throw new Error(`Unknown check tool: ${id}`)
  return tool
}
