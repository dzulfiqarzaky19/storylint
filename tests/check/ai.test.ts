/**
 * AI-check mapping layer — pure, no network (src/lib/check/ai.ts).
 *
 * Covers the three things that must be right for AI findings to render safely:
 *   1. mapping AI JSON -> the same Mark shape the deterministic engine emits,
 *   2. the GROUNDING GUARD (drop any quote not verbatim in the manuscript),
 *   3. changed-paragraph diffing + reconciliation (cost control on save).
 */

import { describe, it, expect } from 'vitest';
import {
  aiResultToMarks,
  mergeMarks,
  paragraphHash,
  hashParagraphs,
  changedParagraphIndices,
  reconcileAiMarks,
  AI_CONFLICT_RULE_ID,
  AI_MISSING_RULE_ID,
  AI_NEW_ENTITY_RULE_ID,
  type AiCheckResponse,
} from '@/lib/check/ai';
import type { Mark } from '@/lib/check';

const paragraphs = [
  'The Sept had twenty-three members that winter, never more.',
  'She wore her grandmother’s iron key on a cord.',
];

describe('aiResultToMarks — mapping + grounding', () => {
  it('maps a verbatim conflict to a conflict Mark with a stable key', () => {
    const res: AiCheckResponse = {
      conflicts: [
        {
          quote: 'twenty-three members',
          entryId: 'sept',
          reason: 'The Quiet Sept has twenty-one members.',
          recorded: 'Members: Twenty-one, never more',
        },
      ],
    };
    const marks = aiResultToMarks(res, paragraphs);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.kind).toBe('conflict');
    expect(marks[0]!.ruleId).toBe(AI_CONFLICT_RULE_ID);
    expect(marks[0]!.quote).toBe('twenty-three members');
    expect(marks[0]!.position.paragraphIndex).toBe(0);
    expect(marks[0]!.markKey).toMatch(/^[0-9a-f]{40}$/);
    // Actions mirror the deterministic conflict set (rule-1-safe include path).
    expect(marks[0]!.actions.map((a) => a.id)).toEqual(['wiki', 'text', 'leave']);
  });

  it('maps a verbatim missing finding to a missing Mark', () => {
    const res: AiCheckResponse = {
      missing: [
        { quote: 'her grandmother’s iron key', reason: 'A new object, not in the wiki.' },
      ],
    };
    const marks = aiResultToMarks(res, paragraphs);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.kind).toBe('missing');
    expect(marks[0]!.ruleId).toBe(AI_MISSING_RULE_ID);
    expect(marks[0]!.position.paragraphIndex).toBe(1);
    expect(marks[0]!.actions.map((a) => a.id)).toEqual(['add', 'edit', 'leave']);
  });

  it('DROPS a hallucinated quote that is not verbatim in the manuscript', () => {
    const res: AiCheckResponse = {
      conflicts: [
        { quote: 'a dragon named Fyre', entryId: 'sept', reason: 'invented' },
      ],
      missing: [{ quote: 'the crystal throne', reason: 'invented' }],
    };
    const marks = aiResultToMarks(res, paragraphs);
    expect(marks).toHaveLength(0);
  });

  it('uses the model’s paragraph hint to disambiguate an identical substring', () => {
    const dup = ['the key turned twice', 'she found the key again'];
    const res: AiCheckResponse = {
      missing: [{ quote: 'the key', reason: 'x', ...( { paragraph: 1 } as object) }],
    };
    const marks = aiResultToMarks(res, dup, { preferredIndexByQuote: { 'the key': 1 } });
    expect(marks).toHaveLength(1);
    expect(marks[0]!.position.paragraphIndex).toBe(1);
  });

  it('de-duplicates identical findings', () => {
    const res: AiCheckResponse = {
      conflicts: [
        { quote: 'twenty-three members', entryId: 'sept', reason: 'a' },
        { quote: 'twenty-three members', entryId: 'sept', reason: 'a' },
      ],
    };
    expect(aiResultToMarks(res, paragraphs)).toHaveLength(1);
  });

  it('treats a bracketed entryId ("[sept]") as the bare id for a stable key', () => {
    // The live gateway sometimes echoes the gazetteer id with brackets. The
    // markKey must not change based on that formatting, else the same finding
    // would produce two different squiggles across checks.
    const bracketed: AiCheckResponse = {
      conflicts: [{ quote: 'twenty-three members', entryId: '[sept]', reason: 'a' }],
    };
    const bare: AiCheckResponse = {
      conflicts: [{ quote: 'twenty-three members', entryId: 'sept', reason: 'a' }],
    };
    const a = aiResultToMarks(bracketed, paragraphs);
    const b = aiResultToMarks(bare, paragraphs);
    expect(a).toHaveLength(1);
    expect(a[0]!.markKey).toBe(b[0]!.markKey);
  });
});

