import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Mark } from '@/domain/check';
import { mark, wiki } from '@/domain/check/testing/wiki';
import Write from './Write';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  noteHost: null as HTMLElement | null,
  createChapter: vi.fn(),
  deleteChapter: vi.fn(),
  renameChapter: vi.fn(),
  resolveMark: vi.fn(),
  explainMark: vi.fn(),
  writeConfirmedTarget: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
// The Tiptap editor and the debounced checker are left out: this file covers
// how the screen wires its panels, its chapter navigation and its mark actions.
vi.mock('./hooks/useManuscriptEditor', () => ({
  useManuscriptEditor: () => ({ editor: null, noteHost: mocks.noteHost }),
}));
vi.mock('./hooks/useLiveCheck', () => ({ useLiveCheck: () => ({ aiChecking: false }) }));
vi.mock('@/server/actions/write/chapters', () => ({
  createChapter: mocks.createChapter,
  deleteChapter: mocks.deleteChapter,
  renameChapter: mocks.renameChapter,
}));
vi.mock('@/server/actions/write/marks', () => ({ resolveMark: mocks.resolveMark }));
vi.mock('@/server/actions/write/ai', () => ({ explainMark: mocks.explainMark }));
vi.mock('@/server/actions/wiki/writeConfirmedTarget', () => ({
  writeConfirmedTarget: mocks.writeConfirmedTarget,
}));

const RING: Mark = mark({
  markKey: 'mark-ring',
  quote: 'a brass ring',
  rail: 'Maren carries nothing yet',
  noteText: 'Maren has no ring on record.',
  actions: [
    { id: 'wiki', label: 'Write it in' },
    { id: 'leave', label: 'Leave it' },
  ],
});
const EYES: Mark = mark({
  markKey: 'mark-eyes',
  kind: 'conflict',
  quote: 'green eyes',
  rail: 'The wiki says grey',
  noteText: 'Her eyes are grey in the gazetteer.',
  actions: [{ id: 'leave', label: 'Leave it' }],
});

const setup = (marks: Mark[] = [RING, EYES]) =>
  render(
    <Write
      chapterNumber={1}
      chapterTitle="The Ledger"
      initialBody={{ type: 'doc', content: [] }}
      initialMarks={marks}
      wiki={wiki()}
      resolvedMarkKeys={[]}
      chapters={[
        { number: 1, title: 'The Ledger' },
        { number: 2, title: 'The Oath' },
      ]}
      activeBookId="book-oath"
      activeUniverseId="uni-ash"
      activeWorldId="world-verge"
      pickerEntries={[{ id: 'maren', name: 'Maren', kind: 'character' }]}
      pickerCategories={[{ id: 'character', label: 'People' }]}
    />,
  );

const outstanding = () => within(screen.getByRole('complementary', { name: 'Outstanding marks' }));
const note = () => within(mocks.noteHost!);
const openRing = () => userEvent.click(outstanding().getByRole('button', { name: /a brass ring/ }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.noteHost = document.createElement('div');
  document.body.append(mocks.noteHost);
  mocks.createChapter.mockResolvedValue({ ok: true, data: { number: 3 } });
  mocks.deleteChapter.mockResolvedValue({ ok: true, data: { next: 1 } });
  mocks.renameChapter.mockResolvedValue({ ok: true, data: undefined });
  mocks.resolveMark.mockResolvedValue({ ok: true, data: undefined });
  mocks.writeConfirmedTarget.mockResolvedValue({ ok: true, data: undefined });
});

afterEach(() => {
  mocks.noteHost?.remove();
});

