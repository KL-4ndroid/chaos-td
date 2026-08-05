import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import {
  parseTrainingReport,
  runEvolutionTraining,
  serializeTrainingReport,
  validateTrainingRunReport,
  writeCheckpoint,
  checkPoolCompatibility,
} from './index';

const projectRoot = resolve(__dirname, '..', '..', '..');
const trainingReportFile = resolve(projectRoot, 'reports', 'ai', 'latest', 'training-report.json');
const snapshotFile = resolve(projectRoot, 'reports', 'ai', 'latest', 'training-checkpoint.json');
const poolFile = resolve(projectRoot, 'data', 'ai', 'frozen', 'strategy-pool-smoke-v1.json');

function ensureTrainingReport(): void {
  if (existsSync(trainingReportFile)) return;
  mkdirSync(dirname(trainingReportFile), { recursive: true });
  const report = runEvolutionTraining({
    populationSize: 6,
    generations: 1,
    matchesPerGenome: 1,
    eliteCount: 1,
    hallOfFameOpponentCount: 2,
    mutationRatePermille: 200,
    crossoverRatePermille: 600,
    evaluationSeeds: ['validate-eval-1', 'validate-eval-2'],
    trainingSeed: 'validate-seed',
    maxTicksPerMatch: 120,
    contentVersion: CONFIG_VERSION,
    canonicalTag: 'trainer-validate',
  });
  writeFileSync(trainingReportFile, serializeTrainingReport(report), 'utf8');
  writeCheckpoint({ reportFile: trainingReportFile, snapshotFile }, report);
}

describe('AI trainer post-run validation', () => {
  it('validates the most recent training report and the smoke pool', () => {
    ensureTrainingReport();
    const report = parseTrainingReport(readFileSync(trainingReportFile, 'utf8'));
    const issues = validateTrainingRunReport(report);
    expect(issues).toEqual([]);

    if (existsSync(poolFile)) {
      const pool = JSON.parse(readFileSync(poolFile, 'utf8'));
      const compatibility = checkPoolCompatibility(pool);
      expect(['compatible', 'requires_retraining', 'requires_reevaluation']).toContain(compatibility.overallResult);
    }
  });
});
