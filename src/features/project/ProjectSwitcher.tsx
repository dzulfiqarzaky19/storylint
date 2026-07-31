import { useState } from 'react'
import type { ProjectSummary } from './api.ts'
import { Button, Input } from '../../components/ui'

export function ProjectSwitcher({
  projects,
  activeProjectId,
  onSwitch,
  onCreate,
  onExport,
}: {
  projects: ProjectSummary[]
  activeProjectId: string
  onSwitch: (id: string) => Promise<void>
  onCreate: (id: string, title: string) => Promise<void>
  onExport: () => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    const normalized = title.trim()
    const id = normalized.toLocaleLowerCase('en-US').replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '')
    if (!id || busy) return
    setBusy(true)
    try {
      await onCreate(id, normalized)
      setTitle('')
      setCreating(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="project-switcher">
      <select
        aria-label="Active project"
        value={activeProjectId}
        disabled={busy}
        onChange={(event) => void onSwitch(event.target.value)}
      >
        {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
      </select>
      {creating ? (
        <>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New project title" aria-label="New project title" />
          <Button disabled={busy || !title.trim()} onClick={() => void create()}>Create</Button>
          <Button disabled={busy} onClick={() => setCreating(false)}>Cancel</Button>
        </>
      ) : <Button onClick={() => setCreating(true)}>New project</Button>}
      <Button aria-label="Export markdown" title="Download project as Markdown ZIP" onClick={() => void onExport()}>
        Export
      </Button>
    </div>
  )
}
