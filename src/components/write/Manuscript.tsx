'use client';

/**
 * Manuscript (HANDOFF §6/§7/§8) — the full Write screen client.
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
import { useRouter } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { checkManuscript } from '@/lib/check';
import type { Mark, MarkAction, WikiSnapshot as CheckWiki } from '@/lib/check';
import {
  mergeMarks,
  hashParagraphs,
  changedParagraphIndices,
  reconcileAiMarks,
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
  explainMark,
  aiCheckChapter,
} from '@/lib/actions/write';
import { docToParagraphs } from '@/lib/write/adapters';
import {
  createMarkDecorationPlugin,
  resolveMarkRange,
  resolveSentenceRange,
  type MarkDecorationData,
} from './markDecorations';
import { InlineNote } from './InlineNote';
import { OutstandingRail } from './OutstandingRail';
import WriteIndex, { type WriteIndexChapter } from './WriteIndex';
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
  /** AI gateway configured at load; gates the inline note's ✦ Ask AI affordance. */
  aiEnabled?: boolean;
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
  aiEnabled = false,
}: ManuscriptProps) {
  const router = useRouter();
  // Rebuild the serializable entries into a Map once; used by every live check.
  const chapterCountsMap = useMemo(
    () => new Map(chapterCounts ?? []),
    [chapterCounts],
  );
  const [state, dispatch] = useReducer(
    writeReducer,
    { chapterNumber, body: initialBody, marks: initialMarks, resolvedMarkKeys },
    initWriteState,
  );

  // Latest reducer state for the plugin's getData() closure and debounced jobs.
  const stateRef = useRef<WriteState>(state);
  stateRef.current = state;

  // Stable DOM host for the inline note; the plugin places it, React portals into it.
  const noteHostRef = useRef<HTMLElement | null>(null);
  if (noteHostRef.current === null && typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.setAttribute('data-write-note-host', '');
    noteHostRef.current = el;
  }

  // Re-render trigger so the portal follows the host once the widget mounts it.
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const [busy, setBusy] = useState(false);

  // AI advice per mark (session-only; read-only; keyed by markKey). Cleared
  // implicitly by keying — a mark with no entry shows the ✦ Ask AI button.
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<
    Record<string, { explanation: string; rewrite: string; error?: string }>
  >({});

  // AI check (Core 2): marks produced by the on-save AI pass, cached client-side
  // so the fast deterministic pass can render alongside them. Reconciled per
  // save using paragraph hashes so only changed paragraphs are re-sent.
  const aiMarksRef = useRef<Mark[]>([]);
  const aiHashesRef = useRef<string[]>([]);
  const aiCheckSeqRef = useRef(0);
  const [aiChecking, setAiChecking] = useState(false);

  // Forward-declared so the plugin's getData can reach the click handler.
  const onSelectMarkRef = useRef<(markKey: string) => void>(() => {});

  // The plugin reads this each recompute (marks, open mark, host, click cb).
  const getPluginData = useCallback((): MarkDecorationData => {
    const s = stateRef.current;
    return {
      marks: s.marks,
      openMarkKey: s.openMarkKey,
      noteHost: noteHostRef.current,
      onUnderlineClick: (markKey) => onSelectMarkRef.current(markKey),
    };
  }, []);

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
      } finally {
        if (seq === aiCheckSeqRef.current) setAiChecking(false);
      }
    },
    [aiEnabled, editor, pushDeterministicMarks],
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
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta('write-marks', true));
    // The widget may have (re)mounted the host; refresh the portal.
    bump();
  }, [editor, state.marks, state.openMarkKey, bump]);

  // ---- Interactions -------------------------------------------------------

  const selectMark = useCallback((markKey: string) => {
    dispatch({ type: 'OPEN_MARK', markKey });
  }, []);
  onSelectMarkRef.current = selectMark;

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
          // 'wiki' → the confirmed wiki path owns the actual write (product rule 1).
          // Surface it as a non-error notice; the Wiki screen handles confirmation.
          dispatch({
            type: 'SET_ERROR',
            error:
              'Send this to the wiki thread to write it in — nothing enters the gazetteer without a yes.',
          });
          dispatch({ type: 'OPEN_MARK', markKey: null });
        }
      } finally {
        setBusy(false);
      }
    },
    [editor, aiEnabled, aiAdvice, handleExplain],
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
      router.push(`/write?chapter=${n}`);
    },
    [router, chapterNumber],
  );
  const addChapter = useCallback(() => {
    void createChapter().then((res) => {
      if (res.ok) router.push(`/write?chapter=${res.data.number}`);
    });
  }, [router]);

  return (
    <div className={styles.screen}>
      <div className={styles.body}>
        <WriteIndex
          chapters={chapters}
          selectedNumber={chapterNumber}
          onSelect={selectChapter}
          onCreate={addChapter}
        />
        <div className={styles.manuscriptScroll}>
          <div className={styles.manuscript}>
            <div className={styles.eyebrow}>Chapter {numberWord(chapterNumber)}</div>
            <h1 className={styles.title}>{chapterTitle}</h1>
            <div className={styles.titleRule} />
            <div className={styles.editor}>
              <EditorContent editor={editor} />
            </div>
            {state.error ? (
              <p className={`${styles.saveState} ${styles.saveError}`} role="status">
                {state.error}
              </p>
            ) : (
              <p className={styles.saveState} role="status">
                {state.dirty ? 'Saving…' : aiChecking ? 'Checking with AI…' : 'Saved'}
              </p>
            )}
          </div>
        </div>

        <OutstandingRail
          marks={state.marks}
          openMarkKey={state.openMarkKey}
          onSelect={selectMark}
        />
      </div>

      {/* Portal the note into the plugin's widget host under the open paragraph. */}
      {openMark && noteHostRef.current
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
            noteHostRef.current,
          )
        : null}
    </div>
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
