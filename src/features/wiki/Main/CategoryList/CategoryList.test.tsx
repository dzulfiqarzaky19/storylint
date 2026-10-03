import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import type { CategoryRow, EntryWithDetails } from '@/domain/types';
import { DragProvider } from '@/features/wiki/dnd/DragContext';
import { category } from '@/features/wiki/state/testing/state';
import CategoryList from './CategoryList';

const PEOPLE: CategoryRow = category('character', 'People', { shelf: 'people', isBuiltin: true });
const RITUALS: CategoryRow = category('cat-rituals', 'Rituals');

const MAREN = snapshotEntry('maren', 'Maren');
const OATH = snapshotEntry('the-oath', 'The Oath', { kind: 'lore' });

const TITLES: Record<string, string> = { character: 'Cast', 'cat-rituals': 'Rituals' };

const setup = () => {
  const handlers = {
    onSelect: vi.fn(),
    onDropEntry: vi.fn(),
    onDropFactOnEntry: vi.fn(),
    onRenameCategory: vi.fn(),
    onResetCategory: vi.fn(),
    onRequestDeleteCategory: vi.fn(),
    onCreate: vi.fn(),
    onCreateCategory: vi.fn(),
  };
  render(
    <DragProvider>
      <CategoryList
        categories={[PEOPLE, RITUALS]}
        byCategory={new Map<string, EntryWithDetails[]>([['character', [MAREN, OATH]]])}
        selectedId="maren"
        contradictions={new Set(['the-oath'])}
        entryCount={2}
        isRenamed={(id) => id === 'character'}
        isBuiltin={(id) => id === 'character'}
        titleFor={(id) => TITLES[id] ?? id}
        {...handlers}
      />
    </DragProvider>,
  );
  return handlers;
};

describe('CategoryList', () => {
  it('heads the list with the world and its entry count', () => {
    setup();

    expect(screen.getByRole('region', { name: 'The world' }).textContent).toContain('2 entries');
  });

  it('shows each category under the title its owner resolves', () => {
    setup();

    expect(screen.getByRole('region', { name: 'Cast' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Rituals' })).toBeDefined();
  });

  it('files the entries under their category, and leaves the rest empty', () => {
    setup();

    const cast = within(screen.getByRole('region', { name: 'Cast' }));
    expect(cast.getByRole('button', { name: /Maren/ }).getAttribute('aria-pressed')).toBe('true');
    expect(cast.getByRole('button', { name: /The Oath/ })).toBeDefined();
    expect(within(screen.getByRole('region', { name: 'Rituals' })).getByRole('note')).toBeDefined();
  });

  it('offers a reset on renamed categories only', () => {
    setup();

    expect(
      within(screen.getByRole('region', { name: 'Cast' })).getByRole('button', {
        name: 'Reset to default',
      }),
    ).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'Rituals' })).queryByRole('button', {
        name: 'Reset to default',
      }),
    ).toBeNull();
  });

  it('offers to delete custom categories only', async () => {
    const { onRequestDeleteCategory } = setup();

    expect(screen.queryByRole('button', { name: 'Delete Cast category' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Rituals category' }));

    expect(onRequestDeleteCategory).toHaveBeenCalledExactlyOnceWith('cat-rituals');
  });

  it('creates an entry in the category whose add button is clicked', async () => {
    const { onCreate } = setup();

    await userEvent.click(screen.getByRole('button', { name: '+ Add new ritual' }));

    expect(onCreate).toHaveBeenCalledExactlyOnceWith('lore', 'cat-rituals');
  });

  it('creates a category from the panel at the end of the list', async () => {
    const { onCreateCategory } = setup();

    await userEvent.click(screen.getByRole('button', { name: '+ New category' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New category name' }), 'Songs{Enter}');

    expect(onCreateCategory).toHaveBeenCalledExactlyOnceWith(expect.any(String), 'Songs');
  });
});
