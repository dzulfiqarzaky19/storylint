import type {
  Chapter,
  Fact,
  Lab,
  Mark,
  Project,
  Proposal,
  Sheet,
} from '../src/domain/types.ts'
import type { TranscriptEntry } from '../src/agent/types.ts'

const BEFORE = 'The lamp had been out for '
const FLAGGED = 'three days'
const AFTER =
  ', and Mara had not written it in the log. She told herself the harbour would notice before the ' +
  'keeper did, which was the kind of lie that kept a person climbing the stairs each evening.'

export const CHAPTER_BODY = BEFORE + FLAGGED + AFTER

const FLAG_START = BEFORE.length
const FLAG_END = FLAG_START + FLAGGED.length

export const chapter: Chapter = {
  id: 'ch-1',
  title: 'The Lighthouse Keeper',
  body: CHAPTER_BODY,
  craftTags: ['char-dev', 'setup'],
  revision: 4,
}

export const chapters: Chapter[] = [
  chapter,
  {
    id: 'ch-2',
    title: 'Salt and Rope',
    body: 'The tide came in under the pier and took the rope with it.',
    craftTags: ['plot-progress'],
    revision: 2,
  },
  { id: 'ch-3', title: 'What the Tide Left', body: '', craftTags: [], revision: 0 },
]

const maraFacts: Fact[] = [
  {
    id: 'fact-1',
    key: 'role',
    value: 'lighthouse keeper',
    statement: 'Mara Vance is the keeper of the Harbour Bell light.',
    claimKind: 'attribute',
  },
  {
    id: 'fact-2',
    key: 'lamp-outage',
    value: 'one day',
    statement: 'The lamp was out for a single day before Mara logged it.',
    claimKind: 'event',
  },
]

export const sheets: Sheet[] = [
  {
    id: 'sheet-mara',
    kind: 'character',
    name: 'Mara Vance',
    aliases: ['the keeper'],
    summary: 'Keeps the Harbour Bell light. Records everything except what matters.',
    notes: 'Clipped voice. Never explains herself twice.',
    facts: maraFacts,
  },
  {
    id: 'sheet-harbour',
    kind: 'world',
    name: 'Harbour Bell',
    aliases: [],
    summary: 'A working harbour whose light has guided the north run for eighty years.',
    notes: '',
    facts: [],
  },
]

export const marks: Mark[] = [
  {
    id: 'mark-1',
    severity: 'red',
    reason: 'Canon says the lamp was out for one day, not three.',
    sheetId: 'sheet-mara',
    factId: 'fact-2',
    span: { chapterId: 'ch-1', start: FLAG_START, end: FLAG_END, text: FLAGGED },
  },
]

export const proposals: Proposal[] = [
  {
    id: 'prop-1',
    fingerprint: 'fp-lamp-outage',
    status: 'pending',
    entityName: 'Mara Vance',
    sheetKind: 'character',
    targetSheetId: 'sheet-mara',
    targetFactId: 'fact-2',
    key: 'lamp-outage',
    value: 'three days',
    statement: 'The lamp was out for three days before Mara logged it.',
    claimKind: 'event',
    confidence: 0.82,
    source: { chapterId: 'ch-1', start: FLAG_START, end: FLAG_END, text: FLAGGED },
  },
]

export const lab: Lab = { boards: [], cards: [] }

export const project: Project = {
  schemaVersion: 2,
  title: 'The Harbour Bell',
  chapters,
  sheets,
  proposals,
  rejectedFingerprints: [],
  marks,
  researchNotes: [],
  lab,
}

export const transcript: TranscriptEntry[] = [
  { id: 't-1', role: 'user', text: 'Check this chapter against the canon.' },
  {
    id: 't-2',
    role: 'tool',
    tool: 'continuity',
    red: 1,
    yellow: 0,
    proposals: 1,
    mode: 'fixture',
  },
  {
    id: 't-3',
    role: 'assistant',
    text: 'One contradiction: the lamp outage runs three days here, but Mara’s sheet records one.',
  },
]

export const selection = { start: FLAG_START, end: FLAG_END, text: FLAGGED }

export const noop = () => {}
export const asyncNoop = async () => {}
