import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { canonicalSerializeAIStrategyGenome, createDefaultAIStrategyGenome } from './strategy';
import { selectOpponentStrategy, validateFrozenStrategyPool, type FrozenStrategyPool } from './frozen-pool';

function entry(id: string, tier: 'Normal' | 'Advanced' = 'Normal') {
  const genome = createDefaultAIStrategyGenome(id);
  return { id, displayName: id, schemaVersion: 1, contentVersion: CONFIG_VERSION, skillRating: 1200, tier, archetype: 'adaptive' as const, genome, behaviorFingerprint: canonicalSerializeAIStrategyGenome(genome), trainingRunId: 'smoke', evaluationSummary: { elo: 1200, winRate: 0.5, invalidCommandRate: 0 }, finalValidationHash: 'hash' };
}

const pool: FrozenStrategyPool = { schemaVersion: 1, contentVersion: CONFIG_VERSION, strategies: [entry('normal-a'), entry('normal-b'), entry('advanced', 'Advanced')] };

describe('frozen opponent pool', () => {
  it('loads validated strategies and selects reproducibly without player slot input', () => {
    validateFrozenStrategyPool(pool);
    const input = { pool, matchSeed: 'seed-1', requestedTier: 'Normal' as const, excludedRecentIds: [] };
    expect(selectOpponentStrategy(input)).toEqual(selectOpponentStrategy(input));
    expect(selectOpponentStrategy({ ...input, excludedRecentIds: ['normal-a'] }).id).toBe('normal-b');
  });

  it('rejects duplicate or unvalidated frozen entries', () => {
    expect(() => validateFrozenStrategyPool({ ...pool, strategies: [entry('duplicate'), entry('duplicate')] })).toThrow('Duplicate');
    expect(() => validateFrozenStrategyPool({ ...pool, strategies: [{ ...entry('bad'), evaluationSummary: { elo: 1200, winRate: 0.5, invalidCommandRate: 0.1 } }] })).toThrow('Unvalidated');
  });
});
