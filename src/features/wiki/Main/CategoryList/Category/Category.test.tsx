import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import type { EntryWithDetails } from '@/domain/types';
import { DragProvider, useDrag, type DragItem } from '@/features/wiki/dnd/DragContext';
import Category from './Category';

const VERGE = snapshotEntry('the-verge', 'The Verge', { kind: 'world' });
const HOLLOW = snapshotEntry('the-hollow', 'The Hollow', { kind: 'world' });

// Stands in for a drag that began elsewhere on the page, such as a fact row.
function StartDrag({ item }: { item: DragItem }) {
  const drag = useDrag();
  return (
    <button type="button" onClick={() => drag.startDrag(item)}>
      start drag
    </button>
  );
}

const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' });

interface SetupOptions {
  entries?: EntryWithDetails[];
  isRenamed?: boolean;
  isBuiltin?: boolean;
  creatable?: boolean;
  dragged?: DragItem;
}

const setup = (options: SetupOptions = {}) => {
  const handlers = {
    onSelect: vi.fn(),
    onDropEntry: vi.fn(),
    onDropFactOnEntry: vi.fn(),
    onRenameCategory: vi.fn(),
    onResetCategory: vi.fn(),
    onRequestDeleteCategory: vi.fn(),
  };
  const onCreate = vi.fn();
  render(
    <DragProvider>
      {options.dragged ? <StartDrag item={options.dragged} /> : null}
      <Category
        shelf="places"
        categoryId="world"
        title="Places"
        entries={options.entries ?? [VERGE, HOLLOW]}
        selectedId="the-hollow"
        contradictions={new Set()}
        isRenamed={options.isRenamed ?? false}
        isBuiltin={options.isBuiltin ?? true}
        onCreate={options.creatable === false ? undefined : onCreate}
        {...handlers}
      />
    </DragProvider>,
  );
  return { ...handlers, onCreate, shelf: screen.getByRole('region', { name: 'Places' }) };
};

const startRename = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Rename Places category' }));
  return screen.getByRole('textbox', { name: 'Rename Places category' });
};

describe('Category', () => {
  it('lists its entries under its title, with a count', () => {
    const { shelf } = setup();

    expect(within(shelf).getByRole('button', { name: 'Rename Places category' }).textContent).toBe(
      'Places',
    );
    expect(within(shelf).getByText('2')).toBeDefined();
    expect(within(shelf).getByRole('button', { name: /The Verge/ })).toBeDefined();
    expect(within(shelf).getByRole('button', { name: /The Hollow/ })).toBeDefined();
  });

  it('marks the selected entry', () => {
    setup();

    expect(screen.getByRole('button', { name: /The Hollow/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /The Verge/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('says so when it has no entries', () => {
    setup({ entries: [] });

    expect(screen.getByRole('note').textContent).toBe('No entries yet');
  });

  describe('adding an entry', () => {
    it('creates one on its own shelf, named in the singular', async () => {
      const { onCreate } = setup();

      await userEvent.click(screen.getByRole('button', { name: '+ Add new place' }));

      expect(onCreate).toHaveBeenCalledExactlyOnceWith('places', 'world');
    });

    it('is not offered without a create handler', () => {
      setup({ creatable: false });

      expect(screen.queryByRole('button', { name: /Add new/ })).toBeNull();
    });
  });

  describe('renaming', () => {
    it('starts from the current title', async () => {
      setup();

      expect(await startRename()).toHaveProperty('value', 'Places');
    });

    it('commits a new label on Enter', async () => {
      const { onRenameCategory, onResetCategory } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, 'Regions{Enter}');

      expect(onRenameCategory).toHaveBeenCalledExactlyOnceWith('world', 'Regions');
      expect(onResetCategory).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('commits on blur', async () => {
      const { onRenameCategory } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, 'Regions');
      await userEvent.tab();

      expect(onRenameCategory).toHaveBeenCalledExactlyOnceWith('world', 'Regions');
    });

    it('resets to the default when the label is cleared', async () => {
      const { onRenameCategory, onResetCategory } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, '  {Enter}');

      expect(onResetCategory).toHaveBeenCalledExactlyOnceWith('world');
      expect(onRenameCategory).not.toHaveBeenCalled();
    });

    it('does nothing when the label is unchanged', async () => {
      const { onRenameCategory, onResetCategory } = setup();
      const input = await startRename();

      await userEvent.type(input, '{Enter}');

      expect(onRenameCategory).not.toHaveBeenCalled();
      expect(onResetCategory).not.toHaveBeenCalled();
    });

    it('abandons the edit on Escape', async () => {
      const { onRenameCategory, onResetCategory } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, 'Regions{Escape}');

      expect(onRenameCategory).not.toHaveBeenCalled();
      expect(onResetCategory).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Rename Places category' })).toBeDefined();
    });
  });

  describe('the header actions', () => {
    it('offers a reset only once the category is renamed', async () => {
      const { onResetCategory } = setup({ isRenamed: true });

      await userEvent.click(screen.getByRole('button', { name: 'Reset to default' }));

      expect(onResetCategory).toHaveBeenCalledExactlyOnceWith('world');
    });

    it('hides the reset for a category that still has its default name', () => {
      setup();

      expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
    });

    it('asks before deleting a custom category', async () => {
      const { onRequestDeleteCategory } = setup({ isBuiltin: false });

      await userEvent.click(screen.getByRole('button', { name: 'Delete Places category' }));

      expect(onRequestDeleteCategory).toHaveBeenCalledExactlyOnceWith('world');
    });

    it('never offers to delete a built-in category', () => {
      setup({ isBuiltin: true });

      expect(screen.queryByRole('button', { name: 'Delete Places category' })).toBeNull();
    });
  });

  describe('as a drop zone', () => {
    it('takes a dragged entry onto the end of its shelf', () => {
      const { shelf, onDropEntry } = setup();
      fireEvent.dragStart(screen.getByRole('button', { name: /The Verge/ }), {
        dataTransfer: dataTransfer(),
      });

      // fireEvent returns false once a handler calls preventDefault, which is
      // how a drop zone says it accepts the drag.
      expect(fireEvent.dragOver(shelf, { dataTransfer: dataTransfer() })).toBe(false);
      fireEvent.drop(shelf, { dataTransfer: dataTransfer() });

      expect(onDropEntry).toHaveBeenCalledExactlyOnceWith('places', null);
    });

    it('does not accept anything that is not an entry', async () => {
      const { shelf, onDropEntry } = setup({
        dragged: { type: 'fact', id: 'maren.Carries', from: 'maren' },
      });
      await userEvent.click(screen.getByRole('button', { name: 'start drag' }));

      expect(fireEvent.dragOver(shelf, { dataTransfer: dataTransfer() })).toBe(true);
      fireEvent.drop(shelf, { dataTransfer: dataTransfer() });

      expect(onDropEntry).not.toHaveBeenCalled();
    });
  });
});
