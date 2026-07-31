import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type { Fact, Sheet, SheetKind } from '../../domain/types.ts'
import { Button, Input, Textarea } from '../../components/ui'
import { isSheetIdentityDirty, normalizeSheetIdentity } from './sheetIdentityDirty.ts'
import './project.css'

export type SheetEditorProps = {
  sheet: Sheet | null
  onSaveSheet: (sheet: Sheet) => Promise<void>
  onSaveFact: (sheetId: string, fact: Fact) => Promise<void>
  onDeleteFact: (sheetId: string, factId: string) => Promise<void>
  onBack: () => void
  /** When false, parent stack chrome owns Back (binder L3). Default true. */
  showBack?: boolean
}

/** Single exit path for Back, Escape, stack switches, and Canon leave. */
export type SheetEditorHandle = {
  requestLeave: (proceed: () => void) => void
}

const EMPTY_KIND: SheetKind = 'character'

function isImageSource(value: string): boolean {
  return /^(?:https?:\/\/|data:image\/|\/{1,2}|\.\.?\/)/i.test(value.trim())
}

const FIELD_HINTS: Record<SheetKind, readonly string[]> = {
  character: ['appearance', 'wound', 'oath', 'faction'],
  lore: ['origin', 'rule', 'cost', 'exception'],
  world: ['climate', 'custom', 'danger', 'resource'],
  organization: ['purpose', 'leader', 'symbol', 'rival'],
}

