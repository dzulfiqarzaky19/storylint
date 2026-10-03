import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests sit next to the code they cover and need no database or network.
// Logic tests (`*.test.ts`) run in node; component tests (`*.test.tsx`) run in jsdom.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.db.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['src/testing/setupComponents.ts'],
        },
      },
    ],
    // Report only (`npm run test:coverage`): no thresholds, never fails a run.
    // Scoped to the pure logic unit tests can reach without a database or a DOM.
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'src/domain/**/*.ts',
        'src/features/**/state/**/*.ts',
        'src/features/**/lib/**/*.ts',
        'src/features/write/Manuscript/markDecorations.ts',
        'src/server/websearch/read/safeFetch.ts',
      ],
      exclude: ['**/*.test.ts', '**/testing/**'],
    },
  },
});
