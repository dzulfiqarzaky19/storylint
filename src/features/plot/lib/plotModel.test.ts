import { describe, expect, it } from 'vitest';

import type { PlotBeat, PlotChapter, PlotLane } from '@/domain/plot';
import { buildStoryRows, LANE_COLORS, laneColor, LONG_GAP, longGapChapters, statusLabel } from './plotModel';

const beat = (chapterNumber: number): PlotBeat => ({
  chapterNumber,
  summary: `Beat in chapter ${chapterNumber}`,
  warn: null,
  resolves: false,
  abandons: false,
});

function lane(over: Partial<PlotLane> = {}): PlotLane {
  return {
    id: 'lane',
    name: 'The oath',
    label: 'Oath',
    ownerName: null,
    beats: [],
    lastAdvanced: 1,
    neglect: 0,
    state: 'open',
    resolvedAt: null,
    colorIndex: 0,
    ...over,
  };
}

const chapters = (count: number): PlotChapter[] =>
  Array.from({ length: count }, (_, i) => ({ id: `ch${i + 1}`, number: i + 1, title: `Chapter ${i + 1}` }));

describe('laneColor', () => {
  it('gives each lane the colour at its index', () => {
    expect(laneColor(lane({ colorIndex: 2 }))).toBe(LANE_COLORS[2]);
  });

  it('wraps around when there are more lanes than colours', () => {
    expect(laneColor(lane({ colorIndex: LANE_COLORS.length + 1 }))).toBe(LANE_COLORS[1]);
  });
});

describe('statusLabel', () => {
  it.each<[string, Partial<PlotLane>, string]>([
    ['a resolved plotline', { state: 'resolved', resolvedAt: 9 }, 'done'],
    ['an abandoned plotline', { state: 'abandoned', resolvedAt: 4 }, 'abandoned'],
    ['a plotline with no beats yet', { lastAdvanced: null }, 'idle'],
    ['a stalled plotline', { state: 'stalled', neglect: 6 }, 'stalled'],
    ['a plotline advanced in the current chapter', { neglect: 0 }, 'fresh'],
    ['a plotline quiet for fewer chapters than the long gap', { neglect: LONG_GAP - 1 }, 'cool'],
    ['a plotline quiet for exactly the long gap', { neglect: LONG_GAP }, 'warm'],
  ])('classes %s as %s', (_name, over, cls) => {
    expect(statusLabel(lane(over), 10).cls).toBe(cls);
  });

  it('reports resolved even when the plotline never advanced', () => {
    expect(statusLabel(lane({ state: 'resolved', resolvedAt: 2, lastAdvanced: null }), 10).cls).toBe('done');
  });

  it('names the chapter a plotline was resolved in', () => {
    expect(statusLabel(lane({ state: 'resolved', resolvedAt: 9 }), 10).text).toContain('ch.9');
  });

  it('says how many chapters a quiet plotline has gone without moving', () => {
    expect(statusLabel(lane({ neglect: 4 }), 10).text).toContain('4 chapters');
  });
});

describe('longGapChapters', () => {
  it('flags every chapter inside a gap of the long-gap length or more', () => {
    expect([...longGapChapters(lane({ beats: [beat(1), beat(5)] }))]).toEqual([2, 3, 4]);
  });

  it('flags nothing for a gap one chapter short of the long gap', () => {
    expect(longGapChapters(lane({ beats: [beat(1), beat(4)] })).size).toBe(0);
  });

  it('measures gaps in chapter order, whatever order the beats are stored in', () => {
    expect([...longGapChapters(lane({ beats: [beat(5), beat(1)] }))]).toEqual([2, 3, 4]);
  });

  it('flags nothing before the first beat or after the last', () => {
    expect(longGapChapters(lane({ beats: [beat(5)] })).size).toBe(0);
  });
});

describe('buildStoryRows', () => {
  it('lists one row per beat, with the chapter title', () => {
    const rows = buildStoryRows(lane({ beats: [beat(1), beat(2)] }), chapters(3));

    expect(rows).toEqual([
      { kind: 'beat', chapterNumber: 1, chapterTitle: 'Chapter 1', beat: beat(1) },
      { kind: 'beat', chapterNumber: 2, chapterTitle: 'Chapter 2', beat: beat(2) },
    ]);
  });

  it('collapses a long gap into a single stall row spanning it', () => {
    const rows = buildStoryRows(lane({ beats: [beat(1), beat(5)] }), chapters(6));

    expect(rows.map((r) => (r.kind === 'stall' ? `stall ${r.from}-${r.to}` : `beat ${r.chapterNumber}`))).toEqual([
      'beat 1',
      'stall 2-4',
      'beat 5',
    ]);
  });

  it('shows no row for a short gap', () => {
    const rows = buildStoryRows(lane({ beats: [beat(1), beat(3)] }), chapters(3));

    expect(rows.map((r) => r.kind)).toEqual(['beat', 'beat']);
  });

  it('shows two stall rows for two separate long gaps', () => {
    const rows = buildStoryRows(lane({ beats: [beat(1), beat(5), beat(9)] }), chapters(9));

    expect(rows.filter((r) => r.kind === 'stall')).toEqual([
      { kind: 'stall', from: 2, to: 4 },
      { kind: 'stall', from: 6, to: 8 },
    ]);
  });

  it('shows nothing for a plotline with no beats', () => {
    expect(buildStoryRows(lane(), chapters(5))).toEqual([]);
  });
});
