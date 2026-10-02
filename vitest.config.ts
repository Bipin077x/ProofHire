import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./scripts/setup-tests.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  }
});
