import { useState } from 'react'
import { applyTheme, type Theme } from './design'
import { Badge, Button, IconButton, Input, Textarea } from './components/ui'
import './App.css'

/** Slice 0: token/primitive smoke surface + shell slots. Real IA lands in Slice A. */
function App() {
  const [theme, setTheme] = useState<Theme>('dark')

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="app">
      <header className="app__topbar">
        <h1 className="app__title">Storylint</h1>
        <Badge tone="accent">Slice 0</Badge>
        <div className="app__spacer" />
        <IconButton label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1.5V13.5a5.5 5.5 0 0 1 0-11Z" />
          </svg>
        </IconButton>
      </header>

      <div className="app__body">
        <aside className="app__panel app__panel--binder" aria-label="Binder">
          <h2 className="app__section-label">Binder</h2>
          <p className="app__note">Chapters and bible sheets — Slice A.</p>
        </aside>

        <main className="app__manuscript" aria-label="Manuscript">
          <div className="app__measure">
            <p>
              Manuscript slot. Measure, size, and leading come from the manuscript tokens; a{' '}
              <mark className="app__mark--yellow">soft drift span</mark> and a{' '}
              <mark className="app__mark--red">hard conflict span</mark> render from mark tokens
              only.
            </p>
          </div>
        </main>

        <aside className="app__panel app__panel--agent" aria-label="Agent panel">
          <h2 className="app__section-label">Agent</h2>
          <div className="app__row">
            <Badge>neutral</Badge>
            <Badge tone="success">accepted</Badge>
            <Badge tone="pending">pending</Badge>
            <Badge tone="danger">conflict</Badge>
          </div>
          <Input placeholder="Context chip…" aria-label="Context" />
          <Textarea placeholder="Ask about this chapter…" aria-label="Composer" rows={3} />
          <div className="app__row">
            <Button variant="primary">Accept</Button>
            <Button>Edit</Button>
            <Button variant="danger">Reject</Button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
