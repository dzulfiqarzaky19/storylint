import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { WikiSuggestion } from '@/domain/types';
import { DragProvider } from '@/features/wiki/dnd/DragContext';
import { suggestion } from '@/features/wiki/state/testing/state';
import Suggestions from './Suggestions';

const RING: WikiSuggestion = suggestion('sug-ring', 'maren');
const SCAR: WikiSuggestion = {
  ...suggestion('sug-scar', 'maren'),
  text: '“a scar on her wrist” — not yet in the wiki',
  source: 'Chapter 3',
};

const setup = (suggestions: WikiSuggestion[] = [RING, SCAR]) => {
  const onWriteIn = vi.fn();
  const onLeave = vi.fn();
  const { container } = render(
    <DragProvider>
      <Suggestions suggestions={suggestions} onWriteIn={onWriteIn} onLeave={onLeave} />
    </DragProvider>,
  );
  return { container, onWriteIn, onLeave };
};

const cardOf = (text: string) => screen.getByText(text).closest('article')!;

describe('Suggestions', () => {
  it('renders nothing when there is nothing to suggest', () => {
    const { container } = setup([]);

    expect(container.innerHTML).toBe('');
  });

  it('counts the suggestions in its headline', () => {
    setup();

    expect(
      screen.getByRole('heading', { name: '2 things the gazetteer has never written down.' }),
    ).toBeDefined();
  });

  it('shows where each suggestion came from', () => {
    setup();

    expect(cardOf(RING.text).textContent).toContain('Chapter 1');
    expect(cardOf(SCAR.text).textContent).toContain('Chapter 3');
  });

  it('expands and collapses from its toggle', async () => {
    setup();
    const toggle = screen.getByRole('button', { name: /2 things the gazetteer/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      document.getElementById(toggle.getAttribute('aria-controls')!)?.textContent,
    ).toContain(RING.text);

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('writes in the suggestion whose button is clicked', async () => {
    const { onWriteIn, onLeave } = setup();

    await userEvent.click(within(cardOf(SCAR.text)).getByRole('button', { name: 'Write it in' }));

    expect(onWriteIn).toHaveBeenCalledExactlyOnceWith(SCAR);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('leaves the suggestion whose button is clicked', async () => {
    const { onWriteIn, onLeave } = setup();

    await userEvent.click(within(cardOf(RING.text)).getByRole('button', { name: 'Leave it' }));

    expect(onLeave).toHaveBeenCalledExactlyOnceWith(RING);
    expect(onWriteIn).not.toHaveBeenCalled();
  });

  it('carries its key when a card is dragged', () => {
    setup();
    const transfer = { setData: vi.fn(), effectAllowed: '' };

    fireEvent.dragStart(cardOf(SCAR.text), { dataTransfer: transfer });

    expect(transfer.setData).toHaveBeenCalledExactlyOnceWith('text/plain', 'sug-scar');
    expect(transfer.effectAllowed).toBe('copy');
  });
});