// TCK-016 (newEntity): the write check can now propose a GENUINELY NEW entity the
// prose introduces (e.g. "Saint Osk" when Osk isn't in the wiki), routed through
// the SAME writer-confirm path as `missing` (RULE 1: propose->confirm, nothing
// auto-enters) but with a DISTINCT ruleId so it de-dupes separately and carries
// the proposed name + kind. RULE 2: it is NOT a conflict.
describe('aiResultToMarks — newEntity (TCK-016)', () => {
  const prose = [
    'Saint Osk the One-Eyed walked the salt road at dawn.',
    'She wore her grandmother’s iron key on a cord.',
  ];

  it('maps a verbatim newEntity to a missing-kind Mark with the DISTINCT ai-new-entity ruleId', () => {
    const res: AiCheckResponse = {
      newEntity: [
        {
          quote: 'Saint Osk the One-Eyed',
          name: 'Saint Osk',
          kind: 'character',
          reason: 'A new person not in the wiki yet.',
        },
      ],
    };
    const marks = aiResultToMarks(res, prose);
    expect(marks).toHaveLength(1);
    // Rides the missing/confirm path (RULE 1) but is tagged distinctly.
    expect(marks[0]!.kind).toBe('missing');
    expect(marks[0]!.ruleId).toBe(AI_NEW_ENTITY_RULE_ID);
    expect(marks[0]!.ruleId).not.toBe(AI_MISSING_RULE_ID);
    expect(marks[0]!.quote).toBe('Saint Osk the One-Eyed');
    expect(marks[0]!.position.paragraphIndex).toBe(0);
    // Same writer-confirm affordances as a plain missing finding.
    expect(marks[0]!.actions.map((a) => a.id)).toEqual(['add', 'edit', 'leave']);
    // The proposed name + kind are surfaced in the rail/note copy.
    expect(`${marks[0]!.rail} ${marks[0]!.noteText}`).toContain('Saint Osk');
    expect(`${marks[0]!.rail} ${marks[0]!.noteText}`).toMatch(/character/i);
  });

  it('de-dupes SEPARATELY from a plain missing finding on the same quote (distinct ruleId)', () => {
    // Same quote, one as missing, one as newEntity → two marks (different keys),
    // because the ruleId is part of the markKey. A shared ruleId would collapse them.
    const res: AiCheckResponse = {
      missing: [{ quote: 'Saint Osk the One-Eyed', reason: 'x' }],
      newEntity: [{ quote: 'Saint Osk the One-Eyed', name: 'Saint Osk', kind: 'character', reason: 'y' }],
    };
    const marks = aiResultToMarks(res, prose);
    expect(marks).toHaveLength(2);
    const ruleIds = marks.map((m) => m.ruleId).sort();
    expect(ruleIds).toEqual([AI_MISSING_RULE_ID, AI_NEW_ENTITY_RULE_ID].sort());
  });

  it('clamps an INVALID kind to lore (no throw), mirroring the 015 allowlist', () => {
    const res: AiCheckResponse = {
      newEntity: [
        { quote: 'the salt road', name: 'The Salt Road', kind: 'planet' as unknown as 'world', reason: 'z' },
      ],
    };
    const marks = aiResultToMarks(res, prose);
    expect(marks).toHaveLength(1);
    // Invalid kind must not surface as-is; it falls back to the safe default.
    expect(`${marks[0]!.rail} ${marks[0]!.noteText}`).not.toMatch(/planet/i);
    expect(`${marks[0]!.rail} ${marks[0]!.noteText}`).toMatch(/lore/i);
  });

  it('DROPS a hallucinated newEntity quote not verbatim in the manuscript (grounding guard)', () => {
    const res: AiCheckResponse = {
      newEntity: [{ quote: 'the crystal throne of Fyre', name: 'Fyre', kind: 'world', reason: 'invented' }],
    };
    expect(aiResultToMarks(res, prose)).toHaveLength(0);
  });

  it('REGRESSION: conflict + missing findings are UNCHANGED when newEntity is also present', () => {
    const res: AiCheckResponse = {
      conflicts: [{ quote: 'the salt road', entryId: 'road', reason: 'c' }],
      missing: [{ quote: 'her grandmother’s iron key', reason: 'm' }],
      newEntity: [{ quote: 'Saint Osk the One-Eyed', name: 'Saint Osk', kind: 'character', reason: 'n' }],
    };
    const marks = aiResultToMarks(res, prose);
    const conflict = marks.find((m) => m.kind === 'conflict');
    const plainMissing = marks.find((m) => m.ruleId === AI_MISSING_RULE_ID);
    expect(conflict?.ruleId).toBe(AI_CONFLICT_RULE_ID);
    expect(conflict?.actions.map((a) => a.id)).toEqual(['wiki', 'text', 'leave']);
    expect(plainMissing?.kind).toBe('missing');
    expect(plainMissing?.actions.map((a) => a.id)).toEqual(['add', 'edit', 'leave']);
  });
});

