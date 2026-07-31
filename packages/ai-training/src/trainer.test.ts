import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import {
  runEvolutionTraining,
  summarizeTrainingRun,
  type TrainerConfig,
  type TrainingRunReport,
} from './trainer';
import { validateTrainingRunReport, hashTrainingRunReport } from './validation';

function baseConfig(overrides: Partial<TrainerConfig> = {}): TrainerConfig {
  return {
    populationSize: 8,
    generations: 1,
    matchesPerGenome: 1,
    eliteCount: 2,
    hallOfFameOpponentCount: 3,
    mutationRatePermille: 200,
    crossoverRatePermille: 600,
    evaluationSeeds: ['eval-1', 'eval-2'],
    trainingSeed: 'seed-trainer-test',
    maxTicksPerMatch: 120,
    contentVersion: CONFIG_VERSION,
    canonicalTag: 'trainer-test',
    ...overrides,
  };
}

describe('deterministic evolutionary AI trainer', () => {
  it('produces the same report for the same config across repeated runs', () => {
    const config = baseConfig();
    const first = runEvolutionTraining(config);
    const second = runEvolutionTraining(config);
    expect(first.finalCanonicalHash).toBe(second.finalCanonicalHash);
    expect(first.matchCount).toBe(second.matchCount);
    expect(first.generations).toHaveLength(second.generations.length);
    expect(first.hallOfFame).toHaveLength(second.hallOfFame.length);
  });

  it('admits reliable candidates into the hall of fame and respects capacity', () => {
    const report = runEvolutionTraining(baseConfig({ hallOfFameOpponentCount: 2, generations: 2, populationSize: 8 }));
    expect(report.hallOfFame.length).toBeLessThanOrEqual(2 * (report.generations.length));
    for (const entry of report.hallOfFame) {
      expect(entry.eloAtAdmission).toBeGreaterThan(0);
      expect(entry.strategy.compatibleContentVersion).toBe(CONFIG_VERSION);
    }
  });

  it('reports a stable final canonical hash that survives re-serialization', () => {
    const report = runEvolutionTraining(baseConfig());
    const recomputed = hashTrainingRunReport(report);
    expect(recomputed).toBe(report.finalCanonicalHash);
  });

  it('builds a report that the validator accepts with zero issues', () => {
    const report: TrainingRunReport = runEvolutionTraining(baseConfig());
    const issues = validateTrainingRunReport(report);
    expect(issues).toEqual([]);
  });

  it('summarizes the run with deterministic best-Elo and average final tick', () => {
    const report = runEvolutionTraining(baseConfig());
    const summary = summarizeTrainingRun(report);
    expect(summary.generationsCompleted).toBe(report.generations.length);
    expect(summary.totalMatches).toBe(report.matchCount);
    expect(summary.bestEloStrategyId.length).toBeGreaterThan(0);
    expect(summary.bestEloGeneration).toBeGreaterThanOrEqual(0);
  });

  it('does not execute a generation when generations is zero', () => {
    const report = runEvolutionTraining(baseConfig({ generations: 0 }));
    expect(report.generations).toHaveLength(0);
  });
});
