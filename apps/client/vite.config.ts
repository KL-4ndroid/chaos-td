import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  plugins: [{
    name: 'training-live-state',
    configureServer(server) {
      server.middlewares.use('/api/training/live', (_request, response) => {
        const reportRoot = resolve(fileURLToPath(new URL('../../reports/ai', import.meta.url)));
        const progressPath = resolve(reportRoot, 'live-training-progress.json');
        const statePath = resolve(reportRoot, 'live-training-state.json');
        const progress = existsSync(progressPath) ? JSON.parse(readFileSync(progressPath, 'utf8')) : null;
        const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ progress, state }));
      });
    },
  }],
});
