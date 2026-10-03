import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ResolvedTie } from '@/domain/types';
import { DragProvider, useDrag, type DragItem } from '@/features/wiki/dnd/DragContext';
import Ties, { type TieCandidate } from './Ties';

const tie = (toEntryId: string, toName: string, toKind: string, rel: string): ResolvedTie => ({
  id: `maren>${toEntryId}`,
  fromEntryId: 'maren',
  toEntryId,
  rel,
  toName,
  toKind,
  toCatalogueNo: toEntryId.toUpperCase(),
});

const TO_TOBIAS = tie('tobias', 'Tobias', 'character', 'mentor');
const TO_VERGE = tie('the-verge', 'The Verge', 'world', 'home');
// Ilsa was deleted, so her tie is a tombstone.
const TO_ILSA = tie('ilsa', 'Ilsa', 'character', 'rival');

const CANDIDATES: TieCandidate[] = [
  { id: 'tobias', name: 'Tobias', kind: 'character' },
  { id: 'the-hollow', name: 'The Hollow', kind: 'world' },
];

// Stands in for a drag that began elsewhere on the page, such as an entry tile.
function StartDrag({ item }: { item: DragItem }) {
  const drag = useDrag();
  return (
    <button type="button" onClick={() => drag.startDrag(item)}>
      start drag
    </button>
  );
}

const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' });

const setup = (dragged?: DragItem) => {
  const handlers = {
    onSelect: vi.fn(),
    onDropOnTies: vi.fn(),
    onUntie: vi.fn(),
    onTieExisting: vi.fn(),
    onCreateTied: vi.fn(),
  };
  render(
    <DragProvider>
      {dragged ? <StartDrag item={dragged} /> : null}
      <Ties
        ties={[TO_TOBIAS, TO_VERGE, TO_ILSA]}
        liveEntryIds={new Set(['tobias', 'the-verge'])}
        tieCandidates={CANDIDATES}
        {...handlers}
      />
    </DragProvider>,
  );
  return handlers;
};

const openAdd = async () => {
  await userEvent.click(screen.getByRole('button', { name: '+ Add tie' }));
  return within(screen.getByRole('listbox', { name: 'Pick an entry to tie' }));
};
const search = () => screen.getByRole('textbox', { name: 'Search entries to tie' });

