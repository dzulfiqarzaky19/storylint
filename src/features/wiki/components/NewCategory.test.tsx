import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NewCategory from './NewCategory';

const MINTED_ID = '11111111-1111-4111-8111-111111111111';

const setup = async () => {
  const onCreate = vi.fn();
  render(<NewCategory onCreate={onCreate} />);
  await userEvent.click(screen.getByRole('button', { name: '+ New category' }));
  return { onCreate, input: screen.getByRole('textbox', { name: 'New category name' }) };
};

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(MINTED_ID);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NewCategory', () => {
  it('stays closed until its button is clicked', () => {
    render(<NewCategory onCreate={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a dialog asking for the name', async () => {
    const { input } = await setup();

    expect(screen.getByRole('dialog', { name: 'New category' })).toBeDefined();
    expect(input).toHaveProperty('value', '');
  });

  it('creates the category under a freshly minted id, trimmed', async () => {
    const { onCreate, input } = await setup();

    await userEvent.type(input, '  Rituals {Enter}');

    expect(onCreate).toHaveBeenCalledExactlyOnceWith(MINTED_ID, 'Rituals');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('creates from the Add button', async () => {
    const { onCreate, input } = await setup();

    await userEvent.type(input, 'Rituals');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onCreate).toHaveBeenCalledExactlyOnceWith(MINTED_ID, 'Rituals');
  });

  it('closes without creating when the name is blank', async () => {
    const { onCreate, input } = await setup();

    await userEvent.type(input, '   {Enter}');

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancels without creating, and forgets what was typed', async () => {
    const { onCreate, input } = await setup();
    await userEvent.type(input, 'Rituals');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: '+ New category' }));
    expect(screen.getByRole('textbox', { name: 'New category name' })).toHaveProperty('value', '');
  });
});
