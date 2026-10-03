import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InlineText from './InlineText';

const setup = (over: { value?: string; multiline?: boolean; placeholder?: string } = {}) => {
  const onCommit = vi.fn();
  const view = render(
    <InlineText
      value={over.value ?? 'Grey'}
      multiline={over.multiline}
      placeholder={over.placeholder}
      ariaLabel="eye colour"
      onCommit={onCommit}
    />,
  );
  return { onCommit, ...view };
};

const startEditing = async () => {
  await userEvent.click(screen.getByRole('button'));
  return screen.getByRole<HTMLInputElement | HTMLTextAreaElement>('textbox', { name: 'eye colour' });
};

describe('InlineText', () => {
  describe('at rest', () => {
    it('shows its value as a button that offers editing', () => {
      setup();

      const button = screen.getByRole('button', { name: 'Grey' });
      expect(button.getAttribute('title')).toBe('Edit eye colour');
    });

    it('shows a placeholder, and names the button, when the value is empty', () => {
      setup({ value: '' });

      expect(screen.getByRole('button', { name: 'Edit eye colour' }).textContent).toBe('Empty');
    });

    it('uses the placeholder it is given', () => {
      setup({ value: '', placeholder: 'No colour yet' });

      expect(screen.getByRole('button').textContent).toBe('No colour yet');
    });
  });

  describe('editing', () => {
    it('opens a focused field with the value selected', async () => {
      setup();

      const field = await startEditing();

      expect(document.activeElement).toBe(field);
      expect(field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)).toBe('Grey');
    });

    it('commits the trimmed text on Enter and returns to rest', async () => {
      const { onCommit } = setup();
      const field = await startEditing();

      await userEvent.clear(field);
      await userEvent.type(field, '  Green  {Enter}');

      expect(onCommit).toHaveBeenCalledExactlyOnceWith('Green');
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('commits when focus leaves the field', async () => {
      const { onCommit } = setup();
      const field = await startEditing();

      await userEvent.clear(field);
      await userEvent.type(field, 'Green');
      await userEvent.tab();

      expect(onCommit).toHaveBeenCalledExactlyOnceWith('Green');
    });

    it('commits an emptied value, so a fact can be cleared', async () => {
      const { onCommit } = setup();
      const field = await startEditing();

      await userEvent.clear(field);
      await userEvent.keyboard('{Enter}');

      expect(onCommit).toHaveBeenCalledExactlyOnceWith('');
    });

    it('does not commit text that has not changed', async () => {
      const { onCommit } = setup();
      await startEditing();

      await userEvent.keyboard('{Enter}');

      expect(onCommit).not.toHaveBeenCalled();
    });

    it('throws the draft away on Escape', async () => {
      const { onCommit } = setup();
      const field = await startEditing();

      await userEvent.clear(field);
      await userEvent.type(field, 'Green{Escape}');

      expect(onCommit).not.toHaveBeenCalled();
      expect(await startEditing()).toHaveProperty('value', 'Grey');
    });
  });

  describe('multiline', () => {
    it('edits in a textarea, where Enter adds a line', async () => {
      const { onCommit } = setup({ multiline: true });
      const field = await startEditing();

      await userEvent.clear(field);
      await userEvent.type(field, 'Grey{Enter}flecked');

      expect(field.tagName).toBe('TEXTAREA');
      expect(field.value).toBe('Grey\nflecked');
      expect(onCommit).not.toHaveBeenCalled();
    });

    it.each([
      ['Ctrl', '{Control>}{Enter}{/Control}'],
      ['Meta', '{Meta>}{Enter}{/Meta}'],
    ])('commits on %s+Enter', async (_name, keys) => {
      const { onCommit } = setup({ multiline: true });
      const field = await startEditing();

      await userEvent.clear(field);
      await userEvent.type(field, `Green${keys}`);

      expect(onCommit).toHaveBeenCalledExactlyOnceWith('Green');
    });
  });

  describe('when the value changes elsewhere', () => {
    const next = (onCommit: () => void) => (
      <InlineText value="Hazel" ariaLabel="eye colour" onCommit={onCommit} />
    );

    it('follows the new value while at rest', async () => {
      const { onCommit, rerender } = setup();

      rerender(next(onCommit));

      expect(screen.getByRole('button', { name: 'Hazel' })).toBeDefined();
      expect(await startEditing()).toHaveProperty('value', 'Hazel');
    });

    it('keeps the draft while it is being edited', async () => {
      const { onCommit, rerender } = setup();
      const field = await startEditing();
      await userEvent.clear(field);
      await userEvent.type(field, 'Green');

      rerender(next(onCommit));

      expect(field).toHaveProperty('value', 'Green');
    });
  });
});
