import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests live NEXT TO the code they cover: `src/**/*.test.ts`, no separate tests
// tree. `npm test` is DB-free and network-free by construction — a module that
// needs a database or a gateway takes it as an injected port (see
// `lib/write/chapterMarksReader.ts`), so a test passes a fake instead of the
// suite needing a live Postgres.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    name: 'unit',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
