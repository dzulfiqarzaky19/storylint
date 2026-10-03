import type { ResearchTurnWithCards } from "@/domain/types";

export interface DeltaFrame {
  type: "delta";
  text: string;
}
export interface DoneFrame {
  type: "done";
  turns: ResearchTurnWithCards[];
}
export interface ErrorFrame {
  type: "error";
  error: string;
}

export type StreamFrame = DeltaFrame | DoneFrame | ErrorFrame;

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (turns: ResearchTurnWithCards[]) => void;
  onError: (message: string) => void;
}

export interface ByteReader {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>;
}

export async function readResearchStream(
  reader: ByteReader,
  handlers: StreamHandlers,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatchLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let frame: StreamFrame;
    try {
      frame = JSON.parse(trimmed) as StreamFrame;
    } catch {
      return;
    }
    if (frame.type === "delta") {
      handlers.onDelta(frame.text);
    } else if (frame.type === "done") {
      handlers.onDone(frame.turns);
    } else if (frame.type === "error") {
      handlers.onError(frame.error);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        dispatchLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
    }
    if (done) break;
  }

  if (buffer) dispatchLine(buffer);
}
