import type { AIStrategyGenome } from '@chaos-td/ai-strategy';

export interface EvolutionMatch {
  readonly generation: number;
  readonly pairId: string;
  readonly seed: string;
  readonly participantAId: string;
  readonly participantBId: string;
  readonly p1StrategyId: string;
  readonly p2StrategyId: string;
  readonly mirrored: boolean;
}

export interface GenerationScheduleConfig {
  readonly population: readonly AIStrategyGenome[];
  readonly generation: number;
  readonly trainingSeed: string;
  readonly evaluationSeeds: readonly string[];
  readonly matchesPerGenome: number;
}

function matchKey(match: EvolutionMatch): string {
  return `${match.pairId}:${match.seed}:${match.mirrored ? '1' : '0'}`;
}

export function createGenerationSchedule(config: GenerationScheduleConfig): readonly EvolutionMatch[] {
  if (config.population.length < 2) throw new Error('Generation schedule requires at least two genomes');
  if (config.evaluationSeeds.length === 0) throw new Error('Generation schedule requires evaluation seeds');
  const matches: EvolutionMatch[] = [];
  const target = Math.max(1, config.matchesPerGenome);
  let pairIndex = 0;
  for (let left = 0; left < config.population.length; left += 1) {
    for (let right = left + 1; right < config.population.length && pairIndex < config.population.length * target; right += 1) {
      const a = config.population[left];
      const b = config.population[right];
      if (!a || !b) continue;
      const pairId = `g${config.generation}:pair-${String(pairIndex).padStart(4, '0')}`;
      const seed = config.evaluationSeeds[pairIndex % config.evaluationSeeds.length] ?? config.trainingSeed;
      matches.push({ generation: config.generation, pairId, seed: `${config.trainingSeed}:${seed}`, participantAId: a.strategyId, participantBId: b.strategyId, p1StrategyId: a.strategyId, p2StrategyId: b.strategyId, mirrored: false });
      matches.push({ generation: config.generation, pairId, seed: `${config.trainingSeed}:${seed}`, participantAId: a.strategyId, participantBId: b.strategyId, p1StrategyId: b.strategyId, p2StrategyId: a.strategyId, mirrored: true });
      pairIndex += 1;
    }
  }
  return matches.sort((left, right) => matchKey(left).localeCompare(matchKey(right)));
}

export function participantPolicySeed(match: EvolutionMatch, participantId: string, tick: number): string {
  const participant = participantId === match.participantAId ? 'participant-a' : participantId === match.participantBId ? 'participant-b' : 'unknown';
  if (participant === 'unknown') throw new Error(`Unknown participant ${participantId}`);
  return `${match.pairId}:${participant}:${participantId}:${tick}`;
}
