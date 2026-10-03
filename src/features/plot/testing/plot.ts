import { vi } from 'vitest';

import type { PlotBeat, PlotChapter, PlotLane } from '@/domain/plot';
import type { PlotEdit } from '../hooks/usePlotEdit';

// Builders for plot component tests. Imported by *.test.tsx files only.

export function beat(chapterNumber: number, over: Partial<PlotBeat> = {}): PlotBeat {
  return {
    chapterNumber,
    summary: `Beat in chapter ${chapterNumber}`,
    warn: null,
    resolves: false,
    abandons: false,
    ...over,
  };
}

export function lane(id: string, name: string, over: Partial<PlotLane> = {}): PlotLane {
  return {
    id,
    name,
    label: 'Oath',
    ownerName: null,
    beats: [],
    lastAdvanced: null,
    neglect: 0,
    state: 'open',
    resolvedAt: null,
    colorIndex: 0,
    ...over,
  };
}

export function chapters(count: number): PlotChapter[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ch${i + 1}`,
    number: i + 1,
    title: `Chapter ${i + 1}`,
  }));
}

/** A PlotEdit whose every action is a spy. */
export function plotEdit(over: Partial<PlotEdit> = {}): PlotEdit {
  return {
    pending: false,
    error: null,
    clearError: vi.fn(),
    rename: vi.fn(),
    setState: vi.fn(),
    saveBeat: vi.fn(),
    removeBeat: vi.fn(),
    moveBeat: vi.fn(),
    createLane: vi.fn(),
    deleteLane: vi.fn(),
    ...over,
  };
}
