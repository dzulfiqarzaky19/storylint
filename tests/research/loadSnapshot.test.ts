import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  selectResearchThread,
  EMPTY_RESEARCH_SNAPSHOT,
  loadResearchThreads,
  loadResearchSnapshot,
} from "@/lib/db/research";
import type { ResearchThreadRow } from "@/lib/domain/types";

// The loader composes two DB queries; mock them so the empty-vs-non-empty
// branches are driven deterministically with no Postgres.
vi.mock("@/lib/db/queries", () => ({
  listResearchThreads: vi.fn(),
  getResearchThread: vi.fn(),
}));
import { listResearchThreads, getResearchThread } from "@/lib/db/queries";
const listMock = vi.mocked(listResearchThreads);
const getMock = vi.mocked(getResearchThread);

// -----------------------------------------------------------------------------
// Make research REAL — threads now START EMPTY (no seed). The loader used to
// synthesize a phantom "Salt as debt" thread on an empty table and then index
// threads[0]! unconditionally, which would CRASH once the table is genuinely
// empty. This locks the pure selection core:
//   - a non-empty set selects the requested id, falling back to the first;
//   - an EMPTY set selects nothing (null) instead of crashing, so the loader
//     can return a typed empty-state snapshot and the screen renders "no
//     threads yet" rather than a fabricated one.
// -----------------------------------------------------------------------------

function thread(over: Partial<ResearchThreadRow>): ResearchThreadRow {
  return { id: "t", title: "T", subtitle: "", sortOrder: 0, scope: "chat", ...over };
}

describe("selectResearchThread", () => {
  it("returns the thread matching the requested id", () => {
    const a = thread({ id: "a", sortOrder: 0 });
    const b = thread({ id: "b", sortOrder: 1 });
    expect(selectResearchThread([a, b], "b")).toEqual(b);
  });

  it("falls back to the first thread when the id is unknown", () => {
    const a = thread({ id: "a", sortOrder: 0 });
    const b = thread({ id: "b", sortOrder: 1 });
    expect(selectResearchThread([a, b], "nope")).toEqual(a);
  });

  it("falls back to the first thread when no id is given", () => {
    const a = thread({ id: "a", sortOrder: 0 });
    const b = thread({ id: "b", sortOrder: 1 });
    expect(selectResearchThread([a, b], undefined)).toEqual(a);
  });

  it("returns null for an EMPTY thread set instead of crashing", () => {
    // This is the anti-crash guard: no threads[0]! on an empty array.
    expect(selectResearchThread([], "anything")).toBeNull();
    expect(selectResearchThread([], undefined)).toBeNull();
  });
});

describe("EMPTY_RESEARCH_SNAPSHOT", () => {
  it("is a valid, inert empty-state snapshot (no thread, no turns)", () => {
    expect(EMPTY_RESEARCH_SNAPSHOT.threads).toEqual([]);
    expect(EMPTY_RESEARCH_SNAPSHOT.turns).toEqual([]);
    expect(EMPTY_RESEARCH_SNAPSHOT.initialVisibleTurnIds).toEqual([]);
    expect(EMPTY_RESEARCH_SNAPSHOT.threadId).toBe("");
    expect(EMPTY_RESEARCH_SNAPSHOT.question).toBe("");
  });
});

describe("loadResearchThreads (mutant B — no synthetic phantom)", () => {
  beforeEach(() => {
    listMock.mockReset();
    getMock.mockReset();
  });

  it("returns the empty list verbatim when the table is empty (no phantom thread)", async () => {
    listMock.mockResolvedValue([]);
    const threads = await loadResearchThreads();
    expect(threads).toEqual([]);
    expect(threads.length).toBe(0);
  });

  it("returns the DB threads unchanged when the table is non-empty", async () => {
    const rows: ResearchThreadRow[] = [thread({ id: "a" }), thread({ id: "b" })];
    listMock.mockResolvedValue(rows);
    expect(await loadResearchThreads()).toEqual(rows);
  });
});

describe("loadResearchSnapshot (mutant A — empty-guard returns the typed empty snapshot)", () => {
  beforeEach(() => {
    listMock.mockReset();
    getMock.mockReset();
  });

  it("returns the typed empty-state snapshot when there are NO threads (no crash)", async () => {
    listMock.mockResolvedValue([]);
    const snap = await loadResearchSnapshot();
    // Assert the SHAPE, not merely 'did not throw'.
    expect(snap.threads.length).toBe(0);
    expect(snap.threadId).toBe("");
    expect(snap.question).toBe("");
    expect(snap.turns).toEqual([]);
    expect(snap.initialVisibleTurnIds).toEqual([]);
    // getResearchThread must never be reached with no thread to load.
    expect(getMock).not.toHaveBeenCalled();
  });

  it("loads the selected thread's snapshot when threads exist", async () => {
    listMock.mockResolvedValue([thread({ id: "a", title: "Alpha", sortOrder: 0 })]);
    getMock.mockResolvedValue([]);
    const snap = await loadResearchSnapshot("a");
    expect(snap.threadId).toBe("a");
    expect(snap.question).toBe("Alpha");
    expect(snap.threads.length).toBe(1);
    expect(getMock).toHaveBeenCalledWith("a");
  });
});
