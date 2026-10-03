export interface SseEvent {
  event: string | null;
  data: string;
}

export function parseSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const events: SseEvent[] = [];
  let searchFrom = 0;
  let sep = normalized.indexOf("\n\n", searchFrom);
  while (sep !== -1) {
    const frame = normalized.slice(searchFrom, sep);
    const parsed = parseFrame(frame);
    if (parsed) events.push(parsed);
    searchFrom = sep + 2;
    sep = normalized.indexOf("\n\n", searchFrom);
  }
  return { events, rest: normalized.slice(searchFrom) };
}

function parseFrame(frame: string): SseEvent | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

interface DeltaEvent {
  type: string;
  delta?: { type?: string; text?: string };
}

export function textDeltaFrom(evt: SseEvent): string | null {
  let parsed: DeltaEvent;
  try {
    parsed = JSON.parse(evt.data) as DeltaEvent;
  } catch {
    return null;
  }
  if (parsed.type !== "content_block_delta") return null;
  if (parsed.delta?.type !== "text_delta") return null;
  return typeof parsed.delta.text === "string" ? parsed.delta.text : null;
}

export function isStreamStop(evt: SseEvent): boolean {
  if (evt.event === "message_stop") return true;
  try {
    return (JSON.parse(evt.data) as DeltaEvent).type === "message_stop";
  } catch {
    return false;
  }
}
