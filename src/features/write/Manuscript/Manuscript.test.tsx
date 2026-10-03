import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Mark } from '@/domain/check';
import { mark } from '@/domain/check/testing/wiki';
import Manuscript, { type ManuscriptProps } from './Manuscript';

const RING: Mark = mark({
  markKey: 'mark-ring',
  quote: 'a brass ring',
  noteText: 'Maren has no ring on record.',
  actions: [
    { id: 'wiki', label: 'Write it in' },
    { id: 'text', label: 'Fix the text' },
    { id: 'leave', label: 'Leave it' },
  ],
});

// The editor mounts the note inside the page; a plain element stands in for it.
let noteHost: HTMLElement;

beforeEach(() => {
  noteHost = document.createElement('div');
  document.body.append(noteHost);
});

afterEach(() => {
  noteHost.remove();
});

const setup = (over: Partial<ManuscriptProps> = {}) => {
  const handlers = {
    onRename: vi.fn(),
    onAction: vi.fn(),
    onExplain: vi.fn(),
    onApplyRewrite: vi.fn(),
  };
  render(
    <Manuscript
      chapterNumber={7}
      chapterTitle="The Oath"
      activeBookId="book-oath"
      editor={null}
      error={null}
      dirty={false}
      aiChecking={false}
      openMark={null}
      noteHost={noteHost}
      busy={false}
      aiEnabled={false}
      aiBusyKey={null}
      aiAdvice={{}}
      {...handlers}
      {...over}
    />,
  );
  return { ...handlers, note: within(noteHost) };
};

describe('Manuscript', () => {
  it.each([
    [7, 'Chapter seven'],
    [13, 'Chapter 13'],
  ])('heads chapter %i as "%s"', (chapterNumber, eyebrow) => {
    setup({ chapterNumber });

    expect(screen.getByText(eyebrow)).toBeDefined();
  });

  it('shows the title, and renames the chapter when it is edited', () => {
    const { onRename } = setup();
    const title = screen.getByRole('textbox', { name: 'Chapter title' });
    expect(title.textContent).toBe('The Oath');

    title.textContent = 'The Vow';
    fireEvent.blur(title);

    expect(onRename).toHaveBeenCalledExactlyOnceWith(7, 'The Vow');
  });

  it('links to the chapter export', () => {
    setup();

    expect(
      screen.getByRole('link', { name: 'Export chapter (Markdown)' }).getAttribute('href'),
    ).toBe('/api/export/book-oath/chapter/7');
  });

  describe('the save state', () => {
    it.each<[string, Partial<ManuscriptProps>]>([
      ['Saved', {}],
      ['Unsaved changes', { dirty: true }],
      ['Checking with AI…', { aiChecking: true }],
      ['Unsaved changes', { dirty: true, aiChecking: true }],
    ])('reads "%s"', (text, over) => {
      setup(over);

      expect(screen.getByRole('status').textContent).toBe(text);
    });

    it('gives way to an error', () => {
      setup({ error: 'Could not save.', dirty: true });

      expect(screen.getByRole('alert').textContent).toBe('Could not save.');
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  describe('the note on an open mark', () => {
    it('is absent while no mark is open', () => {
      setup();

      expect(noteHost.childElementCount).toBe(0);
    });

    it('is absent while the editor has no place for it', () => {
      setup({ openMark: RING, noteHost: null });

      expect(screen.queryByTestId('write-inline-note')).toBeNull();
    });

    it('is drawn inside the host the editor provides', () => {
      const { note } = setup({ openMark: RING });

      expect(note.getByTestId('write-inline-note').textContent).toContain(
        'Maren has no ring on record.',
      );
    });

    it('hands the chosen action to its owner, with the mark', async () => {
      const { note, onAction } = setup({ openMark: RING });

      await userEvent.click(note.getByRole('button', { name: 'Leave it' }));

      expect(onAction).toHaveBeenCalledExactlyOnceWith(RING, { id: 'leave', label: 'Leave it' });
    });

    it('locks its actions while one is running', () => {
      const { note } = setup({ openMark: RING, busy: true });

      for (const button of note.getAllByRole('button')) {
        expect(button).toHaveProperty('disabled', true);
      }
    });

    it('hides the text fix while the AI is off', () => {
      const { note } = setup({ openMark: RING });

      expect(note.getAllByRole('button').map((button) => button.textContent)).toEqual([
        'Write it in',
        'Leave it',
      ]);
    });

    describe('with the AI on', () => {
      it('offers the text fix', () => {
        const { note } = setup({ openMark: RING, aiEnabled: true });

        expect(note.getByRole('button', { name: 'Fix the text' })).toBeDefined();
      });

      it('shows it asking only for the mark being explained', () => {
        const { note } = setup({ openMark: RING, aiEnabled: true, aiBusyKey: 'mark-ring' });

        expect(note.getByRole('button', { name: 'Asking…' })).toHaveProperty('disabled', true);
      });

      it('does not show another mark as asking', () => {
        const { note } = setup({ openMark: RING, aiEnabled: true, aiBusyKey: 'mark-other' });

        expect(note.getByRole('button', { name: 'Fix the text' })).toHaveProperty('disabled', false);
      });

      it('shows the advice for the open mark and applies its rewrite', async () => {
        const { note, onApplyRewrite } = setup({
          openMark: RING,
          aiEnabled: true,
          aiAdvice: {
            'mark-ring': { explanation: 'The ring is new.', rewrite: 'a brass key' },
            'mark-other': { explanation: 'Unrelated.', rewrite: '' },
          },
        });

        expect(note.getByTestId('write-ai-advice').textContent).toContain('The ring is new.');
        expect(note.queryByText('Unrelated.')).toBeNull();
        await userEvent.click(note.getByRole('button', { name: 'Use in editor' }));

        expect(onApplyRewrite).toHaveBeenCalledExactlyOnceWith(RING, 'a brass key');
      });

      it('shows the advice error in place of the advice', () => {
        const { note } = setup({
          openMark: RING,
          aiEnabled: true,
          aiAdvice: { 'mark-ring': { explanation: '', rewrite: '', error: 'The model timed out.' } },
        });

        expect(note.getByTestId('write-ai-advice').textContent).toBe('The model timed out.');
      });
    });
  });
});
