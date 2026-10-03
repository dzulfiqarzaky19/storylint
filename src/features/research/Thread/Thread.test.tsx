import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ResolvedTarget } from '@/domain/check';
import type { ResearchProposition, ResearchTurnWithCards } from '@/domain/types';
import Thread, { type ThreadProps } from './Thread';

const card = (id: string, title: string): ResearchProposition => ({
  id,
  turnId: 'turn-2',
  kind: 'custom',
  title,
  body: 'Rendered from mutton fat.',
  asKind: 'lore',
  sortOrder: 0,
  kept: false,
  inWiki: false,
});

const LAMPS = card('card-lamps', 'Tallow lamps');
const OIL = card('card-oil', 'Lamp oil');

const ASKED: ResearchTurnWithCards = {
  id: 'turn-1',
  threadId: 'thread-1',
  ordinal: 0,
  side: 'you',
  who: 'You',
  text: 'How are the lamps lit?',
  cards: [],
};
const ANSWERED: ResearchTurnWithCards = {
  id: 'turn-2',
  threadId: 'thread-1',
  ordinal: 1,
  side: 'them',
  who: 'Collaborator',
  text: 'Tallow, mostly.',
  cards: [LAMPS, OIL],
};

const TARGET: ResolvedTarget = {
  category: { id: 'lore' },
  entry: { proposeName: 'Tallow lamps' },
  fact: { key: 'Made from', value: 'mutton fat' },
};

const setup = (over: Partial<ThreadProps> = {}) => {
  const handlers = {
    onKeep: vi.fn(),
    onPropose: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onDismissError: vi.fn(),
    onDraftChange: vi.fn(),
    onAsk: vi.fn(),
    onChip: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
  };
  render(
    <Thread
      question="How are the lamps lit?"
      worldName="Verge"
      visibleTurns={[ASKED, ANSWERED]}
      keptSet={new Set()}
      inWikiSet={new Set()}
      pendingCard={undefined}
      resolvedTarget={null}
      categories={[{ id: 'lore', label: 'Lore' }]}
      entries={[]}
      error={null}
      draft=""
      asking={false}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
};

const cardOf = (title: string) => within(screen.getByText(title).parentElement!);

describe('Thread', () => {
  describe('before anything is asked', () => {
    it('explains what to do instead of showing a question', () => {
      setup({ visibleTurns: [] });

      expect(screen.getByText(/Ask me anything about your story\./)).toBeDefined();
      expect(screen.queryByRole('heading')).toBeNull();
    });
  });

  it('heads the conversation with the question, its length and its world', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('How are the lamps lit?');
    expect(screen.getByText('2 turns · Verge world')).toBeDefined();
  });

  it('shows every visible turn', () => {
    setup();

    expect(screen.getByText('Tallow, mostly.')).toBeDefined();
    expect(screen.getByText('You')).toBeDefined();
  });

  describe('the cards on a turn', () => {
    it('reflect what is kept and what is already in the wiki', () => {
      setup({ keptSet: new Set(['card-lamps']), inWikiSet: new Set(['card-oil']) });

      expect(
        cardOf('Tallow lamps').getByRole('button', { name: 'Kept' }).getAttribute('aria-pressed'),
      ).toBe('true');
      expect(cardOf('Lamp oil').getByText('In the wiki')).toBeDefined();
      expect(cardOf('Lamp oil').getByRole('button', { name: 'Keep' })).toHaveProperty(
        'disabled',
        true,
      );
    });

    it('marks the card that is in focus', () => {
      setup({ focusPropositionId: 'card-oil' });

      expect(screen.getByText('Lamp oil').parentElement?.dataset.cardFocused).toBe('true');
      expect(screen.getByText('Tallow lamps').parentElement?.dataset.cardFocused).toBeUndefined();
    });

    it('keeps the card whose button is clicked', async () => {
      const { onKeep } = setup();

      await userEvent.click(cardOf('Lamp oil').getByRole('button', { name: 'Keep' }));

      expect(onKeep).toHaveBeenCalledExactlyOnceWith('card-oil', true);
    });

    it('proposes the card as an entry', async () => {
      const { onPropose } = setup();

      await userEvent.click(cardOf('Tallow lamps').getByRole('button', { name: 'Make it an entry' }));

      expect(onPropose).toHaveBeenCalledExactlyOnceWith('card-lamps');
    });

    it('reports a card being dragged', () => {
      const { onDragStart, onDragEnd } = setup();
      const dragged = screen.getByText('Lamp oil').parentElement!;

      fireEvent.dragStart(dragged);
      fireEvent.dragEnd(dragged);

      expect(onDragStart).toHaveBeenCalledExactlyOnceWith('card-oil');
      expect(onDragEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('the wiki picker', () => {
    it('opens for a pending card with a resolved target', () => {
      setup({ pendingCard: LAMPS, resolvedTarget: TARGET });

      expect(screen.getByRole('dialog', { name: 'Add to the wiki' })).toBeDefined();
      expect(screen.getByRole('textbox', { name: 'New entry name' })).toHaveProperty(
        'value',
        'Tallow lamps',
      );
    });

    it.each<[string, Partial<ThreadProps>]>([
      ['a target is resolved', { pendingCard: LAMPS }],
      ['a card is pending', { resolvedTarget: TARGET }],
    ])('stays closed until %s', (_name, over) => {
      setup(over);

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('hands its result and its cancel back to the owner', async () => {
      const { onConfirm, onCancel } = setup({ pendingCard: LAMPS, resolvedTarget: TARGET });

      await userEvent.click(screen.getByRole('button', { name: 'Create entry' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onConfirm).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ categoryId: 'lore', entryName: 'Tallow lamps' }),
      );
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('the error bar', () => {
    it('is absent while nothing has gone wrong', () => {
      setup();

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows the error and can be dismissed', async () => {
      const { onDismissError } = setup({ error: 'The model is unreachable.' });

      expect(screen.getByRole('alert').textContent).toContain('The model is unreachable.');
      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(onDismissError).toHaveBeenCalledTimes(1);
    });
  });

  describe('the composer', () => {
    it('shows the draft and reports edits to it', async () => {
      const { onDraftChange } = setup({ draft: 'Why tallow' });
      const input = screen.getByRole('textbox', { name: 'Ask the research AI' });
      expect(input).toHaveProperty('value', 'Why tallow');

      await userEvent.type(input, '?');

      expect(onDraftChange).toHaveBeenCalledExactlyOnceWith('Why tallow?');
    });

    it('asks from the button', async () => {
      const { onAsk } = setup({ draft: 'Why tallow?' });

      await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

      expect(onAsk).toHaveBeenCalledTimes(1);
    });

    it('locks while an answer is on its way', () => {
      setup({ draft: 'Why tallow?', asking: true });

      expect(screen.getByRole('button', { name: 'Thinking…' })).toHaveProperty('disabled', true);
      expect(screen.getByRole('textbox', { name: 'Ask the research AI' })).toHaveProperty(
        'disabled',
        true,
      );
    });

    it('sends the label of the prompt chip that is clicked', async () => {
      const { onChip } = setup();

      await userEvent.click(screen.getByRole('button', { name: 'Give me a scene' }));

      expect(onChip).toHaveBeenCalledExactlyOnceWith('Give me a scene');
    });
  });
});
