import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { WorldUniverseNode } from '@/domain/structure';
import { universe, world } from '@/domain/testing/structure';
import WikiManage from './WikiManage';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  editWorldStructure: vi.fn(),
  previewStructureDelete: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  editWorldStructure: mocks.editWorldStructure,
  previewStructureDelete: mocks.previewStructureDelete,
}));

const TREE: WorldUniverseNode[] = [
  universe('uni-ash', 'Ashfall', [world('world-verge', 'Verge'), world('world-hollow', 'Hollow')]),
  universe('uni-tide', 'Tidewater', [world('world-reach', 'Reach')]),
];

const setup = () => render(<WikiManage tree={TREE} />);

// The head of a universe card: its name and its own Rename and Delete.
const universeHead = (name: string) =>
  within(screen.getByRole('heading', { level: 2, name }).parentElement!);
const universeCard = (name: string) =>
  within(screen.getByRole('heading', { level: 2, name }).closest('li')!);
const worldRow = (title: string) => within(screen.getByText(title).closest('li')!);

const answerPrompt = async (title: string, name: string) => {
  const input = screen.getByRole('textbox', { name: title });
  await userEvent.clear(input);
  await userEvent.type(input, `${name}{Enter}`);
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.editWorldStructure.mockResolvedValue({ ok: true, data: {} });
  mocks.previewStructureDelete.mockResolvedValue({ ok: true, data: { total: 12 } });
});

describe('WikiManage', () => {
  it('lists every universe with its worlds', () => {
    setup();

    expect(screen.getByRole('main', { name: 'Manage universes & worlds' })).toBeDefined();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Ashfall', 'Tidewater']);
    expect(universeCard('Ashfall').getByText('Verge')).toBeDefined();
    expect(universeCard('Ashfall').getByText('Hollow')).toBeDefined();
    expect(universeCard('Tidewater').getByText('Reach')).toBeDefined();
  });

  it('links back to the gazetteer', () => {
    setup();

    expect(screen.getByRole('link', { name: /Back to the gazetteer/ }).getAttribute('href')).toBe(
      '/wiki',
    );
  });

  describe('creating', () => {
    it('creates a universe, then refreshes', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: '+ New universe' }));
      await answerPrompt('Name the new universe', ' Emberlight ');

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'create',
        level: 'universe',
        name: 'Emberlight',
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('creates a world in the universe whose button was clicked', async () => {
      setup();

      await userEvent.click(universeCard('Tidewater').getByRole('button', { name: '+ New world' }));
      await answerPrompt('Name the new world', 'Marsh');

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'create',
        level: 'world',
        name: 'Marsh',
        universeId: 'uni-tide',
      });
    });

    it('cannot submit a blank name', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: '+ New universe' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Name the new universe' }), '  {Enter}');

      expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', true);
      expect(mocks.editWorldStructure).not.toHaveBeenCalled();
    });

    it('does nothing when the prompt is cancelled', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: '+ New universe' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mocks.editWorldStructure).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('renaming', () => {
    it('renames a universe, starting from its current name', async () => {
      setup();

      await userEvent.click(universeHead('Ashfall').getByRole('button', { name: 'Rename' }));
      expect(screen.getByRole('textbox', { name: 'Rename universe' })).toHaveProperty(
        'value',
        'Ashfall',
      );
      await answerPrompt('Rename universe', 'Cinderfall');

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'rename',
        level: 'universe',
        id: 'uni-ash',
        name: 'Cinderfall',
      });
    });

    it('renames a world, starting from its current title', async () => {
      setup();

      await userEvent.click(worldRow('Hollow').getByRole('button', { name: 'Rename' }));
      expect(screen.getByRole('textbox', { name: 'Rename world' })).toHaveProperty('value', 'Hollow');
      await answerPrompt('Rename world', 'Hollows');

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'rename',
        level: 'world',
        id: 'world-hollow',
        name: 'Hollows',
      });
    });

    it('shows why a rename was refused, without refreshing', async () => {
      mocks.editWorldStructure.mockResolvedValue({ ok: false, error: 'That name is taken.' });
      setup();

      await userEvent.click(worldRow('Hollow').getByRole('button', { name: 'Rename' }));
      await answerPrompt('Rename world', 'Verge');

      expect((await screen.findByRole('alert')).textContent).toBe('That name is taken.');
      expect(mocks.refresh).not.toHaveBeenCalled();
    });
  });

  describe('deleting', () => {
    it('locks the delete, with a reason, for the last world of a universe', () => {
      setup();

      const lastWorld = worldRow('Reach').getByRole('button', { name: 'Delete' });
      expect(lastWorld).toHaveProperty('disabled', true);
      expect(lastWorld.getAttribute('title')).toBeTruthy();
      expect(worldRow('Verge').getByRole('button', { name: 'Delete' })).toHaveProperty(
        'disabled',
        false,
      );
    });

    it('counts what a world delete removes, and says shared entities survive', async () => {
      setup();

      await userEvent.click(worldRow('Verge').getByRole('button', { name: 'Delete' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Delete Verge?' }));

      expect(mocks.previewStructureDelete).toHaveBeenCalledExactlyOnceWith({
        level: 'world',
        id: 'world-verge',
      });
      expect(await dialog.findByText(/removes 12 rows \(this world and its links\)/)).toBeDefined();
    });

    it('counts what a universe delete removes, in the singular for one row', async () => {
      mocks.previewStructureDelete.mockResolvedValue({ ok: true, data: { total: 1 } });
      setup();

      await userEvent.click(universeHead('Tidewater').getByRole('button', { name: 'Delete' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Delete Tidewater?' }));

      expect(mocks.previewStructureDelete).toHaveBeenCalledExactlyOnceWith({
        level: 'universe',
        id: 'uni-tide',
      });
      expect(
        await dialog.findByText(/removes 1 row \(the universe and everything inside it\)/),
      ).toBeDefined();
    });

    it('deletes once the name is typed, then refreshes', async () => {
      setup();
      await userEvent.click(worldRow('Verge').getByRole('button', { name: 'Delete' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Delete Verge?' }));
      const confirm = await dialog.findByRole('button', { name: 'Delete 12 rows' });
      expect(confirm).toHaveProperty('disabled', true);

      await userEvent.type(dialog.getByRole('textbox', { name: 'Type Verge to confirm' }), 'Verge');
      await userEvent.click(confirm);

      expect(mocks.editWorldStructure).toHaveBeenCalledExactlyOnceWith({
        op: 'delete',
        level: 'world',
        id: 'world-verge',
        confirmed: true,
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps everything when cancelled', async () => {
      setup();
      await userEvent.click(worldRow('Verge').getByRole('button', { name: 'Delete' }));

      await userEvent.click(
        within(screen.getByRole('dialog', { name: 'Delete Verge?' })).getByRole('button', {
          name: 'Cancel',
        }),
      );

      expect(mocks.editWorldStructure).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows why the count failed', async () => {
      mocks.previewStructureDelete.mockResolvedValue({ ok: false, error: 'Database is down.' });
      setup();

      await userEvent.click(worldRow('Verge').getByRole('button', { name: 'Delete' }));

      expect((await screen.findByRole('alert')).textContent).toBe('Database is down.');
    });
  });
});
