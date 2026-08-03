import {
  canonicalSerializeAIStrategyGenome,
  type AIStrategyGenome,
} from '@chaos-td/ai-strategy';
import {
  calculateEvaluation,
  updateElo,
  type GenomeEvaluation,
} from './fitness.js';
import { classifyArchetype } from './evolution.js';
import type { EvolutionArchetype } from './population.js';
import type { SelfPlayMatchSummary } from './league.js';
import type { LeagueTelemetryRecord } from './telemetry.js';

export interface MatchRecord {
  readonly generation: number;
  readonly pairId: string;
  readonly seed: string;
  readonly participantAId: string;
  readonly participantBId: string;
  readonly p1StrategyId: string;
  readonly p2StrategyId: string;
  readonly mirrored: boolean;
  readonly canonicalMatchKey: string;
  readonly summary: SelfPlayMatchSummary;
  readonly telemetry?: LeagueTelemetryRecord;
}

export interface GenomeAggregateInput {
  readonly strategyId: string;
  readonly generation: number;
  readonly records: readonly MatchRecord[];
  readonly behaviorDiversity: number;
  readonly elo: number;
  readonly initialElo: number;
}

export interface EvaluatedGenome {
  readonly strategyId: string;
  readonly generation: number;
  readonly archetype: EvolutionArchetype;
  readonly evaluation: GenomeEvaluation;
  readonly fingerprint: string;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly mirroredWins: number;
  readonly mirroredLosses: number;
  readonly tickGuardCount: number;
  readonly acceptedCommands: number;
  readonly rejectedCommands: number;
  readonly matches: number;
  readonly finalTicks: readonly number[];
}

interface Tally {
  wins: number;
  losses: number;
  draws: number;
  tickGuardCount: number;
  accepted: number;
  rejected: number;
  finalTicks: number[];
}

/**
 * Sums outcome counts for one genome across all match records it appears in.
 * Slot-aware: for non-mirrored records the strategy may sit in either p1 or p2;
 * for mirrored records the strategy originally listed as p1 now occupies p2.
 * Slot-adjusted bookkeeping is handled by `calculateEvaluation`.
 */
function playerTelemetry(record: MatchRecord, _slot: 'p1' | 'p2'): LeagueTelemetryRecord | null {
  return record.telemetry ?? null;
}

function tallyRecords(records: readonly MatchRecord[], genomeStrategyId: string, mirroredOnly: boolean): Tally {
  let wins = 0; let losses = 0; let draws = 0;
  let tickGuardCount = 0;
  let accepted = 0; let rejected = 0;
  const finalTicks: number[] = [];
  for (const record of records) {
    if (mirroredOnly && !record.mirrored) continue;
    const slot = record.p1StrategyId === genomeStrategyId ? 'p1' : record.p2StrategyId === genomeStrategyId ? 'p2' : null;
    if (!slot) continue;
    const summary = record.summary;
    const telemetry = playerTelemetry(record, slot);
    finalTicks.push(summary.finalTick);
    accepted += telemetry?.commandAcceptedPerPlayer[slot] ?? 0;
    rejected += telemetry?.commandRejectedPerPlayer[slot] ?? 0;
    if (summary.completion === 'tick_guard') tickGuardCount += 1;
    if (summary.outcome === 'draw') draws += 1;
    else if ((summary.winnerId === slot)) wins += 1;
    else losses += 1;
  }
  return { wins, losses, draws, tickGuardCount, accepted, rejected, finalTicks };
}

function tallyAll(input: GenomeAggregateInput, genomeStrategyId: string): Tally {
  return tallyRecords(input.records, genomeStrategyId, false);
}

function tallyMirrored(input: GenomeAggregateInput, genomeStrategyId: string): Tally {
  return tallyRecords(input.records, genomeStrategyId, true);
}

/**
 * Aggregates deterministic match records for a single genome into a
 * `GenomeEvaluation`. Same input yields the same evaluation.
 */
