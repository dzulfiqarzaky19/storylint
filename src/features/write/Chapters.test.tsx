import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Chapters, { type ChaptersChapter } from './Chapters';

const LEDGER: ChaptersChapter = { number: 1, title: 'The Ledger' };
const OATH: ChaptersChapter = { number: 2, title: 'The Oath' };
const LAMPS: ChaptersChapter = { number: 13, title: 'Lamps' };

interface SetupOptions {
  chapters?: ChaptersChapter[];
  readOnly?: boolean;
}

const setup = ({ chapters = [LEDGER, OATH], readOnly = false }: SetupOptions = {}) => {
  const onSelect = vi.fn();
  const handlers = { onCreate: vi.fn(), onRename: vi.fn(), onRequestDelete: vi.fn() };
  render(
    <Chapters
      chapters={chapters}
      selectedNumber={1}
      onSelect={onSelect}
      {...(readOnly ? {} : handlers)}
    />,
  );
  return { onSelect, ...handlers };
};

const rowOf = (name: string) => screen.getByRole('button', { name }).closest('li')!;
// The editable title is a bare contentEditable span, found by its text.
const titleOf = (title: string) => screen.getByText(title);

// Typing into a contentEditable is not modelled by jsdom, so the edit is set
// directly and committed the way the browser would: by leaving the field.
const retitle = (el: HTMLElement, text: string) => {
  el.textContent = text;
  fireEvent.blur(el);
};

describe('Chapters', () => {
  it('lists the chapters in a counted rail, numbered in words', () => {
    setup({ chapters: [LEDGER, OATH, LAMPS] });

    const rail = screen.getByRole('navigation', { name: 'Chapters' });
    expect(rail.textContent).toContain('Chapters· 3');
    expect(
      within(rail)
        .getAllByRole('listitem')
        .slice(0, 3)
        .map((item) => item.textContent),
    ).toEqual(['Chapter oneThe Ledger', 'Chapter twoThe Oath', 'Chapter 13Lamps']);
  });

  it('marks the selected chapter', () => {
    setup();

    expect(
      screen.getByRole('button', { name: 'Chapter 1: The Ledger' }).getAttribute('aria-current'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Chapter 2: The Oath' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('selects the chapter that is clicked', async () => {
    const { onSelect } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Chapter 2: The Oath' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('starts a new chapter', async () => {
    const { onCreate } = setup();

    await userEvent.click(screen.getByRole('button', { name: '+ New chapter' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('offers no way to create, rename or delete without handlers', () => {
    setup({ readOnly: true });

    expect(screen.queryByRole('button', { name: '+ New chapter' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Rename chapter/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete chapter/ })).toBeNull();
    expect(titleOf('The Ledger').hasAttribute('contenteditable')).toBe(false);
  });

  describe('the severity dot', () => {
    it.each<[ChaptersChapter['severity'], string]>([
      ['red', 'Has a contradiction'],
      ['yellow', 'Has an unrecorded detail'],
    ])('flags a %s chapter', (severity, label) => {
      setup({ chapters: [LEDGER, { ...OATH, severity }] });

      expect(within(rowOf('Chapter 2: The Oath')).getByLabelText(label)).toBeDefined();
    });

    it('is never shown on the open chapter', () => {
      setup({ chapters: [{ ...LEDGER, severity: 'red' }, OATH] });

      expect(screen.queryByLabelText('Has a contradiction')).toBeNull();
    });
  });

  describe('renaming', () => {
    it('lets the open chapter be retitled in place', () => {
      const { onRename } = setup();

      expect(titleOf('The Ledger').getAttribute('contenteditable')).toBe('true');
      expect(titleOf('The Oath').hasAttribute('contenteditable')).toBe(false);
      retitle(titleOf('The Ledger'), '  The Account ');

      expect(onRename).toHaveBeenCalledExactlyOnceWith(1, 'The Account');
    });

    it('opens another chapter for retitling from its pencil', async () => {
      const { onRename } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Rename chapter 2: The Oath' }));
      const title = titleOf('The Oath');
      expect(title.getAttribute('contenteditable')).toBe('true');
      retitle(title, 'The Vow');

      expect(onRename).toHaveBeenCalledExactlyOnceWith(2, 'The Vow');
      // The row goes back to showing the title it was given, no longer editable.
      expect(titleOf('The Oath').hasAttribute('contenteditable')).toBe(false);
    });

    it.each([
      ['blank', '   '],
      ['unchanged', 'The Ledger'],
    ])('restores the title when the edit is %s', (_name, text) => {
      const { onRename } = setup();
      const title = titleOf('The Ledger');

      retitle(title, text);

      expect(onRename).not.toHaveBeenCalled();
      expect(title.textContent).toBe('The Ledger');
    });

    it('restores the title on Escape', () => {
      const { onRename } = setup();
      const title = titleOf('The Ledger');
      title.textContent = 'The Account';

      fireEvent.keyDown(title, { key: 'Escape' });
      fireEvent.blur(title);

      expect(title.textContent).toBe('The Ledger');
      expect(onRename).not.toHaveBeenCalled();
    });
  });

  describe('deleting', () => {
    it('asks its owner to delete the chapter', async () => {
      const { onRequestDelete } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Delete chapter 2: The Oath' }));

      expect(onRequestDelete).toHaveBeenCalledExactlyOnceWith(2);
    });

    it('is locked for the last chapter', () => {
      setup({ chapters: [LEDGER] });

      expect(screen.getByRole('button', { name: 'Delete chapter 1: The Ledger' })).toHaveProperty(
        'disabled',
        true,
      );
    });
  });
});
