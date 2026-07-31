import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import {
  runEvolutionTraining,
  validateTrainingRunReport,
  writeCheckpoint,
  parseTrainingReport,
  verifyCheckpoint,
  serializeTrainingReport,
  summarizeTrainingRun,
  renderTrainingSummaryMarkdown,
} from './index';

const projectRoot = resolve(__dirname, '..', '..', '..');

function outputPath(...parts: string[]): string {
  return resolve(projectRoot, ...parts);
}

describe('AI trainer end-to-end smoke', () => {
  it('runs the deterministic trainer and persists checkpoint + reports under reports/ai/latest/', () => {
    const config = {
      populationSize: 6,
      generations: 1,
      matchesPerGenome: 1,
      eliteCount: 1,
      hallOfFameOpponentCount: 2,
      mutationRatePermille: 200,
      crossoverRatePermille: 600,
      evaluationSeeds: ['smoke-eval-1', 'smoke-eval-2'],
      trainingSeed: 'smoke-trainer-seed',
      maxTicksPerMatch: 120,
      contentVersion: CONFIG_VERSION,
      canonicalTag: 'trainer-smoke',
    };

    const report = runEvolutionTraining(config);
    expect(report.matchCount).toBeGreaterThan(0);
    const issues = validateTrainingRunReport(report);
    expect(issues).toEqual([]);

    const reportFile = outputPath('reports', 'ai', 'latest', 'training-report.json');
    const snapshotFile = outputPath('reports', 'ai', 'latest', 'training-checkpoint.json');
    const matchesFile = outputPath('reports', 'ai', 'latest', 'training-matches.jsonl');
    const summaryFile = outputPath('reports', 'ai', 'latest', 'training-summary.md');
    const hallOfFameFile = outputPath('data', 'ai', 'frozen', 'strategy-pool-candidate.json');

    for (const file of [reportFile, snapshotFile, matchesFile, summaryFile, hallOfFameFile]) {
      mkdirSync(dirname(file), { recursive: true });
    }
    writeFileSync(reportFile, serializeTrainingReport(report), 'utf8');
    writeCheckpoint({ reportFile, snapshotFile }, report);
    writeFileSync(
      matchesFile,
      report.generations.flatMap((gen) => gen.matchRecords).map((record) => JSON.stringify(record)).join('\n') + '\n',
      'utf8',
    );
    writeFileSync(
      hallOfFameFile,
      JSON.stringify({
        schemaVersion: 1,
        contentVersion: report.contentVersion,
        strategies: report.hallOfFame.map((entry) => ({
          id: entry.strategy.strategyId,
          displayName: entry.strategy.strategyId,
          schemaVersion: 1,
          contentVersion: report.contentVersion,
          skillRating: Math.round(entry.eloAtAdmission),
          tier: entry.eloAtAdmission >= 1700 ? 'Advanced' : 'Normal',
          archetype: 'adaptive',
          genome: entry.strategy,
          behaviorFingerprint: entry.behaviorFingerprint,
          trainingRunId: report.trainingRunId,
          evaluationSummary: { elo: entry.eloAtAdmission, winRate: 0.5, invalidCommandRate: 0 },
          finalValidationHash: report.finalCanonicalHash,
        })),
      }, null, 2),
      'utf8',
    );
    writeFileSync(summaryFile, renderTrainingSummaryMarkdown(summarizeTrainingRun(report)), 'utf8');

    const verifyResult = verifyCheckpoint(JSON.parse(JSON.stringify({
      schemaVersion: 1,
      format: 'trainer-snapshot',
      contentVersion: report.contentVersion,
      trainingRunId: report.trainingRunId,
      nextGeneration: report.generations.length,
      config: report.config,
      hallOfFame: report.hallOfFame,
      completedGenerations: report.generations,
      canonicalHash: report.finalCanonicalHash,
    })));
    expect(verifyResult.valid).toBe(true);

    const parsedReport = parseTrainingReport(JSON.stringify(report));
    expect(parsedReport.finalCanonicalHash).toBe(report.finalCanonicalHash);
  });
});
