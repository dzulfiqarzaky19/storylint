import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PlotEdit } from '../hooks/usePlotEdit';
import { beat, chapters, lane, plotEdit } from '../testing/plot';
import { Grid } from './Grid';

// Beats in chapters 1 and 6, so chapters 2 to 5 are a long gap.
const OATH = lane('oath', 'The oath', {
  beats: [beat(1), beat(6)],
  lastAdvanced: 6,
  ownerName: 'Maren',
});
// Resolved in chapter 2, so nothing can be plotted after it.
const LEDGER = lane('ledger', 'The ledger', {
  label: 'Mystery',
  beats: [beat(2, { resolves: true })],
  lastAdvanced: 2,
  state: 'resolved',
  resolvedAt: 2,
  colorIndex: 1,
});

const setup = (edit: PlotEdit = plotEdit()) => {
  const onOpen = vi.fn();
  render(
    <Grid lanes={[OATH, LEDGER]} chapters={chapters(6)} latestChapter={6} onOpen={onOpen} edit={edit} />,
  );
  const [oath, ledger] = screen.getAllByRole('row');
  return { edit, onOpen, oath: oath!, ledger: ledger! };
};

const cell = (row: HTMLElement, chapter: number) => within(row).getAllByRole('gridcell')[chapter - 1]!;
const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Grid', () => {
  it('heads a column for every chapter', () => {
    setup();

    const grid = screen.getByRole('grid', { name: 'Plot progression by chapter' });
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .slice(1)
        .map((head) => head.textContent),
    ).toEqual(['Ch.1Chapter 1', 'Ch.2Chapter 2', 'Ch.3Chapter 3', 'Ch.4Chapter 4', 'Ch.5Chapter 5', 'Ch.6Chapter 6']);
  });

  it('labels each lane with its name, kind, owner and status', () => {
    const { oath, ledger } = setup();

    expect(within(oath).getByRole('rowheader').textContent).toContain('The oathOathMaren');
    expect(within(oath).getByRole('rowheader').textContent).toContain('advanced ch.6 · current');
    expect(within(ledger).getByRole('rowheader').textContent).toContain('✓ resolved · ch.2');
  });

  describe('opening a lane', () => {
    it('opens from a click on its label', async () => {
      const { onOpen } = setup();

      await userEvent.click(screen.getByRole('rowheader', { name: 'Open The ledger story so far' }));

      expect(onOpen).toHaveBeenCalledExactlyOnceWith('ledger');
    });

    it.each(['{Enter}', ' '])('opens from the keyboard with "%s"', async (key) => {
      const { onOpen } = setup();
      screen.getByRole('rowheader', { name: 'Open The oath story so far' }).focus();

      await userEvent.keyboard(key);

      expect(onOpen).toHaveBeenCalledExactlyOnceWith('oath');
    });
  });

  describe('deleting a lane', () => {
    it('deletes once confirmed, without opening the lane', async () => {
      const confirm = vi.fn(() => true);
      vi.stubGlobal('confirm', confirm);
      const { edit, onOpen } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Delete plotline The oath' }));

      expect(confirm).toHaveBeenCalledExactlyOnceWith(
        'Delete plotline "The oath"? Its beats are hidden with it.',
      );
      expect(edit.deleteLane).toHaveBeenCalledExactlyOnceWith('oath');
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('keeps the lane when the confirm is declined', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false));
      const { edit } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Delete plotline The oath' }));

      expect(edit.deleteLane).not.toHaveBeenCalled();
    });
  });

  describe('the cells of a lane', () => {
    it('show a beat where the lane advanced', () => {
      const { oath } = setup();

      expect(within(cell(oath, 1)).getByRole('button').textContent).toContain('Beat in chapter 1');
    });

    it('flag a long gap between two beats', () => {
      const { oath } = setup();

      expect(
        within(oath)
          .getAllByRole('gridcell')
          .map((c) => c.getAttribute('aria-label')),
      ).toEqual([
        null,
        'arc stalled at chapter 2',
        'arc stalled at chapter 3',
        'arc stalled at chapter 4',
        'arc stalled at chapter 5',
        null,
      ]);
    });

    it('offer a beat before the lane began', () => {
      const { ledger } = setup();

      expect(
        within(cell(ledger, 1)).getByRole('button', {
          name: 'Add a beat to The ledger at chapter 1',
        }),
      ).toBeDefined();
    });

    it('are closed after the lane was resolved', () => {
      const { ledger } = setup();

      for (const chapter of [3, 4, 5, 6]) {
        expect(cell(ledger, chapter).childElementCount).toBe(0);
      }
    });
  });

  describe('editing a beat', () => {
    it('rewrites an existing beat', async () => {
      const { edit, oath } = setup();

      await userEvent.click(within(cell(oath, 1)).getByRole('button'));
      const input = screen.getByRole('textbox', { name: 'Beat summary' });
      expect(input).toHaveProperty('value', 'Beat in chapter 1');
      await userEvent.clear(input);
      await userEvent.type(input, 'She swears it{Enter}');

      expect(edit.saveBeat).toHaveBeenCalledExactlyOnceWith('oath', 1, 'She swears it');
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('adds a beat to an empty cell', async () => {
      const { edit } = setup();

      await userEvent.click(
        screen.getByRole('button', { name: 'Add a beat to The ledger at chapter 1' }),
      );
      await userEvent.type(screen.getByRole('textbox', { name: 'Beat summary' }), 'A page is missing');
      await userEvent.click(screen.getByRole('button', { name: 'save' }));

      expect(edit.saveBeat).toHaveBeenCalledExactlyOnceWith('ledger', 1, 'A page is missing');
    });

    it('adds a beat from a stalled cell', async () => {
      const { edit, oath } = setup();

      await userEvent.click(within(cell(oath, 3)).getByRole('button', { name: 'arc stalled' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Beat summary' }), 'She doubts{Enter}');

      expect(edit.saveBeat).toHaveBeenCalledExactlyOnceWith('oath', 3, 'She doubts');
    });

    it('abandons the edit on cancel', async () => {
      const { edit, oath } = setup();

      await userEvent.click(within(cell(oath, 1)).getByRole('button'));
      await userEvent.click(screen.getByRole('button', { name: 'cancel' }));

      expect(edit.saveBeat).not.toHaveBeenCalled();
      expect(within(cell(oath, 1)).getByRole('button').textContent).toContain('Beat in chapter 1');
    });
  });

  describe('dragging a beat', () => {
    it('moves it to an empty cell of the same lane', () => {
      const { edit, oath } = setup();
      fireEvent.dragStart(within(cell(oath, 1)).getByRole('button'), {
        dataTransfer: dataTransfer(),
      });

      // fireEvent returns false once a handler calls preventDefault, which is
      // how a drop target says it accepts the drag.
      expect(fireEvent.dragOver(cell(oath, 3))).toBe(false);
      fireEvent.drop(cell(oath, 3));

      expect(edit.moveBeat).toHaveBeenCalledExactlyOnceWith('oath', 1, 3);
    });

    it('cannot leave its lane', () => {
      const { edit, oath, ledger } = setup();
      fireEvent.dragStart(within(cell(oath, 1)).getByRole('button'), {
        dataTransfer: dataTransfer(),
      });

      expect(fireEvent.dragOver(cell(ledger, 1))).toBe(true);
      fireEvent.drop(cell(ledger, 1));

      expect(edit.moveBeat).not.toHaveBeenCalled();
    });

    it('stops accepting drops once the drag ends', () => {
      const { edit, oath } = setup();
      const dragged = within(cell(oath, 1)).getByRole('button');
      fireEvent.dragStart(dragged, { dataTransfer: dataTransfer() });
      fireEvent.dragEnd(dragged);

      fireEvent.drop(cell(oath, 3));

      expect(edit.moveBeat).not.toHaveBeenCalled();
    });
  });

  it('locks every edit while one is pending', () => {
    const { oath, ledger } = setup(plotEdit({ pending: true }));

    expect(screen.getByRole('button', { name: 'Delete plotline The oath' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(cell(oath, 3)).getByRole('button')).toHaveProperty('disabled', true);
    expect(within(cell(ledger, 1)).getByRole('button')).toHaveProperty('disabled', true);
    expect(within(cell(oath, 1)).getByRole('button').getAttribute('draggable')).toBe('false');
  });
});
