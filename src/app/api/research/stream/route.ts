import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { streamComplete, aiEnabled } from "@/server/ai/saarouters";
import { loadWorldSnapshot } from "@/server/db/gazetteer/snapshots";
import { getResearchThreadWorldId, getResearchThread } from "@/server/db/research/queries";
import { insertResearchTurnPair } from "@/server/db/research/mutations";
import { deriveThreadTitle } from "@/server/research/title";
import { visibleProsePrefix } from "@/domain/research/streamParse";
import { finalizeStreamedAnswer } from "@/server/research/finalizeStream";
import { renderGrounding } from "@/server/ai/groundedAsk";
import { buildResearchPrompt } from "@/server/research/buildResearchPrompt";
import { loadWebSearchConfig } from "@/server/websearch/search/config";
import { retrieve, buildSearchImpl } from "@/server/websearch/retrieve";
import { enforceCitations } from "@/server/websearch/ground/enforceCitations";
import {
  renderWebContext,
  collectAllowedUrls,
} from "@/server/research/webSearchAdapter";

export const dynamic = "force-dynamic";
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

  if (!question) return jsonError("Type a question first.", 400);
  if (!threadId) return jsonError("No active thread to write to.", 400);
  if (!aiEnabled()) {
    return jsonError("AI is not configured. Add SAAROUTERS_API_KEY to .env.local.", 400);
  }

  const threadWorldId = await getResearchThreadWorldId(threadId);
  if (!threadWorldId) return jsonError("That thread no longer exists.", 404);
  const wiki = await loadWorldSnapshot(threadWorldId);
  const gazetteer = renderGrounding(wiki.entries);
  const priorTurns = await getResearchThread(threadId);
  const history = priorTurns.map((t) => ({ side: t.side, text: t.text }));
  const { system, user } = buildResearchPrompt(question, threadTitle, gazetteer, false, history);

  let webSystem = system;
  let webUser = user;
  let allowedUrls: string[] = [];
  try {
    const cfg = loadWebSearchConfig(process.env);
    if (cfg.enabled) {
      const retrieval = await retrieve(question, {
        searchImpl: buildSearchImpl(cfg),
        maxRead: cfg.maxResults,
        signal: req.signal,
      });
      const context = renderWebContext(retrieval);
      allowedUrls = collectAllowedUrls(retrieval);
      if (context) {
        webUser = `${user}\n\n${context}`;
        webSystem = buildResearchPrompt(question, threadTitle, gazetteer, true, history).system;
      }
    }
  } catch {
    webSystem = system;
    webUser = user;
    allowedUrls = [];
  }

  const stamp = Date.now();
  const rid = randomUUID().slice(0, 8);
  const youId = `ai-you-${stamp}-${rid}`;
  const themId = `ai-them-${stamp}-${rid}`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let forwarded = 0;
      let completed = false;

      try {
        for await (const delta of streamComplete({
          system: webSystem,
          messages: [{ role: "user", content: webUser }],
          maxTokens: 900,
          signal: req.signal,
        })) {
          buffer += delta;
          const visible = visibleProsePrefix(buffer);
          if (visible.length > forwarded) {
            controller.enqueue(frame({ type: "delta", text: visible.slice(forwarded) }));
            forwarded = visible.length;
          }
        }
        completed = true;
      } catch (err) {
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
