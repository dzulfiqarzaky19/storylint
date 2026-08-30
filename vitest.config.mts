import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readTestDbUrl } from './tests/db/testDbUrl.mts';

// Two honest tiers, split by filename suffix so the everyday `test` run never
// touches the live Postgres:
//   - unit: pure logic, DB-free, fast — every `*.test.ts` EXCEPT `*.int.test.ts`.
//   - int:  the shared-Postgres integration suite — `*.int.test.ts` only.
// `npm test` runs unit only (safe against warm dev data). `npm run test:int`
// runs the DB suite deliberately. Select a tier with `--project unit|int`.
export default defineConfig({
  plugins: [react()],
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
          // T-ARCH-8: run against the ISOLATED test DB (db_test, :5435/
          // ashkeld_test) that e2e already uses, never the live dev DB
          // (:5434/ashkeld) — that DB gets reseeded/reimported by unrelated
          // work (novel-extraction, demo data), which twice rotted these
          // tests' DEFAULT_UNIVERSE_ID fixtures out from under a gate. `env`
          // sets DATABASE_URL for every int-project child process; each
          // `.int.test.ts` file's own `loadEnv()` no-ops because it only fills
          // gaps (see src/lib/db/env.ts), so this wins.
          env: { DATABASE_URL: readTestDbUrl() },
          // Reset + seed the isolated DB ONCE before the whole int project
          // runs (mirrors tests/e2e/global-setup.ts), so every file sees the
          // same deterministic fixtures regardless of prior runs. Set
          // INT_SKIP_SEED=1 to reuse an already-seeded DB while iterating.
          globalSetup: ['./tests/db/int-global-setup.mts'],
          // Integration tests share ONE Postgres. With file parallelism on
          // (the vitest default), concurrent test files seed/delete the same
          // tables and race any whole-table-count assertion. Serialize file
          // execution so the shared-DB suite is deterministic. (Per-file
          // fixture-scoped counts are the belt; this is the suspenders.)
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          // React component + a11y tests, rendered in jsdom (no browser, no
          // server, no DB). This is where UI/a11y checks live — NOT e2e. Real
          // CSS layout/computed-style facts jsdom can't compute stay out of
          // here (they belong to a browser tool), so this tier proves render,
          // roles/labels/headings, interactions, and component logic only.
          include: ['tests/**/*.component.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/setup-component.ts'],
        },
      },
    ],
  },
});
