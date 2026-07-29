import { spawnSync } from 'node:child_process';

const command = 'npx vitest run --config vitest.balance.config.ts --no-file-parallelism';
const result = spawnSync(command, {
  env: { ...process.env, BALANCE_MODE: 'smoke' },
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
