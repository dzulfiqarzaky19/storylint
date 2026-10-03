import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ResearchThreadRow } from '@/domain/types';
import Threads from './Threads';

const thread = (id: string, title: string, subtitle = ''): ResearchThreadRow => ({
  id,
  title,
  subtitle,
  sortOrder: 0,
  scope: 'chat',
  worldId: 'world-verge',
});

const LAMPS = thread('thread-lamps', 'Lighting the Verge', 'tallow or oil');
const KEEPERS = thread('thread-keepers', 'Keepers');

interface SetupOptions {
  threads?: ResearchThreadRow[];
  readOnly?: boolean;
}

const setup = ({ threads = [LAMPS, KEEPERS], readOnly = false }: SetupOptions = {}) => {
  const onSelect = vi.fn();
  const handlers = { onCreate: vi.fn(), onDelete: vi.fn(), onRename: vi.fn() };
  render(
    <Threads
      threads={threads}
      selectedId="thread-keepers"
      onSelect={onSelect}
      {...(readOnly ? {} : handlers)}
    />,
  );
  return { onSelect, ...handlers };
};

const startRename = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Rename thread "Lighting the Verge"' }));
  return screen.getByRole('textbox', { name: 'thread name' });
};

describe('Threads', () => {
  it('lists the threads in a counted rail', () => {
    setup();

    const rail = screen.getByRole('navigation', { name: 'Research threads' });
    expect(rail.textContent).toContain('Threads· 2');
    expect(within(rail).getByTitle('Lighting the Verge').textContent).toBe(
      'Lighting the Vergetallow or oil',
    );
    expect(within(rail).getByTitle('Keepers').textContent).toBe('Keepers');
  });

  it('marks the selected thread', () => {
    setup();

    expect(screen.getByTitle('Keepers').getAttribute('aria-current')).toBe('true');
    expect(screen.getByTitle('Lighting the Verge').getAttribute('aria-current')).toBeNull();
  });

  it('selects the thread that is clicked', async () => {
    const { onSelect } = setup();

    await userEvent.click(screen.getByTitle('Lighting the Verge'));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('thread-lamps');
  });

  it('starts a new thread', async () => {
    const { onCreate } = setup();

    await userEvent.click(screen.getByRole('button', { name: '+ New thread' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('offers no way to create, rename or delete without handlers', () => {
    setup({ readOnly: true });

    expect(screen.queryByRole('button', { name: '+ New thread' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Rename thread/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete thread/ })).toBeNull();
  });

  describe('renaming', () => {
    it('starts from the current title', async () => {
      setup();

      expect(await startRename()).toHaveProperty('value', 'Lighting the Verge');
    });

    it('also starts from a double click on the row', async () => {
      setup();

      await userEvent.dblClick(screen.getByTitle('Lighting the Verge'));

      expect(screen.getByRole('textbox', { name: 'thread name' })).toBeDefined();
    });

    it('commits the trimmed title on Enter and shows it straight away', async () => {
      const { onRename } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, '  Lamps {Enter}');

      expect(onRename).toHaveBeenCalledExactlyOnceWith('thread-lamps', 'Lamps');
      expect(screen.getByTitle('Lamps')).toBeDefined();
      expect(screen.queryByTitle('Lighting the Verge')).toBeNull();
    });

    it('keeps the old title when the new one is blank', async () => {
      const { onRename } = setup();
      const input = await startRename();

      await userEvent.clear(input);
      await userEvent.type(input, '  {Enter}');

      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByTitle('Lighting the Verge')).toBeDefined();
    });

    it.each([
      ['Escape', () => userEvent.keyboard('{Escape}')],
      ['losing focus', () => userEvent.tab()],
    ])('abandons the edit on %s', async (_name, leave) => {
      const { onRename } = setup();
      const input = await startRename();
      await userEvent.clear(input);
      await userEvent.type(input, 'Lamps');

      await leave();

      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByTitle('Lighting the Verge')).toBeDefined();
    });
  });

  describe('deleting', () => {
    const openConfirm = async () => {
      await userEvent.click(
        screen.getByRole('button', { name: 'Delete thread "Lighting the Verge"' }),
      );
      return within(screen.getByRole('dialog', { name: 'Delete "Lighting the Verge"?' }));
    };

    it('deletes the thread once confirmed', async () => {
      const { onDelete } = setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));

      expect(onDelete).toHaveBeenCalledExactlyOnceWith('thread-lamps');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the thread when cancelled', async () => {
      const { onDelete } = setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('never offers to delete the last thread', () => {
      setup({ threads: [LAMPS] });

      expect(screen.queryByRole('button', { name: /^Delete thread/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Rename thread "Lighting the Verge"' })).toBeDefined();
    });
  });
});
