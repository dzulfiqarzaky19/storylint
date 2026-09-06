"use client";

import { useRef, useState, useTransition, type Dispatch } from "react";
import { useRouter } from "next/navigation";
import type { ResearchTurnWithCards } from "@/lib/domain/types";
import type { ResearchSnapshot } from "@/lib/db/research";
import type { ResearchAction } from "@/lib/state/researchStore";
import { readResearchStream } from "@/lib/research/readStream";
import { decideStreamEnd } from "@/lib/research/decideStreamEnd";
import { createThread } from "@/lib/actions/research";
import { clientErr } from "@/components/hooks/useServerAction";

export interface ResearchAskApi {
  /** The ask-box draft (session-only). */
  draft: string;
  setDraft: (value: string) => void;
  /** True while a streaming ask is out; disables the input. */
  asking: boolean;
  /** The single real-AI entry point: ask box submit AND every prompt chip. */
  ask: (question: string) => void;
}

/**
 * The /research streaming ask engine, lifted out of Research (T-ARCH-14).
 * It owns the ask-box draft, the in-flight guard, and the whole POST→stream→
 * reconcile / rollback lifecycle. The reducer stays the sole owner of turns; this
 * hook only DISPATCHES the streaming actions in order, so the behaviour
 * (optimistic placeholders, delta growth, done-reconcile, error/abort rollback,
 * auto-thread creation, URL sync) is byte-for-byte the same as before the lift.
 */
export function useResearchAsk(
  snapshot: ResearchSnapshot,
  activeWorldId: string,
  dispatch: Dispatch<ResearchAction>,
): ResearchAskApi {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  // Synchronous re-entrancy guard. `asking` is React state, so two calls fired
  // in the same tick would both read `asking === false` before either commits;
  // this ref short-circuits the second. Reset in ask's finally, same as `asking`.
  const askInFlight = useRef(false);

  const ask = (question: string) => {
    if (!question || asking || askInFlight.current) return;
    askInFlight.current = true;
    setAsking(true);

    // Client-side placeholder ids. The server generates its OWN real ids and
    // returns the persisted turns in `done`; RECONCILE_TURN remaps these temp
    // ids to the persisted ids (and folds any card kept/inWiki flags).
    // `ask` runs only on a user action (ask box submit / prompt chip), never
    // during render, so a one-off `Date.now()` temp id is intentional and stable
    // for this call (same pattern as Wiki's handler id-gen).
    const stamp = Date.now();
    const tempYouId = `stream-you-${stamp}`;
    const tempThemId = `stream-them-${stamp}`;
    const threadId = snapshot.threadId;

    const youPlaceholder: ResearchTurnWithCards = {
      id: tempYouId,
      threadId,
      ordinal: -1,
      side: "you",
      who: "You",
      text: question,
      cards: [],
    };
    const themPlaceholder: ResearchTurnWithCards = {
      id: tempThemId,
      threadId,
      ordinal: -1,
      side: "them",
      who: "Collaborator",
      text: "",
      cards: [],
    };

    dispatch({ type: "APPEND_STREAMING_TURN", turns: [youPlaceholder, themPlaceholder] });
    setDraft("");

    startTransition(async () => {
      let reconciled = false;
      let sawError = false;
      try {
        // T-RESEARCH-1: with NO active thread (an empty research surface), the
        // first question auto-creates a default thread in the ACTIVE world and
        // asks against it — instead of erroring "No active thread". createThread
        // returns the real id; we chat against it now and sync the URL AFTER the
        // exchange persists (a mid-stream router.push would remount and abort it).
        let activeThreadId = threadId;
        let createdThreadId: string | null = null;
        if (!activeThreadId) {
          const created = await createThread({ worldId: activeWorldId });
          if (!created.ok) throw new Error(created.error ?? "Could not start a thread.");
          activeThreadId = created.data.threadId;
          createdThreadId = created.data.threadId;
        }
        const res = await fetch("/api/research/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question,
            threadId: activeThreadId,
            // A pre-existing thread carries its title (memory/auto-title); an
            // auto-created thread has none yet, so send undefined and let the
            // route derive it from this first question.
            threadTitle: createdThreadId
              ? undefined
              : snapshot.threads.find((t) => t.id === activeThreadId)?.title,
          }),
        });

        if (!res.ok || !res.body) {
          let message = "The AI stream failed to start.";
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            /* non-JSON error body */
          }
          throw new Error(message);
        }

        await readResearchStream(res.body.getReader(), {
          onDelta: (text) => {
            dispatch({ type: "STREAM_DELTA", turnId: tempThemId, text });
          },
          onDone: (turns) => {
            // Reconcile in order: [youPersisted, themPersisted].
            const [youTurn, themTurn] = turns;
            if (youTurn) dispatch({ type: "RECONCILE_TURN", tempTurnId: tempYouId, turn: youTurn });
            if (themTurn) {
              dispatch({ type: "RECONCILE_TURN", tempTurnId: tempThemId, turn: themTurn });
            }
            reconciled = true;
            // T-RESEARCH-1: now that the auto-created thread has a persisted turn,
            // point the URL at it so the rail selects it and a refresh keeps it.
            if (createdThreadId) {
              router.push(`/research?thread=${encodeURIComponent(createdThreadId)}`);
            }
          },
          onError: (message) => {
            dispatch({ type: "SET_ERROR", error: message });
            sawError = true;
          },
        });

        // No `done` frame => nothing was persisted; drop the placeholders.
        if (!reconciled) {
          dispatch({ type: "ROLLBACK_STREAMING_TURN", turnIds: [tempYouId, tempThemId] });
          // A stream can close with NO terminal frame at all (slow/aborted
          // gateway, dropped connection). Without this the user saw the turn
          // vanish silently. `decideStreamEnd` surfaces a retry-oriented error
          // and restores the draft ONLY for that case, and never clobbers an
          // error the route already reported via `onError`.
          const decision = decideStreamEnd({ reconciled, sawError, question });
          if (decision.setError !== undefined) {
            dispatch({ type: "SET_ERROR", error: decision.setError });
          }
          if (decision.restoreDraft !== undefined) {
            setDraft(decision.restoreDraft);
          }
        }
      } catch (err) {
        // Transport failure / abort: the server persisted nothing, so remove the
        // placeholders and surface the error.
        dispatch({ type: "ROLLBACK_STREAMING_TURN", turnIds: [tempYouId, tempThemId] });
        dispatch({ type: "SET_ERROR", error: clientErr(err) });
      } finally {
        askInFlight.current = false;
        setAsking(false);
      }
    });
  };

  return { draft, setDraft, asking, ask };
}