function fakeMark(paragraphIndex: number, key: string): Mark {
  return {
    markKey: key,
    kind: 'conflict',
    ruleId: 'ai-conflict',
    quote: `q${key}`,
    rail: 'r',
    noteText: 'n',
    actions: [],
    position: { paragraphIndex, occurrenceIndex: 0 },
  };
}

describe('mergeMarks', () => {
  it('unions by markKey, deterministic winning on collision', () => {
    const det = [fakeMark(0, 'k1')];
    const ai = [fakeMark(0, 'k1'), fakeMark(1, 'k2')];
    const merged = mergeMarks(det, ai);
    expect(merged.map((m) => m.markKey).sort()).toEqual(['k1', 'k2']);
  });
});

describe('changed-paragraph diffing', () => {
  it('first pass (no previous hashes) reports every paragraph', () => {
    expect(changedParagraphIndices(paragraphs, [])).toEqual([0, 1]);
  });

  it('reports only the paragraph that actually changed', () => {
    const prev = hashParagraphs(paragraphs);
    const edited = [...paragraphs];
    edited[1] = 'She wore her grandmother’s iron key on a leather cord.';
    expect(changedParagraphIndices(edited, prev)).toEqual([1]);
  });

  it('paragraphHash ignores whitespace-only differences', () => {
    expect(paragraphHash('a   b')).toBe(paragraphHash('a b'));
  });
});

