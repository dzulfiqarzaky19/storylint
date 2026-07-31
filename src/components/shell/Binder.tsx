import { useEffect, useState } from 'react'
<<<<<<< HEAD
import type { Fact, Sheet } from '../../domain/types.ts'
=======
import type { Fact, Lab, Sheet } from '../../domain/types.ts'
>>>>>>> storylint/lab-slice
import { SheetEditor } from '../../features/project/SheetEditor.tsx'
import { Button, IconButton, ListRow } from '../ui'
import type { Chapter, SheetKind } from './workspace'
import { SHEET_KINDS, SHEET_KIND_LABEL } from './workspace'
import './shell.css'

export type BinderProps = {
  chapters: Chapter[]
  sheets: Sheet[]
<<<<<<< HEAD
  activeChapterId: string
  onSelectChapter: (id: string) => void
=======
  lab?: Lab | null
  activeChapterId: string
  activeBoardId?: string | null
  labMode?: boolean
  onSelectChapter: (id: string) => void
  onSelectLabBoard?: (boardId: string) => void
  onOpenLab?: () => void
>>>>>>> storylint/lab-slice
  onAddChapter: () => void
  onSaveSheet: (sheet: Sheet) => Promise<void>
  onSaveFact: (sheetId: string, fact: Fact) => Promise<void>
  onDeleteFact: (sheetId: string, factId: string) => Promise<void>
  requestedSheetId?: string | null
  onRequestedSheetHandled?: () => void
  onClose?: () => void
}

export function Binder({
  chapters,
  sheets,
<<<<<<< HEAD
  activeChapterId,
  onSelectChapter,
=======
  lab,
  activeChapterId,
  activeBoardId,
  labMode = false,
  onSelectChapter,
  onSelectLabBoard,
  onOpenLab,
>>>>>>> storylint/lab-slice
  onAddChapter,
  onSaveSheet,
  onSaveFact,
  onDeleteFact,
  requestedSheetId,
  onRequestedSheetHandled,
  onClose,
}: BinderProps) {
  const [editingSheetId, setEditingSheetId] = useState<string | 'new' | null>(null)
  const editingSheet = sheets.find((sheet) => sheet.id === editingSheetId) ?? null
<<<<<<< HEAD
=======
  const boards = lab?.boards ?? []
>>>>>>> storylint/lab-slice

  useEffect(() => {
    if (requestedSheetId && sheets.some((sheet) => sheet.id === requestedSheetId)) {
      setEditingSheetId(requestedSheetId)
      onRequestedSheetHandled?.()
    } else if (editingSheetId && editingSheetId !== 'new' && !sheets.some((sheet) => sheet.id === editingSheetId)) {
      setEditingSheetId(null)
    }
  }, [requestedSheetId, sheets, editingSheetId, onRequestedSheetHandled])

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
<<<<<<< HEAD
                  active={chapter.id === activeChapterId}
=======
                  active={!labMode && chapter.id === activeChapterId}
>>>>>>> storylint/lab-slice
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
<<<<<<< HEAD
=======

            <section className="panel__group" aria-labelledby="binder-lab">
              <h3 className="panel__label" id="binder-lab">Lab</h3>
              {boards.length === 0 ? (
                <div className="panel__empty-row" role="status">Bench</div>
              ) : (
                boards.map((board) => {
                  const live = (lab?.cards ?? []).filter(
                    (card) => card.boardId === board.id && (card.status === 'active' || card.status === 'pinned'),
                  ).length
                  return (
                    <ListRow
                      key={board.id}
                      active={labMode && board.id === activeBoardId}
                      meta={String(live)}
                      onClick={() => {
                        onOpenLab?.()
                        onSelectLabBoard?.(board.id)
                      }}
                    >
                      {board.title}
                    </ListRow>
                  )
                })
              )}
              <Button onClick={() => onOpenLab?.()}>Open Lab</Button>
            </section>
>>>>>>> storylint/lab-slice
          </>
        )}
      </div>
    </div>
  )
}
