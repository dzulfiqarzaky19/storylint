import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PlotBeat } from '@/domain/plot';
import { Beat } from './Beat';

function beat(over: Partial<PlotBeat> = {}): PlotBeat {
  return {
    chapterNumber: 3,
    summary: 'Maren finds the ledger',
    warn: null,
    resolves: false,
    abandons: false,
    ...over,
  };
}

describe('Beat', () => {
  it('shows the summary and the kind, with no notes on a plain beat', () => {
    render(<Beat beat={beat()} kind="turn" color="#a33" onOpen={() => {}} />);

    const card = screen.getByRole('button');
    expect(card.textContent).toContain('Maren finds the ledger');
    expect(card.textContent).toContain('turn');
    expect(card.textContent).not.toContain('arc');
  });

  it('opens when clicked', async () => {
    const onOpen = vi.fn();
    render(<Beat beat={beat()} kind="turn" color="#a33" onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('notes the beat that resolves its arc', () => {
    render(<Beat beat={beat({ resolves: true })} kind="turn" color="#a33" onOpen={() => {}} />);

    expect(screen.getByText('✓ arc resolved here')).toBeDefined();
  });

  it('notes the beat that drops its arc', () => {
    render(<Beat beat={beat({ abandons: true })} kind="turn" color="#a33" onOpen={() => {}} />);

    expect(screen.getByText('arc dropped here')).toBeDefined();
  });

  it('shows a warning the beat carries', () => {
    render(
      <Beat
        beat={beat({ warn: 'No beat for 6 chapters' })}
        kind="turn"
        color="#a33"
        onOpen={() => {}}
      />,
    );

    expect(screen.getByRole('button').textContent).toContain('No beat for 6 chapters');
  });

  it('passes its lane colour to the card', () => {
    render(<Beat beat={beat()} kind="turn" color="#a33" onOpen={() => {}} />);

    expect(screen.getByRole('button').style.getPropertyValue('--lane')).toBe('#a33');
  });

  it('is draggable only when asked to be', () => {
    const { rerender } = render(<Beat beat={beat()} kind="turn" color="#a33" onOpen={() => {}} />);
    expect(screen.getByRole('button').getAttribute('draggable')).toBeNull();

    rerender(<Beat beat={beat()} kind="turn" color="#a33" onOpen={() => {}} draggable />);
    expect(screen.getByRole('button').getAttribute('draggable')).toBe('true');
  });

  it('starts a move drag and reports its start and end', () => {
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <Beat
        beat={beat()}
        kind="turn"
        color="#a33"
        onOpen={() => {}}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />,
    );
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'none' };

    fireEvent.dragStart(screen.getByRole('button'), { dataTransfer });
    fireEvent.dragEnd(screen.getByRole('button'));

    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'beat');
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });
});
