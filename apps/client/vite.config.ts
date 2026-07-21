import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@chaos-td/game-core': fileURLToPath(new URL('../../packages/game-core/src/index.ts', import.meta.url)),
      '@chaos-td/game-data': fileURLToPath(new URL('../../packages/game-data/src/index.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    port: 3000,
    open: true,
  },
});
