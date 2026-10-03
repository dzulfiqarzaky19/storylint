import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { WorldUniverseNode } from '@/domain/structure';
import { book, universe, world } from '@/domain/testing/structure';
import Header from './Header';

const mocks = vi.hoisted(() => ({ pathname: '/wiki', search: '' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
// The scope and book pills import these; nothing here calls them.
vi.mock('@/server/actions/wiki/worldStructure', () => ({
  editWorldStructure: vi.fn(),
  previewStructureDelete: vi.fn(),
}));

const TREE: WorldUniverseNode[] = [
  universe('uni-ash', 'Ashfall', [world('world-verge', 'Verge', [book('book-oath', 'The Oath')])]),
];

const setup = (pathname: string, props: Parameters<typeof Header>[0] = {}, search = '') => {
  mocks.pathname = pathname;
  mocks.search = search;
  render(<Header {...props} />);
  return { nav: within(screen.getByRole('navigation', { name: 'Primary' })) };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Header', () => {
  describe('the navigation', () => {
    it('links to the four surfaces', () => {
      const { nav } = setup('/wiki');

      expect(
        nav.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]),
      ).toEqual([
        ['wiki', '/wiki'],
        ['research', '/research'],
        ['write', '/write'],
        ['plot', '/plot'],
      ]);
    });

    it.each([
      ['/wiki', 'wiki'],
      ['/research', 'research'],
      ['/wiki/manage', 'wiki'],
      ['/somewhere-else', 'wiki'],
    ])('on %s, marks %s as the current page', (pathname, label) => {
      const { nav } = setup(pathname);

      expect(
        nav
          .getAllByRole('link')
          .filter((link) => link.getAttribute('aria-current') === 'page')
          .map((link) => link.textContent),
      ).toEqual([label]);
    });

    it('carries the universe and world across surfaces, but not the book', () => {
      const { nav } = setup('/write', {}, 'u=uni-ash&w=world-verge&book=book-oath');

      expect(nav.getByRole('link', { name: 'plot' }).getAttribute('href')).toBe(
        '/plot?u=uni-ash&w=world-verge',
      );
      expect(nav.getByRole('link', { name: 'write' }).getAttribute('href')).toBe(
        '/write?u=uni-ash&w=world-verge',
      );
    });
  });

  describe('the brand', () => {
    it.each([
      ['/wiki', 'a gazetteer in progress'],
      ['/research', 'the workings'],
      ['/plot', 'the arcs, chapter by chapter'],
    ])('on %s, describes the surface as "%s"', (pathname, descriptor) => {
      setup(pathname);

      expect(screen.getByText('STORYLINT')).toBeDefined();
      expect(screen.getByText(descriptor)).toBeDefined();
    });

    it('gives way to the scope pill when a scope is passed', () => {
      setup('/wiki', { scope: { tree: TREE } });

      expect(screen.queryByText('STORYLINT')).toBeNull();
      expect(screen.getByRole('button', { expanded: false }).textContent).toBe('AshfallVerge▾');
    });

    it('gives way to the book pill when a book scope is passed', () => {
      setup('/write', { scope: { tree: TREE }, bookScope: { tree: TREE } });

      expect(screen.getByRole('button', { expanded: false }).textContent).toBe('VergeThe Oath▾');
      expect(screen.getByTestId('export-book')).toBeDefined();
    });
  });
});
