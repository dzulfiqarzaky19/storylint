import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import IndexRail from './IndexRail';

// jsdom has no matchMedia; the rail reads it to know whether it is stacked.
function stubViewport(stacked: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: stacked,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IndexRail', () => {
  it('is a navigation landmark named by its title, showing its rows', () => {
    render(
      <IndexRail title="Chapters" toggleLabel="Toggle chapters">
        <a href="/write?c=1">One</a>
      </IndexRail>,
    );

    const nav = screen.getByRole('navigation', { name: 'Chapters' });
    expect(nav.contains(screen.getByRole('link', { name: 'One' }))).toBe(true);
  });

  it('prefers an explicit label over the title for the landmark', () => {
    render(
      <IndexRail title="Chapters" ariaLabel="Chapter index" toggleLabel="Toggle chapters">
        <p>rows</p>
      </IndexRail>,
    );

    expect(screen.getByRole('navigation', { name: 'Chapter index' })).toBeDefined();
  });

  it('shows the count beside the title, including a count of zero', () => {
    render(
      <IndexRail title="Chapters" count={0} toggleLabel="Toggle chapters">
        <p>rows</p>
      </IndexRail>,
    );

    expect(screen.getByText('· 0')).toBeDefined();
  });

  it('renders the action and the footer it is given', () => {
    render(
      <IndexRail
        title="Chapters"
        toggleLabel="Toggle chapters"
        action={<button type="button">New chapter</button>}
        footer={<p>End of list</p>}
      >
        <p>rows</p>
      </IndexRail>,
    );

    expect(screen.getByRole('button', { name: 'New chapter' })).toBeDefined();
    expect(screen.getByText('End of list')).toBeDefined();
  });

  describe('on a wide viewport', () => {
    it('has no collapse toggle', () => {
      stubViewport(false);
      render(
        <IndexRail title="Chapters" toggleLabel="Toggle chapters">
          <p>rows</p>
        </IndexRail>,
      );

      expect(screen.queryByRole('button', { name: 'Toggle chapters' })).toBeNull();
    });
  });

  describe('on a stacked viewport', () => {
    it('collapses behind a toggle that reports and flips its state', async () => {
      stubViewport(true);
      render(
        <IndexRail title="Chapters" toggleLabel="Toggle chapters">
          <p>rows</p>
        </IndexRail>,
      );
      const toggle = screen.getByRole('button', { name: 'Toggle chapters' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      await userEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');

      await userEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('points the toggle at the panel it controls', () => {
      stubViewport(true);
      render(
        <IndexRail title="Chapters" toggleLabel="Toggle chapters">
          <p>rows</p>
        </IndexRail>,
      );

      const panelId = screen
        .getByRole('button', { name: 'Toggle chapters' })
        .getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      expect(document.getElementById(panelId!)?.textContent).toContain('rows');
    });
  });

  describe('the filter', () => {
    const withFilter = (value = '') => {
      const onChange = vi.fn();
      render(
        <IndexRail
          title="Chapters"
          toggleLabel="Toggle chapters"
          filter={{ placeholder: 'Find a chapter', value, onChange }}
        >
          <button type="button">A row</button>
        </IndexRail>,
      );
      return { onChange, input: screen.getByRole('searchbox', { name: 'Find a chapter' }) };
    };

    it('is absent unless a filter is given', () => {
      render(
        <IndexRail title="Chapters" toggleLabel="Toggle chapters">
          <p>rows</p>
        </IndexRail>,
      );

      expect(screen.queryByRole('searchbox')).toBeNull();
    });

    it('shows the current value and reports what is typed', async () => {
      const { input, onChange } = withFilter('ma');
      expect(input).toHaveProperty('value', 'ma');

      await userEvent.type(input, 'r');

      expect(onChange).toHaveBeenLastCalledWith('mar');
    });

    it('clears and leaves the field on Escape', async () => {
      const { input, onChange } = withFilter('mar');
      input.focus();

      await userEvent.keyboard('{Escape}');

      expect(onChange).toHaveBeenLastCalledWith('');
      expect(document.activeElement).not.toBe(input);
    });

    it('takes focus when "/" is pressed elsewhere on the page', async () => {
      const { input } = withFilter();
      screen.getByRole('button', { name: 'A row' }).focus();

      await userEvent.keyboard('/');

      expect(document.activeElement).toBe(input);
    });

    it('opens the stacked rail when "/" is pressed', async () => {
      stubViewport(true);
      withFilter();

      await userEvent.keyboard('/');

      expect(
        screen.getByRole('button', { name: 'Toggle chapters' }).getAttribute('aria-expanded'),
      ).toBe('true');
    });

    it.each([
      ['Ctrl', { ctrlKey: true }],
      ['Meta', { metaKey: true }],
      ['Alt', { altKey: true }],
    ])('leaves %s+/ to the browser', (_name, modifier) => {
      const { input } = withFilter();

      fireEvent.keyDown(document.body, { key: '/', ...modifier });

      expect(document.activeElement).not.toBe(input);
    });

    it('lets "/" be typed into another text field', async () => {
      const { input } = withFilter();
      const other = document.createElement('textarea');
      document.body.append(other);
      other.focus();

      await userEvent.keyboard('/');

      expect(document.activeElement).not.toBe(input);
      expect(other.value).toBe('/');
      other.remove();
    });
  });

  describe('scroll position', () => {
    const scroller = () => screen.getByText('rows').parentElement as HTMLElement;

    it('restores the offset saved for this rail', () => {
      sessionStorage.setItem('indexrail:scroll:Chapters', '120');
      render(
        <IndexRail title="Chapters" toggleLabel="Toggle chapters">
          <p>rows</p>
        </IndexRail>,
      );

      expect(scroller().scrollTop).toBe(120);
    });

    it('ignores a saved offset that is not a number', () => {
      sessionStorage.setItem('indexrail:scroll:Chapters', 'far down');
      render(
        <IndexRail title="Chapters" toggleLabel="Toggle chapters">
          <p>rows</p>
        </IndexRail>,
      );

      expect(scroller().scrollTop).toBe(0);
    });

    it('saves the offset under its own rail name as the list scrolls', async () => {
      render(
        <IndexRail title="Chapters" ariaLabel="Chapter index" toggleLabel="Toggle chapters">
          <p>rows</p>
        </IndexRail>,
      );
      const el = scroller();

      el.scrollTop = 64;
      fireEvent.scroll(el);

      await vi.waitFor(() => {
        expect(sessionStorage.getItem('indexrail:scroll:Chapter index')).toBe('64');
      });
    });
  });
});
