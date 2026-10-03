import next from 'eslint-config-next/core-web-vitals';

const SERVER_INTERNALS = [
  '@/server/db/**',
  '@/server/ai/**',
  '@/server/websearch/**',
  '@/server/research/**',
  '@/server/write/**',
];
const FEATURES = ['wiki', 'write', 'research', 'plot'];

const restrict = (files, group, message) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group, message }] }] },
});

// Imports only point downward: app -> features -> components/hooks -> server/actions -> server -> domain.
const boundaries = [
  restrict(
    ['src/domain/**'],
    ['@/server/**', '@/features/**', '@/components/**', '@/hooks/**', '@/app/**'],
    'domain is pure: it imports nothing outside src/domain.',
  ),
  restrict(
    ['src/server/**'],
    ['@/features/**', '@/components/**', '@/hooks/**', '@/app/**'],
    'server code may only import server and domain.',
  ),
  restrict(
    ['src/server/{db,ai,websearch,research,write}/**'],
    ['@/server/actions/**', '@/features/**', '@/components/**', '@/hooks/**', '@/app/**'],
    'actions call into db/ai/websearch, never the other way round.',
  ),
  restrict(
    ['src/components/**', 'src/hooks/**'],
    [...SERVER_INTERNALS, '@/features/**', '@/app/**'],
    'shared UI may only import components, hooks, server/actions and domain.',
  ),
  ...FEATURES.map((feature) =>
    restrict(
      [`src/features/${feature}/**`],
      [
        ...SERVER_INTERNALS,
        '@/app/**',
        ...FEATURES.filter((f) => f !== feature).map((f) => `@/features/${f}/**`),
      ],
      'a feature may only import itself, components, hooks, server/actions and domain.',
    ),
  ),
];

const eslintConfig = [
  ...next,
  ...boundaries,
  { ignores: ['.next**/**', 'node_modules/**', 'next-env.d.ts'] },
];

export default eslintConfig;
