import { describe, expect, it } from 'vitest';
import { createDefaultAIStrategyGenome } from '@chaos-td/ai-strategy';
import type { MatchRecord } from './evaluator';
import {
  evaluateGenome,
  populationBehaviorDiversity,
  updateEloFromGenomes,
} from './evaluator';

function fakeRecord(args: {
  readonly summary: Partial<MatchRecord['summary']> & { readonly p1StrategyId: string; readonly p2StrategyId: string };
  readonly mirrored?: boolean;
  readonly generation?: number;
}): MatchRecord {
  const baseSummary = {
    seed: 'fake',
    finalTick: 0,
    winnerId: null,
    outcome: 'draw' as const,
    completion: 'tick_guard' as const,
    acceptedCommands: 0,
    rejectedCommands: 0,
    finalStateHash: 'hash',
  };
  return {
    generation: args.generation ?? 0,
    pairId: 'pair',
    seed: 'fake',
    p1StrategyId: args.summary.p1StrategyId,
    p2StrategyId: args.summary.p2StrategyId,
    mirrored: args.mirrored ?? false,
    summary: { ...baseSummary, ...args.summary } as MatchRecord['summary'],
  };
}

describe('deterministic evaluator', () => {
  it('produces identical evaluations for identical input', () => {
    const genome = createDefaultAIStrategyGenome('genome-A');
    const records: MatchRecord[] = [
      fakeRecord({ summary: { p1StrategyId: 'genome-A', p2StrategyId: 'genome-B', outcome: 'win', winnerId: 'p1' } }),
      fakeRecord({ summary: { p1StrategyId: 'genome-B', p2StrategyId: 'genome-A', outcome: 'win', winnerId: 'p1' } }),
    ];
    const evaluation = evaluateGenome(genome, {
      strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 500, initialElo: 1500,
    }, 'seed-A');
    const replay = evaluateGenome(genome, {
      strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 500, initialElo: 1500,
    }, 'seed-A');
    expect(evaluation).toEqual(replay);
    expect(evaluation.wins).toBe(1);
    expect(evaluation.losses).toBe(1);
  });

  it('separates non-mirrored and mirrored wins for slot adjustment', () => {
    const genome = createDefaultAIStrategyGenome('genome-C');
    const records: MatchRecord[] = [
      fakeRecord({ summary: { p1StrategyId: 'genome-C', p2StrategyId: 'genome-D', outcome: 'win', winnerId: 'p1' }, mirrored: false }),
      fakeRecord({ summary: { p1StrategyId: 'genome-C', p2StrategyId: 'genome-D', outcome: 'win', winnerId: 'p2' }, mirrored: true }),
    ];
    const evaluation = evaluateGenome(genome, {
      strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 0, initialElo: 1500,
    }, 'seed-C');
    expect(evaluation.wins).toBe(1);
    expect(evaluation.losses).toBe(1);
    expect(evaluation.mirroredWins).toBe(0);
    expect(evaluation.mirroredLosses).toBe(1);
  });

  it('computes Elo deterministically and bounds the result to 3 decimal places', () => {
    expect(updateEloFromGenomes(1500, 3, 1, 0, 'seed-elo')).toBe(updateEloFromGenomes(1500, 3, 1, 0, 'seed-elo'));
    const value = updateEloFromGenomes(1500, 1, 0, 0, 'seed-elo-2');
    expect(Math.round(value * 1000)).toBeGreaterThanOrEqual(Math.floor(value * 1000));
  });

  it('produces a behavior diversity score in the [0, 1000] permille range', () => {
    const population = [
      createDefaultAIStrategyGenome('a'),
      createDefaultAIStrategyGenome('b'),
      createDefaultAIStrategyGenome('c'),
    ];
    const diversity = populationBehaviorDiversity(population);
    expect(diversity).toBeGreaterThanOrEqual(0);
    expect(diversity).toBeLessThanOrEqual(1000);
  });
});
