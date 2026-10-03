"use client";

import { useRef, useState, useTransition, type Dispatch } from "react";
import { useRouter } from "next/navigation";
import type { ResearchTurnWithCards } from "@/domain/types";
import type { ResearchSnapshot } from "@/domain/types";
import type { ResearchAction } from "@/features/research/state/researchStore";
import { readResearchStream } from "@/features/research/lib/readStream";
import { decideStreamEnd } from "@/features/research/lib/decideStreamEnd";
import { createThread } from "@/server/actions/research/threads";
import { clientErr } from "@/hooks/useServerAction";

export interface ResearchAskApi {
  draft: string;
  setDraft: (value: string) => void;
  asking: boolean;
  ask: (question: string) => void;
}

export function useResearchAsk(
  snapshot: ResearchSnapshot,
  activeWorldId: string,
  dispatch: Dispatch<ResearchAction>,
): ResearchAskApi {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const askInFlight = useRef(false);

  const ask = (question: string) => {
    if (!question || asking || askInFlight.current) return;
    askInFlight.current = true;
    setAsking(true);

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
          }
          throw new Error(message);
        }

        await readResearchStream(res.body.getReader(), {
          onDelta: (text) => {
            dispatch({ type: "STREAM_DELTA", turnId: tempThemId, text });
          },
          onDone: (turns) => {
            const [youTurn, themTurn] = turns;
            if (youTurn) dispatch({ type: "RECONCILE_TURN", tempTurnId: tempYouId, turn: youTurn });
            if (themTurn) {
              dispatch({ type: "RECONCILE_TURN", tempTurnId: tempThemId, turn: themTurn });
            }
            reconciled = true;
            if (createdThreadId) {
              router.push(`/research?thread=${encodeURIComponent(createdThreadId)}`);
            }
          },
          onError: (message) => {
            dispatch({ type: "SET_ERROR", error: message });
            sawError = true;
          },
        });

        if (!reconciled) {
          dispatch({ type: "ROLLBACK_STREAMING_TURN", turnIds: [tempYouId, tempThemId] });
          const decision = decideStreamEnd({ reconciled, sawError, question });
          if (decision.setError !== undefined) {
            dispatch({ type: "SET_ERROR", error: decision.setError });
          }
          if (decision.restoreDraft !== undefined) {
            setDraft(decision.restoreDraft);
          }
        }
      } catch (err) {
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
