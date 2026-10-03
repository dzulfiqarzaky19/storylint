import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

// Database tests run against the isolated `db_test` service (docker compose).
loadEnvFile('.env.test');

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    name: 'db',
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    fileParallelism: false,
  },
});