describe('reconcileAiMarks', () => {
  it('keeps marks on untouched paragraphs and replaces those on changed ones', () => {
    const previous = [fakeMark(0, 'old0'), fakeMark(1, 'old1')];
    const fresh = [fakeMark(1, 'new1')];
    const out = reconcileAiMarks(previous, fresh, [1], 2);
    const keys = out.map((m) => m.markKey).sort();
    expect(keys).toEqual(['new1', 'old0']); // old1 dropped, old0 kept, new1 added
  });

  it('drops marks pointing past the current paragraph count (deleted paragraphs)', () => {
    const previous = [fakeMark(0, 'a'), fakeMark(2, 'b')];
    const out = reconcileAiMarks(previous, [], [], 1); // only paragraph 0 exists now
    expect(out.map((m) => m.markKey)).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// T-WRITE-WIKI-MODAL Slice B: every AI mark carries TWO distinct nested objects
//   resolvedTarget  = where an accepted write GOES (may propose a NEW entry)
//   checkedAgainst  = the existing wiki SOURCE the signal was read from
// Both ride the SAME marks jsonb (no new cache column). These lock the contract:
// the objects must survive the cache round-trip, be produced on the cold AI path,
// resolve factId SERVER-SIDE (never fabricated), and keep the id-XOR-proposeName
// modal invariant. The cache is a transparent jsonb column: page.tsx casts the
// stored value straight back to Mark[], so JSON.parse(JSON.stringify(...)) is a
// faithful stand-in for the DB round-trip.
// ---------------------------------------------------------------------------
describe('Slice B — resolvedTarget + checkedAgainst on AI marks', () => {
  const roundTrip = (marks: Mark[]): Mark[] =>
    JSON.parse(JSON.stringify(marks)) as Mark[];

  it('a conflict carries checkedAgainst {entryId,factKey,recordedValue} + a server-resolved factId, all intact through the cache round-trip', () => {
    const res: AiCheckResponse = {
      conflicts: [
        {
          quote: 'twenty-three members',
          entryId: 'sept',
          factKey: 'members',
          reason: 'The Quiet Sept has twenty-one members.',
          recorded: 'Twenty-one, never more',
        },
      ],
    };
    const marks = aiResultToMarks(res, paragraphs, {
      // The server builds this map from the loaded gazetteer snapshot; the model
      // never sees or echoes the opaque fact id.
      factIdByEntryKey: { ['sept\u0000members']: 'fact-sept-members-uuid' },
    });
    expect(marks).toHaveLength(1);

    const persisted = roundTrip(marks)[0]!;
    // checkedAgainst = the wiki SOURCE the AI read from.
    expect(persisted.checkedAgainst).toEqual({
      entryId: 'sept',
      factKey: 'members',
      factId: 'fact-sept-members-uuid',
      recordedValue: 'Twenty-one, never more',
    });
    // resolvedTarget = where an accepted write GOES; a conflict targets the
    // same existing entry (category left for the modal to resolve from the id).
    expect(persisted.resolvedTarget).toEqual({
      category: {},
      entry: { id: 'sept' },
    });
  });

  it('the server resolves factId from (entryId,factKey) and NEVER fabricates one when the key does not match', () => {
    const res: AiCheckResponse = {
      conflicts: [
        {
          quote: 'twenty-three members',
          entryId: 'sept',
          factKey: 'not-a-real-key',
          reason: 'x',
          recorded: 'Twenty-one',
        },
      ],
    };
    const marks = aiResultToMarks(res, paragraphs, {
      factIdByEntryKey: { ['sept\u0000members']: 'fact-sept-members-uuid' },
    });
    const ca = marks[0]!.checkedAgainst!;
    // The echoed key + entry are still recorded (they are what the model saw),
    // but factId stays UNSET rather than being invented from a non-match.
    expect(ca.entryId).toBe('sept');
    expect(ca.factKey).toBe('not-a-real-key');
    expect(ca.factId).toBeUndefined();
  });

  it('a missing finding about a KNOWN entity resolves the write-target to that entry + fact, with no wiki source (that is why it is missing)', () => {
    const res: AiCheckResponse = {
      missing: [
        {
          quote: 'her grandmother’s iron key',
          entryId: 'sept',
          reason: 'A new object tied to the Sept.',
          key: 'heirloom',
          value: 'iron key on a cord',
        },
      ],
    };
    const persisted = roundTrip(
      aiResultToMarks(res, paragraphs, {
        factIdByEntryKey: { ['sept\u0000members']: 'x' },
      }),
    )[0]!;
    expect(persisted.resolvedTarget).toEqual({
      category: {},
      entry: { id: 'sept' },
      fact: { key: 'heirloom', value: 'iron key on a cord' },
    });
    // The KNOWN entity IS the source the fact was checked against, but no
    // single fact matched (that is WHY it is missing), so only entryId is set
    // — factKey/factId/recordedValue stay absent.
    expect(persisted.checkedAgainst).toEqual({ entryId: 'sept' });
  });

  it('a newEntity finding proposes a NEW target by name (never an id) and carries no checkedAgainst', () => {
    const prose = ['Saint Osk blessed the harbour before the ships sailed.'];
    const res: AiCheckResponse = {
      newEntity: [
        { quote: 'Saint Osk', name: 'Saint Osk', kind: 'character', reason: 'A new figure.' },
      ],
    };
    const persisted = roundTrip(aiResultToMarks(res, prose))[0]!;
    // id-XOR-proposeName: a proposed target has proposeName set and NO id at both
    // the category and entry levels, matching the modal's "+ Add new" branch.
    const rt = persisted.resolvedTarget!;
    expect(rt.category.id).toBeUndefined();
    expect(rt.category.proposeName).toBe('character');
    expect(rt.entry.id).toBeUndefined();
    expect(rt.entry.proposeName).toBe('Saint Osk');
    expect(rt.entry.proposeKind).toBe('character');
    expect(persisted.checkedAgainst).toBeUndefined();
  });

  it('older cached marks with NEITHER object rehydrate cleanly (both stay optional)', () => {
    // A mark produced before Slice B has no resolvedTarget/checkedAgainst. The
    // round-trip must not invent them, so the modal can fall back to a blank pick.
    const legacy: Mark[] = aiResultToMarks(
      { conflicts: [{ quote: 'twenty-three members', reason: 'x' }] },
      paragraphs,
    );
    const persisted = roundTrip(legacy)[0]!;
    // entryId empty -> no resolvedTarget, no checkedAgainst (nothing to point at).
    expect(persisted.resolvedTarget).toBeUndefined();
    expect(persisted.checkedAgainst).toBeUndefined();
  });
});
