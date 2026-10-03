import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { snapshotEntry } from '@/domain/testing/snapshot';
import type { EntryRow } from '@/domain/types';
import TrashPanel from './TrashPanel';

const DAY_MS = 24 * 60 * 60 * 1000;
// Midday, so the formatted date keeps its year in every timezone.
const NOW = Date.UTC(2026, 5, 15, 12);

const deleted = (id: string, name: string, daysAgo: number): EntryRow =>
  snapshotEntry(id, name, { deletedAt: NOW - daysAgo * DAY_MS });

const FRESH = deleted('maren', 'Maren', 2);
const LAST_DAY = deleted('the-verge', 'The Verge', 6);
const EXPIRED = deleted('the-oath', 'The Oath', 8);

const setup = (entries: EntryRow[] = [FRESH, LAST_DAY, EXPIRED], busy = false) => {
  const onRestore = vi.fn();
  const onRequestPurge = vi.fn();
  render(
    <TrashPanel
      entries={entries}
      nowMs={NOW}
      busy={busy}
      onRestore={onRestore}
      onRequestPurge={onRequestPurge}
    />,
  );
  return { onRestore, onRequestPurge };
};

const rowOf = (name: string) => screen.getByText(name).closest('li')!;

describe('TrashPanel', () => {
  it('counts the deleted entries', () => {
    setup();

    const panel = screen.getByRole('region', { name: 'Recently deleted' });
    expect(within(panel).getByRole('heading', { name: 'Recently deleted' })).toBeDefined();
    expect(within(panel).getByText('3')).toBeDefined();
  });

  it('shows each entry with its kind and deletion date', () => {
    setup();

    expect(rowOf('Maren').textContent).toMatch(/Person · deleted .*2026/);
  });

  it.each([
    ['Maren', 'Purges in 5 days'],
    ['The Verge', 'Purges in 1 day'],
    ['The Oath', 'Ready to purge'],
  ])('tells how long %s has left: %s', (name, countdown) => {
    setup();

    expect(within(rowOf(name)).getByText(countdown)).toBeDefined();
  });

  it('restores the entry whose button is clicked', async () => {
    const { onRestore } = setup();

    await userEvent.click(within(rowOf('The Verge')).getByRole('button', { name: 'Restore' }));

    expect(onRestore).toHaveBeenCalledExactlyOnceWith('the-verge');
  });

  it('offers to empty the trash of its expired entries', async () => {
    const { onRequestPurge } = setup();
    const purge = screen.getByRole('button', {
      name: 'Empty trash: permanently delete 1 expired entry',
    });
    expect(purge.textContent).toBe('Empty trash (1)');

    await userEvent.click(purge);

    expect(onRequestPurge).toHaveBeenCalledTimes(1);
  });

  it('keeps the purge locked until something has expired', () => {
    setup([FRESH, LAST_DAY]);

    const purge = screen.getByRole('button', {
      name: 'Empty trash: permanently delete 0 expired entries',
    });
    expect(purge).toHaveProperty('disabled', true);
    expect(purge.textContent).toBe('Empty trash');
  });

  it('locks every button while busy', () => {
    setup([FRESH, EXPIRED], true);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveProperty('disabled', true);
    }
  });
});
