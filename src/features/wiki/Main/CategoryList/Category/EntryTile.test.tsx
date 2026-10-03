import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import { DragProvider, useDrag, type DragItem } from '@/features/wiki/dnd/DragContext';
import EntryTile from './EntryTile';

const MAREN = snapshotEntry('maren', 'Maren', { note: 'Keeper of the lamps' });
const VERGE = snapshotEntry('the-verge', 'The Verge', { kind: 'world' });

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

const setup = (props: { selected?: boolean; hasContradiction?: boolean; dragged?: DragItem } = {}) => {
  const handlers = {
    onSelect: vi.fn(),
    onDropEntry: vi.fn(),
    onDropFactOnEntry: vi.fn(),
  };
  render(
    <DragProvider>
      {props.dragged ? <StartDrag item={props.dragged} /> : null}
      <EntryTile
        entry={MAREN}
        selected={props.selected ?? false}
        hasContradiction={props.hasContradiction ?? false}
        {...handlers}
      />
      <EntryTile entry={VERGE} selected={false} hasContradiction={false} {...handlers} />
    </DragProvider>,
  );
  return {
    ...handlers,
    maren: screen.getByRole('button', { name: /Maren/ }),
    verge: screen.getByRole('button', { name: /The Verge/ }),
  };
};

describe('EntryTile', () => {
  it('shows the entry name and note', () => {
    const { maren } = setup();

    expect(maren.textContent).toBe('MarenKeeper of the lamps');
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('reports selected=%s as pressed', (selected, pressed) => {
    const { maren } = setup({ selected });

    expect(maren.getAttribute('aria-pressed')).toBe(pressed);
  });

  it('flags an entry that has a contradiction', () => {
    const { maren, verge } = setup({ hasContradiction: true });

    expect(maren.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(verge.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('selects the entry that is clicked', async () => {
    const { verge, onSelect } = setup();

    await userEvent.click(verge);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('the-verge');
  });

  it('carries its id when a drag starts', () => {
    const { maren } = setup();
    const transfer = dataTransfer();

    fireEvent.dragStart(maren, { dataTransfer: transfer });

    expect(transfer.setData).toHaveBeenCalledExactlyOnceWith('text/plain', 'maren');
    expect(transfer.effectAllowed).toBe('move');
  });

  describe('while another entry is dragged', () => {
    it('accepts the drag over a different tile, but not over itself', () => {
      const { maren, verge } = setup();
      fireEvent.dragStart(maren, { dataTransfer: dataTransfer() });

      // fireEvent returns false once a handler calls preventDefault, which is
      // how a drop target says it accepts the drag.
      expect(fireEvent.dragOver(verge, { dataTransfer: dataTransfer() })).toBe(false);
      expect(fireEvent.dragOver(maren, { dataTransfer: dataTransfer() })).toBe(true);
    });

    it('places the dropped entry before itself, on its own shelf', () => {
      const { maren, verge, onDropEntry, onDropFactOnEntry } = setup();
      fireEvent.dragStart(maren, { dataTransfer: dataTransfer() });

      fireEvent.drop(verge, { dataTransfer: dataTransfer() });

      expect(onDropEntry).toHaveBeenCalledExactlyOnceWith('places', 'the-verge');
      expect(onDropFactOnEntry).not.toHaveBeenCalled();
    });
  });

  describe('while a fact is dragged', () => {
    const FACT: DragItem = { type: 'fact', id: 'maren.Carries', from: 'maren' };

    it('takes the dropped fact', async () => {
      const { verge, onDropEntry, onDropFactOnEntry } = setup({ dragged: FACT });
      await userEvent.click(screen.getByRole('button', { name: 'start drag' }));

      fireEvent.drop(verge, { dataTransfer: dataTransfer() });

      expect(onDropFactOnEntry).toHaveBeenCalledExactlyOnceWith('the-verge');
      expect(onDropEntry).not.toHaveBeenCalled();
    });
  });

  it('ignores a drag that is not an entry or a fact', async () => {
    const { verge, onDropEntry, onDropFactOnEntry } = setup({
      dragged: { type: 'card', id: 'sug-1', from: 'poster' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'start drag' }));

    expect(fireEvent.dragOver(verge, { dataTransfer: dataTransfer() })).toBe(true);
    fireEvent.drop(verge, { dataTransfer: dataTransfer() });

    expect(onDropEntry).not.toHaveBeenCalled();
    expect(onDropFactOnEntry).not.toHaveBeenCalled();
  });
});
