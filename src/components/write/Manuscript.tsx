'use client';

/**
 * Manuscript — the full Write screen client.
 *
 * Owns:
 *   - The Tiptap v3 editor (StarterKit, paragraphs only) rendering the chapter
 *     body. MIT packages only; no @tiptap-pro/*.
 *   - The `writeReducer` session store.
 *   - The LIVE consistency check: `checkManuscript` runs client-side, debounced
 *     ~300ms, over the current manuscript text + the wiki snapshot passed from
 *     the server. NOT fixtures.
 *   - The decoration plugin (two underline styles + a note-host widget) via a
 *     ref the plugin reads each recompute.
 *   - The InlineNote portalled into the widget host under the open paragraph.
 *   - The OutstandingRail; a rail-row click and an underline click are the same
 *     action (open/close, one at a time).
 *   - The three DIFFERENTIATED note actions wired to the server:
 *       leave → upsertResolvedMark (persists; survives reload)
 *       text  → select the run in the editor for rewriting
 *       wiki  → hand off to the confirmed wiki path (no wiki write here)
 *
 * The server component (`app/write/page.tsx`) runs the SAME engine at load and
 * seeds `initialMarks`, so marks are present before the first client keystroke.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { checkManuscript } from '@/lib/check';
import type {
  Mark,
  MarkAction,
  ResolvedTarget,
  WikiSnapshot as CheckWiki,
} from '@/lib/check';
import {
  mergeMarks,
  hashParagraphs,
  changedParagraphIndices,
  reconcileAiMarks,
  AI_CONFLICT_RULE_ID,
} from '@/lib/check/ai';
import {
  writeReducer,
  initWriteState,
  type WriteState,
} from '@/lib/state/writeStore';
import {
  resolveMark as resolveMarkAction,
  saveManuscript,
  createChapter,
  renameChapter,
  deleteChapter,
  explainMark,
  aiCheckChapter,
  persistChapterCheck,
} from '@/lib/actions/write';
import { createEntry, createFact, createCategory, editFact } from '@/lib/actions/wiki';
import { resolveWikiWriteMode } from '@/lib/write/resolveWikiWriteMode';
import { KIND_SHELF, type Shelf } from '@/lib/domain/types';
import { defaultCategoryShelf } from '@/lib/wiki/categoryLabels';
import WikiTargetPicker from '@/components/wiki/WikiTargetPicker';
import {
  resolvePickerTarget,
  type PickerResult,
} from '@/lib/research/resolvePickerTarget';
import { docToParagraphs } from '@/lib/write/adapters';
import {
  createMarkDecorationPlugin,
  resolveMarkRange,
  resolveSentenceRange,
  type MarkDecorationData,
} from './markDecorations';
import { InlineNote } from './InlineNote';
import { OutstandingRail } from './OutstandingRail';
import SaveStateFooter from './SaveStateFooter';
import WriteIndex, { type WriteIndexChapter } from './WriteIndex';
import ChapterDeleteDialog from './ChapterDeleteDialog';
import styles from './Manuscript.module.css';

const CHECK_DEBOUNCE_MS = 300;
const SAVE_DEBOUNCE_MS = 800;

export interface ManuscriptProps {
  chapterNumber: number;
  chapterTitle: string;
  /** ProseMirror doc JSON loaded from the DB. */
  initialBody: unknown;
  /** Marks the server computed at load, so the screen is live from first paint. */
  initialMarks: Mark[];
  /** Wiki snapshot (engine shape) for client-side re-checks. */
  wiki: CheckWiki;
  /** markKeys already resolved (from resolved_marks); suppressed by the engine. */
  resolvedMarkKeys: string[];
  /**
   * Book-wide phrase -> chapter-count index (Tier 2), as serializable entries
   * (a Map cannot cross the server/client boundary). Reconstructed into a Map
   * for the live check so cross-chapter recurrence ranks marks on every
   * keystroke, matching the server load pass. Omitted -> within-chapter only.
   */
  chapterCounts?: [string, number][];
  /** All chapters, for the LEFT index (Track C). Ordered by number. */
  chapters: WriteIndexChapter[];
  /** The active book id (resolved by page.tsx), for the chapter export link. */
  activeBookId: string;
  /** The active universe id (resolved by page.tsx), for persisting the AI cache. */
  activeUniverseId: string;
  /**
   * AI marks rehydrated from a FRESH chapter_check_cache row (T-AICACHE): the last
   * persisted AI cross-check for this chapter, valid because the body + wiki it was
   * checked against are unchanged. Non-empty => the rail shows the AI result from
   * first paint and the mount-time AI re-run is SKIPPED (no gateway call). Empty =>
   * no cache or stale, so the client runs the AI check on mount as before.
   */
  initialAiMarks?: Mark[];
  /** AI gateway configured at load; gates the inline note's ✦ Ask AI affordance. */
  aiEnabled?: boolean;
  /** The active world id (resolved by page.tsx); a minted entry links into it. */
  activeWorldId: string;
  /**
   * Live wiki entries (world-scoped, deleted-filtered — the SAME set /wiki and
   * /research show) the "Add to the wiki" modal offers to enrich. Landing on one
   * makes the confirm an ENRICH; leaving it on "+ new" makes it a MINT.
   */
  pickerEntries: { id: string; name: string; kind: string }[];
  /** Live category pills for the modal's top level (built-in + user-created). */
  pickerCategories: { id: string; label: string }[];
}

