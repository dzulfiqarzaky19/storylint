import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PlotLane } from '@/domain/plot';
import type { PlotEdit } from '../hooks/usePlotEdit';
import { beat, chapters, lane, plotEdit } from '../testing/plot';
import { Story } from './Story';

// Beats in chapters 1 and 6, so chapters 2 to 5 are a long gap.
const OATH = lane('oath', 'The oath', {
  beats: [beat(1), beat(6, { warn: 'Maren swore otherwise in chapter 1.' })],
  lastAdvanced: 6,
});

const setup = (over: { lane?: PlotLane; edit?: PlotEdit; latestChapter?: number } = {}) => {
  const onClose = vi.fn();
  const edit = over.edit ?? plotEdit();
  render(
    <Story
      lane={over.lane ?? OATH}
      chapters={chapters(6)}
      latestChapter={over.latestChapter ?? 6}
      onClose={onClose}
      edit={edit}
    />,
  );
  return { edit, onClose, drawer: screen.getByRole('dialog') };
};

// The row body holds the summary as its own text, beside the row's buttons.
const rowOf = (summary: string) => within(screen.getByText(summary));

describe('Story', () => {
  it('opens as a dialog named after the lane, with Close focused', () => {
    const { drawer } = setup();

    expect(drawer.getAttribute('aria-label')).toBe('Story so far, The oath');
    expect(within(drawer).getByRole('heading', { level: 2 }).textContent).toContain(
      'Story so far — The oath',
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('tells the lane beat by beat, with the stretch where it went quiet', () => {
    const { drawer } = setup();

    expect(drawer.textContent).toContain('Ch.1Chapter 1');
    expect(drawer.textContent).toContain('Ch.2–5arc went quiet — 4 chapters with no beat');
    expect(drawer.textContent).toContain('Ch.6Chapter 6');
  });

  it('shows the warning on a beat that breaks canon', () => {
    setup();

    expect(screen.getByText('Maren swore otherwise in chapter 1.')).toBeDefined();
  });

  it.each<[string, Partial<PlotLane>, string]>([
    ['resolved', { state: 'resolved', resolvedAt: 6 }, '✓ resolved · ch.6'],
    ['dropped', { state: 'abandoned', resolvedAt: 6 }, 'dropped · ch.6'],
    ['stalled', { state: 'stalled', neglect: 4 }, 'stalled'],
  ])('badges a %s lane', (_name, over, pill) => {
    setup({ lane: { ...OATH, ...over } });

    // A closed lane repeats its badge as its status line, so there can be two.
    expect(screen.getAllByText(pill).length).toBeGreaterThan(0);
  });

  describe('closing', () => {
    it.each([
      ['the close button', () => userEvent.click(screen.getByRole('button', { name: 'Close' }))],
      ['Escape', () => userEvent.keyboard('{Escape}')],
      ['a click on the scrim', () => userEvent.click(screen.getByRole('dialog').parentElement!)],
    ])('closes from %s', async (_name, dismiss) => {
      const { onClose } = setup();

      await dismiss();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays open for a click inside the drawer', async () => {
      const { onClose, drawer } = setup();

      await userEvent.click(within(drawer).getByRole('heading', { level: 2 }));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('renaming the lane', () => {
    const startRename = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Rename plotline' }));
      return screen.getByRole('textbox', { name: 'Plotline name' });
    };

    it('starts from the current name', async () => {
      setup();

      const input = await startRename();

      expect(input).toHaveProperty('value', 'The oath');
      expect(document.activeElement).toBe(input);
    });

    it('commits the trimmed name on Enter', async () => {
      const { edit } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, '  The vow {Enter}');

      expect(edit.rename).toHaveBeenCalledExactlyOnceWith('oath', 'The vow');
    });

    it.each([
      ['unchanged', 'The oath'],
      ['blank', '  '],
    ])('does nothing when the name is %s', async (_name, typed) => {
      const { edit } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, `${typed}{Enter}`);

      expect(edit.rename).not.toHaveBeenCalled();
    });

    it('abandons the rename on Escape, without closing the drawer', async () => {
      const { edit, onClose } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, 'The vow{Escape}');

      expect(edit.rename).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Rename plotline' })).toBeDefined();
    });
  });

  describe('the arc state', () => {
    it.each<[string, 'open' | 'resolved' | 'abandoned', number | null]>([
      ['open', 'open', null],
      ['resolved', 'resolved', 6],
      ['dropped', 'abandoned', 6],
    ])('sets "%s" at the chapter the lane last advanced', async (button, state, resolvedAt) => {
      const { edit } = setup({ latestChapter: 9 });

      await userEvent.click(screen.getByRole('button', { name: button }));

      expect(edit.setState).toHaveBeenCalledExactlyOnceWith('oath', state, resolvedAt);
    });

    it('falls back to the latest chapter for a lane that never advanced', async () => {
      const { edit } = setup({ lane: lane('oath', 'The oath'), latestChapter: 9 });

      await userEvent.click(screen.getByRole('button', { name: 'resolved' }));

      expect(edit.setState).toHaveBeenCalledExactlyOnceWith('oath', 'resolved', 9);
    });
  });

  describe('the beats', () => {
    it('rewrites the beat whose edit button is clicked', async () => {
      const { edit } = setup();

      await userEvent.click(rowOf('Beat in chapter 6').getByRole('button', { name: 'edit' }));
      const input = screen.getByRole('textbox', { name: 'Beat summary' });
      await userEvent.clear(input);
      await userEvent.type(input, 'She breaks it{Enter}');

      expect(edit.saveBeat).toHaveBeenCalledExactlyOnceWith('oath', 6, 'She breaks it');
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('keeps the drawer open when Escape cancels a beat edit', async () => {
      const { edit, onClose } = setup();

      await userEvent.click(rowOf('Beat in chapter 1').getByRole('button', { name: 'edit' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Beat summary' }), '{Escape}');

      expect(screen.queryByRole('textbox')).toBeNull();
      expect(edit.saveBeat).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('deletes the beat whose delete button is clicked', async () => {
      const { edit } = setup();

      await userEvent.click(rowOf('Beat in chapter 1').getByRole('button', { name: 'delete' }));

      expect(edit.removeBeat).toHaveBeenCalledExactlyOnceWith('oath', 1);
    });
  });

  it('shows the edit error', () => {
    setup({ edit: plotEdit({ error: 'Could not save the beat.' }) });

    expect(screen.getByRole('alert').textContent).toBe('Could not save the beat.');
  });

  it('locks every edit while one is pending, but not Close', () => {
    const { drawer } = setup({ edit: plotEdit({ pending: true }) });

    const locked = within(drawer)
      .getAllByRole('button')
      .filter((button) => (button as HTMLButtonElement).disabled)
      .map((button) => button.textContent);
    expect(locked).toEqual(['rename', 'open', 'resolved', 'dropped', 'edit', 'delete', 'edit', 'delete']);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveProperty('disabled', false);
  });
});
