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
  return `${match.pairId}:${match.seed}:${match.participantAId}:${match.participantBId}:${match.mirrored ? '1' : '0'}`;
}

export function createGenerationSchedule(config: GenerationScheduleConfig): readonly EvolutionMatch[] {
  if (config.population.length < 2) throw new Error('Generation schedule requires at least two genomes');
  if (config.evaluationSeeds.length === 0) throw new Error('Generation schedule requires evaluation seeds');
  if (config.matchesPerGenome < 1) throw new Error('matchesPerGenome must be at least one');

  const ids = [...new Set(config.population.map((genome) => genome.strategyId))].sort((left, right) => left.localeCompare(right));
  if (ids.length !== config.population.length) throw new Error('Generation schedule requires unique strategy IDs');
  const roundsNeeded = config.matchesPerGenome;
  const rounds: string[][] = [];
  const circle = [...ids];
  if (circle.length % 2 === 1) circle.push('__bye__');
  const half = circle.length / 2;
  for (let round = 0; round < roundsNeeded; round += 1) {
    const pairs: string[] = [];
    for (let index = 0; index < half; index += 1) {
      const left = circle[index];
      const right = circle[circle.length - 1 - index];
      if (left && right && left !== '__bye__' && right !== '__bye__') {
        pairs.push(left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`);
      }
    }
    rounds.push(pairs);
    if (circle.length > 2) {
      const fixed = circle[0];
      const rotated = circle.slice(1);
      const last = rotated.pop();
      if (fixed && last) circle.splice(0, circle.length, fixed, last, ...rotated);
    }
  }

  const matches: EvolutionMatch[] = [];
  let pairIndex = 0;
  for (const round of rounds) {
    for (const pair of round.sort((left, right) => left.localeCompare(right))) {
      const [left, right] = pair.split('\u0000');
      if (!left || !right) continue;
      const pairId = `g${config.generation}:pair-${String(pairIndex).padStart(4, '0')}`;
      const seedName = config.evaluationSeeds[pairIndex % config.evaluationSeeds.length] ?? config.trainingSeed;
      const seed = `${config.trainingSeed}:${seedName}:r${String(pairIndex)}`;
      matches.push({ generation: config.generation, pairId, seed, participantAId: left, participantBId: right, p1StrategyId: left, p2StrategyId: right, mirrored: false });
      matches.push({ generation: config.generation, pairId, seed, participantAId: left, participantBId: right, p1StrategyId: right, p2StrategyId: left, mirrored: true });
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