/** Maps a note action id to the store/server resolution id. */
function resolutionIdOf(action: MarkAction): 'wiki' | 'text' | 'leave' {
  // Contradiction marks emit ids wiki/text/leave; missing marks emit add/edit/leave.
  switch (action.id) {
    case 'wiki':
    case 'text':
    case 'leave':
      return action.id;
    case 'add':
      // "Add to the wiki" is a wiki write → confirmed wiki path.
      return 'wiki';
    case 'edit':
      // "Add, but let me word it" → author edits the text first.
      return 'text';
    default:
      return 'leave';
  }
}

export function Manuscript({
  chapterNumber,
  chapterTitle,
  initialBody,
  initialMarks,
  wiki,
  resolvedMarkKeys,
  chapters,
  chapterCounts,
  activeBookId,
  activeUniverseId,
  initialAiMarks,
  aiEnabled = false,
  activeWorldId,
  pickerEntries,
  pickerCategories,
}: ManuscriptProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preserve the active scope (u/w/book) when switching chapters. Selecting a
  // chapter must NOT drop the world/book — a bare /write?chapter=N resets the
  // page resolver to the default (Ashkeld) world, snapping the header + wiki off
  // the book the writer is actually in. Keep every existing param, override only
  // ?chapter=.
  const writeChapterHref = useCallback(
    (n: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('chapter', String(n));
      return `/write?${params.toString()}`;
    },
    [searchParams],
  );
  // Rebuild the serializable entries into a Map once; used by every live check.
  const chapterCountsMap = useMemo(
    () => new Map(chapterCounts ?? []),
    [chapterCounts],
  );
  // T-AICACHE: merge any FRESH cached AI marks into the first-paint mark set so
  // the rail shows the AI result immediately, matching what pushDeterministicMarks
  // will render once the editor mounts.
  const seededInitialMarks = initialAiMarks && initialAiMarks.length > 0
    ? mergeMarks(initialMarks, initialAiMarks)
    : initialMarks;
  const [state, dispatch] = useReducer(
    writeReducer,
    { chapterNumber, body: initialBody, marks: seededInitialMarks, resolvedMarkKeys },
    initWriteState,
  );

  // Latest reducer state for the plugin's getData() closure and debounced jobs.
  const stateRef = useRef<WriteState>(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Stable DOM host for the inline note; the plugin places it, React portals into it.
  const [noteHost] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.setAttribute('data-write-note-host', '');
    return el;
  });

  const [busy, setBusy] = useState(false);

  // The mark whose "Add to the wiki" modal is open, held in LOCAL state so the
  // writeReducer keeps its invariant of never touching the wiki. null => no modal.
  // The modal's confirm IS the only wiki-write gate (product rule 1); cancel
  // writes nothing.
  const [pendingPickerMark, setPendingPickerMark] = useState<Mark | null>(null);

  // The chapter number awaiting a delete confirm (its dialog is open), plus an
  // in-flight flag so a double-click can't fire two deletes. null => no dialog.
  const [pendingDeleteNumber, setPendingDeleteNumber] = useState<number | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // AI advice per mark (session-only; read-only; keyed by markKey). Cleared
  // implicitly by keying — a mark with no entry shows the ✦ Ask AI button.
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<
    Record<string, { explanation: string; rewrite: string; error?: string }>
  >({});

  // AI check (Core 2): marks produced by the on-save AI pass, cached client-side
  // so the fast deterministic pass can render alongside them. Reconciled per
  // save using paragraph hashes so only changed paragraphs are re-sent.
  const aiMarksRef = useRef<Mark[]>(initialAiMarks ?? []);
  // When we rehydrate cached AI marks, seed the paragraph hashes to the CURRENT
  // body (via a lazy useRef initializer, computed once) so changedParagraphIndices
  // sees no change and the mount AI re-run is a no-op until the writer actually
  // edits. With no cached marks this seeds to [] (unchanged prior behavior).
  const aiHashesRef = useRef<string[]>(
    initialAiMarks && initialAiMarks.length > 0
      ? hashParagraphs(docToParagraphs(initialBody))
      : [],
  );
  const aiCheckSeqRef = useRef(0);
  const [aiChecking, setAiChecking] = useState(false);

  // Forward-declared so the plugin's getData can reach the click handler.
  const onSelectMarkRef = useRef<(markKey: string) => void>(() => {});

  // The plugin reads this each recompute (marks, open mark, host, click cb).
  // getPluginData is invoked ONLY from ProseMirror plugin lifecycle
  // (init/apply/decorations/handleClick) via createMarkDecorationPlugin, never
  // during React render, so its reads of stateRef/onSelectMarkRef are latest-ref
  // reads at dispatch time, not render-time.
  const getPluginData = useCallback((): MarkDecorationData => {
    const s = stateRef.current;
    return {
      marks: s.marks,
      openMarkKey: s.openMarkKey,
      noteHost,
      onUnderlineClick: (markKey) => onSelectMarkRef.current(markKey),
    };
  }, [noteHost]);

  // Register the decoration plugin once via a StarterKit-sibling extension.
  const decorationExtension = useMemo(
    () =>
      Extension.create({
        name: 'writeMarkDecorations',
        addProseMirrorPlugins() {
          return [createMarkDecorationPlugin(getPluginData)];
        },
      }),
    [getPluginData],
  );

  const editor = useEditor({
    // Next SSR: avoid a hydration mismatch by not rendering immediately.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Paragraphs only (§6). Drop headings/lists/quotes/code from the doc schema.
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      decorationExtension,
    ],
    content: initialBody as object,
  });

  // Debounced live re-check + save on every doc change.
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push deterministic marks, MERGED with the cached AI marks so both passes
  // coexist. The deterministic pass is instant; AI marks arrive on save.
  const pushDeterministicMarks = useCallback(
    (body: unknown) => {
      const paragraphs = docToParagraphs(body);
      const { marks } = checkManuscript({
        paragraphs,
        wiki,
        resolvedMarkKeys: stateRef.current.resolvedMarkKeys,
        chapterCounts: chapterCountsMap,
      });
      dispatch({ type: 'SET_MARKS', marks: mergeMarks(marks, aiMarksRef.current) });
    },
    [wiki, chapterCountsMap],
  );

  // Core 2: AI cross-checks the manuscript against the wiki on save. Sends only
  // the CHANGED paragraphs (cost control), reconciles with cached AI marks, and
  // merges with the current deterministic marks. Never writes the wiki.
  const runAiCheck = useCallback(
    async (body: unknown) => {
      if (!aiEnabled) return;
      const paragraphs = docToParagraphs(body);
      const changed = changedParagraphIndices(paragraphs, aiHashesRef.current);
      if (changed.length === 0) return;

      const seq = ++aiCheckSeqRef.current;
      setAiChecking(true);
      try {
        const res = await aiCheckChapter({
          paragraphs,
          changedIndices: changed,
          resolvedMarkKeys: stateRef.current.resolvedMarkKeys,
        });
        // Ignore a stale response if a newer check started meanwhile.
        if (seq !== aiCheckSeqRef.current) return;
        if (!res.ok) {
          dispatch({ type: 'SET_ERROR', error: res.error });
          return;
        }
        aiMarksRef.current = reconcileAiMarks(
          aiMarksRef.current,
          res.data.marks,
          changed,
          paragraphs.length,
        );
        aiHashesRef.current = hashParagraphs(paragraphs);
        pushDeterministicMarks(body);
        if (editor) editor.view.dispatch(editor.state.tr.setMeta('write-marks', true));
        // T-AICACHE: persist the reconciled FULL AI mark set so returning to this
        // chapter rehydrates the rail without re-calling the gateway. Fire-and-
        // forget: a cache write failure never blocks the editor. The server
        // stamps bodyHash/wikiHash so a later open knows if the row is still fresh.
        void persistChapterCheck({
          chapterNumber,
          universeId: activeUniverseId,
          bookId: activeBookId,
          body,
          marks: aiMarksRef.current,
        });
      } finally {
        if (seq === aiCheckSeqRef.current) setAiChecking(false);
      }
    },
    [aiEnabled, editor, pushDeterministicMarks, chapterNumber, activeUniverseId, activeBookId],
  );

  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      const body = editor.getJSON();
      dispatch({ type: 'EDIT_BODY', body });

      // Live deterministic check (debounced ~300ms), merged with cached AI marks.
      if (checkTimer.current) clearTimeout(checkTimer.current);
      checkTimer.current = setTimeout(() => {
        pushDeterministicMarks(body);
        editor.view.dispatch(editor.state.tr.setMeta('write-marks', true));
      }, CHECK_DEBOUNCE_MS);

      // Persist (debounced). A failed save surfaces (§8). On save success, run
      // the AI check over the changed paragraphs.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        dispatch({ type: 'SAVE_MANUSCRIPT' });
        const res = await saveManuscript({ chapterNumber, body });
        if (res.ok) {
          dispatch({ type: 'SAVE_SUCCEEDED' });
          void runAiCheck(body);
        } else {
          dispatch({ type: 'SET_ERROR', error: res.error });
        }
      }, SAVE_DEBOUNCE_MS);
    };

    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
      if (checkTimer.current) clearTimeout(checkTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [editor, wiki, chapterNumber, pushDeterministicMarks, runAiCheck]);

  // Redraw decorations whenever marks / open mark change (rail clicks, resolves).
  // The plugin (re)mounts the note-host widget on this dispatch; the portal into
  // noteHost re-evaluates on the same state.openMarkKey change that triggered us,
  // so no extra forced re-render is needed here.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta('write-marks', true));
  }, [editor, state.marks, state.openMarkKey]);

  // Check ON OPEN, not only on save. When a chapter mounts we re-run the
  // deterministic pass (contradiction + not-recorded) over the initial body and,
  // when AI is enabled, kick the AI cross-check once — so opening a chapter
  // immediately shows its marks instead of waiting for the first edit/save. The
  // component is keyed by chapterNumber (page.tsx), so this fires once per open.
  const didMountCheckRef = useRef(false);
  useEffect(() => {
    if (!editor || didMountCheckRef.current) return;
    didMountCheckRef.current = true;
    const body = editor.getJSON();
    pushDeterministicMarks(body);
    editor.view.dispatch(editor.state.tr.setMeta('write-marks', true));
    void runAiCheck(body);
  }, [editor, pushDeterministicMarks, runAiCheck]);

  // ---- Interactions -------------------------------------------------------

  const selectMark = useCallback((markKey: string) => {
    dispatch({ type: 'OPEN_MARK', markKey });
  }, []);
  useEffect(() => {
    onSelectMarkRef.current = selectMark;
  });

  const openMark = useMemo(
    () => state.marks.find((m) => m.markKey === state.openMarkKey) ?? null,
    [state.marks, state.openMarkKey],
  );

  // Ask the AI to explain a flagged run (read-only; grounds on the wiki server
  // side). Writes nothing; result lives only in session state keyed by markKey.
  const handleExplain = useCallback(
    async (mark: Mark) => {
      setAiBusyKey(mark.markKey);
      try {
        // Give the model the surrounding paragraph for context, and the exact
        // sentence so it can return a whole-sentence rewrite that splices cleanly.
        const paragraphs = docToParagraphs(stateRef.current.body);
        const paragraph = paragraphs[mark.position.paragraphIndex] ?? '';
        const sentence = editor
          ? resolveSentenceRange(editor.state.doc, mark)?.text
          : undefined;
        const res = await explainMark({
          quote: mark.quote,
          kind: mark.kind,
          noteText: mark.noteText,
          paragraph,
          sentence,
          entityId: mark.entityId,
        });
        setAiAdvice((prev) => ({
          ...prev,
          [mark.markKey]: res.ok
            ? { explanation: res.data.explanation, rewrite: res.data.rewrite }
            : { explanation: '', rewrite: '', error: res.error },
        }));
      } finally {
        setAiBusyKey(null);
      }
    },
    [editor],
  );

  const handleAction = useCallback(
    async (mark: Mark, action: MarkAction) => {
      const resolution = resolutionIdOf(action);
      if (resolution === 'wiki') {
        // "Add to the wiki" -> open the drill-down modal defaulted to the mark's
        // resolved target. The confirm gate does the write; nothing happens yet.
        setPendingPickerMark(mark);
        dispatch({ type: 'OPEN_MARK', markKey: null });
        return;
      }
      setBusy(true);
      try {
        if (resolution === 'text') {
          // "Change the sentence": put the writer where the fix goes and, when AI
          // is on, fetch a grounded rewrite so the button visibly DOES something.
          // Keep the note open so the suggestion + "Use in editor" stay reachable.
          selectRunInEditor(editor, mark);
          if (aiEnabled && !aiAdvice[mark.markKey]) {
            void handleExplain(mark);
          }
          return;
        }

        const res = await resolveMarkAction(mark.markKey, resolution, {
          quote: mark.quote,
        });
        if (!res.ok) {
          dispatch({ type: 'SET_ERROR', error: res.error });
          return;
        }

        if (res.data.kind === 'resolved') {
          // 'leave' persisted → suppress locally too (survives reload via DB).
          dispatch({ type: 'RESOLVE_MARK', markKey: mark.markKey, actionId: 'leave' });
        } else if (res.data.kind === 'needsConfirmation') {
          // The 'wiki' resolution is intercepted above and never reaches here; any
          // other needsConfirmation has no inline gate, so just close the note.
          dispatch({ type: 'OPEN_MARK', markKey: null });
        }
      } finally {
        setBusy(false);
      }
    },
    [editor, aiEnabled, aiAdvice, handleExplain],
  );

  const handlePickerCancel = useCallback(() => {
    // Cancel writes NOTHING (product rule 1). Reopen the mark's note so the
    // writer lands back where they were, not on a blank manuscript.
    const mark = pendingPickerMark;
    setPendingPickerMark(null);
    if (mark) dispatch({ type: 'OPEN_MARK', markKey: mark.markKey });
  }, [pendingPickerMark]);

  // The modal's confirm IS the wiki-write gate (product rule 1). The writer's
  // PickerResult maps through the SAME pure resolvePickerTarget /research uses;
  // the one bit it carries (entryId present) routes ENRICH vs MINT. /write has a
  // Mark, not a proposition, so it drives the manual-authoring actions directly
  // (createFact / createEntry) rather than /research's proposition-coupled
  // confirmCard. Mark-keyed ids make a double-confirm idempotent: insertFact and
  // insertEntry are both ON CONFLICT (id) DO UPDATE, so re-confirming the same
  // mark updates in place instead of stacking a duplicate.
  const handlePickerConfirm = useCallback(
    async (result: PickerResult) => {
      const mark = pendingPickerMark;
      if (!mark) return;
      const markKey = mark.markKey;
      setPendingPickerMark(null);
      setBusy(true);
      try {
        const args = resolvePickerTarget(result);
        if (args.enrichEntryId) {
          // Resolving a CONTRADICTION corrects the fact it contradicts in place;
          // any other enrich appends a new fact. Editing keeps the wiki from
          // holding both the old value and its correction (which re-flags).
          const writeMode = resolveWikiWriteMode(mark);
          const res =
            writeMode.mode === 'edit'
              ? await editFact({
                  factId: writeMode.factId,
                  key: args.entry.name,
                  value: args.entry.summary,
                })
              : await createFact({
                  id: `mark-fact-${markKey}`,
                  entryId: args.enrichEntryId,
                  key: args.entry.name,
                  value: args.entry.summary,
                });
          if (!res.ok) {
            dispatch({ type: 'SET_ERROR', error: res.error });
            return;
          }
        } else {
          // MINT. A brand-new category is a real categories row: mint it FIRST so
          // the entry's kind is that real category id, not the lore fallback. The
          // proposed NAME's presence is what routes to a category mint.
          const newCategoryName = result.proposeCategoryName?.trim();
          let kind: string = args.entry.kind;
          let shelf: Shelf = KIND_SHELF[args.entry.kind];
          if (newCategoryName) {
            const cat = await createCategory({
              id: `cat-${markKey}`,
              label: newCategoryName,
              shelf: defaultCategoryShelf(),
            });
            if (!cat.ok) {
              dispatch({ type: 'SET_ERROR', error: cat.error });
              return;
            }
            kind = cat.data.id;
            shelf = cat.data.shelf as Shelf;
          }
          const entry = await createEntry({
            id: `mint-${markKey}`,
            kind,
            shelf,
            name: args.entry.name,
            summary: args.entry.summary,
            worldId: activeWorldId,
          });
          if (!entry.ok) {
            dispatch({ type: 'SET_ERROR', error: entry.error });
            return;
          }
        }
        // Written -> resolve the mark locally so it drops off the rail and
        // survives reload (the wiki now records what the mark flagged).
        dispatch({ type: 'RESOLVE_MARK', markKey, actionId: 'leave' });
      } finally {
        setBusy(false);
      }
    },
    [pendingPickerMark, activeWorldId],
  );

  // Replace the flagged run's SENTENCE in the editor with the AI's suggested
  // rewrite (the model rewrites the whole sentence, so the splice is grammatical).
  // Falls back to the run range if the sentence can't be resolved. Edits the
  // MANUSCRIPT only (never the wiki), and only on the writer's click.
  const applyRewrite = useCallback(
    (mark: Mark, rewrite: string) => {
      if (!editor || !rewrite) return;
      const range =
        resolveSentenceRange(editor.state.doc, mark) ??
        resolveMarkRange(editor.state.doc, mark);
      if (!range) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: range.from, to: range.to }, rewrite)
        .run();
      dispatch({ type: 'OPEN_MARK', markKey: null });
    },
    [editor],
  );

  const selectChapter = useCallback(
    (n: number) => {
      if (n === chapterNumber) return;
      router.push(writeChapterHref(n));
    },
    [router, chapterNumber, writeChapterHref],
  );
  const addChapter = useCallback(() => {
    void createChapter().then((res) => {
      if (res.ok) router.push(writeChapterHref(res.data.number));
    });
  }, [router, writeChapterHref]);

  // Rename a chapter's title in place. The DB is the source of truth for the
  // left index + the manuscript heading, so on success we router.refresh() to
  // re-pull the server-rendered title rather than mirror it in client state.
  const handleRename = useCallback(
    (n: number, title: string) => {
      void renameChapter({ number: n, title, bookId: activeBookId }).then((res) => {
        if (res.ok) router.refresh();
        else dispatch({ type: 'SET_ERROR', error: res.error });
      });
    },
    [router, activeBookId],
  );

  const requestDeleteChapter = useCallback((n: number) => {
    setPendingDeleteNumber(n);
  }, []);

  // Confirm the delete: remove the chapter, then navigate to the surviving
  // sibling the server picked (nearest lower, else the new lowest) so the writer
  // never lands on a gone chapter. router.push re-resolves the page against the
  // surviving list, which also refreshes the left index.
  const confirmDeleteChapter = useCallback(() => {
    if (pendingDeleteNumber === null) return;
    setDeleteBusy(true);
    void deleteChapter({ number: pendingDeleteNumber, bookId: activeBookId }).then((res) => {
      setDeleteBusy(false);
      setPendingDeleteNumber(null);
      if (res.ok) {
        // push moves off the deleted chapter; refresh re-pulls the server chapter
        // list so the deleted row leaves the left index even when the client
        // router would otherwise serve the pre-delete list from its cache.
        router.push(writeChapterHref(res.data.next));
        router.refresh();
      } else dispatch({ type: 'SET_ERROR', error: res.error });
    });
  }, [pendingDeleteNumber, activeBookId, router, writeChapterHref]);

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        <WriteIndex
          chapters={chapters}
          selectedNumber={chapterNumber}
          onSelect={selectChapter}
          onCreate={addChapter}
          onRename={handleRename}
          onRequestDelete={requestDeleteChapter}
        />
        <div className={styles.manuscriptScroll}>
          <div className={styles.manuscript}>
            <div className={styles.eyebrow}>Chapter {numberWord(chapterNumber)}</div>
            <h1 className={styles.title}>{chapterTitle}</h1>
            <a
              className={styles.exportLink}
              href={`/api/export/${activeBookId}/chapter/${chapterNumber}`}
              data-testid="export-chapter"
            >
              Export chapter (Markdown)
            </a>
            <div className={styles.titleRule} />
            <div className={styles.editor}>
              <EditorContent editor={editor} />
            </div>
            <SaveStateFooter
              error={state.error}
              dirty={state.dirty}
              aiChecking={aiChecking}
            />
          </div>
        </div>

        <OutstandingRail
          marks={state.marks}
          openMarkKey={state.openMarkKey}
          onSelect={selectMark}
        />
      </div>

      {pendingPickerMark ? (
        <WikiTargetPicker
          resolvedTarget={writeMarkTarget(pendingPickerMark)}
          checkedAgainst={pendingPickerMark.checkedAgainst}
          categories={pickerCategories}
          entries={pickerEntries}
          onConfirm={handlePickerConfirm}
          onCancel={handlePickerCancel}
        />
      ) : null}

      {pendingDeleteNumber !== null ? (
        <ChapterDeleteDialog
          number={pendingDeleteNumber}
          title={chapters.find((c) => c.number === pendingDeleteNumber)?.title ?? ''}
          busy={deleteBusy}
          onConfirm={confirmDeleteChapter}
          onCancel={() => setPendingDeleteNumber(null)}
        />
      ) : null}

      {/* Portal the note into the plugin's widget host under the open paragraph. */}
      {openMark && noteHost
        ? createPortal(
            <InlineNote
              mark={openMark}
              busy={busy}
              onAction={handleAction}
              ai={{
                enabled: aiEnabled,
                busy: aiBusyKey === openMark.markKey,
                explanation: aiAdvice[openMark.markKey]?.explanation,
                rewrite: aiAdvice[openMark.markKey]?.rewrite,
                error: aiAdvice[openMark.markKey]?.error,
                onExplain: () => handleExplain(openMark),
                onApplyRewrite: (rewrite) => applyRewrite(openMark, rewrite),
              }}
            />,
            noteHost,
          )
        : null}
    </div>
  );
}

