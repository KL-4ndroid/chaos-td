import { createFromString, nextInt } from '@chaos-td/game-core';
import { assertValidAIStrategyGenome, canonicalSerializeAIStrategyGenome, type AIStrategyGenome } from '@chaos-td/ai-strategy';

export const MUTABLE_FIELDS = Object.freeze([
  'economyWeight',
  'defenseWeight',
  'aggressionWeight',
  'buildThreshold',
  'upgradeThreshold',
  'sellThreshold',
  'emergencyDefenseThreshold',
  'reserveGoldRatio',
  'incomeInvestmentRatio',
  'sendInvestmentRatio',
  'antiAirPriority',
  'splashPriority',
  'slowPriority',
  'antiBossPriority',
  'pressureTimingWeight',
  'counterOpponentWeight',
  'diversityPreference',
  'defenseBaselineThreshold',
  'goldRetentionRatio',
] as const);

type MutableField = typeof MUTABLE_FIELDS[number];

function clamp(value: number, field?: MutableField): number {
  if (field === 'goldRetentionRatio') return Math.max(0, Math.min(900, value));
  return Math.max(0, Math.min(1000, value));
}

function gaussian(rng: ReturnType<typeof createFromString>): number {
  const u1 = Math.max(1e-6, nextInt(rng, 1, 999999).value / 1_000_000);
  const u2 = nextInt(rng, 0, 999999).value / 1_000_000;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function mutateGenome(genome: AIStrategyGenome, seed: string, mutationRatePermille: number, sigma = 50): AIStrategyGenome {
  const rng = createFromString(seed);
  const mutated: Record<MutableField, number> = {} as Record<MutableField, number>;
  for (const field of MUTABLE_FIELDS) {
    const shouldMutate = nextInt(rng, 0, 999).value < mutationRatePermille;
    const delta = shouldMutate ? Math.round(gaussian(rng) * sigma) : 0;
    mutated[field] = clamp(genome[field] + delta, field);
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