export const SheetEditor = forwardRef<SheetEditorHandle, SheetEditorProps>(function SheetEditor(
  {
    sheet,
    onSaveSheet,
    onSaveFact,
    onDeleteFact,
    onBack,
    showBack = true,
  },
  ref,
) {
  const [draft, setDraft] = useState<Sheet>(() => sheet ?? emptySheet())
  const [loaded, setLoaded] = useState(() => normalizeSheetIdentity(sheet))
  const [portraitFailed, setPortraitFailed] = useState(false)
  const [fact, setFact] = useState({ id: '', key: '', value: '', statement: '' })
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [savingLeave, setSavingLeave] = useState(false)
  const pendingProceedRef = useRef<(() => void) | null>(null)
  const leaveDialogRef = useRef<HTMLDivElement | null>(null)
  const saveLeaveRef = useRef<HTMLButtonElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setDraft(sheet ?? emptySheet())
    setLoaded(normalizeSheetIdentity(sheet))
    setPortraitFailed(false)
    setFact({ id: '', key: '', value: '', statement: '' })
    setLeaveOpen(false)
    setLeaveError(null)
    pendingProceedRef.current = null
  }, [sheet])

  const dirty = useMemo(() => isSheetIdentityDirty(draft, loaded), [draft, loaded])
  const canSave = Boolean(draft.name.trim())
  const displayName = draft.name.trim() || 'this sheet'

  const closeLeavePrompt = useCallback((opts?: { restore?: boolean }) => {
    setLeaveOpen(false)
    setLeaveError(null)
    pendingProceedRef.current = null
    if (opts?.restore) {
      const target = restoreFocusRef.current
      restoreFocusRef.current = null
      queueMicrotask(() => target?.focus())
    }
  }, [])

  const finishLeave = useCallback((proceed: () => void) => {
    setLeaveOpen(false)
    setLeaveError(null)
    pendingProceedRef.current = null
    proceed()
  }, [])

  const requestLeave = useCallback(
    (proceed: () => void) => {
      if (leaveOpen) return
      if (!isSheetIdentityDirty(draft, loaded)) {
        proceed()
        return
      }
      restoreFocusRef.current = document.activeElement as HTMLElement | null
      pendingProceedRef.current = proceed
      setLeaveError(null)
      setLeaveOpen(true)
    },
    [draft, leaveOpen, loaded],
  )

  useImperativeHandle(ref, () => ({ requestLeave }), [requestLeave])

  useLayoutEffect(() => {
    if (!leaveOpen) return
    saveLeaveRef.current?.focus()
  }, [leaveOpen])

  useEffect(() => {
    if (!leaveOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      // Guard Escape = Cancel, never Discard.
      closeLeavePrompt({ restore: true })
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [closeLeavePrompt, leaveOpen])

  async function persistIdentity(): Promise<boolean> {
    const name = draft.name.trim()
    if (!name) {
      setLeaveError('Name is required to save.')
      return false
    }
    const next: Sheet = {
      ...draft,
      name,
      facts: sheet?.facts ?? draft.facts,
    }
    await onSaveSheet(next)
    setDraft(next)
    setLoaded(normalizeSheetIdentity(next))
    return true
  }

  async function submitSheet(event: FormEvent) {
    event.preventDefault()
    const ok = await persistIdentity()
    if (!ok) return
  }

  async function onSaveAndLeave() {
    if (savingLeave) return
    setSavingLeave(true)
    try {
      const ok = await persistIdentity()
      if (!ok) return
      const proceed = pendingProceedRef.current
      if (proceed) finishLeave(proceed)
    } finally {
      setSavingLeave(false)
    }
  }

  function onDiscardAndLeave() {
    const proceed = pendingProceedRef.current
    if (proceed) finishLeave(proceed)
  }

  function requestBack() {
    requestLeave(onBack)
  }

  async function submitFact(event: FormEvent) {
    event.preventDefault()
    const key = fact.key.trim()
    const value = fact.value.trim()
    const statement = fact.statement.trim() || `${key}: ${value}`
    if (!key || !value) return
    const saved: Fact = {
      id: fact.id || `fact-${Date.now()}`,
      key,
      value,
      statement,
      claimKind: 'attribute',
    }
    await onSaveFact(draft.id, saved)
    setFact({ id: '', key: '', value: '', statement: '' })
  }

  function onLeaveDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !leaveDialogRef.current) return
    const focusable = Array.from(
      leaveDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="sheet-editor" data-sheet-dirty={dirty ? 'true' : 'false'}>
      {showBack ? <Button onClick={requestBack}>Back to binder</Button> : null}
      <form className="sheet-editor__form" onSubmit={(event) => void submitSheet(event)}>
        <div className="sheet-editor__identity">
          <div className="sheet-editor__portrait" aria-label="Sheet portrait or icon">
            {draft.portrait && isImageSource(draft.portrait) && !portraitFailed ? (
              <img src={draft.portrait} alt="" onError={() => setPortraitFailed(true)} />
            ) : (
              draft.portrait?.trim() || draft.name.trim().slice(0, 2).toUpperCase() || '✦'
            )}
          </div>
          <label className="sheet-editor__field">
            <span>Portrait / icon</span>
            <Input
              value={draft.portrait ?? ''}
              onChange={(event) => {
                setPortraitFailed(false)
                setDraft((current) => ({ ...current, portrait: event.target.value }))
              }}
              placeholder="Emoji, local path, or URL"
            />
          </label>
        </div>
        <label className="sheet-editor__field">
          <span>Name</span>
          <Input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            required
          />
        </label>
        <label className="sheet-editor__field">
          <span>Kind</span>
          <select
            className="sheet-editor__select ui-focusable"
            value={draft.kind}
            onChange={(event) =>
              setDraft((current) => ({ ...current, kind: event.target.value as SheetKind }))
            }
          >
            <option value="character">Character</option>
            <option value="lore">Lore</option>
            <option value="world">World</option>
            <option value="organization">Organization</option>
          </select>
        </label>
        <label className="sheet-editor__field">
          <span>Aliases</span>
          <Input
            value={draft.aliases.join(', ')}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                aliases: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
              }))
            }
            placeholder="Comma separated"
          />
        </label>
        <label className="sheet-editor__field">
          <span>Summary</span>
          <Textarea
            value={draft.summary}
            onChange={(event) =>
              setDraft((current) => ({ ...current, summary: event.target.value }))
            }
            rows={3}
          />
        </label>
        <label className="sheet-editor__field">
          <span>Notes</span>
          <Textarea
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            rows={3}
          />
        </label>
        <Button variant="primary" type="submit" disabled={!draft.name.trim()}>
          Save sheet
        </Button>
      </form>

      {sheet ? (
        <section className="sheet-editor__facts" aria-labelledby="facts-heading">
          <h3 className="panel__label" id="facts-heading">Facts</h3>
          {sheet.facts.map((item) => (
            <div className="sheet-editor__fact" key={item.id}>
              <div>
                <strong>{item.key}</strong>: {item.value}
                <small>{item.statement}</small>
              </div>
              <div className="sheet-editor__fact-actions">
                <Button
                  onClick={() =>
                    setFact({
                      id: item.id,
                      key: item.key,
                      value: item.value,
                      statement: item.statement,
                    })
                  }
                >
                  Edit
                </Button>
                <Button variant="danger" onClick={() => void onDeleteFact(sheet.id, item.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          <div className="sheet-editor__hints" aria-label="Optional lore field hints">
            {FIELD_HINTS[draft.kind].map((hint) => (
              <Button key={hint} onClick={() => setFact((current) => ({ ...current, key: hint }))}>
                {hint}
              </Button>
            ))}
          </div>
          <form className="sheet-editor__form" onSubmit={(event) => void submitFact(event)}>
            <label className="sheet-editor__field">
              <span>Key</span>
              <Input value={fact.key} onChange={(event) => setFact({ ...fact, key: event.target.value })} required />
            </label>
            <label className="sheet-editor__field">
              <span>Value</span>
              <Input value={fact.value} onChange={(event) => setFact({ ...fact, value: event.target.value })} required />
            </label>
            <label className="sheet-editor__field">
              <span>Statement</span>
              <Input value={fact.statement} onChange={(event) => setFact({ ...fact, statement: event.target.value })} placeholder="Optional" />
            </label>
            <div className="sheet-editor__fact-actions">
              <Button type="submit">{fact.id ? 'Save fact' : 'Add fact'}</Button>
              {fact.id ? (
                <Button onClick={() => setFact({ id: '', key: '', value: '', statement: '' })}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      {leaveOpen ? (
        <div className="sheet-editor__leave-root">
          <div className="sheet-editor__leave-backdrop" aria-hidden="true" />
          <div
            ref={leaveDialogRef}
            className="sheet-editor__leave-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-leave-title"
            aria-describedby="sheet-leave-body"
            tabIndex={-1}
            onKeyDown={onLeaveDialogKeyDown}
          >
            <h3 className="sheet-editor__leave-title" id="sheet-leave-title">
              {`Save changes to ${displayName}?`}
            </h3>
            <p className="sheet-editor__leave-body" id="sheet-leave-body">
              Canon keeps accepted truth. Save writes these identity edits, or discard them.
            </p>
            {leaveError ? (
              <p className="sheet-editor__leave-error" role="alert">
                {leaveError}
              </p>
            ) : null}
            <div className="sheet-editor__leave-actions">
              <Button
                ref={saveLeaveRef}
                variant="primary"
                disabled={!canSave || savingLeave}
                onClick={() => void onSaveAndLeave()}
              >
                Save
              </Button>
              <Button variant="danger" disabled={savingLeave} onClick={onDiscardAndLeave}>
                Discard
              </Button>
              <Button disabled={savingLeave} onClick={() => closeLeavePrompt({ restore: true })}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
})

function emptySheet(): Sheet {
  return {
    id: `sheet-${Date.now()}`,
    kind: EMPTY_KIND,
    name: '',
    aliases: [],
    summary: '',
    notes: '',
    portrait: '',
    facts: [],
  }
}
