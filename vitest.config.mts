import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Integration tests share ONE live Postgres. With file parallelism on (the
    // vitest default), concurrent test files seed/delete the same tables and
    // race any whole-table-count assertion. Serialize file execution so the
    // shared-DB suite is deterministic. (Per-file fixture-scoped counts are the
    // belt; this is the suspenders — coordinator ruling A.)
    fileParallelism: false,
  },
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
});
