import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PlotLane, PlotProgression } from '@/domain/plot';
import Plot from './Plot';
import { beat, chapters, lane } from './testing/plot';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  createPlotlineAction: vi.fn(),
  deletePlotlineAction: vi.fn(),
  renamePlotlineAction: vi.fn(),
  setPlotlineStateAction: vi.fn(),
  upsertBeatAction: vi.fn(),
  deleteBeatAction: vi.fn(),
  moveBeatAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/server/actions/plot/plotlines', () => ({
  createPlotlineAction: mocks.createPlotlineAction,
  deletePlotlineAction: mocks.deletePlotlineAction,
  renamePlotlineAction: mocks.renamePlotlineAction,
  setPlotlineStateAction: mocks.setPlotlineStateAction,
}));
vi.mock('@/server/actions/plot/beats', () => ({
  upsertBeatAction: mocks.upsertBeatAction,
  deleteBeatAction: mocks.deleteBeatAction,
  moveBeatAction: mocks.moveBeatAction,
}));

const OATH = lane('oath', 'The oath', { beats: [beat(1)], lastAdvanced: 1, neglect: 1 });

const progression = (lanes: PlotLane[]): PlotProgression => ({
  chapters: chapters(2),
  lanes,
  latestChapter: 2,
  completion: { resolved: 0, owed: lanes.length, percent: 0 },
});

const setup = (lanes: PlotLane[] = [OATH]) =>
  render(<Plot progression={progression(lanes)} worldId="world-verge" bookId="book-oath" />);

const openStory = async () => {
  await userEvent.click(screen.getByRole('rowheader', { name: 'Open The oath story so far' }));
  return within(screen.getByRole('dialog', { name: 'Story so far, The oath' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const action of [
    mocks.createPlotlineAction,
    mocks.deletePlotlineAction,
    mocks.renamePlotlineAction,
    mocks.setPlotlineStateAction,
    mocks.upsertBeatAction,
    mocks.deleteBeatAction,
    mocks.moveBeatAction,
  ]) {
    action.mockResolvedValue({ ok: true, data: undefined });
  }
});

describe('Plot', () => {
  describe('with nothing plotted', () => {
    it('explains the empty board instead of drawing a grid', () => {
      setup([]);

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Nothing plotted yet');
      expect(screen.queryByRole('grid')).toBeNull();
    });

    it('creates the first plotline in the active world, then refreshes', async () => {
      setup([]);

      await userEvent.click(screen.getByRole('button', { name: '+ new plotline' }));
      await userEvent.type(
        screen.getByRole('textbox', { name: 'New plotline name' }),
        'The oath{Enter}',
      );

      expect(mocks.createPlotlineAction).toHaveBeenCalledExactlyOnceWith({
        worldId: 'world-verge',
        name: 'The oath',
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    });
  });

  it('draws the lanes on the timeline', () => {
    setup();

    const board = within(screen.getByRole('region', { name: 'Plot timeline' }));
    expect(board.getByRole('grid')).toBeDefined();
    expect(board.getByRole('rowheader', { name: 'Open The oath story so far' })).toBeDefined();
  });

  describe('the story drawer', () => {
    it('opens for the lane that is clicked, and closes again', async () => {
      setup();
      expect(screen.queryByRole('dialog')).toBeNull();

      const story = await openStory();
      await userEvent.click(story.getByRole('button', { name: 'Close' }));

      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('edits', () => {
    it('save a beat against the active book', async () => {
      setup();

      await userEvent.click(
        screen.getByRole('button', { name: 'Add a beat to The oath at chapter 2' }),
      );
      await userEvent.type(screen.getByRole('textbox', { name: 'Beat summary' }), 'She doubts{Enter}');

      expect(mocks.upsertBeatAction).toHaveBeenCalledExactlyOnceWith({
        bookId: 'book-oath',
        plotlineId: 'oath',
        chapterNumber: 2,
        summary: 'She doubts',
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    });

    it('delete a beat from the story drawer', async () => {
      setup();
      const story = await openStory();

      await userEvent.click(story.getByRole('button', { name: 'delete' }));

      expect(mocks.deleteBeatAction).toHaveBeenCalledExactlyOnceWith({
        bookId: 'book-oath',
        plotlineId: 'oath',
        chapterNumber: 1,
      });
    });

    it('rename and resolve the lane from the story drawer', async () => {
      setup();
      const story = await openStory();

      await userEvent.click(story.getByRole('button', { name: 'resolved' }));
      await userEvent.click(story.getByRole('button', { name: 'Rename plotline' }));
      await userEvent.type(story.getByRole('textbox', { name: 'Plotline name' }), ', kept{Enter}');

      expect(mocks.setPlotlineStateAction).toHaveBeenCalledExactlyOnceWith({
        plotlineId: 'oath',
        state: 'resolved',
        resolvedAt: 1,
      });
      expect(mocks.renamePlotlineAction).toHaveBeenCalledExactlyOnceWith({
        plotlineId: 'oath',
        name: 'The oath, kept',
      });
    });
  });

  describe('when an edit fails', () => {
    it('shows the refusal and does not refresh', async () => {
      mocks.upsertBeatAction.mockResolvedValue({ ok: false, error: 'Chapter 2 is locked.' });
      setup();

      await userEvent.click(
        screen.getByRole('button', { name: 'Add a beat to The oath at chapter 2' }),
      );
      await userEvent.type(screen.getByRole('textbox', { name: 'Beat summary' }), 'She doubts{Enter}');

      expect((await screen.findByRole('alert')).textContent).toContain('Chapter 2 is locked.');
      expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('shows a thrown error, which can be dismissed', async () => {
      mocks.upsertBeatAction.mockRejectedValue(new Error('offline'));
      setup();

      await userEvent.click(
        screen.getByRole('button', { name: 'Add a beat to The oath at chapter 2' }),
      );
      await userEvent.type(screen.getByRole('textbox', { name: 'Beat summary' }), 'She doubts{Enter}');
      expect((await screen.findByRole('alert')).textContent).toContain('offline');

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