export function evaluateGenome(
  genome: AIStrategyGenome,
  input: GenomeAggregateInput,
  _rngSeed: string,
): EvaluatedGenome {
  const all = tallyAll(input, genome.strategyId);
  const mirror = tallyMirrored(input, genome.strategyId);
  const elo = input.elo;
  const evaluation = calculateEvaluation({
    elo,
    wins: all.wins,
    losses: all.losses,
    draws: all.draws,
    mirroredWins: mirror.wins,
    mirroredLosses: mirror.losses,
    acceptedCommands: all.accepted,
    rejectedCommands: all.rejected,
    tickGuardCount: all.tickGuardCount,
    matchCount: all.finalTicks.length,
    behaviorDiversity: input.behaviorDiversity,
  });
  return {
    strategyId: genome.strategyId,
    generation: input.generation,
    archetype: classifyArchetype(genome),
    evaluation,
    fingerprint: canonicalSerializeAIStrategyGenome(genome),
    wins: all.wins,
    losses: all.losses,
    draws: all.draws,
    mirroredWins: mirror.wins,
    mirroredLosses: mirror.losses,
    tickGuardCount: all.tickGuardCount,
    acceptedCommands: all.accepted,
    rejectedCommands: all.rejected,
    matches: all.finalTicks.length,
    finalTicks: all.finalTicks,
  };
}

/**
 * Deterministic Elo update for a single genome across the matches it played.
 * Uses `kFactor = 32` against a fixed 1500 reference rating. The result is
 * rounded to 3 decimal places.
 */
export function updateEloFromGenomes(
  rating: number,
  wins: number,
  losses: number,
  draws: number,
  _rngSeed: string,
): number {
  const matches = wins + losses + draws;
  if (matches === 0) return rating;
  const kFactor = 32;
  let current = rating;
  for (let index = 0; index < matches; index += 1) {
    const outcome: 0 | 0.5 | 1 = index < wins ? 1 : index < wins + losses ? 0 : 0.5;
    const expected = 1 / (1 + 10 ** ((1000 - current) / 400));
    current = Math.round((current + kFactor * (outcome - expected)) * 1000) / 1000;
  }
  return current;
}


/**
 * Compute head-to-head Elo ratings for all genomes in a population.
 * Processes matches in canonical order, updating both participants' ratings
 * after each match. Uses the actual opponent rating, not a fixed reference.
 */
export function computeHeadToHeadRatings(
  population: readonly AIStrategyGenome[],
  records: readonly MatchRecord[],
  initialElo: number,
): ReadonlyMap<string, number> {
  const ratings = new Map<string, number>();
  for (const genome of population) {
    ratings.set(genome.strategyId, initialElo);
  }
  const sorted = [...records].sort((a, b) => a.canonicalMatchKey.localeCompare(b.canonicalMatchKey));
  for (const record of sorted) {
    const p1Rating = ratings.get(record.p1StrategyId) ?? initialElo;
    const p2Rating = ratings.get(record.p2StrategyId) ?? initialElo;
    let p1Score: 0 | 0.5 | 1;
    if (record.summary.outcome === 'draw') {
      p1Score = 0.5;
    } else if (record.summary.winnerId === 'p1') {
      p1Score = 1;
    } else {
      p1Score = 0;
    }
    const { p1: newP1, p2: newP2 } = updateElo(p1Rating, p2Rating, p1Score);
    ratings.set(record.p1StrategyId, newP1);
    ratings.set(record.p2StrategyId, newP2);
  }
  return ratings;
}

/**
 * Behavior diversity as the average pairwise genome distance over a small
 * subset of the population's most-differentiating fields, normalized to a
 * 0..1000 permille scale.
 */

export function populationBehaviorDiversity(
  population: readonly AIStrategyGenome[],
): number {
  if (population.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < population.length; i += 1) {
    for (let j = i + 1; j < population.length; j += 1) {
      const left = population[i]; const right = population[j];
      if (!left || !right) continue;
      total += distance(left, right);
      pairs += 1;
    }
  }
  if (pairs === 0) return 0;
  return Math.min(1000, Math.round((total / pairs) / 100));
}

function distance(left: AIStrategyGenome, right: AIStrategyGenome): number {
  return Math.abs(left.economyWeight - right.economyWeight)
    + Math.abs(left.defenseWeight - right.defenseWeight)
    + Math.abs(left.aggressionWeight - right.aggressionWeight)
    + Math.abs(left.counterOpponentWeight - right.counterOpponentWeight);
}
