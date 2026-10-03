import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import type { EntryWithDetails } from '@/domain/types';
import Profile from './Profile';
import type { ShareWorld } from './ShareControls';

// ShareControls, rendered inside the kicker, reaches for the router and two actions.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  shareEntityToWorld: vi.fn(),
  unshareEntityFromWorld: vi.fn(),
}));

const VERGE: ShareWorld = { id: 'world-verge', title: 'Verge' };
const MAREN = snapshotEntry('maren', 'Maren', { summary: 'Keeper of the lamps.' });

const setup = (entry: EntryWithDetails = MAREN, activeWorldId = VERGE.id) => {
  const onEditEntryField = vi.fn();
  const onDelete = vi.fn();
  const { container } = render(
    <Profile
      entry={entry}
      sharing={{ worlds: [VERGE], activeWorldId, onError: vi.fn() }}
      onEditEntryField={onEditEntryField}
      onDelete={onDelete}
    />,
  );
  return { container, onEditEntryField, onDelete };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Profile', () => {
  it('shows the kind, the catalogue number and the world', () => {
    const { container } = setup();

    expect(container.textContent).toContain('Person');
    expect(screen.getByText('No. MAREN · Verge world')).toBeDefined();
  });

  it('leaves out a catalogue number that is only a dash', () => {
    setup({ ...MAREN, catalogueNo: '—' });

    expect(screen.getByText('Verge world')).toBeDefined();
    expect(screen.queryByText(/No\./)).toBeNull();
  });

  it('leaves out the world when the active one is unknown', () => {
    setup(MAREN, 'world-gone');

    expect(screen.getByText('No. MAREN')).toBeDefined();
  });

  it('shows the name as the heading', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Maren');
  });

  it('commits an edited name', async () => {
    const { onEditEntryField } = setup();

    await userEvent.click(screen.getByTitle('Edit entry name'));
    const input = screen.getByRole('textbox', { name: 'entry name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Maren Vale{Enter}');

    expect(onEditEntryField).toHaveBeenCalledExactlyOnceWith('maren', 'name', 'Maren Vale');
  });

  it('commits an edited summary when focus leaves it', async () => {
    const { onEditEntryField } = setup();

    await userEvent.click(screen.getByTitle('Edit entry summary'));
    const input = screen.getByRole('textbox', { name: 'entry summary' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Lights the Verge.');
    await userEvent.tab();

    expect(onEditEntryField).toHaveBeenCalledExactlyOnceWith(
      'maren',
      'summary',
      'Lights the Verge.',
    );
  });

  it('invites a summary when there is none', () => {
    setup({ ...MAREN, summary: '' });

    expect(screen.getByRole('button', { name: 'Edit entry summary' }).textContent).toBe(
      'Add a summary',
    );
  });

  describe('deleting', () => {
    const openConfirm = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Delete Maren' }));
      return within(screen.getByRole('dialog', { name: 'Delete Maren?' }));
    };

    it('asks before deleting', async () => {
      const { onDelete } = setup();

      const dialog = await openConfirm();

      expect(dialog.getByText(/removes the entry from the gazetteer/)).toBeDefined();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('deletes the entry once confirmed', async () => {
      const { onDelete } = setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));

      expect(onDelete).toHaveBeenCalledExactlyOnceWith('maren');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the entry when cancelled', async () => {
      const { onDelete } = setup();
      const dialog = await openConfirm();

      await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
