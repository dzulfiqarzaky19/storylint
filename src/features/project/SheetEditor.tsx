import { useEffect, useState, type FormEvent } from 'react'
import type { Fact, Sheet, SheetKind } from '../../domain/types.ts'
import { Button, Input, Textarea } from '../../components/ui'
import './project.css'

export type SheetEditorProps = {
  sheet: Sheet | null
  onSaveSheet: (sheet: Sheet) => Promise<void>
  onSaveFact: (sheetId: string, fact: Fact) => Promise<void>
  onDeleteFact: (sheetId: string, factId: string) => Promise<void>
  onBack: () => void
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

export function SheetEditor({
  sheet,
  onSaveSheet,
  onSaveFact,
  onDeleteFact,
  onBack,
}: SheetEditorProps) {
  const [draft, setDraft] = useState<Sheet>(() => sheet ?? emptySheet())
  const [portraitFailed, setPortraitFailed] = useState(false)
  const [fact, setFact] = useState({ id: '', key: '', value: '', statement: '' })

  useEffect(() => {
    setDraft(sheet ?? emptySheet())
    setPortraitFailed(false)
    setFact({ id: '', key: '', value: '', statement: '' })
  }, [sheet])

  async function submitSheet(event: FormEvent) {
    event.preventDefault()
    await onSaveSheet({
      ...draft,
      name: draft.name.trim(),
      facts: sheet?.facts ?? draft.facts,
    })
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

  return (
    <div className="sheet-editor">
      <Button onClick={onBack}>Back to binder</Button>
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
    </div>
  )
}

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
