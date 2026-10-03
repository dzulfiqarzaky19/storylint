import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ChapterDelete from './ChapterDelete';

const setup = (busy = false) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ChapterDelete
      number={4}
      title="The Ledger"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
};

describe('ChapterDelete', () => {
  it('names the chapter it is about to delete', () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'Delete chapter 4' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('delete chapter 4: The Ledger?');
  });

  it('opens with the delete button focused', () => {
    setup();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete chapter' }));
  });

  it('confirms from the delete button', async () => {
    const { onConfirm, onCancel } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Delete chapter' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it.each([
    ['the cancel button', () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('cancels from %s', async (_name, dismiss) => {
    const { onConfirm, onCancel } = setup();

    await dismiss();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('locks both buttons while the delete is running', () => {
    setup(true);

    expect(screen.getByRole('button', { name: 'Deleting…' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
  });
});
