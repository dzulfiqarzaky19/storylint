import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import { DragProvider, useDrag, type DragItem } from '@/features/wiki/dnd/DragContext';
import Facts from './Facts';

const FACTS = snapshotEntry('maren', 'Maren', {
  facts: { Eyes: 'grey', Carries: 'a brass ring' },
}).facts;

// Stands in for a drag that began elsewhere on the page, such as a suggestion card.
function StartDrag({ item }: { item: DragItem }) {
  const drag = useDrag();
  return (
    <button type="button" onClick={() => drag.startDrag(item)}>
      start drag
    </button>
  );
}

const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' });

type Ai = NonNullable<Parameters<typeof Facts>[0]['ai']>;

const setup = (options: { ai?: Partial<Ai>; dragged?: DragItem } = {}) => {
  const handlers = {
    onDropSuggestion: vi.fn(),
    onEditFactField: vi.fn(),
    onAddFact: vi.fn(),
    onDeleteFact: vi.fn(),
  };
  const ai: Ai = {
    suggestions: [],
    busy: false,
    onSuggest: vi.fn(),
    onAdd: vi.fn(),
    onDismiss: vi.fn(),
    ...options.ai,
  };
  render(
    <DragProvider>
      {options.dragged ? <StartDrag item={options.dragged} /> : null}
      <Facts entryId="maren" facts={FACTS} ai={options.ai ? ai : undefined} {...handlers} />
    </DragProvider>,
  );
  return { ...handlers, ai, rows: screen.getAllByRole('list')[0]! };
};

const rowOf = (text: string) => screen.getByRole('button', { name: text }).closest('li')!;

describe('Facts', () => {
  it('lists each detail as a label and a value', () => {
    const { rows } = setup();

    expect(within(rows).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'Eyesgrey',
      'Carriesa brass ring',
    ]);
  });

  it('commits an edited value', async () => {
    const { onEditFactField } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'grey' }));
    const input = screen.getByRole('textbox', { name: 'detail value' });
    await userEvent.clear(input);
    await userEvent.type(input, 'green{Enter}');

    expect(onEditFactField).toHaveBeenCalledExactlyOnceWith('maren', 'maren.Eyes', 'value', 'green');
  });

  it('commits an edited label', async () => {
    const { onEditFactField } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Carries' }));
    const input = screen.getByRole('textbox', { name: 'detail label' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Wears{Enter}');

    expect(onEditFactField).toHaveBeenCalledExactlyOnceWith('maren', 'maren.Carries', 'key', 'Wears');
  });

  it('deletes the detail whose button is clicked', async () => {
    const { onDeleteFact } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Carries' }));

    expect(onDeleteFact).toHaveBeenCalledExactlyOnceWith('maren', 'maren.Carries');
  });

  it('adds a detail to its entry', async () => {
    const { onAddFact } = setup();

    await userEvent.click(screen.getByRole('button', { name: '+ Add detail' }));

    expect(onAddFact).toHaveBeenCalledExactlyOnceWith('maren');
  });

  it('carries the fact id when a row is dragged', () => {
    setup();
    const transfer = dataTransfer();

    fireEvent.dragStart(rowOf('grey'), { dataTransfer: transfer });

    expect(transfer.setData).toHaveBeenCalledExactlyOnceWith('text/plain', 'maren.Eyes');
    expect(transfer.effectAllowed).toBe('move');
  });

  describe('as a drop zone', () => {
    it('takes a dropped suggestion card', async () => {
      const { rows, onDropSuggestion } = setup({
        dragged: { type: 'card', id: 'sug-ring', from: 'poster' },
      });
      await userEvent.click(screen.getByRole('button', { name: 'start drag' }));

      // fireEvent returns false once a handler calls preventDefault, which is
      // how a drop zone says it accepts the drag.
      expect(fireEvent.dragOver(rows, { dataTransfer: dataTransfer() })).toBe(false);
      fireEvent.drop(rows, { dataTransfer: dataTransfer() });

      expect(onDropSuggestion).toHaveBeenCalledExactlyOnceWith('sug-ring');
    });

    it('does not accept one of its own rows', () => {
      const { rows, onDropSuggestion } = setup();
      fireEvent.dragStart(rowOf('grey'), { dataTransfer: dataTransfer() });

      expect(fireEvent.dragOver(rows, { dataTransfer: dataTransfer() })).toBe(true);
      fireEvent.drop(rows, { dataTransfer: dataTransfer() });

      expect(onDropSuggestion).not.toHaveBeenCalled();
    });
  });

  describe('AI suggestions', () => {
    const SCAR = { key: 'Scar', value: 'left wrist' };

    it('are not offered without an AI', () => {
      setup();

      expect(screen.queryByRole('button', { name: 'Suggest details' })).toBeNull();
    });

    it('are requested from the suggest button', async () => {
      const { ai } = setup({ ai: {} });

      await userEvent.click(screen.getByRole('button', { name: 'Suggest details' }));

      expect(ai.onSuggest).toHaveBeenCalledTimes(1);
    });

    it('lock the suggest button while thinking', () => {
      setup({ ai: { busy: true } });

      expect(screen.getByRole('button', { name: 'Thinking…' })).toHaveProperty('disabled', true);
    });

    it('add the suggestion that is accepted', async () => {
      const { ai } = setup({ ai: { suggestions: [SCAR] } });

      expect(screen.getByText('Scar:').closest('li')!.textContent).toContain('Scar: left wrist');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(ai.onAdd).toHaveBeenCalledExactlyOnceWith('Scar', 'left wrist');
    });

    it('dismiss the suggestion by its key', async () => {
      const { ai } = setup({ ai: { suggestions: [SCAR] } });

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss Scar' }));

      expect(ai.onDismiss).toHaveBeenCalledExactlyOnceWith('Scar');
    });
  });
});
