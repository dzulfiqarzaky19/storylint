import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Modal from './Modal';

describe('Modal', () => {
  it('opens as a modal dialog when `open` is set', () => {
    render(
      <Modal open onClose={() => {}} ariaLabel="Rename book">
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rename book' });
    expect(dialog).toHaveProperty('open', true);
    expect(screen.getByText('Body')).toBeDefined();
  });

  it('stays closed until `open` is set', () => {
    render(
      <Modal open={false} onClose={() => {}} ariaLabel="Rename book">
        <p>Body</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the dialog when `open` is cleared', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} ariaLabel="Rename book">
        <p>Body</p>
      </Modal>,
    );

    rerender(
      <Modal open={false} onClose={() => {}} ariaLabel="Rename book">
        <p>Body</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names the dialog from the element `labelledBy` points at', () => {
    render(
      <Modal open onClose={() => {}} labelledBy="heading">
        <h2 id="heading">Delete chapter</h2>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Delete chapter' })).toBeDefined();
  });

  describe('closing', () => {
    it('asks to close on Escape, and leaves the closing to its owner', () => {
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} ariaLabel="Rename book">
          <p>Body</p>
        </Modal>,
      );
      const dialog = screen.getByRole('dialog');

      // Escape reaches a modal dialog as a cancellable `cancel` event.
      const notPrevented = fireEvent(dialog, new Event('cancel', { cancelable: true }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(notPrevented).toBe(false);
      expect(dialog).toHaveProperty('open', true);
    });

    it('asks to close on a click on the backdrop', async () => {
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} ariaLabel="Rename book">
          <p>Body</p>
        </Modal>,
      );

      await userEvent.click(screen.getByRole('dialog'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ignores a click inside the panel', async () => {
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} ariaLabel="Rename book">
          <p>Body</p>
        </Modal>,
      );

      await userEvent.click(screen.getByText('Body'));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('focus', () => {
    // jsdom lays nothing out, so every element reports no offsetParent and the
    // modal would see nothing focusable. Report the parent, as a browser does
    // for a visible element.
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.parentElement;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const twoButtons = (open: boolean) => (
      <Modal open={open} onClose={() => {}} ariaLabel="Rename book">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>
    );

    it('moves focus to the first focusable element on open', () => {
      render(twoButtons(true));

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
    });

    it('wraps Tab from the last element back to the first', async () => {
      render(twoButtons(true));
      screen.getByRole('button', { name: 'Last' }).focus();

      await userEvent.tab();

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
    });

    it('wraps Shift+Tab from the first element back to the last', async () => {
      render(twoButtons(true));

      await userEvent.tab({ shift: true });

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
    });

    it('returns focus to the element that had it once the modal closes', () => {
      const opener = document.createElement('button');
      document.body.append(opener);
      opener.focus();

      const { rerender } = render(twoButtons(true));
      expect(document.activeElement).not.toBe(opener);
      rerender(twoButtons(false));

      expect(document.activeElement).toBe(opener);
      opener.remove();
    });
  });
});
