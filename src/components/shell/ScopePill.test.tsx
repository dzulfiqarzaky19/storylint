import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { WorldUniverseNode } from '@/domain/structure';
import { universe, world } from '@/domain/testing/structure';
import ScopePill from './ScopePill';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  search: '',
  editWorldStructure: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  editWorldStructure: mocks.editWorldStructure,
}));

const TREE: WorldUniverseNode[] = [
  universe('uni-ash', 'Ashfall', [world('world-verge', 'Verge'), world('world-hollow', 'Hollow')]),
  universe('uni-tide', 'Tidewater', [world('world-reach', 'Reach')]),
];

const setup = (options: { tree?: WorldUniverseNode[]; search?: string; basePath?: string } = {}) => {
  mocks.search = options.search ?? 'u=uni-ash&w=world-hollow';
  render(<ScopePill tree={options.tree ?? TREE} basePath={options.basePath} />);
  return { pill: screen.getByRole('button', { expanded: false }) };
};

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { expanded: false }));
  return within(screen.getByRole('menu', { name: 'Switch universe or world' }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ScopePill', () => {
  describe('the pill', () => {
    it('names the universe and world the URL points at', () => {
      const { pill } = setup();

      expect(pill.textContent).toBe('AshfallHollow▾');
    });

    it('falls back to the first world when the URL is stale', () => {
      const { pill } = setup({ search: 'u=uni-gone&w=world-gone' });

      expect(pill.textContent).toBe('AshfallVerge▾');
    });

    it('says so when there are no worlds at all', () => {
      const { pill } = setup({ tree: [] });

      expect(pill.textContent).toBe('STORYLINTNo worlds▾');
    });
  });

  describe('the menu', () => {
    it('stays closed until the pill is clicked', () => {
      setup();

      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('lists every world under its universe, ticking the active one', async () => {
      setup();
      const menu = await openMenu();

      expect(
        menu
          .getAllByRole('menuitemradio')
          .map((item) => [item.textContent, item.getAttribute('aria-checked')]),
      ).toEqual([
        ['Verge', 'false'],
        ['✓Hollow', 'true'],
        ['Reach', 'false'],
      ]);
      expect(menu.getByText('Ashfall')).toBeDefined();
      expect(menu.getByText('Tidewater')).toBeDefined();
    });

    it('switches to the world that is clicked, then closes', async () => {
      setup();
      const menu = await openMenu();

      await userEvent.click(menu.getByRole('menuitemradio', { name: 'Reach' }));

      expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/wiki?u=uni-tide&w=world-reach');
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('stays on the surface it was given', async () => {
      setup({ basePath: '/research' });
      const menu = await openMenu();

      await userEvent.click(menu.getByRole('menuitemradio', { name: 'Verge' }));

      expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/research?u=uni-ash&w=world-verge');
    });

    it('links to the manage page', async () => {
      setup();
      const menu = await openMenu();

      expect(
        menu.getByRole('menuitem', { name: 'Manage universes & worlds…' }).getAttribute('href'),
      ).toBe('/wiki/manage');
    });

    it.each([
      ['Escape', () => userEvent.keyboard('{Escape}')],
      ['a press outside it', async () => void fireEvent.pointerDown(document.body)],
    ])('closes on %s', async (_name, dismiss) => {
      setup();
      await openMenu();

      await dismiss();

      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    });
  });

  describe('creating a world', () => {
    const nameWorld = async (name: string) => {
      const menu = await openMenu();
      await userEvent.click(menu.getByRole('menuitem', { name: '+ New world' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Name the new world' }), name);
    };

    it('creates it in the active universe and moves there', async () => {
      mocks.editWorldStructure.mockResolvedValue({ ok: true, data: { worldId: 'world-marsh' } });
      setup();

      await nameWorld('Marsh{Enter}');

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'create',
        level: 'world',
        name: 'Marsh',
        universeId: 'uni-ash',
      });
      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/wiki?u=uni-ash&w=world-marsh'),
      );
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows why it failed, and stays put', async () => {
      mocks.editWorldStructure.mockResolvedValue({ ok: false, error: 'That name is taken.' });
      setup();

      await nameWorld('Verge{Enter}');

      expect((await screen.findByRole('alert')).textContent).toBe('That name is taken.');
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('does nothing when the prompt is cancelled', async () => {
      setup();

      await nameWorld('Marsh');
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mocks.editWorldStructure).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('creating a universe', () => {
    it('creates it and refreshes in place', async () => {
      mocks.editWorldStructure.mockResolvedValue({ ok: true, data: { universeId: 'uni-new' } });
      setup();
      const menu = await openMenu();

      await userEvent.click(menu.getByRole('menuitem', { name: '+ New universe' }));
      await userEvent.type(
        screen.getByRole('textbox', { name: 'Name the new universe' }),
        'Emberlight{Enter}',
      );

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'create',
        level: 'universe',
        name: 'Emberlight',
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(mocks.push).not.toHaveBeenCalled();
    });
  });
});
