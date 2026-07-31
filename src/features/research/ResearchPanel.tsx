import { useState, type FormEvent } from 'react'
import type { Project, ResearchNote } from '../../domain/types.ts'
import type { ResearchResultItem } from '../../research/types.ts'
import { pinResearch, proposeResearch, requestResearch } from '../project/api.ts'
import { Badge, Button, EmptyState, Input } from '../../components/ui'
import './research.css'

/** Per-result decision busy: which control is writing (ox B local busy). */
type DecisionBusy =
  | { noteId: string; op: 'pin' | 'propose' }
  | null

export function ResearchPanel({
  project,
  onProject,
  beginMutation,
  trackMutation,
  assistantBusy = false,
  onRunningChange,
}: {
  project: Project | null
  onProject: (project: Project, generation?: number) => void
  beginMutation: () => number | null
  trackMutation: <T>(operation: Promise<T>) => Promise<T>
  /** One assistant one job: block Research QUERY while Continuity/agent runs. Pin/Propose are decisions. */
  assistantBusy?: boolean
  /** Report Research job running so other companion lanes can gate. */
  onRunningChange?: (running: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResearchResultItem[]>([])
  const [mode, setMode] = useState<'fixture' | 'live' | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // BG: decision writes get local Working… (Apply/ProposalCard shape). Never assistantBusy.
  const [decisionBusy, setDecisionBusy] = useState<DecisionBusy>(null)

  function setResearchRunning(next: boolean) {
    setRunning(next)
    onRunningChange?.(next)
  }

  async function search(event: FormEvent) {
    event.preventDefault()
    if (!query.trim() || running || assistantBusy || beginMutation() === null) return
    setResearchRunning(true)
    setError(null)
    try {
      const response = await requestResearch(query.trim())
      setResults(response.results)
      setMode(response.mode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Research failed')
    } finally {
      setResearchRunning(false)
    }
  }

  async function pin(note: ResearchNote) {
    // Author decision (ox B): local busy only. Query job stays on assistantBusy; pin does not.
    if (decisionBusy) return
    const generation = beginMutation()
    if (generation === null) return
    setDecisionBusy({ noteId: note.id, op: 'pin' })
    setError(null)
    try {
      onProject(await trackMutation(pinResearch(note)), generation)
    } catch (caught) {
      setResearchError(caught)
    } finally {
      setDecisionBusy(null)
    }
  }

  async function propose(note: ResearchNote) {
    // Author decision (ox B): local busy only — free while Continuity/agent jobs run.
    if (decisionBusy) return
    const generation = beginMutation()
    if (generation === null) return
    setDecisionBusy({ noteId: note.id, op: 'propose' })
    setError(null)
    try {
      onProject(await trackMutation(proposeResearch(note)), generation)
    } catch (caught) {
      setResearchError(caught)
    } finally {
      setDecisionBusy(null)
    }
  }

  function decisionActive(noteId: string, op: 'pin' | 'propose') {
    return decisionBusy?.noteId === noteId && decisionBusy.op === op
  }

  function decisionBusyOnCard(noteId: string) {
    return decisionBusy?.noteId === noteId
  }

  return (
    <div className="research-panel">
      <form className="research-panel__query" onSubmit={(event) => void search(event)}>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Research a custom, place, or motif…"
          aria-label="Research query"
        />
        <Button
          variant="primary"
          type="submit"
          disabled={running || assistantBusy || !query.trim()}
          aria-busy={running || undefined}
        >
          {running ? 'Working…' : 'Research'}
        </Button>
      </form>
      <p className="continuity-privacy">
        Live research sends this query and project sheet context to the configured endpoint.
        {mode ? ` Last run: ${mode}.` : ''}
      </p>
      {error ? <p className="project-error" role="alert">{error}</p> : null}

      {results.length === 0 ? (
        <EmptyState title="Research without chat clutter" hint="Results require citations. Pin notes or propose them to Canon; neither action auto-canonizes." />
      ) : (
        <div className="research-panel__results">
          {results.map((result) => {
            const cardBusy = decisionBusyOnCard(result.id)
            const pinBusy = decisionActive(result.id, 'pin')
            const proposeBusy = decisionActive(result.id, 'propose')
            return (
              <article className="research-card" key={result.id}>
                <div className="proposal-card__heading"><strong>{result.title}</strong><Badge>{mode}</Badge></div>
                <p>{result.summary}</p>
                <p className="continuity-privacy">Model-provided citations — Storylint has not fetched or verified these links.</p>
                <ul className="research-card__sources" aria-label="Sources">
                  {result.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                    </li>
                  ))}
                </ul>
                <div className="proposal-card__actions">
                  <Button
                    disabled={cardBusy}
                    aria-busy={pinBusy || undefined}
                    onClick={() => void pin(result)}
                  >
                    {pinBusy ? 'Working…' : 'Pin'}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={cardBusy}
                    aria-busy={proposeBusy || undefined}
                    onClick={() => void propose(result)}
                  >
                    {proposeBusy ? 'Working…' : 'Propose to sheet'}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {project && project.researchNotes.length > 0 ? (
        <section className="research-panel__pins" aria-labelledby="pinned-research">
          <h3 className="panel__label" id="pinned-research">Pinned notes</h3>
          {project.researchNotes.map((note) => <div key={note.id} className="research-pin"><strong>{note.title}</strong></div>)}
        </section>
      ) : null}
    </div>
  )

  function setResearchError(caught: unknown) {
    setError(caught instanceof Error ? caught.message : 'Research action failed')
  }
}
