import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Tabs from './Tabs';

const TABS = [
  { key: 'overview' as const, label: 'Overview', panel: <p>overview panel</p> },
  { key: 'details' as const, label: 'Details', count: 3, panel: <p>details panel</p> },
  { key: 'ties' as const, label: 'Ties', count: 0, warn: true, panel: <p>ties panel</p> },
];

const selected = () =>
  screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-selected'));

describe('Tabs', () => {
  it('lists its tabs in a labelled tablist', () => {
    render(<Tabs tabs={TABS} />);

    expect(screen.getByRole('tablist', { name: 'Entry sections' })).toBeDefined();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('starts on the first tab, showing only its panel', () => {
    render(<Tabs tabs={TABS} />);

    expect(selected()).toEqual(['true', 'false', 'false']);
    expect(screen.getByText('overview panel')).toBeDefined();
    expect(screen.queryByText('details panel')).toBeNull();
  });

  it('switches to the tab that is clicked', async () => {
    render(<Tabs tabs={TABS} />);

    await userEvent.click(screen.getByRole('tab', { name: /Details/ }));

    expect(selected()).toEqual(['false', 'true', 'false']);
    expect(screen.getByText('details panel')).toBeDefined();
    expect(screen.queryByText('overview panel')).toBeNull();
  });

  it('shows a count where one is given, including zero', () => {
    render(<Tabs tabs={TABS} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Details3',
      'Ties0',
    ]);
  });

  it('renders nothing in the body when it has no tabs', () => {
    render(<Tabs tabs={[]} />);

    expect(screen.queryAllByRole('tab')).toEqual([]);
  });
});
