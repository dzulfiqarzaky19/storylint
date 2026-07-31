import { useEffect, useLayoutEffect, useRef, useState, type RefCallback } from 'react'
import type { Fact, Lab, Sheet } from '../../domain/types.ts'
import { SheetEditor, type SheetEditorHandle } from '../../features/project/SheetEditor.tsx'
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
  /**
   * Enter Canon from a binder sheet action outside Canon (F3).
   * Pass sheetId to open that sheet; null/omit opens Canon map only.
   */
  onOpenCanonSheet?: (sheetId?: string | null) => void
  /**
   * Shell registers the active sheet leave guard so ecosystem place switches
   * can share one Save/Discard/Cancel path with Back.
   */
  onRequestLeaveGuard?: (requestLeave: ((proceed: () => void) => void) | null) => void
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
  onOpenCanonSheet,
  onRequestLeaveGuard,
  onClose,
}: BinderProps) {
  const [editingSheetId, setEditingSheetId] = useState<string | 'new' | null>(null)
  /** Park sheet detail when leaving Canon; restore on re-enter (D9). */
  const [parkedSheetId, setParkedSheetId] = useState<string | null>(null)
  const currentChapterRef = useRef<HTMLButtonElement | null>(null)
  const stackBodyRef = useRef<HTMLDivElement | null>(null)
  const listScrollTopRef = useRef(0)
  const editorRef = useRef<SheetEditorHandle | null>(null)
  /** Opener control to restore after Back (sheet id or new). */
  const returnFocusIdRef = useRef<string | 'new' | null>(null)
  const sheetRowRefs = useRef(new Map<string, HTMLButtonElement | null>())
  const newSheetBtnRef = useRef<HTMLButtonElement | null>(null)
  const backBtnRef = useRef<HTMLButtonElement | null>(null)
  const wasDetailOpenRef = useRef(false)
  /** AU-3: polite open announce once per enter; clear when closed. Not role=dialog. */
  const [stackLiveText, setStackLiveText] = useState('')
  const editingSheet = sheets.find((sheet) => sheet.id === editingSheetId) ?? null
  const boards = lab?.boards ?? []
  const draftActive = !labMode && !canonMode
  /** F3 hard gate: form only while Canon is the place. */
  const sheetDetailOpen = Boolean(canonMode && editingSheetId)
  const sheetKindLabel =
    editingSheetId === 'new'
      ? 'New sheet'
      : editingSheet
        ? SHEET_KIND_LABEL[editingSheet.kind]
        : 'Sheet'
  const sheetTitle =
    editingSheetId === 'new' ? 'New sheet' : editingSheet?.name?.trim() || 'Untitled sheet'

  function openSheetFromList(sheetId: string) {
    if (!canonMode) {
      // F3: never mount sheet form in Draft/Lab. Route through Canon entry.
      setParkedSheetId(sheetId)
      setEditingSheetId(null)
      onEditSheet?.(null)
      onOpenCanonSheet?.(sheetId)
      return
    }
    const open = () => {
      if (stackBodyRef.current) listScrollTopRef.current = stackBodyRef.current.scrollTop
      setEditingSheetId(sheetId)
      setParkedSheetId(null)
      returnFocusIdRef.current = sheetId
      onEditSheet?.(sheetId)
    }
    // Switching sheets while a dirty form is open must share the leave guard.
    if (editingSheetId && editingSheetId !== sheetId && editorRef.current) {
      editorRef.current.requestLeave(open)
      return
    }
    open()
  }

  function openNewSheet() {
    if (!canonMode) {
      // New sheet is a Canon L3 job. Enter Canon map; user hits New sheet there.
      onOpenCanonSheet?.(null)
      return
    }
    const open = () => {
      if (stackBodyRef.current) listScrollTopRef.current = stackBodyRef.current.scrollTop
      setEditingSheetId('new')
      returnFocusIdRef.current = 'new'
      // Signal detail-open for map quiet (F2); Shell ignores 'new' as a real sheet id for landing.
      onEditSheet?.('new')
    }
    if (editingSheetId && editorRef.current) {
      editorRef.current.requestLeave(open)
      return
    }
    open()
  }

  function closeSheetDetail() {
    setEditingSheetId(null)
    onEditSheet?.(null)
  }

  function requestCloseSheetDetail() {
    if (editorRef.current) {
      editorRef.current.requestLeave(closeSheetDetail)
      return
    }
    closeSheetDetail()
  }

  useEffect(() => {
    // 'new' is a request for the create form itself, not for an existing sheet id.
    if (requestedSheetId === 'new') {
      if (canonMode) openNewSheet()
      onRequestedSheetHandled?.()
      return
    }
    if (requestedSheetId && sheets.some((sheet) => sheet.id === requestedSheetId)) {
      if (canonMode) {
        if (stackBodyRef.current && !editingSheetId) {
          listScrollTopRef.current = stackBodyRef.current.scrollTop
        }
        setEditingSheetId(requestedSheetId)
        setParkedSheetId(null)
        returnFocusIdRef.current = requestedSheetId
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
        returnFocusIdRef.current = parkedSheetId
        onEditSheet?.(parkedSheetId)
        setParkedSheetId(null)
      }
    }
  }, [canonMode, editingSheetId, parkedSheetId, sheets, onEditSheet])

  // F3 belt: if somehow editing while not Canon, drop the form immediately.
  useEffect(() => {
    if (!canonMode && editingSheetId) {
      if (editingSheetId !== 'new') setParkedSheetId(editingSheetId)
      setEditingSheetId(null)
      onEditSheet?.(null)
    }
  }, [canonMode, editingSheetId, onEditSheet])

  // Publish leave guard to Shell for ecosystem place switches (Draft/Lab/Canon).
  useEffect(() => {
    if (!onRequestLeaveGuard) return
    if (!sheetDetailOpen) {
      onRequestLeaveGuard(null)
      return
    }
    onRequestLeaveGuard((proceed) => {
      if (editorRef.current) {
        editorRef.current.requestLeave(proceed)
        return
      }
      proceed()
    })
    return () => onRequestLeaveGuard(null)
  }, [onRequestLeaveGuard, sheetDetailOpen])

  // Keep the active Draft chapter visible in long lists.
  useEffect(() => {
    if (!draftActive || sheetDetailOpen) return
    currentChapterRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeChapterId, chapters.length, draftActive, sheetDetailOpen])

  // F1: restore list scroll when popping the detail stack.
  useLayoutEffect(() => {
    if (sheetDetailOpen) return
    const body = stackBodyRef.current
    if (!body) return
    body.scrollTop = listScrollTopRef.current
  }, [sheetDetailOpen, canonMode, labMode])

  // Push-stack focus: enter detail → Back; leave detail → opener row/button.
  // AU-3: also emit a single polite "Editing {title}" (not role=dialog — leave/Esc must stay free).
  useLayoutEffect(() => {
    const wasOpen = wasDetailOpenRef.current
    wasDetailOpenRef.current = sheetDetailOpen
    if (!wasOpen && sheetDetailOpen) {
      backBtnRef.current?.focus()
      const title =
        editingSheetId === 'new' ? 'New sheet' : editingSheet?.name?.trim() || 'Untitled sheet'
      setStackLiveText(`Editing ${title}`)
      return
    }
    if (wasOpen && !sheetDetailOpen) {
      setStackLiveText('')
      const returnId = returnFocusIdRef.current
      returnFocusIdRef.current = null
      const restore = () => {
        if (returnId === 'new') {
          newSheetBtnRef.current?.focus()
          return
        }
        if (returnId) sheetRowRefs.current.get(returnId)?.focus()
      }
      // List unhides in the same commit; focus after paint so the control is tabbable.
      queueMicrotask(restore)
    }
  }, [sheetDetailOpen, editingSheetId, editingSheet?.name])

  const setSheetRowRef = (sheetId: string): RefCallback<HTMLButtonElement> => (node) => {
    if (node) sheetRowRefs.current.set(sheetId, node)
    else sheetRowRefs.current.delete(sheetId)
  }

  const draftSection = (
    <section className="panel__group" aria-labelledby="binder-draft">
      <div className="binder__section-head">
        <h3 className="panel__label" id="binder-draft">Draft</h3>
        <span className="binder__count" aria-label={`${chapters.length} chapters`}>{chapters.length}</span>
      </div>
      {chapters.length === 0 ? (
        <div className="panel__empty-row">
          No chapters yet. Start with New chapter.
        </div>
      ) : (
        <div className="binder__chapter-list" role="list" aria-label="Chapters">
          {chapters.map((chapter, index) => {
            const current = draftActive && chapter.id === activeChapterId
            return (
              <ListRow
                key={chapter.id}
                ref={current ? currentChapterRef : undefined}
                className={current ? 'binder__chapter binder__chapter--current' : 'binder__chapter'}
                active={current}
                meta={String(index + 1)}
                data-binder-chapter={current ? 'current' : undefined}
                onClick={() => onSelectChapter(chapter.id)}
              >
                {chapter.title || 'Untitled'}
              </ListRow>
            )
          })}
        </div>
      )}
      {/*
        One primary per job (ox): Draft true-empty dual-rail — binder owns create.
        Companion "Write first chapter" demotes to ghost; this stays solid while empty.
        Populated lists keep the quiet footer recipe (default ghost).
      */}
      <Button variant={chapters.length === 0 ? 'primary' : undefined} onClick={onAddChapter}>
        New chapter
      </Button>
    </section>
  )

  const canonSection = (
    <section className="panel__group" aria-labelledby="binder-canon">
      <div className="binder__section-head">
        <h3 className="panel__label" id="binder-canon">Canon</h3>
        <span className="binder__count" aria-label={`${sheets.length} sheets`}>{sheets.length}</span>
      </div>
      {sheets.length === 0 ? (
        <div className="panel__empty-row">
          Add a sheet, or promote from Lab.
        </div>
      ) : null}
      {SHEET_KINDS.map((kind: SheetKind) => {
        const forKind = sheets.filter((sheet) => sheet.kind === kind)
        return (
          <div className="binder__canon-kind" key={kind}>
            <div className="binder__kind-head">
              <h4 className="panel__sublabel" id={`binder-${kind}`}>{SHEET_KIND_LABEL[kind]}</h4>
              <span className="binder__count binder__count--kind" aria-hidden="true">{forKind.length}</span>
            </div>
            {forKind.length === 0 ? (
              <div className="panel__empty-row">
                None yet
              </div>
            ) : (
              forKind.map((sheet) => (
                <ListRow
                  key={sheet.id}
                  ref={setSheetRowRef(sheet.id)}
                  meta={String(sheet.facts.length)}
                  active={canonMode && editingSheetId === sheet.id}
                  onClick={() => openSheetFromList(sheet.id)}
                >
                  {sheet.name}
                </ListRow>
              ))
            )}
          </div>
        )
      })}
      {/*
        One primary per job (ox): Canon true-empty — map empty CTA owns create.
        Binder demotes to ghost while no sheets; restores solid once the list is navigator.
        Filtered-empty still has sheets, so binder stays solid (map create is already off).
      */}
      <Button
        ref={newSheetBtnRef}
        variant={sheets.length === 0 ? 'ghost' : 'primary'}
        onClick={openNewSheet}
      >
        New sheet
      </Button>
    </section>
  )

  const labSection = (
    <section className="panel__group" aria-labelledby="binder-lab">
      <div className="binder__section-head">
        <h3 className="panel__label" id="binder-lab">Lab</h3>
        <span className="binder__count" aria-label={`${boards.length} boards`}>{boards.length}</span>
      </div>
      {boards.length === 0 ? (
        <div className="panel__empty-row">Open Lab to start a bench.</div>
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

  const navigator = canonMode ? (
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
  )

  return (
    <div className="panel" data-binder-stack={sheetDetailOpen ? 'detail' : 'list'}>
      <div className="panel__header">
        <h2 className="panel__title">Binder</h2>
        {onClose ? <IconButton label="Close binder" onClick={onClose}>✕</IconButton> : null}
      </div>

      <div className="panel__body binder__stack" ref={stackBodyRef}>
        <div className="sr-only" aria-live="polite" aria-atomic="true" data-au-live="binder-stack">
          {stackLiveText}
        </div>
        {/* F1: list stays mounted under the detail layer so Back restores scroll. */}
        <div
          className="binder__stack-list"
          hidden={sheetDetailOpen}
          aria-hidden={sheetDetailOpen}
        >
          {navigator}
        </div>

        {sheetDetailOpen ? (
          <div className="binder__stack-detail" data-binder-detail="sheet">
            <div className="binder__detail-chrome">
              <Button
                ref={backBtnRef}
                aria-label={`Back, editing ${sheetTitle}`}
                onClick={requestCloseSheetDetail}
              >
                Back
              </Button>
              <div className="binder__detail-meta">
                <span className="binder__detail-title" id="binder-detail-title">{sheetTitle}</span>
                <span className="binder__detail-kind">{sheetKindLabel}</span>
              </div>
            </div>
            <SheetEditor
              ref={editorRef}
              sheet={editingSheet}
              showBack={false}
              onSaveSheet={async (sheet) => {
                await onSaveSheet(sheet)
                setEditingSheetId(sheet.id)
                onEditSheet?.(sheet.id)
              }}
              onSaveFact={onSaveFact}
              onDeleteFact={onDeleteFact}
              onBack={closeSheetDetail}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
