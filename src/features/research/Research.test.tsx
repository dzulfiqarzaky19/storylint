import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {
  ResearchProposition,
  ResearchSnapshot,
  ResearchThreadRow,
  ResearchTurnWithCards,
  WorldKeptCardRow,
} from '@/domain/types';
import { STREAM_INCOMPLETE_MESSAGE } from './lib/decideStreamEnd';
import type { StreamHandlers } from './lib/readStream';
import Research from './Research';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  createThread: vi.fn(),
  deleteThread: vi.fn(),
  renameThread: vi.fn(),
  keepCard: vi.fn(),
  proposeCard: vi.fn(),
  cancelPending: vi.fn(),
  writeConfirmedTarget: vi.fn(),
  readResearchStream: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/server/actions/research/threads', () => ({
  createThread: mocks.createThread,
  deleteThread: mocks.deleteThread,
  renameThread: mocks.renameThread,
}));
vi.mock('@/server/actions/research/cards', () => ({
  keepCard: mocks.keepCard,
  proposeCard: mocks.proposeCard,
  cancelPending: mocks.cancelPending,
}));
vi.mock('@/server/actions/wiki/writeConfirmedTarget', () => ({
  writeConfirmedTarget: mocks.writeConfirmedTarget,
}));
// The wire format has its own tests; here the stream is driven by hand.
vi.mock('@/features/research/lib/readStream', () => ({
  readResearchStream: mocks.readResearchStream,
}));

const thread = (id: string, title: string): ResearchThreadRow => ({
  id,
  title,
  subtitle: '',
  sortOrder: 0,
  scope: 'chat',
  worldId: 'world-verge',
});

const card = (id: string, title: string, over: Partial<ResearchProposition> = {}): ResearchProposition => ({
  id,
  turnId: 'turn-2',
  kind: 'custom',
  title,
  body: 'Rendered from mutton fat.',
  asKind: 'lore',
  sortOrder: 0,
  kept: false,
  inWiki: false,
  ...over,
});

const turn = (id: string, over: Partial<ResearchTurnWithCards> = {}): ResearchTurnWithCards => ({
  id,
  threadId: 'thread-lamps',
  ordinal: 0,
  side: 'them',
  who: 'Collaborator',
  text: '',
  cards: [],
  ...over,
});

const LAMPS = thread('thread-lamps', 'Lighting the Verge');
const KEEPERS = thread('thread-keepers', 'Keepers');
const SONGS = thread('thread-songs', 'Songs');

const TALLOW = card('card-tallow', 'Tallow lamps');
const OIL = card('card-oil', 'Lamp oil', { kept: true });

const ASKED = turn('turn-1', { side: 'you', who: 'You', text: 'How are the lamps lit?' });
const ANSWERED = turn('turn-2', { text: 'Tallow, mostly.', cards: [TALLOW, OIL] });
const HIDDEN = turn('turn-3', { text: 'An unrevealed aside.' });

const snapshot = (over: Partial<ResearchSnapshot> = {}): ResearchSnapshot => ({
  question: 'How are the lamps lit?',
  threadId: 'thread-lamps',
  turns: [ASKED, ANSWERED, HIDDEN],
  initialVisibleTurnIds: ['turn-1', 'turn-2'],
  threads: [LAMPS, KEEPERS, SONGS],
  ...over,
});

const setup = (props: Partial<Parameters<typeof Research>[0]> = {}) =>
  render(
    <Research
      snapshot={snapshot()}
      categories={[{ id: 'lore', label: 'Lore' }]}
      activeWorldId="world-verge"
      activeWorldName="Verge"
      {...props}
    />,
  );

const board = () => screen.getByRole('complementary', { name: 'Kept' });
// A card in the open thread; the kept board repeats its title, outside <main>.
const cardOf = (title: string) => within(screen.getByRole('main')).getByText(title).parentElement!;
const composer = () => screen.getByRole('textbox', { name: 'Ask the research AI' });

