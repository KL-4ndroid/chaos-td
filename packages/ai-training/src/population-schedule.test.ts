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

  it('creates canonical mirror pairs with equal simulation seeds and slot-neutral participant streams', () => {
    const population = createInitialPopulation({ size: 6, seed: 'schedule-seed', contentVersion: CONFIG_VERSION });
    const schedule = createGenerationSchedule({ population, generation: 0, trainingSeed: 'training', evaluationSeeds: ['eval-a', 'eval-b'], matchesPerGenome: 1 });
    expect(schedule).toHaveLength(12);
    for (let index = 0; index < schedule.length; index += 2) {
      const original = schedule[index];
      const mirror = schedule[index + 1];
      if (!original || !mirror) throw new Error('Expected mirror pair');
      expect(original.pairId).toBe(mirror.pairId);
      expect(original.seed).toBe(mirror.seed);
      expect(original.mirrored).toBe(false);
      expect(mirror.mirrored).toBe(true);
      expect(participantPolicySeed(original, original.participantAId, 20)).toBe(participantPolicySeed(mirror, original.participantAId, 20));
    }
    const keys = schedule.map((match) => `${match.pairId}:${match.seed}:${match.mirrored ? '1' : '0'}`);
    expect(keys).toEqual([...keys].sort((left, right) => left.localeCompare(right)));
  });
});
