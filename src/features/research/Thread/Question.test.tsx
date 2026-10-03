import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import Question from './Question';

describe('Question', () => {
  it('shows the question as the heading', () => {
    render(<Question question="How are the lamps lit?" turnCount={3} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('How are the lamps lit?');
  });

  it.each([
    [0, '0 turns'],
    [1, '1 turn'],
    [4, '4 turns'],
  ])('counts %i as "%s"', (turnCount, meta) => {
    render(<Question question="How are the lamps lit?" turnCount={turnCount} />);

    expect(screen.getByText(meta)).toBeDefined();
  });

  it('names the world the thread belongs to', () => {
    render(<Question question="How are the lamps lit?" turnCount={2} worldName="Verge" />);

    expect(screen.getByText('2 turns · Verge world')).toBeDefined();
  });
});
