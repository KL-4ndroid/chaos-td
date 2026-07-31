import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { runEvolutionTraining, type TrainerConfig } from './trainer';
import {
  buildCheckpoint,
  parseTrainingReport,
  readCheckpoint,
  resumeTraining,
  serializeTrainingReport,
  verifyCheckpoint,
  writeCheckpoint,
} from './checkpoint';
import { hashTrainingRunReport, validateTrainingRunReport } from './validation';

function config(overrides: Partial<TrainerConfig> = {}): TrainerConfig {
  return {
    populationSize: 6,
    generations: 1,
    matchesPerGenome: 1,
    eliteCount: 1,
    hallOfFameOpponentCount: 2,
    mutationRatePermille: 200,
    crossoverRatePermille: 600,
    evaluationSeeds: ['seed-a', 'seed-b'],
    trainingSeed: 'seed-checkpoint',
    maxTicksPerMatch: 120,
    contentVersion: CONFIG_VERSION,
    canonicalTag: 'checkpoint-test',
    ...overrides,
  };
}

describe('training checkpoint and resume', () => {
  it('round-trips a report through serialization', () => {
    const report = runEvolutionTraining(config());
    const serialized = serializeTrainingReport(report);
    const parsed = parseTrainingReport(serialized);
    expect(parsed.finalCanonicalHash).toBe(report.finalCanonicalHash);
    expect(parsed.generations.length).toBe(report.generations.length);
  });

  it('builds a checkpoint that verifies successfully', () => {
    const report = runEvolutionTraining(config());
    const built = buildCheckpoint(report);
    expect(built.issues).toEqual([]);
    const verification = verifyCheckpoint(built.snapshot);
    expect(verification.valid).toBe(true);
  });

  it('writes and reads a checkpoint via the Node fs path', () => {
    const report = runEvolutionTraining(config());
    const tmp = mkdtempSync(join(tmpdir(), 'ai-training-'));
    try {
      const reportPath = join(tmp, 'report.json');
      const snapshotPath = join(tmp, 'snapshot.json');
      const built = writeCheckpoint({ reportFile: reportPath, snapshotFile: snapshotPath }, report);
      expect(existsSync(reportPath)).toBe(true);
      expect(existsSync(snapshotPath)).toBe(true);
      const reloaded = readCheckpoint({ reportFile: reportPath, snapshotFile: snapshotPath });
      expect(reloaded.canonicalHash).toBe(built.snapshot.canonicalHash);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('verifies a snapshot written to disk and loaded back via JSON parse', () => {
    const report = runEvolutionTraining(config());
    const built = buildCheckpoint(report);
    const tmp = mkdtempSync(join(tmpdir(), 'ai-training-verify-'));
    try {
      const snapshotPath = join(tmp, 'snapshot.json');
      writeFileSync(snapshotPath, JSON.stringify(built.snapshot), 'utf8');
      const loaded = JSON.parse(readFileSync(snapshotPath, 'utf8'));
      const verification = verifyCheckpoint(loaded);
      expect(verification.valid).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('resumes a partial training run to completion', () => {
    const fullConfig = config({ generations: 2, trainingSeed: 'resume-seed' });
    const fullReport = runEvolutionTraining(fullConfig);
    const halfConfig = config({ generations: 1, trainingSeed: 'resume-seed' });
    const halfReport = runEvolutionTraining(halfConfig);
    const built = buildCheckpoint(halfReport);
    const resumed = resumeTraining(fullConfig, built.snapshot);
    expect(resumed.generations.length).toBe(fullReport.generations.length);
    expect(hashTrainingRunReport(resumed)).toBe(resumed.finalCanonicalHash);
    expect(validateTrainingRunReport(resumed)).toEqual([]);
  });
});
