import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import {
  aggregateTelemetryForRun,
  renderHallOfFameJson,
  renderTrainingSummaryMarkdown,
  summarizeGeneration,
  summarizeHallOfFame,
  summarizeTrainingRun,
} from './report';
import { runEvolutionTraining, type TrainerConfig } from './trainer';

function config(overrides: Partial<TrainerConfig> = {}): TrainerConfig {
  return {
    populationSize: 6,
    generations: 1,
    matchesPerGenome: 1,
    eliteCount: 1,
    hallOfFameOpponentCount: 2,
    mutationRatePermille: 200,
    crossoverRatePermille: 600,
    evaluationSeeds: ['seed-1', 'seed-2'],
    trainingSeed: 'seed-report',
    maxTicksPerMatch: 120,
    contentVersion: CONFIG_VERSION,
    canonicalTag: 'report-test',
    ...overrides,
  };
}

describe('training report generator', () => {
  it('renders Markdown with per-generation stats', () => {
    const report = runEvolutionTraining(config());
    const summary = summarizeTrainingRun(report);
    const md = renderTrainingSummaryMarkdown(summary);
    expect(md).toContain('# AI Training Run');
    expect(md).toContain('Per-generation');
    expect(md).toContain('Best Elo');
    expect(md).toContain(summary.trainingRunId);
  });

  it('summarizes the hall of fame with deterministic Elo and tier inference', () => {
    const report = runEvolutionTraining(config());
    const hof = summarizeHallOfFame(report);
    const json = renderHallOfFameJson(hof);
    expect(JSON.parse(json)).toEqual(hof);
    for (const entry of hof) {
      expect(['Beginner', 'Normal', 'Advanced', 'Elite']).toContain(entry.tier);
    }
  });

  it('aggregates telemetry across all generations', () => {
    const report = runEvolutionTraining(config());
    const aggregate = aggregateTelemetryForRun(report);
    expect(aggregate.total).toBe(report.generations.flatMap((g) => g.telemetry).length);
    expect(aggregate.chronologicalEventRatio).toBeGreaterThanOrEqual(0);
    expect(aggregate.chronologicalEventRatio).toBeLessThanOrEqual(1);
  });

  it('summarizes a single generation with a deterministic evaluation table', () => {
    const report = runEvolutionTraining(config());
    const generation = report.generations[0];
    if (!generation) throw new Error('expected at least one generation');
    const summary = summarizeGeneration(generation);
    expect(summary.evaluated.length).toBe(generation.evaluated.length);
    expect(summary.matchCount).toBe(generation.matchRecords.length);
    const sorted = [...summary.evaluated].sort((a, b) => a.strategyId.localeCompare(b.strategyId));
    expect(sorted).toEqual(summary.evaluated);
  });
});
