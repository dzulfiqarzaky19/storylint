import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { ResearchProposition, ResearchTurnWithCards } from '@/domain/types';
import Turn from './Turn';

const card = (id: string, title: string): ResearchProposition => ({
  id,
  turnId: 'turn-1',
  kind: 'custom',
  title,
  body: '',
  asKind: 'lore',
  sortOrder: 0,
  kept: false,
  inWiki: false,
});

const turn = (over: Partial<ResearchTurnWithCards> = {}): ResearchTurnWithCards => ({
  id: 'turn-1',
  threadId: 'thread-1',
  ordinal: 0,
  side: 'them',
  who: 'Collaborator',
  text: 'Tallow, mostly.',
  cards: [],
  ...over,
});

const setup = (over: Partial<ResearchTurnWithCards> = {}) =>
  render(<Turn turn={turn(over)} renderCard={(c) => <p key={c.id}>card: {c.title}</p>} />);

describe('Turn', () => {
  it('shows who spoke and what they said', () => {
    setup();

    expect(screen.getByText('Collaborator')).toBeDefined();
    expect(screen.getByText('Tallow, mostly.')).toBeDefined();
  });

  it('relabels the legacy "Research" voice as the collaborator', () => {
    setup({ who: 'Research' });

    expect(screen.getByText('Collaborator')).toBeDefined();
    expect(screen.queryByText('Research')).toBeNull();
  });

  it('shows a thinking indicator while the reply is still empty', () => {
    setup({ text: '' });

    expect(screen.getByRole('status', { name: 'Thinking' })).toBeDefined();
  });

  it('never shows the writer as thinking', () => {
    setup({ side: 'you', who: 'You', text: '' });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders each card through its owner', () => {
    setup({ cards: [card('card-1', 'Tallow lamps'), card('card-2', 'Lamp oil')] });

    expect(screen.getByText('card: Tallow lamps')).toBeDefined();
    expect(screen.getByText('card: Lamp oil')).toBeDefined();
  });
});
