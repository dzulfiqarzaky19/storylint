import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mark } from '@/domain/check/testing/wiki';
import Outstanding from './Outstanding';

const rows = () =>
  screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'));

describe('Outstanding', () => {
  it('says so when nothing is outstanding', () => {
    render(<Outstanding marks={[]} openMarkKey={null} onSelect={() => {}} />);

    expect(screen.getByText(/Nothing outstanding\./)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Outstanding' })).toBeDefined();
  });

  it('lists each mark with its signal, quote and reason', () => {
    render(
      <Outstanding
        marks={[
          mark({ markKey: 'a', kind: 'conflict', quote: 'green eyes', rail: 'Maren · Eyes: grey.' }),
          mark({ markKey: 'b', kind: 'missing', quote: 'her brass ring', rail: 'Not recorded.' }),
        ]}
        openMarkKey={null}
        onSelect={() => {}}
      />,
    );

    expect(rows().map((row) => row.textContent)).toEqual([
      'Contradiction“green eyes”Maren · Eyes: grey.',
      'Unrecorded“her brass ring”Not recorded.',
    ]);
  });

  it('counts the marks on the toggle', () => {
    render(
      <Outstanding
        marks={[mark({ markKey: 'a' }), mark({ markKey: 'b' })]}
        openMarkKey={null}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /^Outstanding\s*2$/ })).toBeDefined();
  });

  it('orders marks by importance, keeping manuscript order within a rank', () => {
    render(
      <Outstanding
        marks={[
          mark({ markKey: 'low', quote: 'low', importance: 'low' }),
          mark({ markKey: 'plain-1', quote: 'plain-1' }),
          mark({ markKey: 'high', quote: 'high', importance: 'high' }),
          mark({ markKey: 'plain-2', quote: 'plain-2', importance: 'normal' }),
        ]}
        openMarkKey={null}
        onSelect={() => {}}
      />,
    );

    expect(rows().map((row) => row.textContent?.match(/“(.*)”/)?.[1])).toEqual([
      'high',
      'plain-1',
      'plain-2',
      'low',
    ]);
  });

  it('marks the open row as pressed, and no other', () => {
    render(
      <Outstanding
        marks={[mark({ markKey: 'a' }), mark({ markKey: 'b' })]}
        openMarkKey="b"
        onSelect={() => {}}
      />,
    );

    expect(rows().map((row) => row.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('selects the mark whose row is clicked', async () => {
    const onSelect = vi.fn();
    render(
      <Outstanding
        marks={[mark({ markKey: 'a' }), mark({ markKey: 'b' })]}
        openMarkKey={null}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(rows()[1]!);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('expands and collapses from its toggle, which points at the body it controls', async () => {
    render(<Outstanding marks={[]} openMarkKey={null} onSelect={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'Outstanding' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      document.getElementById(toggle.getAttribute('aria-controls')!)?.textContent,
    ).toContain('Nothing outstanding.');
  });
});
