import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import type { CategoryRow, EntryWithDetails } from '@/domain/types';
import { DragProvider } from '@/features/wiki/dnd/DragContext';
import { category, suggestion } from '@/features/wiki/state/testing/state';
import Main from './Main';

const mocks = vi.hoisted(() => ({ unshareEntityFromWorld: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  shareEntityToWorld: vi.fn(),
  unshareEntityFromWorld: mocks.unshareEntityFromWorld,
}));

const PEOPLE: CategoryRow = category('character', 'People', { shelf: 'people', isBuiltin: true });
const PLACES: CategoryRow = category('world', 'Places', { shelf: 'places', isBuiltin: true });
const RITUALS: CategoryRow = category('cat-rituals', 'Rituals');

const MAREN = snapshotEntry('maren', 'Maren', { facts: { Eyes: 'grey' } });
const TOBIAS = snapshotEntry('tobias', 'Tobias');
const OATH = snapshotEntry('the-oath', 'The Oath', { kind: 'lore' });

type MainProps = Parameters<typeof Main>[0];

const setup = (over: Partial<MainProps> = {}) => {
  const spies = {
    dispatch: vi.fn(),
    commit: vi.fn(),
    select: vi.fn(),
    setConfirmDeleteKind: vi.fn(),
    setConfirmPurge: vi.fn(),
    purge: vi.fn(),
    writeSuggestion: vi.fn(),
    leaveSuggestion: vi.fn(),
    addSuggestedFact: vi.fn(),
    aiSuggest: vi.fn(),
    aiRemove: vi.fn(),
    createEntryOnShelf: vi.fn(),
    deleteEntry: vi.fn(),
  };
  const props: MainProps = {
    selected: MAREN,
    categories: [PEOPLE, PLACES, RITUALS],
    overrides: {},
    byCategory: new Map<string, EntryWithDetails[]>([
      ['character', [MAREN, TOBIAS]],
      ['cat-rituals', [OATH]],
    ]),
    contradictions: new Set(),
    liveEntryIds: new Set(['maren', 'tobias', 'the-oath']),
    tieCandidates: [],
    suggestions: [],
    error: null,
    worlds: [{ id: 'world-verge', title: 'Verge' }],
    activeWorldId: 'world-verge',
    entryCount: 3,
    confirmDeleteKind: null,
    setConfirmDeleteKind: spies.setConfirmDeleteKind,
    confirmDeleteLabel: '',
    trash: {
      confirmPurge: false,
      setConfirmPurge: spies.setConfirmPurge,
      purgeableCount: 0,
      purge: spies.purge,
    },
    dispatch: spies.dispatch,
    commit: spies.commit,
    select: spies.select,
    dropEntry: vi.fn(),
    dropFactOnEntry: vi.fn(),
    dropOnTies: vi.fn(),
    addSuggestionToDetails: vi.fn(),
    createEntryOnShelf: spies.createEntryOnShelf,
    createCategoryOnShelf: vi.fn(),
    renameCategoryLabel: vi.fn(),
    resetCategory: vi.fn(),
    deleteEntry: spies.deleteEntry,
    untieFromSelected: vi.fn(),
    tieExistingToSelected: vi.fn(),
    createTiedToSelected: vi.fn(),
    editEntryField: vi.fn(),
    editFactField: vi.fn(),
    addFact: vi.fn(),
    deleteFactCallback: vi.fn(),
    writeSuggestion: spies.writeSuggestion,
    leaveSuggestion: spies.leaveSuggestion,
    ai: { suggestions: {}, busy: false, suggest: spies.aiSuggest, remove: spies.aiRemove },
    addSuggestedFact: spies.addSuggestedFact,
    ...over,
  };
  render(
    <DragProvider>
      <Main {...props} />
    </DragProvider>,
  );
  return spies;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Main', () => {
  it('says the gazetteer is empty when nothing is selected', () => {
    setup({ selected: undefined });

    expect(screen.getByRole('main').textContent).toBe('No entries in the gazetteer yet.');
  });

  it('shows the selected entry above the categories of the world', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Maren');
    expect(screen.getByRole('region', { name: 'The world' }).textContent).toContain('3 entries');
    expect(screen.getByRole('region', { name: 'People' })).toBeDefined();
  });

  describe('the error bar', () => {
    it('is absent while nothing has gone wrong', () => {
      setup();

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows a failed save and clears it on dismiss', async () => {
      const { dispatch } = setup({ error: 'editEntry: offline' });

      expect(screen.getByRole('alert').textContent).toContain('Save failed: editEntry: offline');
      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'SET_ERROR', error: null });
    });

    it('receives the errors of the sharing controls', async () => {
      mocks.unshareEntityFromWorld.mockResolvedValue({ ok: false, error: 'Last world.' });
      const { dispatch } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Unlink Maren from Verge' }));

      await waitFor(() =>
        expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'SET_ERROR', error: 'Last world.' }),
      );
    });
  });

  describe('the categories', () => {
    it('treat the four kinds as built in, and the rest as deletable', () => {
      setup();

      expect(screen.queryByRole('button', { name: 'Delete People category' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Delete Rituals category' })).toBeDefined();
    });

    it('offer a reset only for a built-in kind with an override', () => {
      setup({ overrides: { character: 'Cast' } });

      const reset = (title: string) =>
        within(screen.getByRole('region', { name: title })).queryByRole('button', {
          name: 'Reset to default',
        });
      expect(reset('People')).not.toBeNull();
      expect(reset('Places')).toBeNull();
      expect(reset('Rituals')).toBeNull();
    });

    it('create an entry in the category whose add button is clicked', async () => {
      const { createEntryOnShelf } = setup();

      await userEvent.click(screen.getByRole('button', { name: '+ Add new ritual' }));

      expect(createEntryOnShelf).toHaveBeenCalledExactlyOnceWith('lore', 'cat-rituals');
    });

    it('select the entry whose tile is clicked', async () => {
      const { select } = setup();

      await userEvent.click(
        within(screen.getByRole('region', { name: 'People' })).getByRole('button', { name: /Tobias/ }),
      );

      expect(select).toHaveBeenCalledExactlyOnceWith('tobias');
    });
  });

  describe('deleting a category', () => {
    it('asks its owner to open the confirmation', async () => {
      const { setConfirmDeleteKind, commit } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Delete Rituals category' }));

      expect(setConfirmDeleteKind).toHaveBeenCalledExactlyOnceWith('cat-rituals');
      expect(commit).not.toHaveBeenCalled();
    });

    const confirming: Partial<MainProps> = {
      confirmDeleteKind: 'cat-rituals',
      confirmDeleteLabel: 'Rituals',
    };

    it('says how many entries go with it', () => {
      setup(confirming);

      const dialog = screen.getByRole('dialog', { name: 'Delete the Rituals category?' });
      expect(dialog.textContent).toContain('This removes all 1 Rituals entries from the gazetteer.');
    });

    it('deletes it once confirmed, and closes', async () => {
      const { commit, setConfirmDeleteKind } = setup(confirming);

      await userEvent.click(screen.getByRole('button', { name: 'Delete category' }));

      expect(commit).toHaveBeenCalledExactlyOnceWith({
        type: 'category.delete',
        categoryId: 'cat-rituals',
      });
      expect(setConfirmDeleteKind).toHaveBeenCalledExactlyOnceWith(null);
    });

    it('only closes when cancelled', async () => {
      const { commit, setConfirmDeleteKind } = setup(confirming);

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
      );

      expect(commit).not.toHaveBeenCalled();
      expect(setConfirmDeleteKind).toHaveBeenCalledExactlyOnceWith(null);
    });
  });

  describe('emptying the trash', () => {
    const purging = (purgeableCount: number, spies?: Partial<MainProps['trash']>): Partial<MainProps> => ({
      trash: {
        confirmPurge: true,
        setConfirmPurge: vi.fn(),
        purgeableCount,
        purge: vi.fn(),
        ...spies,
      },
    });

    it.each([
      [1, '1 entry that has been in the trash'],
      [3, '3 entries that have been in the trash'],
    ])('says what %i expired entries means', (count, phrase) => {
      setup(purging(count));

      expect(screen.getByRole('dialog', { name: 'Empty the trash?' }).textContent).toContain(phrase);
    });

    it('purges once confirmed, and closes', async () => {
      const setConfirmPurge = vi.fn();
      const purge = vi.fn();
      setup(purging(2, { setConfirmPurge, purge }));

      await userEvent.click(screen.getByRole('button', { name: 'Empty trash' }));

      expect(purge).toHaveBeenCalledTimes(1);
      expect(setConfirmPurge).toHaveBeenCalledExactlyOnceWith(false);
    });

    it('only closes when cancelled', async () => {
      const setConfirmPurge = vi.fn();
      const purge = vi.fn();
      setup(purging(2, { setConfirmPurge, purge }));

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
      );

      expect(purge).not.toHaveBeenCalled();
      expect(setConfirmPurge).toHaveBeenCalledExactlyOnceWith(false);
    });
  });

  describe('the suggestions from the manuscript', () => {
    const RING = suggestion('sug-ring', 'maren');

    it('are written in or left by their owner', async () => {
      const { writeSuggestion, leaveSuggestion } = setup({ suggestions: [RING] });

      await userEvent.click(screen.getByRole('button', { name: 'Write it in' }));
      await userEvent.click(screen.getByRole('button', { name: 'Leave it' }));

      expect(writeSuggestion).toHaveBeenCalledExactlyOnceWith(RING);
      expect(leaveSuggestion).toHaveBeenCalledExactlyOnceWith(RING);
    });
  });

  describe('the AI detail suggestions', () => {
    const SCAR = { key: 'Scar', value: 'left wrist' };

    it('are requested for the selected entry', async () => {
      const { aiSuggest } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Suggest details' }));

      expect(aiSuggest).toHaveBeenCalledExactlyOnceWith('maren');
    });

    it('show only those made for the selected entry', () => {
      setup({
        ai: {
          suggestions: { maren: [SCAR], tobias: [{ key: 'Limp', value: 'left leg' }] },
          busy: false,
          suggest: vi.fn(),
          remove: vi.fn(),
        },
      });

      expect(screen.getByText('Scar:')).toBeDefined();
      expect(screen.queryByText('Limp:')).toBeNull();
    });

    it('are added to, or dismissed from, the selected entry', async () => {
      const remove = vi.fn();
      const { addSuggestedFact } = setup({
        ai: { suggestions: { maren: [SCAR] }, busy: false, suggest: vi.fn(), remove },
      });

      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      await userEvent.click(screen.getByRole('button', { name: 'Dismiss Scar' }));

      expect(addSuggestedFact).toHaveBeenCalledExactlyOnceWith('maren', 'Scar', 'left wrist');
      expect(remove).toHaveBeenCalledExactlyOnceWith('maren', 'Scar');
    });
  });

  it('passes the delete of the selected entry up', async () => {
    const { deleteEntry } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Maren' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete Maren?' })).getByRole('button', {
        name: 'Delete',
      }),
    );

    expect(deleteEntry).toHaveBeenCalledExactlyOnceWith('maren');
  });
});
