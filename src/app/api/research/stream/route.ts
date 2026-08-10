// F2b — streaming research answer route (App Router, POST, SSE).
//
// This is the runtime wiring over the proven pure helpers:
//   - streamComplete()        — SSE transport to the gateway (slice 1)
//   - visibleProsePrefix()    — mid-stream forwarding guard (never leaks the
//                               sentinel / cards JSON to the writer)
//   - finalizeStreamedAnswer()— the HARD GATE: persist ONCE on clean completion
//                               with a non-empty reply, persist NOTHING on abort
//                               / error / empty (no half-pair ever)
//   - insertResearchTurnPair()— F2a's atomic you+them(+cards) transaction
//
// Wire protocol (newline-delimited JSON frames, one JSON object per line):
//   {"type":"delta","text":"..."}                     zero+ times, prose only
//   {"type":"done","turns":[youTurn, themTurn]}       exactly once on success
//   {"type":"error","error":"..."}                    on failure before persist
//
// The client (ResearchScreen) dispatches APPEND_STREAMING_TURN up front, one
// STREAM_DELTA per `delta`, and RECONCILE_TURN on `done`. On `error` (or a
// dropped connection) it rolls the placeholder back — nothing was persisted.
//
// ABORT SAFETY: if the client disconnects, req.signal fires; we pass it into
// streamComplete so the upstream gateway fetch is torn down, mark the stream as
// NOT completed, and finalize with completed:false => persist nothing.

import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { streamComplete, aiEnabled } from "@/lib/ai/saarouters";
import { loadWikiSnapshot } from "@/lib/db/queries";
import { insertResearchTurnPair } from "@/lib/db/mutations";
import { deriveThreadTitle } from "@/lib/research/title";
import { CARDS_SENTINEL, visibleProsePrefix } from "@/lib/research/streamParse";
import { finalizeStreamedAnswer } from "@/lib/research/finalizeStream";

// Never statically optimize: this route always runs on request and streams.
export const dynamic = "force-dynamic";

interface StreamRequestBody {
  question?: string;
  threadId?: string;
  threadTitle?: string;
}

/** Build the Option-C prompt: prose first, then the sentinel, then cards JSON. */
function buildPrompt(question: string, threadTitle: string | undefined, gazetteer: string) {
  const system = [
    "You are a story-consistency collaborator for a fiction writer.",
    "You help them think through their own world. Ground every answer ONLY in the gazetteer provided; never invent contradicting facts.",
    "Reply as a thoughtful writing partner in 2-4 sentences of PLAIN PROSE first.",
    // Option C: prose, then the exact sentinel line, then a strict JSON array of
    // cards. The route splits on the sentinel; the writer never sees it or the
    // JSON. Emitting the sentinel verbatim is REQUIRED for cards to be captured.
    `Then, on its own, output EXACTLY this delimiter line (copy it verbatim, including the invisible characters):${CARDS_SENTINEL}`,
    "Immediately after the delimiter, output STRICT JSON only: an array of 2-3 cards shaped exactly as:",
    '[{"kind": "character|world|organization|lore|beat|question", "title": string, "body": string, "asKind": "character|world|organization|lore"}]',
    "title: <=6 words. body: one or two sentences. asKind: the wiki kind this card would become if written in.",
    "Output nothing after the JSON array.",
  ].join("\n");

  const user = [
    threadTitle ? `Thread: ${threadTitle}` : "",
    gazetteer ? `Gazetteer (the writer's wiki):\n${gazetteer}` : "Gazetteer: (empty)",
    "",
    `Writer asks: ${question}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

function frame(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: NextRequest) {
  let body: StreamRequestBody;
  try {
    body = (await req.json()) as StreamRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const question = (body.question ?? "").trim();
  const threadId = (body.threadId ?? "").trim();
  const threadTitle = body.threadTitle?.trim() || undefined;

  // Same guards as the blocking action, returned as plain JSON errors (the
  // client hasn't opened the stream yet).
  if (!question) return jsonError("Type a question first.", 400);
  if (!threadId) return jsonError("No active thread to write to.", 400);
  if (!aiEnabled()) {
    return jsonError("AI is not configured. Add SAAROUTERS_API_KEY to .env.local.", 400);
  }

  const wiki = await loadWikiSnapshot();
  const gazetteer = wiki.entries
    .map((e) => {
      const facts = e.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
      return `- ${e.name} (${e.kind})${e.summary ? ` — ${e.summary}` : ""}${facts ? ` [${facts}]` : ""}`;
    })
    .join("\n");
  const { system, user } = buildPrompt(question, threadTitle, gazetteer);

  const stamp = Date.now();
  const rid = randomUUID().slice(0, 8);
  const youId = `ai-you-${stamp}-${rid}`;
  const themId = `ai-them-${stamp}-${rid}`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The assembled buffer (prose + sentinel + cards JSON). Parsing runs on
      // THIS, at completion, never mid-stream.
      let buffer = "";
      // How many chars of the visible prose we have already forwarded, so we
      // emit only the new tail each tick.
      let forwarded = 0;
      // Only a clean message_stop flips this true; an abort / thrown error
      // leaves it false so finalize persists nothing.
      let completed = false;

      try {
        for await (const delta of streamComplete({
          system,
          messages: [{ role: "user", content: user }],
          maxTokens: 900,
          temperature: 0.7,
          signal: req.signal,
        })) {
          buffer += delta;
          // Forward only the safe-to-show prose tail (never the sentinel/JSON).
          const visible = visibleProsePrefix(buffer);
          if (visible.length > forwarded) {
            controller.enqueue(frame({ type: "delta", text: visible.slice(forwarded) }));
            forwarded = visible.length;
          }
        }
        // streamComplete returns (does not throw) on a clean message_stop.
        completed = true;
      } catch (err) {
        // Mid-stream failure or client abort: fall through to finalize with
        // completed:false, which persists nothing. Report the error unless the
        // client already went away.
        if (!req.signal.aborted) {
          controller.enqueue(frame({ type: "error", error: errText(err) }));
        }
      }

      try {
        const result = await finalizeStreamedAnswer({
          buffer,
          completed: completed && !req.signal.aborted,
          threadId,
          question,
          youId,
          themId,
          persist: (args) =>
            insertResearchTurnPair({
              threadId: args.threadId,
              youId: args.youId,
              themId: args.themId,
              who: { you: "You", them: "Collaborator" },
              question: args.question,
              reply: args.reply,
              cards: args.cards,
              autoTitle: deriveThreadTitle(args.question),
            }),
        });
        if (result) {
          controller.enqueue(
            frame({ type: "done", turns: [result.youTurn, result.themTurn] }),
          );
        }
      } catch (err) {
        // A persist failure after a clean stream: nothing was committed (the txn
        // rolled back), so the placeholder must roll back too.
        if (!req.signal.aborted) {
          controller.enqueue(frame({ type: "error", error: errText(err) }));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "The AI stream failed.";
}
