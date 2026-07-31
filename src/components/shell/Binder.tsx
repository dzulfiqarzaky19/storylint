import { useEffect, useRef, useState } from 'react'
import type { Fact, Lab, Sheet } from '../../domain/types.ts'
import { SheetEditor } from '../../features/project/SheetEditor.tsx'
import { Button, IconButton, ListRow } from '../ui'
import type { Chapter, SheetKind } from './workspace'
import { SHEET_KINDS, SHEET_KIND_LABEL } from './workspace'
import './shell.css'

export type BinderProps = {
  chapters: Chapter[]
  sheets: Sheet[]
  lab?: Lab | null
  activeChapterId: string
  activeBoardId?: string | null
  labMode?: boolean
  /** When center is Canon, sheets lead and Draft chapters are secondary. */
  canonMode?: boolean
  onSelectChapter: (id: string) => void
  onSelectLabBoard?: (boardId: string) => void
  onOpenLab?: () => void
  onAddChapter: () => void
  onSaveSheet: (sheet: Sheet) => Promise<void>
  onSaveFact: (sheetId: string, fact: Fact) => Promise<void>
  onDeleteFact: (sheetId: string, factId: string) => Promise<void>
  requestedSheetId?: string | null
  onRequestedSheetHandled?: () => void
  /** Notify shell when a sheet enters/leaves the binder detail stack (Canon landing). */
  onEditSheet?: (sheetId: string | null) => void
  onClose?: () => void
}

export function Binder({
  chapters,
  sheets,
  lab,
  activeChapterId,
  activeBoardId,
  labMode = false,
  canonMode = false,
  onSelectChapter,
  onSelectLabBoard,
  onOpenLab,
  onAddChapter,
  onSaveSheet,
  onSaveFact,
  onDeleteFact,
  requestedSheetId,
  onRequestedSheetHandled,
  onEditSheet,
  onClose,
}: BinderProps) {
  const [editingSheetId, setEditingSheetId] = useState<string | 'new' | null>(null)
  /** Park sheet detail when leaving Canon; restore on re-enter (D9). */
  const [parkedSheetId, setParkedSheetId] = useState<string | null>(null)
  const editingSheet = sheets.find((sheet) => sheet.id === editingSheetId) ?? null
  const boards = lab?.boards ?? []

  useEffect(() => {
    if (requestedSheetId && sheets.some((sheet) => sheet.id === requestedSheetId)) {
      if (canonMode) {
        setEditingSheetId(requestedSheetId)
        setParkedSheetId(null)
        onEditSheet?.(requestedSheetId)
      } else {
        // Outside Canon: remember for restore, keep binder as navigator.
        setParkedSheetId(requestedSheetId)
        setEditingSheetId(null)
        onEditSheet?.(null)
      }
      onRequestedSheetHandled?.()
    } else if (editingSheetId && editingSheetId !== 'new' && !sheets.some((sheet) => sheet.id === editingSheetId)) {
      setEditingSheetId(null)
      onEditSheet?.(null)
    }
  }, [requestedSheetId, sheets, editingSheetId, canonMode, onRequestedSheetHandled, onEditSheet])

  // Park sheet form only on Canon leave; restore parked sheet on Canon enter (D9).
  const wasCanonRef = useRef(canonMode)
  useEffect(() => {
    const wasCanon = wasCanonRef.current
    wasCanonRef.current = canonMode
    if (wasCanon && !canonMode) {
      if (editingSheetId && editingSheetId !== 'new') setParkedSheetId(editingSheetId)
      if (editingSheetId) {
        setEditingSheetId(null)
        onEditSheet?.(null)
      }
      return
    }
    if (!wasCanon && canonMode) {
      if (!editingSheetId && parkedSheetId && sheets.some((sheet) => sheet.id === parkedSheetId)) {
        setEditingSheetId(parkedSheetId)
        onEditSheet?.(parkedSheetId)
        setParkedSheetId(null)
      }
    }
  }, [canonMode, editingSheetId, parkedSheetId, sheets, onEditSheet])

  const draftSection = (
    <section className="panel__group" aria-labelledby="binder-draft">
      <h3 className="panel__label" id="binder-draft">Draft</h3>
      {chapters.map((chapter, index) => (
        <ListRow
          key={chapter.id}
          active={!labMode && !canonMode && chapter.id === activeChapterId}
          meta={String(index + 1)}
          onClick={() => onSelectChapter(chapter.id)}
        >
          {chapter.title || 'Untitled'}
        </ListRow>
      ))}
      <Button onClick={onAddChapter}>New chapter</Button>
    </section>
  )

  const canonSection = (
    <section className="panel__group" aria-labelledby="binder-canon">
      <h3 className="panel__label" id="binder-canon">Canon</h3>
      {SHEET_KINDS.map((kind: SheetKind) => {
        const forKind = sheets.filter((sheet) => sheet.kind === kind)
        return (
          <div className="binder__canon-kind" key={kind}>
            <h4 className="panel__sublabel" id={`binder-${kind}`}>{SHEET_KIND_LABEL[kind]}</h4>
            {forKind.length === 0 ? (
              <div className="panel__empty-row" role="status">
                None yet
              </div>
            ) : (
              forKind.map((sheet) => (
                <ListRow
                  key={sheet.id}
                  meta={String(sheet.facts.length)}
                  onClick={() => {
                    setEditingSheetId(sheet.id)
                    onEditSheet?.(sheet.id)
                  }}
                >
                  {sheet.name}
                </ListRow>
              ))
            )}
          </div>
        )
      })}
      <Button
        variant="primary"
        onClick={() => {
          setEditingSheetId('new')
          onEditSheet?.(null)
        }}
      >
        New sheet
      </Button>
    </section>
  )

  const labSection = (
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
  )

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
              onEditSheet?.(sheet.id)
            }}
            onSaveFact={onSaveFact}
            onDeleteFact={onDeleteFact}
            onBack={() => {
              setEditingSheetId(null)
              onEditSheet?.(null)
            }}
          />
        ) : canonMode ? (
          <>
            {canonSection}
            {draftSection}
            {labSection}
          </>
        ) : (
          <>
            {draftSection}
            {canonSection}
            {labSection}
          </>
        )}
      </div>
    </div>
  )
}