describe('Ties', () => {
  it('groups the ties by the kind they point at, with counts', () => {
    setup();

    const groups = screen
      .getAllByRole('listitem')
      .filter((item) => item.parentElement === screen.getAllByRole('list')[0])
      .map((item) => item.firstElementChild?.textContent);
    expect(groups).toEqual(['character2', 'world1']);
    expect(screen.getByRole('heading', { name: 'Ties' }).parentElement?.textContent).toBe('Ties3');
  });

  it('opens the entry a tie points at', async () => {
    const { onSelect } = setup();

    await userEvent.click(screen.getByRole('button', { name: /^The Verge/ }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('the-verge');
  });

  describe('a tie to a deleted entry', () => {
    it('is shown as a tombstone that cannot be opened', () => {
      setup();

      expect(screen.getByRole('note').textContent).toBe('Ilsaremoved — needs replacement');
      expect(screen.queryByRole('button', { name: /^Ilsa/ })).toBeNull();
    });

    it('offers a replacement, seeded with the old name and role', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'Replace tie to Ilsa' }));

      expect(search()).toHaveProperty('value', 'Ilsa');
      await userEvent.click(screen.getByRole('button', { name: '+ Create “Ilsa”' }));
      expect(screen.getByRole('textbox', { name: 'Relationship label' })).toHaveProperty(
        'value',
        'rival',
      );
    });
  });

  describe('untying', () => {
    const openConfirm = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Untie Tobias' }));
      return within(screen.getByRole('dialog', { name: 'Untie Tobias?' }));
    };

    it('removes the tie once confirmed', async () => {
      const { onUntie } = setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Untie' }));

      expect(onUntie).toHaveBeenCalledExactlyOnceWith('maren>tobias');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the tie when cancelled', async () => {
      const { onUntie } = setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

      expect(onUntie).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('adding a tie', () => {
    it('lists the candidates and waits for a pick', async () => {
      setup();
      const picker = await openAdd();

      expect(picker.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Tobias character',
        'The Hollow world',
      ]);
      expect(screen.getByText('Pick an entry above to see role suggestions.')).toBeDefined();
    });

    it('narrows the candidates to what the search matches', async () => {
      setup();
      const picker = await openAdd();

      await userEvent.type(search(), 'holl');

      expect(picker.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'The Hollow world',
      ]);
    });

    it('ties an existing entry with a role chip suited to its kind', async () => {
      const { onTieExisting, onCreateTied } = setup();
      const picker = await openAdd();

      await userEvent.click(picker.getByRole('option', { name: /The Hollow/ }));
      expect(screen.getByText('Relationship to world:')).toBeDefined();
      await userEvent.click(screen.getByRole('button', { name: 'origin' }));

      expect(onTieExisting).toHaveBeenCalledExactlyOnceWith('the-hollow', 'origin');
      expect(onCreateTied).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '+ Add tie' })).toBeDefined();
    });

    it('ties an existing entry with a typed role, trimmed', async () => {
      const { onTieExisting } = setup();
      const picker = await openAdd();

      await userEvent.click(picker.getByRole('option', { name: /Tobias/ }));
      await userEvent.type(
        screen.getByRole('textbox', { name: 'Relationship label' }),
        ' cousin {Enter}',
      );

      expect(onTieExisting).toHaveBeenCalledExactlyOnceWith('tobias', 'cousin');
    });

    it('creates and ties a new entry from the search text', async () => {
      const { onCreateTied, onTieExisting } = setup();
      await openAdd();

      await userEvent.type(search(), ' Ilsa ');
      await userEvent.click(screen.getByRole('button', { name: '+ Create “Ilsa”' }));
      await userEvent.click(screen.getByRole('button', { name: 'friend' }));

      expect(onCreateTied).toHaveBeenCalledExactlyOnceWith('Ilsa', 'friend');
      expect(onTieExisting).not.toHaveBeenCalled();
    });

    it('does not offer to create an entry that already exists', async () => {
      setup();
      await openAdd();

      await userEvent.type(search(), 'tobias');

      expect(screen.queryByRole('button', { name: /Create/ })).toBeNull();
    });

    it('drops the pick when the search text changes', async () => {
      setup();
      const picker = await openAdd();
      await userEvent.click(picker.getByRole('option', { name: /Tobias/ }));

      await userEvent.type(search(), 'T');

      expect(screen.getByText('Pick an entry above to see role suggestions.')).toBeDefined();
    });

    it('closes without tying on cancel', async () => {
      const { onTieExisting, onCreateTied } = setup();
      const picker = await openAdd();
      await userEvent.click(picker.getByRole('option', { name: /Tobias/ }));

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onTieExisting).not.toHaveBeenCalled();
      expect(onCreateTied).not.toHaveBeenCalled();
    });
  });

  describe('as a drop zone', () => {
    it('ties a dropped entry', async () => {
      const { onDropOnTies } = setup({ type: 'entry', id: 'the-hollow', from: 'places' });
      await userEvent.click(screen.getByRole('button', { name: 'start drag' }));
      const column = screen.getAllByRole('list')[0]!;

      // fireEvent returns false once a handler calls preventDefault, which is
      // how a drop zone says it accepts the drag.
      expect(fireEvent.dragOver(column, { dataTransfer: dataTransfer() })).toBe(false);
      fireEvent.drop(column, { dataTransfer: dataTransfer() });

      expect(onDropOnTies).toHaveBeenCalledTimes(1);
    });

    it('does not accept anything that is not an entry', async () => {
      const { onDropOnTies } = setup({ type: 'fact', id: 'maren.Eyes', from: 'maren' });
      await userEvent.click(screen.getByRole('button', { name: 'start drag' }));
      const column = screen.getAllByRole('list')[0]!;

      expect(fireEvent.dragOver(column, { dataTransfer: dataTransfer() })).toBe(true);
      fireEvent.drop(column, { dataTransfer: dataTransfer() });

      expect(onDropOnTies).not.toHaveBeenCalled();
    });
  });
});
