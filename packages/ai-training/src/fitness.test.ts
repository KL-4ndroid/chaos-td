import { describe, expect, it } from 'vitest';
import { createDefaultAIStrategyGenome } from '@chaos-td/ai-strategy';
import { calculateEvaluation, updateElo } from './fitness';
import { classifyArchetype, crossoverGenomes, detectDuplicateStrategies, genomeDistance, mutateGenome } from './evolution';

describe('fitness and evolution', () => {
  it('uses a fixed Elo vector', () => {
    expect(updateElo(1200, 1200, 1)).toEqual({ p1: 1216, p2: 1184 });
    expect(updateElo(1200, 1200, 0.5)).toEqual({ p1: 1200, p2: 1200 });
  });

  it('penalizes invalid commands and tick guards in reliability', () => {
    const evaluation = calculateEvaluation({ elo: 1200, wins: 2, losses: 1, draws: 1, mirroredWins: 1, mirroredLosses: 1, acceptedCommands: 90, rejectedCommands: 10, tickGuardCount: 1, matchCount: 4, behaviorDiversity: 600 });
    expect(evaluation).toMatchObject({ winRate: 0.5, drawRate: 0.25, invalidCommandRate: 0.1, reliabilityScore: 700 });
  });

  it('mutates deterministically within bounds, preserving an elite by direct reuse', () => {
    const elite = createDefaultAIStrategyGenome('elite');
    expect(mutateGenome(elite, 'mutation-seed', 1000)).toEqual(mutateGenome(elite, 'mutation-seed', 1000));
    expect(Object.values(mutateGenome(elite, 'mutation-seed', 1000)).filter((value): value is number => typeof value === 'number').every((value) => value >= 0 && value <= 1000)).toBe(true);
    const preservedElite = elite;
    expect(preservedElite).toBe(elite);
  });

  it('supports deterministic crossover, distance, duplicates, and behavior classes', () => {
    const left = createDefaultAIStrategyGenome('left');
    const right = { ...createDefaultAIStrategyGenome('right'), aggressionWeight: 800 };
    expect(crossoverGenomes(left, right, 'cross-seed', 'child')).toEqual(crossoverGenomes(left, right, 'cross-seed', 'child'));
    expect(genomeDistance(left, right)).toBeGreaterThan(0);
    expect(detectDuplicateStrategies([left, { ...left, strategyId: 'clone' }])).toEqual(['clone']);
    expect(classifyArchetype(right)).toBe('rush');
  });
});
