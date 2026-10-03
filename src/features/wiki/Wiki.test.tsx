import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshot, snapshotEntry } from '@/domain/testing/snapshot';
import type { EntryRow, EntryWithDetails, WikiSnapshot, WikiSuggestion } from '@/domain/types';
import { category, suggestion } from '@/features/wiki/state/testing/state';
import Wiki from './Wiki';

const mocks = vi.hoisted(() => ({
  // entries
  moveEntry: vi.fn(),
  linkEntry: vi.fn(),
  untie: vi.fn(),
  createEntryTied: vi.fn(),
  moveFact: vi.fn(),
  addSuggestionAsFact: vi.fn(),
  dismissSuggestion: vi.fn(),
  editEntry: vi.fn(),
  editFact: vi.fn(),
  createEntry: vi.fn(),
  softDeleteEntry: vi.fn(),
  createFact: vi.fn(),
  deleteFact: vi.fn(),
  // categories
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  resetCategoryLabel: vi.fn(),
  deleteCategory: vi.fn(),
  // trash
  getDeletedEntries: vi.fn(),
  restoreEntry: vi.fn(),
  purgeExpiredDeleted: vi.fn(),
  // ai
  suggestEntryFacts: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  shareEntityToWorld: vi.fn(),
  unshareEntityFromWorld: vi.fn(),
}));
vi.mock('@/server/actions/wiki/entries', () => ({
  moveEntry: mocks.moveEntry,
  linkEntry: mocks.linkEntry,
  untie: mocks.untie,
  createEntryTied: mocks.createEntryTied,
  moveFact: mocks.moveFact,
  addSuggestionAsFact: mocks.addSuggestionAsFact,
  dismissSuggestion: mocks.dismissSuggestion,
  editEntry: mocks.editEntry,
  editFact: mocks.editFact,
  createEntry: mocks.createEntry,
  softDeleteEntry: mocks.softDeleteEntry,
  createFact: mocks.createFact,
  deleteFact: mocks.deleteFact,
}));
vi.mock('@/server/actions/wiki/categories', () => ({
  createCategory: mocks.createCategory,
  renameCategory: mocks.renameCategory,
  resetCategoryLabel: mocks.resetCategoryLabel,
  deleteCategory: mocks.deleteCategory,
}));
vi.mock('@/server/actions/wiki/trash', () => ({
  getDeletedEntries: mocks.getDeletedEntries,
  restoreEntry: mocks.restoreEntry,
  purgeExpiredDeleted: mocks.purgeExpiredDeleted,
}));
vi.mock('@/server/actions/wiki/aiSuggest', () => ({
  suggestEntryFacts: mocks.suggestEntryFacts,
}));

const DAY_MS = 24 * 60 * 60 * 1000;

// Tobias sorts first, so he is the entry the screen opens on.
const MAREN = snapshotEntry('maren', 'Maren', { sortOrder: 1, facts: { Eyes: 'grey' } });
const TOBIAS = snapshotEntry('tobias', 'Tobias', { sortOrder: 0 });
const VERGE = snapshotEntry('the-verge', 'The Verge', { kind: 'world', sortOrder: 2 });
// An entry of a custom category carries that category's id as its kind.
const OATH: EntryWithDetails = {
  ...snapshotEntry('the-oath', 'The Oath', { kind: 'lore', sortOrder: 3 }),
  kind: 'cat-rituals',
};

const WORLD: WikiSnapshot = {
  ...snapshot(TOBIAS, MAREN, VERGE, OATH),
  categories: [
    category('character', 'People', { shelf: 'people', isBuiltin: true }),
    category('world', 'Places', { shelf: 'places', isBuiltin: true }),
    category('cat-rituals', 'Rituals'),
  ],
};

const RING: WikiSuggestion = suggestion('sug-ring', 'maren');

const setup = (suggestions: WikiSuggestion[] = []) =>
  render(
    <Wiki
      snapshot={WORLD}
      suggestions={suggestions}
      contradictionEntryIds={[]}
      worlds={[{ id: 'world-verge', title: 'Verge' }]}
      activeWorldId="world-verge"
    />,
  );

