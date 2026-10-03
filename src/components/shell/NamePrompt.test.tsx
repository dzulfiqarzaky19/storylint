import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NamePrompt from './NamePrompt';

describe('NamePrompt', () => {
  it('opens a dialog named by its title, with the field focused', () => {
    render(<NamePrompt title="New book" onSubmit={() => {}} onCancel={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'New book' })).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'New book' }));
  });

  it('starts from the initial name and the given confirm label', () => {
    render(
      <NamePrompt
        title="Rename book"
        initial="The Verge"
        confirmLabel="Rename"
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('textbox')).toHaveProperty('value', 'The Verge');
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDefined();
  });

  it('keeps submitting disabled while the name is blank', async () => {
    render(<NamePrompt title="New book" onSubmit={() => {}} onCancel={() => {}} />);
    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toHaveProperty('disabled', true);

    await userEvent.type(screen.getByRole('textbox'), '   ');

    expect(create).toHaveProperty('disabled', true);
  });

  it('submits the trimmed name from the button', async () => {
    const onSubmit = vi.fn();
    render(<NamePrompt title="New book" onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByRole('textbox'), '  The Verge  ');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('The Verge');
  });

  it('submits on Enter', async () => {
    const onSubmit = vi.fn();
    render(<NamePrompt title="New book" onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByRole('textbox'), 'The Verge{Enter}');

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('The Verge');
  });

  it('submits once when Enter and the button both fire', async () => {
    const onSubmit = vi.fn();
    render(<NamePrompt title="New book" onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByRole('textbox'), 'The Verge{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit a blank name on Enter', async () => {
    const onSubmit = vi.fn();
    render(<NamePrompt title="New book" onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByRole('textbox'), '  {Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancels from the cancel button', async () => {
    const onCancel = vi.fn();
    render(<NamePrompt title="New book" onSubmit={() => {}} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
