import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { canonicalSerializeAIStrategyGenome, validateAIStrategyGenome } from '@chaos-td/ai-strategy';
import {
  createGenerationSchedule,
  createInitialPopulation,
  getInitialPopulationArchetypes,
  participantPolicySeed,
} from './index.js';

function populationFingerprint(genome: ReturnType<typeof createInitialPopulation>[number]): string {
  return canonicalSerializeAIStrategyGenome({ ...genome, strategyId: 'normalized', strategyVersion: 1 });
}

describe('deterministic evolutionary population and schedule', () => {
  it('creates valid, diverse, exact-size populations for a seed', () => {
    const population = createInitialPopulation({ size: 16, seed: 'population-seed', contentVersion: CONFIG_VERSION });
    expect(population).toHaveLength(16);
    expect(new Set(population.map((genome) => genome.strategyId)).size).toBe(16);
    expect(population.every((genome) => validateAIStrategyGenome(genome).ok)).toBe(true);
    expect(new Set(population.map(populationFingerprint)).size).toBeGreaterThanOrEqual(13);
  });

  it('uses all required archetype templates and deterministic variation', () => {
    const first = createInitialPopulation({ size: 15, seed: 'population-seed', contentVersion: CONFIG_VERSION });
    const second = createInitialPopulation({ size: 15, seed: 'population-seed', contentVersion: CONFIG_VERSION });
    const different = createInitialPopulation({ size: 15, seed: 'other-seed', contentVersion: CONFIG_VERSION });
    expect(first).toEqual(second);
    expect(first).not.toEqual(different);
    expect(getInitialPopulationArchetypes()).toHaveLength(5);
    expect(new Set(first.map((genome) => `${genome.economyWeight}:${genome.aggressionWeight}:${genome.defenseWeight}:${genome.counterOpponentWeight}`)).size).toBeGreaterThan(5);
  });

  it('uses dynamic opponents and matches per opponent with balanced pair counts', () => {
    const population = createInitialPopulation({ size: 16, seed: 'fair-schedule', contentVersion: CONFIG_VERSION });
    const schedule = createGenerationSchedule({ population, generation: 0, trainingSeed: 'training', evaluationSeeds: ['eval-a', 'eval-b'], opponentsPerGenome: 2, matchesPerOpponent: 3 });
    const originals = schedule.filter((match) => !match.mirrored);
    expect(originals.length).toBeGreaterThan(0);
    expect(schedule.length).toBe(48);
    const counts = new Map(population.map((genome) => [genome.strategyId, 0]));
    for (const match of originals) {
      counts.set(match.participantAId, (counts.get(match.participantAId) ?? 0) + 1);
      counts.set(match.participantBId, (counts.get(match.participantBId) ?? 0) + 1);
    }
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(new Set(schedule.map((match) => match.pairId.split(':m')[0])).size).toBe(16);
    expect(originals.every((match) => match.participantAId !== match.participantBId)).toBe(true);
  });

  it('is invariant to population array order and emits exactly one original/mirror per pair', () => {
    const population = createInitialPopulation({ size: 10, seed: 'order-schedule', contentVersion: CONFIG_VERSION });
    const config = { population, generation: 2, trainingSeed: 'training', evaluationSeeds: ['eval-a', 'eval-b'], opponentsPerGenome: 2, matchesPerOpponent: 3 };
    const first = createGenerationSchedule(config);
    const second = createGenerationSchedule({ ...config, population: [...population].reverse() });
    const key = (match: (typeof first)[number]) => `${match.pairId}:${match.seed}:${match.participantAId}:${match.participantBId}:${match.mirrored ? 'mirror' : 'original'}`;
    expect(first.map(key)).toEqual(second.map(key));
    const pairIds = [...new Set(first.map((match) => match.pairId))];
    for (const pairId of pairIds) {
      const pair = first.filter((match) => match.pairId === pairId);
      expect(pair).toHaveLength(1);
    }
  });

  it('creates canonical mirror pairs with equal simulation seeds and slot-neutral participant streams', () => {
    const population = createInitialPopulation({ size: 6, seed: 'schedule-seed', contentVersion: CONFIG_VERSION });
    const schedule = createGenerationSchedule({ population, generation: 0, trainingSeed: 'training', evaluationSeeds: ['eval-a', 'eval-b'], opponentsPerGenome: 1, matchesPerOpponent: 3 });
    expect(schedule).toHaveLength(9);
    expect(schedule.filter((match) => match.mirrored)).toHaveLength(3);
    const keys = schedule.map((match) => `${match.pairId}:${match.seed}:${match.mirrored ? '1' : '0'}`);
    expect(keys).toEqual([...keys].sort((left, right) => left.localeCompare(right)));
  });
});
