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
    },
  },
});
