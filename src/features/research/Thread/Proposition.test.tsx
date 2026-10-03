import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ResearchProposition } from '@/domain/types';
import Proposition from './Proposition';

const CARD: ResearchProposition = {
  id: 'card-1',
  turnId: 'turn-1',
  kind: 'custom',
  title: 'Tallow lamps',
  body: 'They smoke and gutter in a draught.',
  asKind: 'world',
  sortOrder: 0,
  kept: false,
  inWiki: false,
};

const setup = (over: { kept?: boolean; inWiki?: boolean; focused?: boolean } = {}) => {
  const handlers = {
    onKeep: vi.fn(),
    onPropose: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
  };
  const { container } = render(
    <Proposition
      card={CARD}
      kept={over.kept ?? false}
      inWiki={over.inWiki ?? false}
      focused={over.focused}
      {...handlers}
    />,
  );
  return { ...handlers, card: container.firstElementChild as HTMLElement };
};

describe('Proposition', () => {
  it('shows the card’s kind, title and body', () => {
    const { card } = setup();

    expect(card.textContent).toContain('custom');
    expect(card.textContent).toContain('Tallow lamps');
    expect(card.textContent).toContain('They smoke and gutter in a draught.');
  });

  it('keeps a card that is not kept', async () => {
    const { onKeep } = setup();
    const keep = screen.getByRole('button', { name: 'Keep' });
    expect(keep.getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(keep);

    expect(onKeep).toHaveBeenCalledExactlyOnceWith('card-1', true);
  });

  it('releases a card that is kept', async () => {
    const { onKeep } = setup({ kept: true });
    const kept = screen.getByRole('button', { name: 'Kept' });
    expect(kept.getAttribute('aria-pressed')).toBe('true');

    await userEvent.click(kept);

    expect(onKeep).toHaveBeenCalledExactlyOnceWith('card-1', false);
  });

  it('offers to make the card a wiki entry', async () => {
    const { onPropose } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Make it an entry' }));

    expect(onPropose).toHaveBeenCalledExactlyOnceWith('card-1');
  });

  it('locks a card that is already in the wiki', () => {
    setup({ kept: true, inWiki: true });

    expect(screen.getByRole('button', { name: 'Kept' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Make it an entry' })).toBeNull();
    expect(screen.getByText('In the wiki')).toBeDefined();
  });

  it('flags the focused card, and only that one', () => {
    expect(setup({ focused: true }).card.getAttribute('data-card-focused')).toBe('true');
    expect(setup().card.getAttribute('data-card-focused')).toBeNull();
  });

  it('carries its id on a copy drag and reports the drag', () => {
    const { card, onDragStart, onDragEnd } = setup();
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'none' };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragEnd(card);

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'card-1');
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(onDragStart).toHaveBeenCalledExactlyOnceWith('card-1');
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('still reports the drag when the browser refuses the drag data', () => {
    const { card, onDragStart } = setup();
    const dataTransfer = {
      setData: () => {
        throw new Error('denied');
      },
    };

    fireEvent.dragStart(card, { dataTransfer });

    expect(onDragStart).toHaveBeenCalledExactlyOnceWith('card-1');
  });
});
