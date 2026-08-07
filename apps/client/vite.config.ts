import { fileURLToPath, URL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@chaos-td/ai-strategy': fileURLToPath(new URL('../../packages/ai-strategy/src/index.ts', import.meta.url)),
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
      let fastTraining: { status: 'idle' | 'running' | 'completed' | 'failed'; message: string } = { status: 'idle', message: '' };
      const trainingRoot = resolve(fileURLToPath(new URL('../../data/ai/training', import.meta.url)));
      const fastStatusPath = resolve(trainingRoot, 'human-guidance', 'fast-training-status.json');
      const startFastTraining = (): void => {
        if (fastTraining.status === 'running') return;
        fastTraining = { status: 'running', message: 'Training against the saved human style…' };
        const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
        const child = spawn(process.execPath, ['--loader', './scripts/ai-training-loader.mjs', 'scripts/run-human-guided-fast-train.mjs'], { cwd: workspaceRoot, windowsHide: true });
        child.on('error', (error) => { fastTraining = { status: 'failed', message: error.message }; });
        child.on('exit', (code) => { fastTraining = code === 0 ? { status: 'completed', message: 'New champion is ready for your next guided match.' } : { status: 'failed', message: `Fast training ended with code ${code ?? 'unknown'}.` }; });
      };
      server.middlewares.use('/api/training/human-guidance', (request, response, next) => {
        if (request.url !== '/' && request.url !== '') { next(); return; }
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
            startFastTraining();
            response.statusCode = 201;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ accepted: true }));
          } catch (error) {
            response.statusCode = 400;
            response.end(JSON.stringify({ accepted: false, error: error instanceof Error ? error.message : 'Invalid request' }));
          }
        });
      });
      server.middlewares.use('/api/training/human-guidance/status', (_request, response) => {
        const detail = existsSync(fastStatusPath) ? JSON.parse(readFileSync(fastStatusPath, 'utf8')) : null;
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ ...fastTraining, detail }));
      });
      server.middlewares.use('/api/training/champion', (_request, response) => {
        const championPath = resolve(trainingRoot, 'latest-champion.json');
        let fallbackChampion: unknown = null;
        if (!existsSync(championPath)) {
          const checkpointRoot = resolve(trainingRoot, 'checkpoints');
          const latestReport = existsSync(checkpointRoot)
            ? readdirSync(checkpointRoot)
              .map((name) => resolve(checkpointRoot, name, 'training-report.json'))
              .filter((path) => existsSync(path))
              .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0]
            : undefined;
          if (latestReport) {
            const report = JSON.parse(readFileSync(latestReport, 'utf8')) as { hallOfFame?: Array<{ strategy: unknown; eloAtAdmission: number }> };
            fallbackChampion = [...(report.hallOfFame ?? [])].sort((left, right) => right.eloAtAdmission - left.eloAtAdmission)[0]?.strategy ?? null;
          }
        }
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(existsSync(championPath) ? readFileSync(championPath, 'utf8') : JSON.stringify({ genome: fallbackChampion }));
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
