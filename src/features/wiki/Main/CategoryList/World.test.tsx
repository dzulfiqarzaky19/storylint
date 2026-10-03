import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import World from './World';

describe('World', () => {
  it('heads the world with its entry count', () => {
    render(<World entryCount={12} />);

    const band = screen.getByRole('region', { name: 'The world' });
    expect(screen.getByRole('heading', { level: 2, name: 'The world' })).toBeDefined();
    expect(band.textContent).toContain('12 entries');
  });
});
