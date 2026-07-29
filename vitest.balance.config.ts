import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/run-balance-simulation.test.ts'],
    testTimeout: 7_200_000,
    hookTimeout: 7_200_000,
  },
});
