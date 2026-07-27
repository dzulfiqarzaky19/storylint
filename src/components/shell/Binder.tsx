import { useState } from 'react'
import type { Fact, Sheet } from '../../domain/types.ts'
import { SheetEditor } from '../../features/project/SheetEditor.tsx'
import { Button, IconButton, ListRow } from '../ui'
import type { Chapter, SheetKind } from './workspace'
import { SHEET_KINDS, SHEET_KIND_LABEL } from './workspace'
import './shell.css'

export type BinderProps = {
  chapters: Chapter[]
  sheets: Sheet[]
  activeChapterId: string
  onSelectChapter: (id: string) => void
  onAddChapter: () => void
  onSaveSheet: (sheet: Sheet) => Promise<void>
  onSaveFact: (sheetId: string, fact: Fact) => Promise<void>
  onDeleteFact: (sheetId: string, factId: string) => Promise<void>
  onClose?: () => void
}

export function Binder({
  chapters,
  sheets,
  activeChapterId,
  onSelectChapter,
  onAddChapter,
  onSaveSheet,
  onSaveFact,
  onDeleteFact,
  onClose,
}: BinderProps) {
  const [editingSheetId, setEditingSheetId] = useState<string | 'new' | null>(null)
  const editingSheet = sheets.find((sheet) => sheet.id === editingSheetId) ?? null

  return (
    <div className="panel">
      <div className="panel__header">
        <h2 className="panel__title">Binder</h2>
        {onClose ? <IconButton label="Close binder" onClick={onClose}>✕</IconButton> : null}
      </div>

      <div className="panel__body">
        {editingSheetId ? (
          <SheetEditor
            sheet={editingSheet}
            onSaveSheet={async (sheet) => {
              await onSaveSheet(sheet)
              setEditingSheetId(sheet.id)
            }}
            onSaveFact={onSaveFact}
            onDeleteFact={onDeleteFact}
            onBack={() => setEditingSheetId(null)}
          />
        ) : (
          <>
            <section className="panel__group" aria-labelledby="binder-chapters">
              <h3 className="panel__label" id="binder-chapters">Chapters</h3>
              {chapters.map((chapter, index) => (
                <ListRow
                  key={chapter.id}
                  active={chapter.id === activeChapterId}
                  meta={String(index + 1)}
                  onClick={() => onSelectChapter(chapter.id)}
                >
                  {chapter.title || 'Untitled'}
                </ListRow>
              ))}
              <Button onClick={onAddChapter}>New chapter</Button>
            </section>

            {SHEET_KINDS.map((kind: SheetKind) => {
              const forKind = sheets.filter((sheet) => sheet.kind === kind)
              return (
                <section className="panel__group" key={kind} aria-labelledby={`binder-${kind}`}>
                  <h3 className="panel__label" id={`binder-${kind}`}>{SHEET_KIND_LABEL[kind]}</h3>
                  {forKind.length === 0 ? (
                    <div className="panel__empty-row" role="status">
                      None yet
                    </div>
                  ) : (
                    forKind.map((sheet) => (
                      <ListRow key={sheet.id} meta={String(sheet.facts.length)} onClick={() => setEditingSheetId(sheet.id)}>
                        {sheet.name}
                      </ListRow>
                    ))
                  )}
                </section>
              )
            })}
            <Button variant="primary" onClick={() => setEditingSheetId('new')}>New sheet</Button>
          </>
        )}
      </div>
    </div>
  )
}
