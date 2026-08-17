import { describe, expect, it } from "vitest";
import { resolveWikiWriteMode } from "@/lib/write/resolveWikiWriteMode";
import { AI_CONFLICT_RULE_ID, AI_MISSING_RULE_ID, AI_NEW_ENTITY_RULE_ID } from "@/lib/check/ai";
import type { Mark, CheckedAgainst } from "@/lib/check";

// -----------------------------------------------------------------------------
// resolveWikiWriteMode — how a confirmed /write picker enrich hits the wiki:
// EDIT the contradicted fact in place vs APPEND a new fact. PURE.
//
// THE BUG THIS LOCKS (user-caught, pre-gate): before this router, handlePickerConfirm
// routed EVERY enrich through createFact (append). Resolving a CONTRADICTION then
// STACKED a second fact beside the one it contradicts, leaving the wiki holding BOTH
// the old value and the correction — and the next check re-flags the same conflict.
//
// The one signal that a real row is being CORRECTED is a CONFLICT mark
// (kind: 'conflict' — an AI conflict OR a deterministic rule) whose resolved
// checkedAgainst.factId points at an actual facts row. Anything else — a conflict
// the engine never matched to a row (factId unset; no path fabricates one), or any
// non-conflict enrich (a 'missing' / new-entity record) — has no row to correct, so
// it appends. Guarding on kind (not ruleId) is what lets BOTH conflict sources edit
// while every 'missing' mark still adds.
//
// MUTATION TARGET (reverted after RED): drop the `&& factId` guard, or the
// `kind === 'conflict'` guard, and the 'create'-expecting cases flip to 'edit'
// (or vice versa) -> RED here instead of on a live screen.
// -----------------------------------------------------------------------------

function mark(overrides: Partial<Mark>): Mark {
  return {
    markKey: "mk-1",
    kind: "conflict",
    ruleId: AI_CONFLICT_RULE_ID,
    quote: "q",
    rail: "r",
    noteText: "n",
    actions: [],
    position: { paragraphIndex: 0, occurrenceIndex: 0 },
    ...overrides,
  } as Mark;
}

function checkedAgainst(overrides: Partial<CheckedAgainst>): CheckedAgainst {
  return { ...overrides };
}

describe("resolveWikiWriteMode — edit-in-place vs append routing", () => {
  it("CONFLICT with a resolved factId -> EDIT that fact in place (the correction)", () => {
    const m = mark({
      ruleId: AI_CONFLICT_RULE_ID,
      checkedAgainst: checkedAgainst({ entryId: "e1", factKey: "chair-count", factId: "f-42" }),
    });
    expect(resolveWikiWriteMode(m)).toEqual({ mode: "edit", factId: "f-42" });
  });

  it("CONFLICT whose server never matched a row (factId UNSET) -> APPEND (new key on a known entry)", () => {
    const m = mark({
      ruleId: AI_CONFLICT_RULE_ID,
      checkedAgainst: checkedAgainst({ entryId: "e1", factKey: "chair-count" }),
    });
    expect(resolveWikiWriteMode(m)).toEqual({ mode: "create" });
  });

  it("CONFLICT with no checkedAgainst at all -> APPEND", () => {
    const m = mark({ ruleId: AI_CONFLICT_RULE_ID, checkedAgainst: undefined });
    expect(resolveWikiWriteMode(m)).toEqual({ mode: "create" });
  });

  it("a MISSING mark never edits, even if it somehow carries a factId -> APPEND", () => {
    // Only a conflict (kind: 'conflict') corrects an existing fact; an
    // unrecorded-detail mark is kind: 'missing' and records a NEW fact. Guarding on
    // kind (not just factId presence) keeps that line.
    const m = mark({
      kind: "missing",
      ruleId: AI_MISSING_RULE_ID,
      checkedAgainst: checkedAgainst({ entryId: "e1", factId: "f-99" }),
    });
    expect(resolveWikiWriteMode(m)).toEqual({ mode: "create" });
  });

  it("a NEW-ENTITY mark with a stray factId -> APPEND (mint path, never an edit)", () => {
    // New-entity proposals are kind: 'missing' too (there is no fact row yet).
    const m = mark({
      kind: "missing",
      ruleId: AI_NEW_ENTITY_RULE_ID,
      checkedAgainst: checkedAgainst({ factId: "f-77" }),
    });
    expect(resolveWikiWriteMode(m)).toEqual({ mode: "create" });
  });
});
