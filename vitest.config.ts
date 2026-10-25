import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['server/test/**/*.test.ts'], testTimeout: 20000, maxWorkers: 2 },
});
