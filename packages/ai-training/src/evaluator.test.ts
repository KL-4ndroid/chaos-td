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
  readonly telemetry?: NonNullable<MatchRecord['telemetry']>;
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
    participantAId: args.summary.p1StrategyId,
    participantBId: args.summary.p2StrategyId,
    p1StrategyId: args.summary.p1StrategyId,
    p2StrategyId: args.summary.p2StrategyId,
    mirrored: args.mirrored ?? false,
    canonicalMatchKey: `pair:${args.summary.p1StrategyId}:${args.summary.p2StrategyId}`,
    summary: { ...baseSummary, ...args.summary } as MatchRecord['summary'],
    telemetry: args.telemetry,
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
      strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 500, elo: 1500, initialElo: 1500,
    }, 'seed-A');
    const replay = evaluateGenome(genome, {
      strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 500, elo: 1500, initialElo: 1500,
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
      strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 0, elo: 1500, initialElo: 1500,
    }, 'seed-C');
    expect(evaluation.wins).toBe(1);
    expect(evaluation.losses).toBe(1);
    expect(evaluation.mirroredWins).toBe(0);
    expect(evaluation.mirroredLosses).toBe(1);
  });

  it('computes Elo deterministically from outcomes without random jitter', () => {
    const expectedWin = 1000 + 32 * (1 - (1 / (1 + 10 ** ((1000 - 1000) / 400))));
    const expectedLoss = 1000 + 32 * (0 - (1 / (1 + 10 ** ((1000 - 1000) / 400))));
    expect(updateEloFromGenomes(1000, 1, 0, 0, 'seed-elo')).toBeCloseTo(expectedWin, 3);
    expect(updateEloFromGenomes(1000, 0, 1, 0, 'seed-elo')).toBeCloseTo(expectedLoss, 3);
    expect(updateEloFromGenomes(1000, 0, 0, 1, 'seed-elo')).toBe(1000);
    expect(updateEloFromGenomes(1000, 1, 0, 0, 'different-seed')).toBe(updateEloFromGenomes(1000, 1, 0, 0, 'seed-elo'));
  });

  it('attributes mirrored p2 results and command telemetry to the genome slot only', () => {
    const genome = createDefaultAIStrategyGenome('genome-P2');
    const record = fakeRecord({
      mirrored: true,
      summary: {
        p1StrategyId: 'opponent',
        p2StrategyId: 'genome-P2',
        outcome: 'win',
        winnerId: 'p2',
        acceptedCommands: 9,
        rejectedCommands: 3,
      },
    });
    const evaluation = evaluateGenome(genome, {
      strategyId: genome.strategyId, generation: 0, records: [record], behaviorDiversity: 0, elo: 1000, initialElo: 1000,
    }, 'seed-P2');
    expect(evaluation.wins).toBe(1);
    expect(evaluation.losses).toBe(0);
    expect(evaluation.mirroredWins).toBe(1);
    expect(evaluation.acceptedCommands).toBe(0);
    expect(evaluation.rejectedCommands).toBe(0);
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

  it('regression: Elo must have no random jitter (same input same output regardless of seed)', () => {
    const genome = createDefaultAIStrategyGenome('genome-E');
    const records: MatchRecord[] = [
      fakeRecord({ summary: { p1StrategyId: 'genome-E', p2StrategyId: 'genome-F', outcome: 'win', winnerId: 'p1' } }),
      fakeRecord({ summary: { p1StrategyId: 'genome-E', p2StrategyId: 'genome-F', outcome: 'win', winnerId: 'p1' } }),
    ];
    const eval1 = evaluateGenome(genome, { strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 0, elo: 1000, initialElo: 1000 }, 'seed-x');
    const eval2 = evaluateGenome(genome, { strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 0, elo: 1000, initialElo: 1000 }, 'seed-y');
    expect(eval1.evaluation.elo).toBe(eval2.evaluation.elo);
  });

  it('regression: accepted/rejected commands must be per-genome, not per-game total', () => {
    const genome = createDefaultAIStrategyGenome('genome-G');
    const records: MatchRecord[] = [
      fakeRecord({
        summary: { p1StrategyId: 'genome-G', p2StrategyId: 'genome-H', outcome: 'win', winnerId: 'p1', acceptedCommands: 20, rejectedCommands: 5 },
        telemetry: {
          commandAcceptedPerPlayer: { p1: 20, p2: 0 },
          commandRejectedPerPlayer: { p1: 5, p2: 0 },
        } as NonNullable<MatchRecord['telemetry']>,
      }),
    ];
    const evaluation = evaluateGenome(genome, { strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 0, elo: 1000, initialElo: 1000 }, 'seed-g');
    // Genome-G is p1, so it should see 20 accepted and 5 rejected commands
    expect(evaluation.acceptedCommands).toBe(20);
    expect(evaluation.rejectedCommands).toBe(5);
  });

  it('regression: mirror match p2 genome must also be correctly counted', () => {
    const genome = createDefaultAIStrategyGenome('genome-P2');
    // Genome-P2 is p2 in a mirrored match
    const records: MatchRecord[] = [
      fakeRecord({
        mirrored: true,
        summary: { p1StrategyId: 'opponent', p2StrategyId: 'genome-P2', outcome: 'win', winnerId: 'p2', acceptedCommands: 15, rejectedCommands: 2 },
      }),
    ];
    const evaluation = evaluateGenome(genome, { strategyId: genome.strategyId, generation: 0, records, behaviorDiversity: 0, elo: 1000, initialElo: 1000 }, 'seed-p2');
    expect(evaluation.wins).toBe(1);
    expect(evaluation.mirroredWins).toBe(1);
  });
});
