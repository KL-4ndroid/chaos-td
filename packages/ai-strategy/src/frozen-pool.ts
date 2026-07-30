import { createFromString, nextInt } from '@chaos-td/game-core';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { assertValidAIStrategyGenome, canonicalSerializeAIStrategyGenome, type AIStrategyGenome } from './strategy.js';

export type AISkillTier = 'Beginner' | 'Normal' | 'Advanced' | 'Elite';
export type AIArchetype = 'economic' | 'rush' | 'defensive' | 'counter-play' | 'adaptive';

export interface FrozenAIStrategy {
  readonly id: string;
  readonly displayName: string;
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly skillRating: number;
  readonly tier: AISkillTier;
  readonly archetype: AIArchetype;
  readonly genome: AIStrategyGenome;
  readonly behaviorFingerprint: string;
  readonly trainingRunId: string;
  readonly evaluationSummary: { readonly elo: number; readonly winRate: number; readonly invalidCommandRate: number };
  readonly finalValidationHash: string;
}

export interface FrozenStrategyPool { readonly schemaVersion: 1; readonly contentVersion: string; readonly strategies: readonly FrozenAIStrategy[]; }

export function validateFrozenStrategyPool(pool: FrozenStrategyPool, expectedContentVersion: string = CONFIG_VERSION): void {
  if (pool.schemaVersion !== 1 || pool.contentVersion !== expectedContentVersion) throw new Error('Incompatible frozen strategy pool');
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  for (const strategy of pool.strategies) {
    if (strategy.contentVersion !== expectedContentVersion || strategy.genome.compatibleContentVersion !== expectedContentVersion) throw new Error(`Incompatible frozen strategy: ${strategy.id}`);
    assertValidAIStrategyGenome(strategy.genome, expectedContentVersion);
    if (ids.has(strategy.id) || fingerprints.has(strategy.behaviorFingerprint)) throw new Error(`Duplicate frozen strategy: ${strategy.id}`);
    ids.add(strategy.id); fingerprints.add(strategy.behaviorFingerprint);
    if (strategy.behaviorFingerprint !== canonicalSerializeAIStrategyGenome(strategy.genome)) throw new Error(`Invalid behavior fingerprint: ${strategy.id}`);
    if (strategy.evaluationSummary.invalidCommandRate !== 0) throw new Error(`Unvalidated frozen strategy: ${strategy.id}`);
  }
}

export function selectOpponentStrategy(input: { readonly pool: FrozenStrategyPool; readonly matchSeed: string; readonly requestedTier: AISkillTier | 'Random'; readonly excludedRecentIds: readonly string[] }): FrozenAIStrategy {
  validateFrozenStrategyPool(input.pool);
  const excluded = new Set(input.excludedRecentIds);
  const byTier = input.pool.strategies.filter((strategy) => (input.requestedTier === 'Random' || strategy.tier === input.requestedTier) && !excluded.has(strategy.id));
  const candidates = byTier.length > 0 ? byTier : input.pool.strategies.filter((strategy) => input.requestedTier === 'Random' || strategy.tier === input.requestedTier);
  if (candidates.length === 0) throw new Error('No eligible frozen strategy');
  const sorted = [...candidates].sort((left, right) => left.id.localeCompare(right.id));
  return sorted[nextInt(createFromString(`opponent:${input.matchSeed}`), 0, sorted.length - 1).value] ?? (() => { throw new Error('Missing selected strategy'); })();
}
