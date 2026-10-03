import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import Title from './Title';

const setup = () => {
  const onRename = vi.fn();
  const view = render(<Title number={4} title="The Ledger" onRename={onRename} />);
  return { onRename, ...view, heading: screen.getByRole('textbox', { name: 'Chapter title' }) };
};

// Stands in for the writer typing into the editable heading.
const retitle = (heading: HTMLElement, text: string) => {
  heading.focus();
  heading.textContent = text;
};

describe('Title', () => {
  it('shows the chapter title in an editable heading', () => {
    const { heading } = setup();

    expect(heading.tagName).toBe('H1');
    expect(heading.textContent).toBe('The Ledger');
    expect(heading.getAttribute('contenteditable')).toBe('true');
  });

  it('renames the chapter with the trimmed title when focus leaves', () => {
    const { heading, onRename } = setup();

    retitle(heading, '  The Brass Ledger  ');
    fireEvent.blur(heading);

    expect(onRename).toHaveBeenCalledExactlyOnceWith(4, 'The Brass Ledger');
  });

  it('commits on Enter instead of adding a line', () => {
    const { heading, onRename } = setup();
    retitle(heading, 'The Brass Ledger');

    const notPrevented = fireEvent.keyDown(heading, { key: 'Enter' });

    expect(notPrevented).toBe(false);
    expect(onRename).toHaveBeenCalledExactlyOnceWith(4, 'The Brass Ledger');
  });

  it('restores the title on Escape without renaming', () => {
    const { heading, onRename } = setup();
    retitle(heading, 'The Brass Ledger');

    fireEvent.keyDown(heading, { key: 'Escape' });

    expect(heading.textContent).toBe('The Ledger');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('does not rename when the title is unchanged', () => {
    const { heading, onRename } = setup();

    retitle(heading, 'The Ledger');
    fireEvent.blur(heading);

    expect(onRename).not.toHaveBeenCalled();
  });

  it('puts the title back rather than saving a blank one', () => {
    const { heading, onRename } = setup();

    retitle(heading, '   ');
    fireEvent.blur(heading);

    expect(heading.textContent).toBe('The Ledger');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('follows a title changed elsewhere', () => {
    const { heading, rerender, onRename } = setup();

    rerender(<Title number={4} title="The Brass Ledger" onRename={onRename} />);

    expect(heading.textContent).toBe('The Brass Ledger');
  });
});
