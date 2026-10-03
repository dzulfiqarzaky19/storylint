import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PlotEdit } from './hooks/usePlotEdit';
import { NewPlotline } from './NewPlotline';

function plotEdit(over: Partial<PlotEdit> = {}): PlotEdit {
  return {
    pending: false,
    error: null,
    clearError: vi.fn(),
    rename: vi.fn(),
    setState: vi.fn(),
    saveBeat: vi.fn(),
    removeBeat: vi.fn(),
    moveBeat: vi.fn(),
    createLane: vi.fn(),
    deleteLane: vi.fn(),
    ...over,
  };
}

const openForm = async (edit: PlotEdit) => {
  render(<NewPlotline edit={edit} />);
  await userEvent.click(screen.getByRole('button', { name: '+ new plotline' }));
  return screen.getByRole('textbox', { name: 'New plotline name' });
};

describe('NewPlotline', () => {
  it('starts as a single button', () => {
    render(<NewPlotline edit={plotEdit()} />);

    expect(screen.getByRole('button', { name: '+ new plotline' })).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('disables the button while an edit is pending', () => {
    render(<NewPlotline edit={plotEdit({ pending: true })} />);

    expect(screen.getByRole('button', { name: '+ new plotline' })).toHaveProperty('disabled', true);
  });

  it('opens a form with the name field focused', async () => {
    const input = await openForm(plotEdit());

    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('button', { name: 'add' })).toHaveProperty('disabled', true);
  });

  it('creates the plotline with the trimmed name and closes', async () => {
    const edit = plotEdit();
    const input = await openForm(edit);

    await userEvent.type(input, '  The Ledger  ');
    await userEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(edit.createLane).toHaveBeenCalledExactlyOnceWith('The Ledger');
    expect(screen.getByRole('button', { name: '+ new plotline' })).toBeDefined();
  });

  it('creates the plotline on Enter', async () => {
    const edit = plotEdit();
    const input = await openForm(edit);

    await userEvent.type(input, 'The Ledger{Enter}');

    expect(edit.createLane).toHaveBeenCalledExactlyOnceWith('The Ledger');
  });

  it('does not create a plotline with a blank name', async () => {
    const edit = plotEdit();
    const input = await openForm(edit);

    await userEvent.type(input, '   {Enter}');

    expect(edit.createLane).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'New plotline name' })).toBeDefined();
  });

  it.each([
    ['Escape', () => userEvent.keyboard('{Escape}')],
    ['cancel', () => userEvent.click(screen.getByRole('button', { name: 'cancel' }))],
  ])('closes on %s and forgets what was typed', async (_name, dismiss) => {
    const edit = plotEdit();
    const input = await openForm(edit);
    await userEvent.type(input, 'The Ledger');

    await dismiss();

    expect(edit.createLane).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '+ new plotline' }));
    expect(screen.getByRole('textbox', { name: 'New plotline name' })).toHaveProperty('value', '');
  });
});
