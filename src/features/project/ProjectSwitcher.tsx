import { useEffect, useId, useRef, useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
        setCreating(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  async function create() {
    const normalized = title.trim()
    const id = normalized.toLocaleLowerCase('en-US').replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '')
    if (!id || busy) return
    setBusy(true)
    try {
      await onCreate(id, normalized)
      setTitle('')
      setCreating(false)
      setMenuOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function exportProject() {
    if (busy) return
    setBusy(true)
    try {
      await onExport()
      setMenuOpen(false)
      setCreating(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="project-switcher" ref={rootRef}>
      <select
        aria-label="Active project"
        value={activeProjectId}
        disabled={busy}
        onChange={(event) => void onSwitch(event.target.value)}
      >
        {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
      </select>
      <div className="project-switcher__menu">
        <Button
          aria-label="Project menu"
          title="Project actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          disabled={busy}
          onClick={() => {
            setMenuOpen((open) => !open)
            if (menuOpen) setCreating(false)
          }}
        >
          ⋯
        </Button>
        {menuOpen ? (
          <div className="project-switcher__popover" id={menuId} role="menu" aria-label="Project actions">
            {creating ? (
              <div className="project-switcher__create">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="New project title"
                  aria-label="New project title"
                  autoFocus
                />
                <div className="project-switcher__create-actions">
                  <Button disabled={busy || !title.trim()} onClick={() => void create()}>Create</Button>
                  <Button disabled={busy} onClick={() => setCreating(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <Button role="menuitem" disabled={busy} onClick={() => setCreating(true)}>
                  New project
                </Button>
                <Button
                  role="menuitem"
                  aria-label="Export markdown"
                  title="Download project as Markdown ZIP"
                  disabled={busy}
                  onClick={() => void exportProject()}
                >
                  Export
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