describe('Write', () => {
  it('lays out the chapters, the manuscript and the outstanding marks', () => {
    setup();

    expect(screen.getByRole('navigation', { name: 'Chapters' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Chapter title' }).textContent).toBe('The Ledger');
    expect(outstanding().getAllByRole('button', { pressed: false })).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  describe('moving between chapters', () => {
    it('opens another chapter within the same book', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'Chapter 2: The Oath' }));

      expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
        '/write?u=uni-ash&w=world-verge&book=book-oath&chapter=2',
      );
    });

    it('stays put when the open chapter is clicked', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'Chapter 1: The Ledger' }));

      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('creates a chapter and opens it', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: '+ New chapter' }));

      expect(mocks.createChapter).toHaveBeenCalledExactlyOnceWith({ bookId: 'book-oath' });
      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
          '/write?u=uni-ash&w=world-verge&book=book-oath&chapter=3',
        ),
      );
    });
  });

  describe('renaming the chapter', () => {
    const retitle = (text: string) => {
      const title = screen.getByRole('textbox', { name: 'Chapter title' });
      title.textContent = text;
      fireEvent.blur(title);
    };

    it('renames it in the active book, then refreshes', async () => {
      setup();

      retitle('The Account');

      expect(mocks.renameChapter).toHaveBeenCalledExactlyOnceWith({
        number: 1,
        title: 'The Account',
        bookId: 'book-oath',
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    });

    it('shows why the rename was refused', async () => {
      mocks.renameChapter.mockResolvedValue({ ok: false, error: 'That title is taken.' });
      setup();

      retitle('The Oath');

      expect((await screen.findByRole('alert')).textContent).toBe('That title is taken.');
      expect(mocks.refresh).not.toHaveBeenCalled();
    });
  });

  describe('deleting a chapter', () => {
    const openConfirm = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Delete chapter 2: The Oath' }));
      return within(screen.getByRole('dialog', { name: 'Delete chapter 2' }));
    };

    it('asks first, naming the chapter', async () => {
      setup();

      const dialog = await openConfirm();

      expect(dialog.getByText(/delete chapter 2: The Oath\?/)).toBeDefined();
      expect(mocks.deleteChapter).not.toHaveBeenCalled();
    });

    it('deletes once confirmed, then opens the chapter it is sent to', async () => {
      setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Delete chapter' }));

      expect(mocks.deleteChapter).toHaveBeenCalledExactlyOnceWith({ number: 2, bookId: 'book-oath' });
      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
          '/write?u=uni-ash&w=world-verge&book=book-oath&chapter=1',
        ),
      );
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows why the delete was refused', async () => {
      mocks.deleteChapter.mockResolvedValue({ ok: false, error: 'A book needs one chapter.' });
      setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Delete chapter' }));

      expect((await screen.findByRole('alert')).textContent).toBe('A book needs one chapter.');
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('keeps the chapter when cancelled', async () => {
      setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

      expect(mocks.deleteChapter).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('an outstanding mark', () => {
    it('opens its note when picked, and closes it when picked again', async () => {
      setup();

      await openRing();
      expect(note().getByTestId('write-inline-note').textContent).toContain(
        'Maren has no ring on record.',
      );
      expect(
        outstanding().getByRole('button', { name: /a brass ring/ }).getAttribute('aria-pressed'),
      ).toBe('true');

      await openRing();
      expect(note().queryByTestId('write-inline-note')).toBeNull();
    });

    it('is cleared once left as it is', async () => {
      setup();
      await openRing();

      await userEvent.click(note().getByRole('button', { name: 'Leave it' }));

      expect(mocks.resolveMark).toHaveBeenCalledExactlyOnceWith('mark-ring', 'leave', {
        bookId: 'book-oath',
        quote: 'a brass ring',
      });
      await waitFor(() =>
        expect(outstanding().queryByRole('button', { name: /a brass ring/ })).toBeNull(),
      );
      expect(outstanding().getByRole('button', { name: /green eyes/ })).toBeDefined();
    });

    it('stays, with the reason, when leaving it is refused', async () => {
      mocks.resolveMark.mockResolvedValue({ ok: false, error: 'Could not record that.' });
      setup();
      await openRing();

      await userEvent.click(note().getByRole('button', { name: 'Leave it' }));

      expect((await screen.findByRole('alert')).textContent).toBe('Could not record that.');
      expect(outstanding().getByRole('button', { name: /a brass ring/ })).toBeDefined();
    });
  });

  describe('writing a mark into the wiki', () => {
    const openPicker = async () => {
      await openRing();
      await userEvent.click(note().getByRole('button', { name: 'Write it in' }));
      return within(screen.getByRole('dialog', { name: 'Add to the wiki' }));
    };

    it('swaps the note for the picker, seeded from the mark', async () => {
      setup();

      const picker = await openPicker();

      expect(note().queryByTestId('write-inline-note')).toBeNull();
      expect(picker.getByRole('textbox', { name: 'New entry name' })).toHaveProperty(
        'value',
        'a brass ring',
      );
      expect(picker.getByRole('textbox', { name: 'Detail value' })).toHaveProperty(
        'value',
        'Maren has no ring on record.',
      );
    });

    it('writes the confirmed target into the active world and clears the mark', async () => {
      setup();
      const picker = await openPicker();

      await userEvent.click(picker.getByRole('button', { name: 'Create entry' }));

      expect(mocks.writeConfirmedTarget).toHaveBeenCalledExactlyOnceWith({
        result: expect.objectContaining({ categoryId: 'character', entryName: 'a brass ring' }),
        origin: { from: 'mark', mark: RING },
        worldId: 'world-verge',
        confirmed: true,
      });
      await waitFor(() =>
        expect(outstanding().queryByRole('button', { name: /a brass ring/ })).toBeNull(),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the mark, with the reason, when the write is refused', async () => {
      mocks.writeConfirmedTarget.mockResolvedValue({ ok: false, error: 'That entry exists.' });
      setup();
      const picker = await openPicker();

      await userEvent.click(picker.getByRole('button', { name: 'Create entry' }));

      expect((await screen.findByRole('alert')).textContent).toBe('That entry exists.');
      expect(outstanding().getByRole('button', { name: /a brass ring/ })).toBeDefined();
    });

    it('reopens the note when the picker is cancelled', async () => {
      setup();
      const picker = await openPicker();

      await userEvent.click(picker.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(note().getByTestId('write-inline-note')).toBeDefined();
      expect(mocks.writeConfirmedTarget).not.toHaveBeenCalled();
    });
  });
});
