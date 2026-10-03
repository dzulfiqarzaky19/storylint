import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ShareControls, { type ShareWorld } from './ShareControls';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  shareEntityToWorld: vi.fn(),
  unshareEntityFromWorld: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  shareEntityToWorld: mocks.shareEntityToWorld,
  unshareEntityFromWorld: mocks.unshareEntityFromWorld,
}));

const VERGE: ShareWorld = { id: 'world-verge', title: 'Verge' };
const HOLLOW: ShareWorld = { id: 'world-hollow', title: 'Hollow' };

const setup = (worlds: ShareWorld[] = [VERGE, HOLLOW]) => {
  const onError = vi.fn();
  render(
    <ShareControls
      entryId="maren"
      entryName="Maren"
      activeWorldId={VERGE.id}
      worlds={worlds}
      onError={onError}
    />,
  );
  return { onError };
};

const picker = () => screen.getByRole('combobox', { name: 'Share Maren to a world' });
const unlink = () => screen.getByRole('button', { name: 'Unlink Maren from Verge' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shareEntityToWorld.mockResolvedValue({ ok: true });
  mocks.unshareEntityFromWorld.mockResolvedValue({ ok: true });
});

describe('ShareControls', () => {
  it('offers every world except the active one', () => {
    setup();

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Share to…', 'Hollow']);
  });

  it('hides the picker when there is no other world to share to', () => {
    setup([VERGE]);

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(unlink()).toBeDefined();
  });

  it('shares the entry to the chosen world, then refreshes', async () => {
    const { onError } = setup();

    await userEvent.selectOptions(picker(), 'Hollow');

    expect(mocks.shareEntityToWorld).toHaveBeenCalledExactlyOnceWith({
      worldId: 'world-hollow',
      entityId: 'maren',
    });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
  });

  it('unlinks the entry from the active world, then refreshes', async () => {
    setup();

    await userEvent.click(unlink());

    expect(mocks.unshareEntityFromWorld).toHaveBeenCalledExactlyOnceWith({
      worldId: 'world-verge',
      entityId: 'maren',
    });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it('reports a refused action without refreshing', async () => {
    mocks.unshareEntityFromWorld.mockResolvedValue({ ok: false, error: 'Last world.' });
    const { onError } = setup();

    await userEvent.click(unlink());

    await waitFor(() => expect(onError).toHaveBeenCalledExactlyOnceWith('Last world.'));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('reports a thrown action under the action name', async () => {
    mocks.shareEntityToWorld.mockRejectedValue(new Error('offline'));
    const { onError } = setup();

    await userEvent.selectOptions(picker(), 'Hollow');

    await waitFor(() =>
      expect(onError).toHaveBeenCalledExactlyOnceWith('shareEntityToWorld: offline'),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('locks both controls while an action is running', async () => {
    let finish: (result: { ok: true }) => void = () => {};
    mocks.unshareEntityFromWorld.mockReturnValue(
      new Promise<{ ok: true }>((resolve) => {
        finish = resolve;
      }),
    );
    setup();

    await userEvent.click(unlink());
    expect(unlink()).toHaveProperty('disabled', true);
    expect(picker()).toHaveProperty('disabled', true);

    finish({ ok: true });
    await waitFor(() => expect(unlink()).toHaveProperty('disabled', false));
  });

  it('falls back to a generic label when the active world is unknown', () => {
    setup([HOLLOW]);

    expect(screen.getByRole('button', { name: 'Unlink Maren from this world' }).textContent).toBe(
      'Unlink from world',
    );
  });
});
