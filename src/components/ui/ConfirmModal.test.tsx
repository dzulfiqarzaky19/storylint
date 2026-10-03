import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
  it('shows the title as the dialog name, the body, and default button labels', () => {
    render(
      <ConfirmModal
        title="Delete chapter?"
        body="This cannot be undone."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Delete chapter?' })).toBeDefined();
    expect(screen.getByText('This cannot be undone.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('uses the labels it is given', () => {
    render(
      <ConfirmModal
        title="Delete chapter?"
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeDefined();
  });

  it('confirms once, however many times the button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal title="Delete chapter?" onConfirm={onConfirm} onCancel={() => {}} />);
    const confirm = screen.getByRole('button', { name: 'Confirm' });

    await userEvent.dblClick(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveProperty('disabled', true);
  });

  it('cancels from the cancel button', async () => {
    const onCancel = vi.fn();
    render(<ConfirmModal title="Delete chapter?" onConfirm={() => {}} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables confirming while the action is pending', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal title="Delete chapter?" pending onConfirm={onConfirm} onCancel={() => {}} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  describe('with a name to type', () => {
    const gated = (onConfirm = vi.fn()) => {
      render(
        <ConfirmModal
          title="Delete book?"
          requireTypeToConfirm="The Verge"
          onConfirm={onConfirm}
          onCancel={() => {}}
        />,
      );
      return {
        onConfirm,
        input: screen.getByRole('textbox', { name: 'Type The Verge to confirm' }),
        confirm: screen.getByRole('button', { name: 'Confirm' }),
      };
    };

    it('keeps confirming disabled until the name is typed', async () => {
      const { input, confirm } = gated();
      expect(confirm).toHaveProperty('disabled', true);

      await userEvent.type(input, 'The Verg');
      expect(confirm).toHaveProperty('disabled', true);

      await userEvent.type(input, 'e');
      expect(confirm).toHaveProperty('disabled', false);
    });

    it('confirms once the name matches', async () => {
      const { input, confirm, onConfirm } = gated();

      await userEvent.type(input, 'The Verge');
      await userEvent.click(confirm);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not accept the name in another case', async () => {
      const { input, confirm } = gated();

      await userEvent.type(input, 'the verge');

      expect(confirm).toHaveProperty('disabled', true);
    });
  });
});
