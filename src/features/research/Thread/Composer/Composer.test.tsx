import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Composer from './Composer';

const withAi = (over: { value?: string; busy?: boolean } = {}) => {
  const ai = {
    value: over.value ?? '',
    busy: over.busy ?? false,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
  };
  render(
    <Composer ai={ai}>
      <button type="button">a chip</button>
    </Composer>,
  );
  return { ai, input: screen.getByRole('textbox', { name: 'Ask the research AI' }) };
};

describe('Composer', () => {
  it('shows a placeholder and no field when the AI is off', () => {
    render(
      <Composer>
        <button type="button">a chip</button>
      </Composer>,
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Type anything. Half a thought is enough.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'a chip' })).toBeDefined();
  });

  it('reports what is typed', async () => {
    const { ai, input } = withAi({ value: 'tallo' });

    await userEvent.type(input, 'w');

    expect(ai.onChange).toHaveBeenLastCalledWith('tallow');
  });

  it('keeps asking disabled while the question is blank', () => {
    withAi({ value: '   ' });

    expect(screen.getByRole('button', { name: 'Ask' })).toHaveProperty('disabled', true);
  });

  it('submits from the button', async () => {
    const { ai } = withAi({ value: 'what burns tallow?' });

    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(ai.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits on Enter', async () => {
    const { ai, input } = withAi({ value: 'what burns tallow?' });

    await userEvent.type(input, '{Enter}');

    expect(ai.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit on Shift+Enter', async () => {
    const { ai, input } = withAi({ value: 'what burns tallow?' });

    await userEvent.type(input, '{Shift>}{Enter}{/Shift}');

    expect(ai.onSubmit).not.toHaveBeenCalled();
  });

  it('locks the field and the button while the AI is thinking', () => {
    const { input } = withAi({ value: 'what burns tallow?', busy: true });

    expect(input).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Thinking…' })).toHaveProperty('disabled', true);
  });
});
