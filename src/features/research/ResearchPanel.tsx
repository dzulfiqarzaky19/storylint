import { useState, type FormEvent } from 'react'
import type { Project, ResearchNote } from '../../domain/types.ts'
import type { ResearchResultItem } from '../../research/types.ts'
import { pinResearch, proposeResearch, requestResearch } from '../project/api.ts'
import { Badge, Button, EmptyState, Input } from '../../components/ui'
import './research.css'

export function ResearchPanel({
  project,
  onProject,
  beginMutation,
  trackMutation,
}: {
  project: Project | null
  onProject: (project: Project, generation?: number) => void
  beginMutation: () => number | null
  trackMutation: <T>(operation: Promise<T>) => Promise<T>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResearchResultItem[]>([])
  const [mode, setMode] = useState<'fixture' | 'live' | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(event: FormEvent) {
    event.preventDefault()
    if (!query.trim() || running || beginMutation() === null) return
    setRunning(true)
    setError(null)
    try {
      const response = await requestResearch(query.trim())
      setResults(response.results)
      setMode(response.mode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Research failed')
    } finally {
      setRunning(false)
    }
  }

  async function pin(note: ResearchNote) {
    const generation = beginMutation()
    if (generation === null) return
    onProject(await trackMutation(pinResearch(note)), generation)
  }

  async function propose(note: ResearchNote) {
    const generation = beginMutation()
    if (generation === null) return
    onProject(await trackMutation(proposeResearch(note)), generation)
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
        <Button variant="primary" type="submit" disabled={running || !query.trim()}>
          {running ? 'Researching…' : 'Research'}
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
          {results.map((result) => (
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
                <Button onClick={() => void pin(result).catch(setResearchError)}>Pin</Button>
                <Button variant="primary" onClick={() => void propose(result).catch(setResearchError)}>Propose to sheet</Button>
              </div>
            </article>
          ))}
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
