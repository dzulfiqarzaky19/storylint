import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
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
