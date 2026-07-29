import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gameData = await import(pathToFileURL(resolve(rootDir, 'packages/game-data/dist/index.js')).href);
const monsters = [...gameData.MONSTER_DEFINITIONS, ...gameData.WAVE_MONSTER_DEFINITIONS.values()];
const rows = gameData.getCounterMatrixRows(gameData.TOWER_DEFINITIONS, monsters);
const towerHeaders = gameData.TOWER_DEFINITIONS.map((tower) => tower.displayName);
const markdown = [
  '# Counter Matrix',
  '',
  '> Generated from `@chaos-td/game-data` by `npm run docs:generate-counter-matrix`. Do not edit manually.',
  '',
  `| Monster | Movement | Tags | ${towerHeaders.join(' | ')} | Effective Counter |`,
  `| --- | --- | --- | ${towerHeaders.map(() => '---').join(' | ')} | --- |`,
  ...rows.map((row) => [
    row.monsterId,
    row.movementType,
    row.tags.length === 0 ? '-' : row.tags.join(', '),
    ...gameData.TOWER_DEFINITIONS.map((tower) => row.counters[tower.id] ? 'Yes' : '-'),
    row.effectiveCounters.join(', '),
  ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')),
  '',
].join('\n');
const outputPath = resolve(rootDir, 'docs/generated/COUNTER_MATRIX.md');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, markdown);
