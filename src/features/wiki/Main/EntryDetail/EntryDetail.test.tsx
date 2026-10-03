import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import { DragProvider } from '@/features/wiki/dnd/DragContext';
import EntryDetail from './EntryDetail';

// ShareControls, rendered inside the profile, reaches for the router and two actions.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  shareEntityToWorld: vi.fn(),
  unshareEntityFromWorld: vi.fn(),
}));

// Tied to Tobias, who is live, and to Ilsa, who was deleted.
const MAREN = snapshotEntry('maren', 'Maren', {
  facts: { Eyes: 'grey', Carries: 'a brass ring' },
  ties: ['tobias', 'ilsa'],
});

const setup = () => {
  const handlers = {
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onDropOnTies: vi.fn(),
    onUntie: vi.fn(),
    onTieExisting: vi.fn(),
    onCreateTied: vi.fn(),
    onDropSuggestion: vi.fn(),
    onEditEntryField: vi.fn(),
    onEditFactField: vi.fn(),
    onAddFact: vi.fn(),
    onDeleteFact: vi.fn(),
  };
  render(
    <DragProvider>
      <EntryDetail
        entry={MAREN}
        liveEntryIds={new Set(['maren', 'tobias'])}
        sharing={{
          worlds: [{ id: 'world-verge', title: 'Verge' }],
          activeWorldId: 'world-verge',
          onError: vi.fn(),
        }}
        tieCandidates={[{ id: 'tobias', name: 'tobias', kind: 'character' }]}
        {...handlers}
      />
    </DragProvider>,
  );
  return { ...handlers, band: within(screen.getByRole('region', { name: 'Entry' })) };
};

describe('EntryDetail', () => {
  it('heads the entry with its profile', () => {
    const { band } = setup();

    expect(band.getByRole('heading', { level: 1 }).textContent).toBe('Maren');
  });

  it('counts the details, and only the ties that still lead somewhere', () => {
    const { band } = setup();

    expect(band.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Details2', 'Ties1']);
  });

  it('opens on the details', async () => {
    const { band, onDeleteFact } = setup();

    await userEvent.click(band.getByRole('button', { name: 'Delete Eyes' }));

    expect(band.getByRole('tab', { name: /Details/ }).getAttribute('aria-selected')).toBe('true');
    expect(onDeleteFact).toHaveBeenCalledExactlyOnceWith('maren', 'maren.Eyes');
  });

  it('switches to the ties', async () => {
    const { band, onSelect } = setup();

    await userEvent.click(band.getByRole('tab', { name: /Ties/ }));
    expect(band.queryByRole('button', { name: 'Delete Eyes' })).toBeNull();
    expect(band.getByRole('note').textContent).toContain('ilsa');

    await userEvent.click(band.getByRole('button', { name: /^tobias/ }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('tobias');
  });

  it('passes entry edits and deletion up from the profile', async () => {
    const { band, onEditEntryField, onDelete } = setup();

    await userEvent.click(band.getByTitle('Edit entry name'));
    await userEvent.type(band.getByRole('textbox', { name: 'entry name' }), ' Vale{Enter}');
    await userEvent.click(band.getByRole('button', { name: 'Delete Maren' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete Maren?' })).getByRole('button', {
        name: 'Delete',
      }),
    );

    expect(onEditEntryField).toHaveBeenCalledExactlyOnceWith('maren', 'name', 'Maren Vale');
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('maren');
  });
});
