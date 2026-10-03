import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import SaveState from './SaveState';

describe('SaveState', () => {
  it.each([
    ['Saved', { dirty: false, aiChecking: false }],
    ['Unsaved changes', { dirty: true, aiChecking: false }],
    ['Checking with AI…', { dirty: false, aiChecking: true }],
  ])('reports "%s" as a status', (text, state) => {
    render(<SaveState error={null} {...state} />);

    expect(screen.getByRole('status').textContent).toBe(text);
  });

  it('puts unsaved changes ahead of the AI check', () => {
    render(<SaveState error={null} dirty aiChecking />);

    expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
  });

  it('raises a save error as an alert, ahead of everything else', () => {
    render(<SaveState error="Could not save the chapter." dirty aiChecking />);

    expect(screen.getByRole('alert').textContent).toBe('Could not save the chapter.');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
