import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@chaos-td/game-data': fileURLToPath(new URL('./packages/game-data/src/index.ts', import.meta.url)),
      '@chaos-td/game-core': fileURLToPath(new URL('./packages/game-core/src/index.ts', import.meta.url)),
      '@chaos-td/ai-strategy': fileURLToPath(new URL('./packages/ai-strategy/src/index.ts', import.meta.url)),
      '@chaos-td/ai-training': fileURLToPath(new URL('./packages/ai-training/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts'],
    },
    typecheck: {
      enabled: true,
    },
  },
});
