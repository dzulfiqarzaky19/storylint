import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BeatEditor } from './BeatEditor';

const setup = (over: { initial?: string; pending?: boolean } = {}) => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <BeatEditor
      initial={over.initial ?? ''}
      pending={over.pending ?? false}
      onSave={onSave}
      onCancel={onCancel}
    />,
  );
  return {
    onSave,
    onCancel,
    field: screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Beat summary' }),
    save: screen.getByRole('button', { name: 'save' }),
  };
};

describe('BeatEditor', () => {
  it('opens focused, with the existing summary selected for overwriting', () => {
    const { field } = setup({ initial: 'Maren finds the ledger' });

    expect(document.activeElement).toBe(field);
    expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe(
      'Maren finds the ledger',
    );
  });

  it('saves the trimmed summary from the button', async () => {
    const { field, save, onSave } = setup();

    await userEvent.type(field, '  Maren finds the ledger  ');
    await userEvent.click(save);

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Maren finds the ledger');
  });

  it('saves on Enter', async () => {
    const { field, onSave } = setup();

    await userEvent.type(field, 'Maren finds the ledger{Enter}');

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Maren finds the ledger');
  });

  it('adds a line on Shift+Enter instead of saving', async () => {
    const { field, onSave } = setup();

    await userEvent.type(field, 'Maren{Shift>}{Enter}{/Shift}finds');

    expect(onSave).not.toHaveBeenCalled();
    expect(field.value).toBe('Maren\nfinds');
  });

  it('does not save a blank summary', async () => {
    const { field, save, onSave } = setup();

    await userEvent.type(field, '   {Enter}');

    expect(save).toHaveProperty('disabled', true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables the save button while a save is pending', () => {
    const { save } = setup({ initial: 'Maren finds the ledger', pending: true });

    expect(save).toHaveProperty('disabled', true);
  });

  it.each([
    ['Escape', () => userEvent.keyboard('{Escape}')],
    ['cancel', () => userEvent.click(screen.getByRole('button', { name: 'cancel' }))],
  ])('cancels on %s without saving', async (_name, dismiss) => {
    const { onSave, onCancel } = setup({ initial: 'Maren finds the ledger' });

    await dismiss();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
