import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'npm run build --workspace=@chaos-td/game-data && npm run build --workspace=@chaos-td/game-core && npx vitest run --config vitest.balance.config.ts --no-file-parallelism' : 'npm run build --workspace=@chaos-td/game-data && npm run build --workspace=@chaos-td/game-core && npx vitest run --config vitest.balance.config.ts --no-file-parallelism';
const result = spawnSync(command, {
  env: { ...process.env, BALANCE_MODE: 'full' },
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
