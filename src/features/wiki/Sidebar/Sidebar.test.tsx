import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import type { CategoryRow, EntryWithDetails } from '@/domain/types';
import { category } from '@/features/wiki/state/testing/state';
import Sidebar from './Sidebar';

const PEOPLE: CategoryRow = category('character', 'People', { shelf: 'people', isBuiltin: true });
const RITUALS: CategoryRow = category('cat-rituals', 'Rituals');

const MAREN = snapshotEntry('maren', 'Maren', { note: 'Keeper' });
// No catalogue number of his own, so he is numbered by position.
const TOBIAS: EntryWithDetails = { ...snapshotEntry('tobias', 'Tobias'), catalogueNo: '—' };

const LABELS: Record<string, string> = { character: 'People', 'cat-rituals': 'Rituals' };

const setup = (options: { renamed?: string[]; footer?: React.ReactNode } = {}) => {
  const handlers = {
    onSelect: vi.fn(),
    onCreateEntry: vi.fn(),
    onCreateCategory: vi.fn(),
    onRenameCategory: vi.fn(),
    onResetCategory: vi.fn(),
    onRequestDeleteCategory: vi.fn(),
  };
  render(
    <Sidebar
      categories={[PEOPLE, RITUALS]}
      byCategory={new Map([['character', [MAREN, TOBIAS]]])}
      selectedId="tobias"
      total={2}
      isRenamed={(id) => (options.renamed ?? []).includes(id)}
      labelFor={(id) => LABELS[id] ?? id}
      footer={options.footer}
      {...handlers}
    />,
  );
  return { ...handlers, rail: within(screen.getByRole('navigation', { name: 'The world' })) };
};

const entryButtons = () =>
  screen
    .getAllByRole('listitem')
    .map((item) => item.textContent)
    .filter((text) => !text?.startsWith('+ New'));
const filter = () => screen.getByRole('searchbox', { name: 'Filter entries…' });

describe('Sidebar', () => {
  it('counts every entry in the rail head', () => {
    const { rail } = setup();

    expect(rail.getByText('All entries').parentElement?.textContent).toBe('All entries· 2');
  });

  it('lists the entries of each category, numbered, with their notes', () => {
    setup();

    expect(entryButtons()).toEqual(['MARENMarenKeeper', '02Tobias']);
    expect(screen.getByRole('button', { name: 'People' }).parentElement?.textContent).toContain('2');
    expect(screen.getByRole('button', { name: 'Rituals' }).parentElement?.textContent).toContain('0');
  });

  it('marks the selected entry', () => {
    setup();

    expect(screen.getByRole('button', { name: /Tobias/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: /Maren/ }).getAttribute('aria-current')).toBeNull();
  });

  it('selects the entry that is clicked', async () => {
    const { onSelect } = setup();

    await userEvent.click(screen.getByRole('button', { name: /Maren/ }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('maren');
  });

  it('renders the footer it is given', () => {
    setup({ footer: <p>Recently deleted</p> });

    expect(screen.getByText('Recently deleted')).toBeDefined();
  });

  describe('collapsing a category', () => {
    it.each([
      ['its chevron', () => screen.getByRole('button', { name: 'Collapse People' })],
      ['its title', () => screen.getByRole('button', { name: 'People' })],
    ])('folds its entries away from %s, and back', async (_name, toggle) => {
      setup();

      await userEvent.click(toggle());
      expect(screen.queryByRole('button', { name: /Maren/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'People' }).getAttribute('aria-expanded')).toBe(
        'false',
      );

      await userEvent.click(screen.getByRole('button', { name: 'Expand People' }));
      expect(screen.getByRole('button', { name: /Maren/ })).toBeDefined();
    });
  });

  describe('adding', () => {
    it('creates an entry in the category, on its shelf', async () => {
      const { onCreateEntry } = setup();

      await userEvent.click(screen.getByRole('button', { name: '+ New ritual' }));

      expect(onCreateEntry).toHaveBeenCalledExactlyOnceWith('lore', 'cat-rituals');
    });

    it('creates a category from the dialog at the end of the rail', async () => {
      const { onCreateCategory } = setup();

      await userEvent.click(screen.getByRole('button', { name: '+ New category' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'New category name' }), 'Songs{Enter}');

      expect(onCreateCategory).toHaveBeenCalledExactlyOnceWith(expect.any(String), 'Songs');
    });
  });

  describe('renaming a category', () => {
    const startRename = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Rename People category' }));
      return screen.getByRole('textbox', { name: 'Rename People category' });
    };

    it('commits a new label on Enter', async () => {
      const { onRenameCategory, onResetCategory } = setup();
      const input = await startRename();
      expect(input).toHaveProperty('value', 'People');

      await userEvent.clear(input);
      await userEvent.type(input, 'Cast{Enter}');

      expect(onRenameCategory).toHaveBeenCalledExactlyOnceWith('character', 'Cast');
      expect(onResetCategory).not.toHaveBeenCalled();
    });

    it('resets to the default when the label is cleared', async () => {
      const { onRenameCategory, onResetCategory } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, '{Enter}');

      expect(onResetCategory).toHaveBeenCalledExactlyOnceWith('character');
      expect(onRenameCategory).not.toHaveBeenCalled();
    });

    it.each([
      ['an unchanged label', '{Enter}'],
      ['Escape', 'Cast{Escape}'],
    ])('does nothing on %s', async (_name, keys) => {
      const { onRenameCategory, onResetCategory } = setup();
      const input = await startRename();

      await userEvent.type(input, keys);

      expect(onRenameCategory).not.toHaveBeenCalled();
      expect(onResetCategory).not.toHaveBeenCalled();
    });
  });

  describe('the category tools', () => {
    it('offer a reset only on a renamed category', async () => {
      const { onResetCategory } = setup({ renamed: ['character'] });

      expect(screen.queryByRole('button', { name: 'Reset Rituals category name' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Reset People category name' }));

      expect(onResetCategory).toHaveBeenCalledExactlyOnceWith('character');
    });

    it('offer to delete custom categories only', async () => {
      const { onRequestDeleteCategory } = setup();

      expect(screen.queryByRole('button', { name: 'Delete People category' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Delete Rituals category' }));

      expect(onRequestDeleteCategory).toHaveBeenCalledExactlyOnceWith('cat-rituals');
    });
  });

  describe('filtering', () => {
    it('keeps only the entries that match, whatever the case', async () => {
      setup();

      await userEvent.type(filter(), 'TOB');

      // The fallback number is a position among the entries shown, so it moves up.
      expect(entryButtons()).toEqual(['01Tobias']);
    });

    it('hides the categories with no match, and every way to add', async () => {
      setup();

      await userEvent.type(filter(), 'tob');

      expect(screen.queryByRole('button', { name: 'Rituals' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^\+ New/ })).toBeNull();
    });

    it('opens a collapsed category that has a match', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse People' }));

      await userEvent.type(filter(), 'mar');

      expect(screen.getByRole('button', { name: /Maren/ })).toBeDefined();
    });

    it('says so when nothing matches', async () => {
      setup();

      await userEvent.type(filter(), 'zzz');

      expect(screen.getByText('No entries match “zzz”.')).toBeDefined();
    });

    it('brings everything back when the filter is cleared', async () => {
      setup();
      await userEvent.type(filter(), 'tob');

      await userEvent.clear(filter());

      expect(entryButtons()).toEqual(['MARENMarenKeeper', '02Tobias']);
      expect(screen.getByRole('button', { name: '+ New category' })).toBeDefined();
    });
  });
});
