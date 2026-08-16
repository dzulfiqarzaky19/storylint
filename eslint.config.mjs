import next from 'eslint-config-next/core-web-vitals';

/**
 * Flat ESLint config (ESLint v9). eslint-config-next v16 ships a native flat
 * config array, so we spread it directly rather than using the FlatCompat shim
 * (which hits a circular-structure bug with the bundled plugin versions).
 */
const eslintConfig = [
  ...next,
  {
    ignores: [
      // Generated build output: the default `.next` plus every isolated dist dir
      // (`.next-verify`, `.next-review`, `.next-e2e`, per-agent `.next-<label>`,
      // and any stray `.next.stale-*`). These hold turbopack chunks, never source;
      // linting them produced ~100 phantom errors. Mirror `.gitignore`'s `.next*`.
      '.next**/**',
      'node_modules/**',
      'next-env.d.ts',
      // Vendored design handoff reference, not application source.
      'Fiction writing app redesign/**',
    ],
  },
];

export default eslintConfig;
