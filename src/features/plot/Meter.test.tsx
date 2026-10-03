import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { Meter } from './Meter';

const meterText = (resolved: number, owed: number, percent: number) => {
  const { container } = render(<Meter completion={{ resolved, owed, percent }} />);
  return { container, text: container.textContent };
};

describe('Meter', () => {
  it('reports how many arcs have landed', () => {
    expect(meterText(2, 5, 40).text).toBe('2 of 5 arcs landed');
  });

  it('says so when every arc has landed', () => {
    expect(meterText(5, 5, 100).text).toBe('5 of 5 arcs landed · all arcs landed');
  });

  it('does not claim every arc landed when none are owed', () => {
    expect(meterText(0, 0, 0).text).toBe('0 of 0 arcs landed');
  });

  it('fills the bar to the completion percentage', () => {
    const { container } = meterText(2, 5, 40);

    expect(container.querySelector('i')?.style.width).toBe('40%');
  });

  it('announces changes politely', () => {
    const { container } = meterText(2, 5, 40);

    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