/**
 * The modal's ResolvedTarget DEFAULT for a /write mark. A contradiction/AI mark
 * carries a resolved target from the check engine (slice B) — use it verbatim.
 * A mark without one (older cached / deterministic) falls back to a MINT proposed
 * by the flagged phrase, seeding the fact key/value from the phrase + note so the
 * default write is one confirm away, still fully editable in the modal.
 */
function writeMarkTarget(mark: Mark): ResolvedTarget {
  return (
    mark.resolvedTarget ?? {
      category: {},
      entry: { proposeName: mark.quote },
      fact: { key: mark.quote, value: mark.noteText },
    }
  );
}

/** Spell small chapter numbers for the eyebrow ("Chapter seven"). */
function numberWord(n: number): string {
  const words = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'eleven', 'twelve',
  ];
  return words[n] ?? String(n);
}

/**
 * Select the mark's run in the editor so the author can rewrite it ('text'
 * action). Finds the quote in the target paragraph and sets a text selection.
 */
function selectRunInEditor(
  editor: ReturnType<typeof useEditor> | null,
  mark: Mark,
): void {
  if (!editor) return;
  const activeEditor = editor;
  const range = resolveMarkRange(activeEditor.state.doc, mark);
  if (!range) return;

  activeEditor
    .chain()
    .focus()
    .setTextSelection({ from: range.from, to: range.to })
    .scrollIntoView()
    .run();
}
