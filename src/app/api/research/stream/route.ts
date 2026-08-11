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
import { visibleProsePrefix } from "@/lib/research/streamParse";
import { finalizeStreamedAnswer } from "@/lib/research/finalizeStream";
import { buildGazetteer } from "@/lib/research/gazetteer";
import { buildResearchPrompt } from "@/lib/research/buildResearchPrompt";
import { loadWebSearchConfig } from "@/lib/websearch/search/config";
import { retrieve, buildSearchImpl } from "@/lib/websearch/retrieve";
import { enforceCitations } from "@/lib/websearch/ground/enforceCitations";
import {
  renderWebContext,
  collectAllowedUrls,
} from "@/lib/research/webSearchAdapter";

// Never statically optimize: this route always runs on request and streams.
export const dynamic = "force-dynamic";
// The web-search engine (safeFetch: node:net BlockList, undici Agent, linkedom)
// requires the Node.js runtime — it cannot run on the Edge runtime.
export const runtime = "nodejs";

interface StreamRequestBody {
  question?: string;
  threadId?: string;
  threadTitle?: string;
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

  // F5: fully-free research chat — the AI always sees the ENTIRE wiki, no scope
  // narrowing. buildGazetteer renders every entry; buildResearchPrompt frames
  // free-context answering (no scope directive) and still emits CARDS_SENTINEL.
  const wiki = await loadWikiSnapshot();
  const gazetteer = buildGazetteer(wiki.entries);
  const { system, user } = buildResearchPrompt(question, threadTitle, gazetteer);

  // F10: real web search. Retrieve + read full-body pages for this question, then
  // append them as grounded prompt context and hold the answer's citations to
  // exactly the URLs we read. Fail-soft: any engine error yields no web context
  // (empty read set) and the answer falls back to wiki-only grounding — the chat
  // never breaks because search is down or unconfigured.
  let webUser = user;
  let allowedUrls: string[] = [];
  try {
    const cfg = loadWebSearchConfig(process.env);
    // Opt-in ACTIVATION (deliberate safe default, not a bug): only run live
    // retrieval when web search is CONFIGURED (a real SearXNG base URL present),
    // so a fresh clone boots green with zero surprise network egress. The
    // Wikipedia floor stays standalone-CAPABLE (buildProviders always appends it)
    // — a future explicit opt-in can flip activation here without touching the
    // engine. Unconfigured => wiki-only, no network.
    if (cfg.enabled) {
      const retrieval = await retrieve(question, {
        searchImpl: buildSearchImpl(cfg),
        maxRead: cfg.maxResults,
        signal: req.signal,
      });
      const context = renderWebContext(retrieval);
      allowedUrls = collectAllowedUrls(retrieval);
      if (context) webUser = `${user}\n\n${context}`;
    }
  } catch {
    // Fail-soft: keep wiki-only prompt, no allowed citations.
    webUser = user;
    allowedUrls = [];
  }

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
        // NB: deliberately DO NOT pass `temperature` here. The SaaRouters
        // gateway returns an empty 200 then ECONNRESET when a temperature is
        // sent alongside a larger prompt, and F5 made this prompt big (the full
        // wiki gazetteer). The blocking path omits temperature for the same
        // reason (saarouters.ts) — the route wants gateway-default sampling.
        for await (const delta of streamComplete({
          system,
          messages: [{ role: "user", content: webUser }],
          maxTokens: 900,
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
              // F10 grounding gate: strip any citation to a URL we did NOT read,
              // so a stored answer never links a fabricated source.
              reply: enforceCitations(args.reply, allowedUrls),
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