const rail = () => within(screen.getByRole('navigation', { name: 'The world' }));
const main = () => within(screen.getByRole('main'));
const shelf = (title: string) => screen.getByRole('region', { name: title });
const tile = (title: string, name: RegExp) => within(shelf(title)).getByRole('button', { name });
const openEntry = (name: RegExp) => userEvent.click(rail().getByRole('button', { name }));
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' });

beforeEach(() => {
  vi.clearAllMocks();
  for (const action of Object.values(mocks)) {
    action.mockResolvedValue({ ok: true, data: undefined });
  }
  mocks.getDeletedEntries.mockResolvedValue({ ok: true, data: { entries: [] } });
});

describe('Wiki', () => {
  it('opens on the entry that sorts first', () => {
    setup();

    expect(heading()).toBe('Tobias');
    expect(rail().getByRole('button', { name: /Tobias/ }).getAttribute('aria-current')).toBe('true');
  });

  it('files every entry under its category, in the rail and on the shelves', () => {
    setup();

    expect(rail().getByText('All entries').parentElement?.textContent).toBe('All entries· 4');
    expect(tile('People', /Maren/)).toBeDefined();
    expect(tile('Places', /The Verge/)).toBeDefined();
    expect(tile('Rituals', /The Oath/)).toBeDefined();
  });

  it.each([
    ['the rail', () => openEntry(/Maren/)],
    ['a shelf tile', () => userEvent.click(tile('People', /Maren/))],
  ])('opens an entry from %s', async (_name, open) => {
    setup();

    await open();

    expect(heading()).toBe('Maren');
  });

  describe('editing the open entry', () => {
    it('renames it at once and saves the change', async () => {
      setup();

      await userEvent.click(main().getByTitle('Edit entry name'));
      await userEvent.type(main().getByRole('textbox', { name: 'entry name' }), ' Vale{Enter}');

      expect(heading()).toBe('Tobias Vale');
      expect(rail().getByRole('button', { name: /Tobias Vale/ })).toBeDefined();
      expect(mocks.editEntry).toHaveBeenCalledExactlyOnceWith({
        entryId: 'tobias',
        name: 'Tobias Vale',
      });
    });

    it('shows a refused save, which can be dismissed', async () => {
      mocks.editEntry.mockResolvedValue({ ok: false, error: 'That name is taken.' });
      setup();

      await userEvent.click(main().getByTitle('Edit entry name'));
      await userEvent.type(main().getByRole('textbox', { name: 'entry name' }), ' Vale{Enter}');
      expect((await screen.findByRole('alert')).textContent).toContain(
        'Save failed: That name is taken.',
      );

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('names the action when the save throws', async () => {
      mocks.editEntry.mockRejectedValue(new Error('offline'));
      setup();

      await userEvent.click(main().getByTitle('Edit entry name'));
      await userEvent.type(main().getByRole('textbox', { name: 'entry name' }), ' Vale{Enter}');

      expect((await screen.findByRole('alert')).textContent).toContain(
        'Save failed: editEntry: offline',
      );
    });

    it('deletes it and moves on', async () => {
      setup();

      await userEvent.click(main().getByRole('button', { name: 'Delete Tobias' }));
      await userEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete Tobias?' })).getByRole('button', {
          name: 'Delete',
        }),
      );

      expect(mocks.softDeleteEntry).toHaveBeenCalledExactlyOnceWith({ id: 'tobias' });
      expect(rail().queryByRole('button', { name: /Tobias/ })).toBeNull();
      expect(rail().getByText('All entries').parentElement?.textContent).toBe('All entries· 3');
    });
  });

  describe('the details of the open entry', () => {
    it('adds a blank detail with a client-minted id', async () => {
      setup();
      await openEntry(/Maren/);

      await userEvent.click(main().getByRole('button', { name: '+ Add detail' }));

      expect(mocks.createFact).toHaveBeenCalledExactlyOnceWith({
        id: expect.any(String),
        entryId: 'maren',
        key: 'Detail',
        value: '',
        sortOrder: 1,
      });
      expect(main().getByRole('tab', { name: /Details/ }).textContent).toBe('Details2');
    });

    it('edits a detail value', async () => {
      setup();
      await openEntry(/Maren/);

      await userEvent.click(main().getByRole('button', { name: 'grey' }));
      const input = main().getByRole('textbox', { name: 'detail value' });
      await userEvent.clear(input);
      await userEvent.type(input, 'green{Enter}');

      expect(mocks.editFact).toHaveBeenCalledExactlyOnceWith({ factId: 'maren.Eyes', value: 'green' });
      expect(main().getByRole('button', { name: 'green' })).toBeDefined();
    });

    it('deletes a detail', async () => {
      setup();
      await openEntry(/Maren/);

      await userEvent.click(main().getByRole('button', { name: 'Delete Eyes' }));

      expect(mocks.deleteFact).toHaveBeenCalledExactlyOnceWith({ factId: 'maren.Eyes' });
      expect(main().queryByRole('button', { name: 'grey' })).toBeNull();
    });

    it('moves a detail dropped on another entry', async () => {
      setup();
      await openEntry(/Maren/);

      fireEvent.dragStart(main().getByRole('button', { name: 'grey' }).closest('li')!, {
        dataTransfer: dataTransfer(),
      });
      fireEvent.drop(tile('People', /Tobias/), { dataTransfer: dataTransfer() });

      expect(mocks.moveFact).toHaveBeenCalledExactlyOnceWith({
        factId: 'maren.Eyes',
        toEntryId: 'tobias',
        sortOrder: 0,
      });
    });
  });

  describe('AI detail suggestions', () => {
    it('are fetched for the open entry and written in when added', async () => {
      mocks.suggestEntryFacts.mockResolvedValue({
        ok: true,
        data: { facts: [{ key: 'Scar', value: 'left wrist' }] },
      });
      setup();
      await openEntry(/Maren/);

      await userEvent.click(main().getByRole('button', { name: 'Suggest details' }));
      expect(mocks.suggestEntryFacts).toHaveBeenCalledExactlyOnceWith({ entryId: 'maren' });
      await userEvent.click(await main().findByRole('button', { name: 'Add' }));

      expect(mocks.createFact).toHaveBeenCalledExactlyOnceWith({
        id: expect.any(String),
        entryId: 'maren',
        key: 'Scar',
        value: 'left wrist',
        sortOrder: 1,
      });
      expect(main().queryByRole('button', { name: 'Add' })).toBeNull();
    });

    it('show why none could be fetched', async () => {
      mocks.suggestEntryFacts.mockResolvedValue({ ok: false, error: 'No model is configured.' });
      setup();

      await userEvent.click(main().getByRole('button', { name: 'Suggest details' }));

      expect((await screen.findByRole('alert')).textContent).toContain('No model is configured.');
    });
  });

  describe('the shelves', () => {
    it('create an entry in a built-in category', async () => {
      setup();

      await userEvent.click(main().getByRole('button', { name: '+ Add new place' }));

      expect(mocks.createEntry).toHaveBeenCalledExactlyOnceWith({
        id: expect.any(String),
        kind: 'world',
        shelf: 'places',
        name: 'New place',
        worldId: 'world-verge',
      });
      expect(tile('Places', /New place/)).toBeDefined();
    });

    it('move an entry dropped on another shelf to its end', () => {
      setup();

      fireEvent.dragStart(tile('People', /Maren/), { dataTransfer: dataTransfer() });
      fireEvent.drop(shelf('Places'), { dataTransfer: dataTransfer() });

      expect(mocks.moveEntry).toHaveBeenCalledExactlyOnceWith({
        entryId: 'maren',
        toShelf: 'places',
        toShelfOrder: ['the-verge', 'maren'],
        fromShelf: 'people',
        fromShelfOrder: ['tobias'],
      });
    });

    it('move an entry dropped on a tile to just before it', () => {
      setup();

      fireEvent.dragStart(tile('People', /Maren/), { dataTransfer: dataTransfer() });
      fireEvent.drop(tile('People', /Tobias/), { dataTransfer: dataTransfer() });

      expect(mocks.moveEntry).toHaveBeenCalledExactlyOnceWith({
        entryId: 'maren',
        toShelf: 'people',
        toShelfOrder: ['maren', 'tobias'],
        fromShelf: 'people',
        fromShelfOrder: ['maren', 'tobias'],
      });
    });
  });

  describe('the ties of the open entry', () => {
    const openTies = () => userEvent.click(main().getByRole('tab', { name: /Ties/ }));

    it('tie an entry dropped on the ties column', async () => {
      setup();
      await openTies();

      fireEvent.dragStart(tile('People', /Maren/), { dataTransfer: dataTransfer() });
      fireEvent.drop(main().getByRole('heading', { name: 'Ties' }), {
        dataTransfer: dataTransfer(),
      });

      expect(mocks.linkEntry).toHaveBeenCalledExactlyOnceWith({
        id: expect.any(String),
        fromEntryId: 'tobias',
        toEntryId: 'maren',
        rel: 'linked',
      });
      expect(main().getByRole('tab', { name: /Ties/ }).textContent).toBe('Ties1');
    });

    it('tie an existing entry with a chosen role', async () => {
      setup();
      await openTies();

      await userEvent.click(main().getByRole('button', { name: '+ Add tie' }));
      await userEvent.click(main().getByRole('option', { name: /Maren/ }));
      await userEvent.click(main().getByRole('button', { name: 'mentor' }));

      expect(mocks.linkEntry).toHaveBeenCalledExactlyOnceWith({
        id: expect.any(String),
        fromEntryId: 'tobias',
        toEntryId: 'maren',
        rel: 'mentor',
      });
    });

    it('create a new entry already tied to the open one', async () => {
      setup();
      await openTies();

      await userEvent.click(main().getByRole('button', { name: '+ Add tie' }));
      await userEvent.type(main().getByRole('textbox', { name: 'Search entries to tie' }), 'Ilsa');
      await userEvent.click(main().getByRole('button', { name: '+ Create “Ilsa”' }));
      await userEvent.click(main().getByRole('button', { name: 'friend' }));

      expect(mocks.createEntryTied).toHaveBeenCalledExactlyOnceWith({
        entryId: expect.any(String),
        tieId: expect.any(String),
        name: 'Ilsa',
        kind: 'character',
        shelf: 'people',
        toEntryId: 'tobias',
        rel: 'friend',
        confirmed: true,
        worldId: 'world-verge',
      });
      expect(rail().getByRole('button', { name: /Ilsa/ })).toBeDefined();
    });
  });

  describe('the categories', () => {
    it('add a category once the server has returned it', async () => {
      mocks.createCategory.mockResolvedValue({ ok: true, data: category('cat-songs', 'Songs') });
      setup();

      await userEvent.click(rail().getByRole('button', { name: '+ New category' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'New category name' }), 'Songs{Enter}');

      expect(mocks.createCategory).toHaveBeenCalledExactlyOnceWith({
        id: expect.any(String),
        label: 'Songs',
        shelf: 'lore',
      });
      expect(await screen.findByRole('region', { name: 'Songs' })).toBeDefined();
    });

    it('rename a category everywhere at once', async () => {
      setup();

      await userEvent.click(rail().getByRole('button', { name: 'Rename People category' }));
      const input = rail().getByRole('textbox', { name: 'Rename People category' });
      await userEvent.clear(input);
      await userEvent.type(input, 'Cast{Enter}');

      expect(mocks.renameCategory).toHaveBeenCalledExactlyOnceWith({ kind: 'character', label: 'Cast' });
      expect(shelf('Cast')).toBeDefined();
      expect(rail().getByRole('button', { name: 'Reset Cast category name' })).toBeDefined();
    });

    it('reset a renamed category to its default', async () => {
      setup();
      await userEvent.click(rail().getByRole('button', { name: 'Rename People category' }));
      const input = rail().getByRole('textbox', { name: 'Rename People category' });
      await userEvent.clear(input);
      await userEvent.type(input, 'Cast{Enter}');

      await userEvent.click(rail().getByRole('button', { name: 'Reset Cast category name' }));

      expect(mocks.resetCategoryLabel).toHaveBeenCalledExactlyOnceWith({ kind: 'character' });
      expect(shelf('People')).toBeDefined();
    });

    it('delete a custom category, with its entries, once confirmed', async () => {
      setup();

      await userEvent.click(rail().getByRole('button', { name: 'Delete Rituals category' }));
      const dialog = screen.getByRole('dialog', { name: 'Delete the Rituals category?' });
      expect(dialog.textContent).toContain('This removes all 1 Rituals entries');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete category' }));

      expect(mocks.deleteCategory).toHaveBeenCalledExactlyOnceWith({
        kind: 'cat-rituals',
        confirmed: true,
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Rituals' })).toBeNull();
      expect(rail().queryByRole('button', { name: /The Oath/ })).toBeNull();
    });
  });

  describe('the suggestions from the manuscript', () => {
    it('write a suggestion in as a detail of its entry', async () => {
      setup([RING]);

      await userEvent.click(main().getByRole('button', { name: 'Write it in' }));

      expect(mocks.addSuggestionAsFact).toHaveBeenCalledExactlyOnceWith({
        factId: expect.any(String),
        suggestionKey: 'sug-ring',
        worldId: 'world-verge',
        entryId: 'maren',
        key: 'Carries',
        value: 'A brass ring',
        sortOrder: 1,
        confirmed: true,
      });
      expect(screen.queryByRole('region', { name: 'Suggestions from the manuscript' })).toBeNull();
    });

    it('leave a suggestion out for good', async () => {
      setup([RING]);

      await userEvent.click(main().getByRole('button', { name: 'Leave it' }));

      expect(mocks.dismissSuggestion).toHaveBeenCalledExactlyOnceWith({
        worldId: 'world-verge',
        suggestionKey: 'sug-ring',
      });
      expect(screen.queryByRole('region', { name: 'Suggestions from the manuscript' })).toBeNull();
    });
  });

  describe('the trash', () => {
    const deleted = (id: string, name: string, daysAgo: number): EntryRow =>
      snapshotEntry(id, name, { deletedAt: Date.now() - daysAgo * DAY_MS });
    const ILSA = deleted('ilsa', 'Ilsa', 2);
    const BELL = deleted('the-bell', 'The Bell', 9);

    const trash = async () => within(await screen.findByRole('region', { name: 'Recently deleted' }));

    it('stays out of the rail while it is empty', async () => {
      setup();

      await waitFor(() => expect(mocks.getDeletedEntries).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('region', { name: 'Recently deleted' })).toBeNull();
    });

    it('restores an entry to the gazetteer', async () => {
      mocks.getDeletedEntries.mockResolvedValue({ ok: true, data: { entries: [ILSA] } });
      mocks.restoreEntry.mockResolvedValue({
        ok: true,
        data: { entry: snapshotEntry('ilsa', 'Ilsa') },
      });
      setup();

      await userEvent.click((await trash()).getByRole('button', { name: 'Restore' }));

      expect(mocks.restoreEntry).toHaveBeenCalledExactlyOnceWith({ id: 'ilsa' });
      await waitFor(() =>
        expect(screen.queryByRole('region', { name: 'Recently deleted' })).toBeNull(),
      );
      expect(tile('People', /Ilsa/)).toBeDefined();
    });

    it('purges the expired entries once confirmed, then reloads', async () => {
      mocks.getDeletedEntries
        .mockResolvedValueOnce({ ok: true, data: { entries: [ILSA, BELL] } })
        .mockResolvedValue({ ok: true, data: { entries: [ILSA] } });
      setup();

      await userEvent.click((await trash()).getByRole('button', { name: /^Empty trash/ }));
      const dialog = screen.getByRole('dialog', { name: 'Empty the trash?' });
      expect(dialog.textContent).toContain('1 entry that has been in the trash');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Empty trash' }));

      expect(mocks.purgeExpiredDeleted).toHaveBeenCalledExactlyOnceWith({ confirmed: true });
      await waitFor(() => expect(mocks.getDeletedEntries).toHaveBeenCalledTimes(2));
      await waitFor(async () => expect((await trash()).queryByText('The Bell')).toBeNull());
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows why the trash could not be loaded', async () => {
      mocks.getDeletedEntries.mockResolvedValue({ ok: false, error: 'Database is down.' });
      setup();

      expect((await screen.findByRole('alert')).textContent).toContain('Database is down.');
    });
  });
});
