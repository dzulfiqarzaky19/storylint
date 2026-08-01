/**
 * Companion Check face — tool copy and hierarchy.
 *
 * UX rule: one primary job, progressive disclosure,
 * cut extraneous Continuity restatement. Continuity, Review and Craft share the
 * face; Continuity is the gate, Review and Craft are quiet coaching.
 *
 * Resting Check shows Continuity as the only primary control. Review and Craft
 * stay secondary with on-demand help (no always-on blurbs/legend cards).
 */

export type CheckToolId = 'continuity' | 'review' | 'craft'

export type CheckToolCopy = {
  id: CheckToolId
  /** Short face label on the run control */
  actionLabel: string
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
    what: 'Scans this chapter against accepted Canon. Only Continuity entry in the app.',
    when: 'When the draft may disagree with settled names, ages, relationships, or rules.',
    outcome: 'Marks on the page and proposals in Inbox. Nothing writes Canon until you Accept.',
    primary: true,
  },
  {
    id: 'review',
    actionLabel: 'Review',
    what: 'On-demand story coaching for plot pressure, culture, and gaps. Not Continuity.',
    when: 'When you want a second reader on the scene without changing Canon.',
    outcome: 'Findings stay in Companion as a Review card. Tag suggestions never auto-apply.',
    primary: false,
  },
  {
    id: 'craft',
    actionLabel: 'Craft',
    what: 'Scene craft coach: pressure, change, pacing — not bible contradictions.',
    when: 'When the scene moves but feels flat, or you want craft-tag ideas.',
    outcome: 'Findings stay in Companion as a Craft card. Tags apply only when you click Add.',
    primary: false,
  },
] as const

export function checkToolById(id: CheckToolId): CheckToolCopy {
  const tool = CHECK_TOOLS.find((entry) => entry.id === id)
  if (!tool) throw new Error(`Unknown check tool: ${id}`)
  return tool
}

export const CHECK_PRIMARY = checkToolById('continuity')
export const CHECK_SECONDARY = CHECK_TOOLS.filter((tool) => !tool.primary)
