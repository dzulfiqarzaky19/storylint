import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Two honest tiers, split by filename suffix so the everyday `test` run never
// touches the live Postgres:
//   - unit: pure logic, DB-free, fast — every `*.test.ts` EXCEPT `*.int.test.ts`.
//   - int:  the shared-Postgres integration suite — `*.int.test.ts` only.
// `npm test` runs unit only (safe against warm dev data). `npm run test:int`
// runs the DB suite deliberately. Select a tier with `--project unit|int`.
export default defineConfig({
  resolve: {
    alias: {
      // Mirror tsconfig `@/* -> ./src/*` so tests import the engine by path.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` is a build-time guard with no runtime package to resolve in
      // the node test env; map it to a harmless empty module so server modules
      // (e.g. the AI client) can be unit-tested directly.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.int.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'int',
          include: ['tests/**/*.int.test.ts'],
          environment: 'node',
          // Integration tests share ONE live Postgres. With file parallelism on
          // (the vitest default), concurrent test files seed/delete the same
          // tables and race any whole-table-count assertion. Serialize file
          // execution so the shared-DB suite is deterministic. (Per-file
          // fixture-scoped counts are the belt; this is the suspenders.)
          fileParallelism: false,
        },
      },
    ],
  },
});
