import { fileURLToPath, URL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
      server.middlewares.use('/api/training/human-guidance', (request, response) => {
        if (request.method !== 'POST') { response.statusCode = 405; response.end(); return; }
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => chunks.push(chunk));
        request.on('end', () => {
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { replay?: unknown; profile?: unknown };
            if (!payload.replay || !payload.profile) throw new Error('Missing guided replay or profile');
            const root = resolve(fileURLToPath(new URL('../../data/ai/training/human-guidance', import.meta.url)));
            const replayRoot = resolve(root, 'replays');
            mkdirSync(replayRoot, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            writeFileSync(resolve(replayRoot, `human-guided-${timestamp}.json`), JSON.stringify(payload.replay));
            const profilePath = resolve(root, 'latest-profile.json');
            const previous = existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, 'utf8')) as { samples?: number; genomeOverrides?: Record<string, number> } : null;
            const incoming = payload.profile as { samples?: number; genomeOverrides?: Record<string, number> };
            const previousSamples = Math.max(0, previous?.samples ?? 0);
            const incomingSamples = Math.max(1, incoming.samples ?? 1);
            const totalSamples = previousSamples + incomingSamples;
            const keys = Object.keys(incoming.genomeOverrides ?? {});
            const genomeOverrides = Object.fromEntries(keys.map((key) => {
              const before = previous?.genomeOverrides?.[key] ?? incoming.genomeOverrides?.[key] ?? 0;
              const next = incoming.genomeOverrides?.[key] ?? before;
              return [key, Math.round((before * previousSamples + next * incomingSamples) / totalSamples)];
            }));
            writeFileSync(profilePath, JSON.stringify({ ...incoming, samples: totalSamples, genomeOverrides }, null, 2));
            response.statusCode = 201;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ accepted: true }));
          } catch (error) {
            response.statusCode = 400;
            response.end(JSON.stringify({ accepted: false, error: error instanceof Error ? error.message : 'Invalid request' }));
          }
        });
      });
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
