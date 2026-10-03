import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { WorldUniverseNode } from '@/domain/structure';
import { book, universe, world } from '@/domain/testing/structure';
import BookPill from './BookPill';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  search: '',
  editWorldStructure: vi.fn(),
  previewStructureDelete: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  editWorldStructure: mocks.editWorldStructure,
  previewStructureDelete: mocks.previewStructureDelete,
}));

const TREE: WorldUniverseNode[] = [
  universe('uni-ash', 'Ashfall', [
    world('world-verge', 'Verge', [book('book-ledger', 'The Ledger'), book('book-oath', 'The Oath')]),
    world('world-hollow', 'Hollow', [book('book-songs', 'Hollow Songs')]),
    world('world-reach', 'Reach'),
  ]),
];

const IN_VERGE = 'u=uni-ash&w=world-verge&book=book-oath';
const IN_HOLLOW = 'u=uni-ash&w=world-hollow';
const IN_REACH = 'u=uni-ash&w=world-reach';

const setup = (search = IN_VERGE) => {
  mocks.search = search;
  render(<BookPill tree={TREE} />);
  return { pill: screen.getByRole('button', { expanded: false }) };
};

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { expanded: false }));
  return within(screen.getByRole('menu', { name: 'Switch book' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.editWorldStructure.mockResolvedValue({ ok: true, data: {} });
  mocks.previewStructureDelete.mockResolvedValue({ ok: true, data: { total: 4 } });
});

describe('BookPill', () => {
  describe('the pill', () => {
    it('names the world and the book the URL points at', () => {
      const { pill } = setup();

      expect(pill.textContent).toBe('VergeThe Oath▾');
    });

    it('falls back to the first book when the URL names none', () => {
      const { pill } = setup(IN_HOLLOW);

      expect(pill.textContent).toBe('HollowHollow Songs▾');
    });

    it('says so when the world has no book', () => {
      const { pill } = setup(IN_REACH);

      expect(pill.textContent).toBe('ReachNo book▾');
    });
  });

  describe('the export link', () => {
    it('points at the active book', () => {
      setup();

      const link = screen.getByRole('link', { name: 'Export' });
      expect(link.getAttribute('href')).toBe('/api/export/book-oath');
      expect(link.getAttribute('title')).toBe('Export "The Oath" as Markdown');
    });

    it('is inert when there is no book', () => {
      setup(IN_REACH);

      expect(screen.queryByRole('link', { name: 'Export' })).toBeNull();
      expect(screen.getByTestId('export-book').getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('the menu', () => {
    it('lists the books of the active world, ticking the active one', async () => {
      setup();
      const menu = await openMenu();

      expect(
        menu
          .getAllByRole('menuitemradio')
          .map((item) => [item.textContent, item.getAttribute('aria-checked')]),
      ).toEqual([
        ['The Ledger', 'false'],
        ['✓The Oath', 'true'],
      ]);
    });

    it('switches to the book that is clicked, then closes', async () => {
      setup();
      const menu = await openMenu();

      await userEvent.click(menu.getByRole('menuitemradio', { name: 'The Ledger' }));

      expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
        '/write?u=uni-ash&w=world-verge&book=book-ledger',
      );
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('closes on Escape', async () => {
      setup();
      await openMenu();

      await userEvent.keyboard('{Escape}');

      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  describe('creating a book', () => {
    it('creates it in the active world and opens it', async () => {
      mocks.editWorldStructure.mockResolvedValue({ ok: true, data: { bookId: 'book-new' } });
      setup();
      const menu = await openMenu();

      await userEvent.click(menu.getByRole('menuitem', { name: '+ New book' }));
      await userEvent.type(
        screen.getByRole('textbox', { name: 'Name the new book' }),
        'The Lamp{Enter}',
      );

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'create',
        level: 'book',
        name: 'The Lamp',
        worldId: 'world-verge',
      });
      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
          '/write?u=uni-ash&w=world-verge&book=book-new',
        ),
      );
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('shows why it failed, and stays put', async () => {
      mocks.editWorldStructure.mockResolvedValue({ ok: false, error: 'That name is taken.' });
      setup();
      const menu = await openMenu();

      await userEvent.click(menu.getByRole('menuitem', { name: '+ New book' }));
      await userEvent.type(
        screen.getByRole('textbox', { name: 'Name the new book' }),
        'The Oath{Enter}',
      );

      expect((await screen.findByRole('alert')).textContent).toBe('That name is taken.');
      expect(mocks.push).not.toHaveBeenCalled();
    });
  });

  describe('renaming the book', () => {
    it('starts from its current name and refreshes once renamed', async () => {
      setup();
      const menu = await openMenu();

      await userEvent.click(menu.getByRole('menuitem', { name: 'Rename book' }));
      const input = screen.getByRole('textbox', { name: 'Rename book' });
      expect(input).toHaveProperty('value', 'The Oath');
      await userEvent.clear(input);
      await userEvent.type(input, 'The Vow');
      await userEvent.click(screen.getByRole('button', { name: 'Rename' }));

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'rename',
        level: 'book',
        id: 'book-oath',
        name: 'The Vow',
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('is locked when there is no book to rename', async () => {
      setup(IN_REACH);
      const menu = await openMenu();

      expect(menu.getByRole('menuitem', { name: 'Rename book' })).toHaveProperty('disabled', true);
    });
  });

  describe('deleting the book', () => {
    const openDelete = async () => {
      const menu = await openMenu();
      await userEvent.click(menu.getByRole('menuitem', { name: 'Delete book' }));
      return within(screen.getByRole('dialog', { name: 'Delete The Oath?' }));
    };

    it('is locked, with a reason, for the last book of a world', async () => {
      setup(IN_HOLLOW);
      const menu = await openMenu();

      const item = menu.getByRole('menuitem', { name: 'Delete book' });
      expect(item).toHaveProperty('disabled', true);
      expect(item.getAttribute('title')).toBeTruthy();
    });

    it('counts what will be removed before it can be confirmed', async () => {
      setup();
      const dialog = await openDelete();

      expect(mocks.previewStructureDelete).toHaveBeenCalledExactlyOnceWith({
        level: 'book',
        id: 'book-oath',
      });
      expect(await dialog.findByText(/permanently removes 4 rows/)).toBeDefined();
      expect(dialog.getByRole('button', { name: 'Delete 4 rows' })).toHaveProperty('disabled', true);
    });

    it('counts a single row in the singular', async () => {
      mocks.previewStructureDelete.mockResolvedValue({ ok: true, data: { total: 1 } });
      setup();
      const dialog = await openDelete();

      expect(await dialog.findByText(/permanently removes 1 row /)).toBeDefined();
    });

    it('deletes once the name is typed, then opens a remaining book', async () => {
      setup();
      const dialog = await openDelete();
      const confirm = await dialog.findByRole('button', { name: 'Delete 4 rows' });

      await userEvent.type(
        dialog.getByRole('textbox', { name: 'Type The Oath to confirm' }),
        'The Oath',
      );
      await userEvent.click(confirm);

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'delete',
        level: 'book',
        id: 'book-oath',
        confirmed: true,
      });
      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
          '/write?u=uni-ash&w=world-verge&book=book-ledger',
        ),
      );
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the book when cancelled', async () => {
      setup();
      const dialog = await openDelete();

      await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

      expect(mocks.editWorldStructure).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows why the count failed', async () => {
      mocks.previewStructureDelete.mockResolvedValue({ ok: false, error: 'Database is down.' });
      setup();
      await openDelete();

      expect((await screen.findByRole('alert')).textContent).toBe('Database is down.');
    });
  });
});
