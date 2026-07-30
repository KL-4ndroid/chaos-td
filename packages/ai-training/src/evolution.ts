import { createFromString, nextInt } from '@chaos-td/game-core';
import { assertValidAIStrategyGenome, canonicalSerializeAIStrategyGenome, type AIStrategyGenome } from '@chaos-td/ai-strategy';

const MUTABLE_FIELDS = [
  'economyWeight', 'defenseWeight', 'aggressionWeight', 'buildThreshold', 'upgradeThreshold', 'sellThreshold',
  'emergencyDefenseThreshold', 'reserveGoldRatio', 'incomeInvestmentRatio', 'sendInvestmentRatio', 'antiAirPriority',
  'splashPriority', 'slowPriority', 'antiBossPriority', 'pressureTimingWeight', 'counterOpponentWeight', 'diversityPreference',
] as const;

type MutableField = typeof MUTABLE_FIELDS[number];

function clamp(value: number): number {
  return Math.max(0, Math.min(1000, value));
}

export function mutateGenome(genome: AIStrategyGenome, seed: string, mutationRate: number): AIStrategyGenome {
  const rng = createFromString(seed);
  const mutated: Record<MutableField, number> = {} as Record<MutableField, number>;
  for (const field of MUTABLE_FIELDS) {
    const shouldMutate = nextInt(rng, 0, 999).value < mutationRate;
    const delta = shouldMutate ? nextInt(rng, -100, 100).value : 0;
    mutated[field] = clamp(genome[field] + delta);
  }
  return assertValidAIStrategyGenome({ ...genome, ...mutated, strategyVersion: genome.strategyVersion + 1 }, genome.compatibleContentVersion);
}

export function crossoverGenomes(left: AIStrategyGenome, right: AIStrategyGenome, seed: string, strategyId: string): AIStrategyGenome {
  const rng = createFromString(seed);
  const child: Record<MutableField, number> = {} as Record<MutableField, number>;
  for (const field of MUTABLE_FIELDS) child[field] = nextInt(rng, 0, 1).value === 0 ? left[field] : right[field];
  return assertValidAIStrategyGenome({ ...left, ...child, strategyId, strategyVersion: Math.max(left.strategyVersion, right.strategyVersion) + 1 }, left.compatibleContentVersion);
}

export function genomeDistance(left: AIStrategyGenome, right: AIStrategyGenome): number {
  return MUTABLE_FIELDS.reduce((total, field) => total + Math.abs(left[field] - right[field]), 0);
}

export function detectDuplicateStrategies(genomes: readonly AIStrategyGenome[]): readonly string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const genome of genomes) {
    const fingerprint = canonicalSerializeAIStrategyGenome({ ...genome, strategyId: 'normalized', strategyVersion: 1 });
    if (seen.has(fingerprint)) duplicates.push(genome.strategyId);
    else seen.set(fingerprint, genome.strategyId);
  }
  return duplicates.sort();
}

export function classifyArchetype(genome: AIStrategyGenome): 'economic' | 'rush' | 'defensive' | 'counter-play' | 'adaptive' {
  if (genome.economyWeight > genome.aggressionWeight + 150) return 'economic';
  if (genome.aggressionWeight > genome.defenseWeight + 150) return 'rush';
  if (genome.defenseWeight > genome.aggressionWeight + 150) return 'defensive';
  if (genome.counterOpponentWeight > 650) return 'counter-play';
  return 'adaptive';
}
