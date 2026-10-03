import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Kept, { type KeptEntry } from './Kept';

const LAMPS: KeptEntry = {
  id: 'card-1',
  kind: 'custom',
  title: 'Tallow lamps',
  threadId: 'thread-1',
  threadTitle: 'Lighting the Verge',
};
const OATH: KeptEntry = {
  id: 'card-2',
  kind: 'ritual',
  title: 'The keeper’s oath',
  threadId: 'thread-2',
  threadTitle: 'Keepers',
};

const setup = (items: KeptEntry[] = [LAMPS, OATH]) => {
  const handlers = {
    onDragOver: vi.fn(),
    onDragLeave: vi.fn(),
    onDrop: vi.fn(),
    onOpenItem: vi.fn(),
  };
  render(<Kept items={items} active={false} {...handlers} />);
  return { ...handlers, board: screen.getByRole('complementary', { name: 'Kept' }) };
};

describe('Kept', () => {
  it('lists each kept card with its kind, title and thread', () => {
    setup();

    expect(screen.getByRole('button', { name: /Tallow lamps/ }).textContent).toBe(
      'customTallow lampsfrom Lighting the VergeOn the board only',
    );
    expect(screen.getByRole('button', { name: /The keeper’s oath/ })).toBeDefined();
  });

  it('explains the board when nothing is kept', () => {
    setup([]);

    expect(screen.getByText(/Nothing kept yet\./)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Kept' })).toBeDefined();
  });

  it('counts the kept cards on the toggle', () => {
    setup();

    expect(screen.getByRole('button', { name: /^Kept\s*2$/ })).toBeDefined();
  });

  it('opens the card that is clicked', async () => {
    const { onOpenItem } = setup();

    await userEvent.click(screen.getByRole('button', { name: /The keeper’s oath/ }));

    expect(onOpenItem).toHaveBeenCalledExactlyOnceWith(OATH);
  });

  describe('the filter tabs', () => {
    it('start on Wiki', () => {
      setup();

      expect(
        screen.getAllByRole('tab').map((tab) => [tab.textContent, tab.getAttribute('aria-selected')]),
      ).toEqual([
        ['Wiki', 'true'],
        ['Plot', 'false'],
        ['Write', 'false'],
      ]);
    });

    it.each(['Plot', 'Write'])('show nothing under %s yet', async (tab) => {
      setup();

      await userEvent.click(screen.getByRole('tab', { name: tab }));

      expect(screen.getByRole('tab', { name: tab }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByText('Nothing here yet.')).toBeDefined();
      expect(screen.queryByRole('button', { name: /Tallow lamps/ })).toBeNull();
    });
  });

  it('expands and collapses from its toggle', async () => {
    setup();
    const toggle = screen.getByRole('button', { name: /^Kept\s*2$/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      document.getElementById(toggle.getAttribute('aria-controls')!)?.textContent,
    ).toContain('Tallow lamps');
  });

  it('hands drag events over the board to its owner', () => {
    const { board, onDragOver, onDragLeave, onDrop } = setup();

    fireEvent.dragOver(board);
    fireEvent.dragLeave(board);
    fireEvent.drop(board);

    expect(onDragOver).toHaveBeenCalledTimes(1);
    expect(onDragLeave).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});