beforeEach(() => {
  vi.clearAllMocks();
  for (const action of [
    mocks.deleteThread,
    mocks.renameThread,
    mocks.keepCard,
    mocks.proposeCard,
    mocks.cancelPending,
    mocks.writeConfirmedTarget,
  ]) {
    action.mockResolvedValue({ ok: true, data: undefined });
  }
  mocks.createThread.mockResolvedValue({ ok: true, data: { threadId: 'thread-new' } });
  mocks.fetch.mockResolvedValue({ ok: true, body: { getReader: () => ({}) } });
  mocks.readResearchStream.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Research', () => {
  it('lays out the threads, the open thread and the kept board', () => {
    setup();

    expect(screen.getByRole('navigation', { name: 'Research threads' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('How are the lamps lit?');
    expect(screen.getByText('2 turns · Verge world')).toBeDefined();
    expect(board()).toBeDefined();
  });

  it('shows only the turns that are visible', () => {
    setup();

    expect(screen.getByText('Tallow, mostly.')).toBeDefined();
    expect(screen.queryByText('An unrevealed aside.')).toBeNull();
  });

  describe('the kept board', () => {
    it('starts with the cards this thread already kept', () => {
      setup();

      expect(within(board()).getByRole('button', { name: /Lamp oil/ }).textContent).toContain(
        'from Lighting the Verge',
      );
      expect(within(board()).queryByRole('button', { name: /Tallow lamps/ })).toBeNull();
    });

    it('adds the cards kept elsewhere in the world, once each', () => {
      const elsewhere: WorldKeptCardRow[] = [
        { propositionId: 'card-oath', kind: 'ritual', title: 'The oath', body: '', inWiki: false, threadId: 'thread-keepers', threadTitle: 'Keepers' },
        { propositionId: 'card-oil', kind: 'custom', title: 'Lamp oil', body: '', inWiki: false, threadId: 'thread-lamps', threadTitle: 'Lighting the Verge' },
        { propositionId: 'card-bell', kind: 'custom', title: 'The bell', body: '', inWiki: true, threadId: 'thread-keepers', threadTitle: 'Keepers' },
      ];
      setup({ worldKept: elsewhere });

      expect(within(board()).getByRole('button', { name: /The oath/ })).toBeDefined();
      expect(within(board()).getAllByRole('button', { name: /Lamp oil/ })).toHaveLength(1);
      expect(within(board()).queryByRole('button', { name: /The bell/ })).toBeNull();
    });

    it('opens a kept card in its own thread, focused', async () => {
      setup();

      await userEvent.click(within(board()).getByRole('button', { name: /Lamp oil/ }));

      expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
        '/research?thread=thread-lamps&focus=card-oil',
      );
    });
  });

  describe('keeping a card', () => {
    it('keeps it at once and saves the choice', async () => {
      setup();

      await userEvent.click(within(cardOf('Tallow lamps')).getByRole('button', { name: 'Keep' }));

      expect(within(board()).getByRole('button', { name: /Tallow lamps/ })).toBeDefined();
      expect(mocks.keepCard).toHaveBeenCalledExactlyOnceWith('card-tallow', true);
    });

    it('lets a kept card go again', async () => {
      setup();

      await userEvent.click(within(cardOf('Lamp oil')).getByRole('button', { name: 'Kept' }));

      expect(within(board()).queryByRole('button', { name: /Lamp oil/ })).toBeNull();
      expect(mocks.keepCard).toHaveBeenCalledExactlyOnceWith('card-oil', false);
    });

    it('shows why saving the choice failed', async () => {
      mocks.keepCard.mockResolvedValue({ ok: false, error: 'Could not keep that.' });
      setup();

      await userEvent.click(within(cardOf('Tallow lamps')).getByRole('button', { name: 'Keep' }));

      expect((await screen.findByRole('alert')).textContent).toContain('Could not keep that.');
    });

    it('keeps a card dropped on the board', () => {
      setup();
      const dragged = cardOf('Tallow lamps');
      fireEvent.dragStart(dragged);

      // fireEvent returns false once a handler calls preventDefault, which is
      // how the board says it accepts the drag.
      expect(fireEvent.dragOver(board())).toBe(false);
      fireEvent.drop(board());

      expect(mocks.keepCard).toHaveBeenCalledExactlyOnceWith('card-tallow', true);
    });

    it('ignores a drop of a card that is already kept', () => {
      setup();
      fireEvent.dragStart(cardOf('Lamp oil'));

      fireEvent.drop(board());

      expect(mocks.keepCard).not.toHaveBeenCalled();
    });

    it('does not accept a drag that is not one of its cards', () => {
      setup();

      expect(fireEvent.dragOver(board())).toBe(true);
    });
  });

  describe('making a card an entry', () => {
    const propose = async () => {
      await userEvent.click(
        within(cardOf('Tallow lamps')).getByRole('button', { name: 'Make it an entry' }),
      );
      return within(screen.getByRole('dialog', { name: 'Add to the wiki' }));
    };

    it('opens the picker seeded from the card', async () => {
      setup();

      const picker = await propose();

      expect(mocks.proposeCard).toHaveBeenCalledExactlyOnceWith('card-tallow');
      expect(picker.getByRole('textbox', { name: 'New entry name' })).toHaveProperty(
        'value',
        'Tallow lamps',
      );
      expect(picker.getByRole('textbox', { name: 'Detail value' })).toHaveProperty(
        'value',
        'Rendered from mutton fat.',
      );
    });

    it('targets the entry the card was written for', async () => {
      setup({
        snapshot: snapshot({
          turns: [ASKED, turn('turn-2', { cards: [card('card-tallow', 'Tallow lamps', { forEntry: 'maren' })] })],
        }),
        entries: [{ id: 'maren', name: 'Maren', kind: 'character', deletedAt: null }],
      });
      const picker = await propose();

      await userEvent.click(picker.getByRole('button', { name: 'Add detail' }));

      expect(mocks.writeConfirmedTarget.mock.calls[0]?.[0]).toMatchObject({
        result: { entryId: 'maren' },
      });
    });

    it('writes the confirmed target into the active world', async () => {
      setup();
      const picker = await propose();

      await userEvent.click(picker.getByRole('button', { name: 'Create entry' }));

      expect(mocks.writeConfirmedTarget).toHaveBeenCalledExactlyOnceWith({
        result: expect.objectContaining({ categoryId: 'lore', entryName: 'Tallow lamps' }),
        origin: { from: 'card', propositionId: 'card-tallow' },
        worldId: 'world-verge',
        confirmed: true,
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(within(cardOf('Tallow lamps')).getByText('In the wiki')).toBeDefined();
      expect(within(board()).queryByRole('button', { name: /Tallow lamps/ })).toBeNull();
    });

    it('closes the picker and clears the proposal on cancel', async () => {
      setup();
      const picker = await propose();

      await userEvent.click(picker.getByRole('button', { name: 'Cancel' }));

      expect(mocks.cancelPending).toHaveBeenCalledTimes(1);
      expect(mocks.writeConfirmedTarget).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('the threads', () => {
    it('opens another thread', async () => {
      setup();

      await userEvent.click(screen.getByTitle('Keepers'));

      expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/research?thread=thread-keepers');
    });

    it('stays put when the open thread is clicked', async () => {
      setup();

      await userEvent.click(screen.getByTitle('Lighting the Verge'));

      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('creates a thread in the active world and opens it', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: '+ New thread' }));

      expect(mocks.createThread).toHaveBeenCalledExactlyOnceWith({ worldId: 'world-verge' });
      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/research?thread=thread-new'),
      );
    });

    it('shows why a thread could not be created', async () => {
      mocks.createThread.mockResolvedValue({ ok: false, error: 'Too many threads.' });
      setup();

      await userEvent.click(screen.getByRole('button', { name: '+ New thread' }));

      expect((await screen.findByRole('alert')).textContent).toContain('Too many threads.');
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('renames a thread, then refreshes', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'Rename thread "Keepers"' }));
      const input = screen.getByRole('textbox', { name: 'thread name' });
      await userEvent.clear(input);
      await userEvent.type(input, 'Wardens{Enter}');

      expect(mocks.renameThread).toHaveBeenCalledExactlyOnceWith({
        threadId: 'thread-keepers',
        title: 'Wardens',
      });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    });

    const deleteThread = async (title: string) => {
      await userEvent.click(screen.getByRole('button', { name: `Delete thread "${title}"` }));
      await userEvent.click(
        within(screen.getByRole('dialog', { name: `Delete "${title}"?` })).getByRole('button', {
          name: 'Delete',
        }),
      );
    };

    it('refreshes in place after deleting another thread', async () => {
      setup();

      await deleteThread('Keepers');

      expect(mocks.deleteThread).toHaveBeenCalledExactlyOnceWith({ threadId: 'thread-keepers' });
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it('moves to the next thread after deleting the open one', async () => {
      setup();

      await deleteThread('Lighting the Verge');

      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/research?thread=thread-keepers'),
      );
    });

    it('moves to the previous thread after deleting the open one at the end', async () => {
      setup({ snapshot: snapshot({ threadId: 'thread-songs' }) });

      await deleteThread('Songs');

      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/research?thread=thread-keepers'),
      );
    });

    it('shows why a thread could not be deleted', async () => {
      mocks.deleteThread.mockResolvedValue({ ok: false, error: 'Thread is locked.' });
      setup();

      await deleteThread('Keepers');

      expect((await screen.findByRole('alert')).textContent).toContain('Thread is locked.');
      expect(mocks.refresh).not.toHaveBeenCalled();
    });
  });

  describe('asking a question', () => {
    const REPLY_YOU = turn('turn-9', { side: 'you', who: 'You', text: 'Why tallow?' });
    const REPLY_THEM = turn('turn-10', { text: 'It is cheap.' });

    it('posts the question for the open thread and clears the draft', async () => {
      mocks.readResearchStream.mockImplementation(async (_reader: unknown, handlers: StreamHandlers) => {
        handlers.onDone([REPLY_YOU, REPLY_THEM]);
      });
      setup();

      await userEvent.type(composer(), 'Why tallow?{Enter}');

      await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
      const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/research/stream');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        question: 'Why tallow?',
        threadId: 'thread-lamps',
        threadTitle: 'Lighting the Verge',
      });
      expect(composer()).toHaveProperty('value', '');
    });

    it('trims the draft, and ignores a blank one', async () => {
      setup();

      await userEvent.type(composer(), '   {Enter}');
      expect(mocks.fetch).not.toHaveBeenCalled();

      await userEvent.type(composer(), '  Why tallow?  {Enter}');
      await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
      expect(JSON.parse((mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string)).toMatchObject({
        question: 'Why tallow?',
      });
    });

    it('asks the label of a prompt chip', async () => {
      setup();

      await userEvent.click(screen.getByRole('button', { name: 'Give me a scene' }));

      await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
      expect(JSON.parse((mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string)).toMatchObject({
        question: 'Give me a scene',
      });
    });

    it('shows the question and the answer as it streams in', async () => {
      let stream!: StreamHandlers;
      let finish!: () => void;
      mocks.readResearchStream.mockImplementation((_reader: unknown, handlers: StreamHandlers) => {
        stream = handlers;
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      });
      setup();

      await userEvent.type(composer(), 'Why tallow?{Enter}');
      await waitFor(() => expect(stream).toBeDefined());
      expect(screen.getByText('Why tallow?')).toBeDefined();
      expect(screen.getByRole('status', { name: 'Thinking' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Thinking…' })).toHaveProperty('disabled', true);

      act(() => {
        stream.onDelta('It is ');
        stream.onDelta('cheap.');
      });
      expect(screen.getByText('It is cheap.')).toBeDefined();

      act(() => {
        stream.onDone([REPLY_YOU, REPLY_THEM]);
        finish();
      });

      await waitFor(() => expect(composer()).toHaveProperty('disabled', false));
      expect(screen.getByText('It is cheap.')).toBeDefined();
      expect(screen.getByText('4 turns · Verge world')).toBeDefined();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('takes the question back when the stream fails to start', async () => {
      mocks.fetch.mockResolvedValue({
        ok: false,
        body: null,
        json: async () => ({ error: 'No model is configured.' }),
      });
      setup();

      await userEvent.type(composer(), 'Why tallow?{Enter}');

      expect((await screen.findByRole('alert')).textContent).toContain('No model is configured.');
      expect(screen.queryByText('Why tallow?')).toBeNull();
      expect(screen.getByText('2 turns · Verge world')).toBeDefined();
    });

    it('restores the draft when the stream ends without an answer', async () => {
      setup();

      await userEvent.type(composer(), 'Why tallow?{Enter}');

      expect((await screen.findByRole('alert')).textContent).toContain(STREAM_INCOMPLETE_MESSAGE);
      expect(composer()).toHaveProperty('value', 'Why tallow?');
      expect(screen.getByText('2 turns · Verge world')).toBeDefined();
    });

    it('shows a stream error without restoring the draft', async () => {
      mocks.readResearchStream.mockImplementation(async (_reader: unknown, handlers: StreamHandlers) => {
        handlers.onError('The model stopped early.');
      });
      setup();

      await userEvent.type(composer(), 'Why tallow?{Enter}');

      expect((await screen.findByRole('alert')).textContent).toContain('The model stopped early.');
      expect(composer()).toHaveProperty('value', '');
    });

    it('starts a thread first when there is none, then opens it', async () => {
      mocks.readResearchStream.mockImplementation(async (_reader: unknown, handlers: StreamHandlers) => {
        handlers.onDone([REPLY_YOU, REPLY_THEM]);
      });
      setup({ snapshot: snapshot({ threadId: '', threads: [], turns: [], initialVisibleTurnIds: [] }) });

      await userEvent.type(composer(), 'Why tallow?{Enter}');

      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/research?thread=thread-new'),
      );
      expect(mocks.createThread).toHaveBeenCalledExactlyOnceWith({ worldId: 'world-verge' });
      expect(JSON.parse((mocks.fetch.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({
        question: 'Why tallow?',
        threadId: 'thread-new',
      });
    });
  });
});
