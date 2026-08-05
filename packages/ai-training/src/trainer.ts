import { createFromString, nextInt } from '@chaos-td/game-core';
import {
  assertValidAIStrategyGenome,
  type AIStrategyGenome,
} from '@chaos-td/ai-strategy';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import {
  createGenerationSchedule,
  type EvolutionMatch,
} from './schedule.js';
import { createInitialPopulation, type EvolutionArchetype } from './population.js';
import { crossoverGenomes, mutateGenome } from './evolution.js';
import {
  admitHallOfFameCandidates,
  behaviorFingerprint,
  type HallOfFameCandidate,
  type HallOfFameEntry,
} from './hall-of-fame.js';
import {
  computeHeadToHeadRatings,
  evaluateGenome,
  populationBehaviorDiversity,
  type EvaluatedGenome,
  type MatchRecord,
} from './evaluator.js';
// SelfPlayMatchSummary is referenced via MatchRecord -> EvaluatedGenome from
// './evaluator.js'; no direct import needed here.
import { runSelfPlayWithTelemetry, type LeagueTelemetryRecord } from './telemetry.js';

export interface TrainerConfig {
  readonly populationSize: number;
  readonly generations: number;
  readonly matchesPerGenome: number;
  readonly eliteCount: number;
  readonly hallOfFameOpponentCount: number;
  readonly mutationRatePermille: number;
  readonly crossoverRatePermille: number;
  readonly evaluationSeeds: readonly string[];
  readonly trainingSeed: string;
  readonly maxTicksPerMatch: number;
  readonly contentVersion: string;
  readonly canonicalTag: string;
}

export interface GenerationRecord {
  readonly generation: number;
  readonly matchRecords: readonly MatchRecord[];
  readonly telemetry: readonly LeagueTelemetryRecord[];
  readonly evaluated: readonly EvaluatedGenome[];
  readonly newHallOfFameEntries: readonly HallOfFameEntry[];
  readonly populationFingerprints: readonly string[];
}

export interface TrainingRunReport {
  readonly config: TrainerConfig;
  readonly contentVersion: string;
  readonly trainingRunId: string;
  readonly generations: readonly GenerationRecord[];
  readonly hallOfFame: readonly HallOfFameEntry[];
  readonly finalCanonicalHash: string;
  readonly matchCount: number;
  readonly duplicateStrategyIds: readonly string[];
  readonly startedAtTick: number;
  readonly currentPopulation: readonly AIStrategyGenome[];
}

interface PopulationState {
  readonly population: readonly AIStrategyGenome[];
  readonly hallOfFame: readonly HallOfFameEntry[];
  readonly generations: GenerationRecord[];
  readonly matchCount: number;
}
 
 /**
  * Complete trainer state for checkpointing and resume.
  * Captures everything needed to continue evolution deterministically.
  */
 export interface EvolutionTrainerState {
   readonly nextGeneration: number;
   readonly currentPopulation: readonly AIStrategyGenome[];
   readonly ratings: Readonly<Record<string, number>>;
   readonly hallOfFame: readonly HallOfFameEntry[];
   readonly completedGenerations: readonly GenerationRecord[];
   readonly previousGenerationHash: string | null;
   readonly trainingHash: string;
   readonly trainerVersion: number;
 }

export function tournamentSelect(
  evaluations: readonly EvaluatedGenome[],
  rngSeed: string,
  pickCount: number,
  tournamentSize = 3,
): EvaluatedGenome[] {
  if (evaluations.length === 0 || pickCount <= 0) return [];
  const rng = createFromString(rngSeed);
  const sortedById = [...evaluations].sort((left, right) => left.strategyId.localeCompare(right.strategyId));
  const picks: EvaluatedGenome[] = [];
  const used = new Set<string>();
  for (let index = 0; index < pickCount; index += 1) {
    let best: EvaluatedGenome | null = null;
    for (let turn = 0; turn < tournamentSize; turn += 1) {
      const candidate = sortedById[nextInt(rng, 0, sortedById.length - 1).value];
      if (!candidate) continue;
      if (best === null || candidate.evaluation.totalScore > best.evaluation.totalScore) best = candidate;
    }
    if (best && !used.has(best.strategyId)) {
      picks.push(best);
      used.add(best.strategyId);
    }
  }
  // Fill if not enough unique elites ??fall back to sorted-by-elo pick.
  if (picks.length < pickCount) {
    const sorted = [...evaluations].sort((a, b) => b.evaluation.elo - a.evaluation.elo || a.strategyId.localeCompare(b.strategyId));
    for (const slot of sorted) {
      if (picks.length >= pickCount) break;
      if (!used.has(slot.strategyId)) { picks.push(slot); used.add(slot.strategyId); }
    }
  }
  return picks;
}

function reproduceParents(
  picked: readonly EvaluatedGenome[],
  populationLookup: ReadonlyMap<string, AIStrategyGenome>,
  generation: number,
  mutationRatePermille: number,
  crossoverRatePermille: number,
  rngSeed: string,
  contentVersion: string,
  slotSeed: 'regular' | 'next',
  childCount: number,
): AIStrategyGenome[] {
  if (picked.length === 0 || childCount <= 0) return [];
  const rng = createFromString(rngSeed);
  const children: AIStrategyGenome[] = [];
  for (let index = 0; index < childCount; index += 1) {
    const leftEval = picked[nextInt(rng, 0, picked.length - 1).value];
    const rightEval = picked[nextInt(rng, 0, picked.length - 1).value];
    if (!leftEval || !rightEval) throw new Error('Parent selection returned no genome');
    const left = populationLookup.get(leftEval.strategyId);
    const right = populationLookup.get(rightEval.strategyId);
    if (!left || !right) continue;
    const useCrossover = nextInt(rng, 0, 999).value < crossoverRatePermille && picked.length >= 2;
    const childId = `g${generation}-${slotSeed === 'regular' ? 'p' : 'n'}-${String(index).padStart(4, '0')}`;
    let draft: AIStrategyGenome;
    if (useCrossover) {
      draft = crossoverGenomes(left, right, `${rngSeed}:x:${index}`, childId);
    } else {
      draft = { ...left, strategyId: childId, strategyVersion: left.strategyVersion + 1 };
      draft = assertValidAIStrategyGenome(draft, contentVersion);
    }
    children.push(mutateGenome(draft, `${rngSeed}:mut:${index}`, mutationRatePermille));
  }
  return children;
}

function playMatches(
  generation: number,
  population: readonly AIStrategyGenome[],
  evaluationSeeds: readonly string[],
  trainingSeed: string,
  maxTicksPerMatch: number,
  matchesPerGenome: number,
): { records: MatchRecord[]; telemetry: LeagueTelemetryRecord[] } {
  if (population.length < 2) return { records: [], telemetry: [] };
  const schedule = createGenerationSchedule({
    population,
    generation,
    trainingSeed,
    evaluationSeeds,
    matchesPerGenome: Math.max(1, matchesPerGenome),
  });
  return executeSchedule(generation, population, schedule, maxTicksPerMatch);
}

function executeSchedule(
  generation: number,
  population: readonly AIStrategyGenome[],
  schedule: readonly EvolutionMatch[],
  maxTicksPerMatch: number,
): { records: MatchRecord[]; telemetry: LeagueTelemetryRecord[] } {
  const records: MatchRecord[] = [];
  const telemetry: LeagueTelemetryRecord[] = [];
  const lookup = new Map(population.map((genome) => [genome.strategyId, genome]));
  for (const match of schedule) {
    const p1 = lookup.get(match.p1StrategyId);
    const p2 = lookup.get(match.p2StrategyId);
    if (!p1 || !p2) continue;
    const { summary, telemetry: fullTelemetry, replay } = runSelfPlayWithTelemetry(match, p1, p2, maxTicksPerMatch);
    records.push({
      generation,
      pairId: match.pairId,
      seed: match.seed,
      p1StrategyId: p1.strategyId,
      p2StrategyId: p2.strategyId,
      mirrored: match.mirrored,
      participantAId: match.participantAId,
      participantBId: match.participantBId,
      canonicalMatchKey: `${match.generation}:${match.pairId}:${match.seed}:${match.mirrored ? '1' : '0'}`,
      summary,
      telemetry: fullTelemetry,
      replay,
    });
    telemetry.push(fullTelemetry);
  }
  return { records, telemetry };
}

function evaluatePopulation(
  population: readonly AIStrategyGenome[],
  generation: number,
  records: readonly MatchRecord[],
  trainingSeed: string,
): EvaluatedGenome[] {
  const behaviorDiversity = populationBehaviorDiversity(population);
  const initialElo = 1000;
  const ratings = computeHeadToHeadRatings(population, records, initialElo);
  return population.map((genome) => {
    const elo = ratings.get(genome.strategyId) ?? initialElo;
    return evaluateGenome(
      genome,
      {
        strategyId: genome.strategyId,
        generation,
        records,
        behaviorDiversity,
        elo,
        initialElo,
      },
      `${trainingSeed}:eval`,
    );
  });
}

function candidateFromEvaluated(
  evaluated: EvaluatedGenome,
  primary: ReadonlyMap<string, AIStrategyGenome>,
  secondary: ReadonlyMap<string, AIStrategyGenome>,
  defaultGenome: AIStrategyGenome,
): AIStrategyGenome {
  return primary.get(evaluated.strategyId) ?? secondary.get(evaluated.strategyId) ?? defaultGenome;
}

function admitToHallOfFame(
  existing: readonly HallOfFameEntry[],
  evaluated: readonly EvaluatedGenome[],
  primary: readonly AIStrategyGenome[],
  hofGensomes: readonly AIStrategyGenome[],
  generation: number,
  evaluationSeedSetVersion: string,
  defaultGenome: AIStrategyGenome,
): HallOfFameEntry[] {
  const primaryLookup = new Map(primary.map((genome) => [genome.strategyId, genome]));
  const secondaryLookup = new Map(hofGensomes.map((genome) => [genome.strategyId, genome]));
  const candidates: HallOfFameCandidate[] = evaluated.map((entry) => ({
    strategy: candidateFromEvaluated(entry, primaryLookup, secondaryLookup, defaultGenome),
    generation,
    evaluation: entry.evaluation,
    evaluationSeedSetVersion,
    behaviorFingerprint: behaviorFingerprint(candidateFromEvaluated(entry, primaryLookup, secondaryLookup, defaultGenome)),
    tickGuardRate: entry.matches === 0 ? 0 : entry.tickGuardCount / entry.matches,
  }));
  return [...admitHallOfFameCandidates(existing, candidates)];
}

function pruneHallOfFame(
  entries: readonly HallOfFameEntry[],
  capacity: number,
): readonly HallOfFameEntry[] {
  if (capacity <= 0 || entries.length <= capacity) return entries;
  // Keep highest-elo most recent generation
  const sorted = [...entries].sort((left, right) => {
    if (left.generation !== right.generation) return right.generation - left.generation;
    if (right.eloAtAdmission !== left.eloAtAdmission) return right.eloAtAdmission - left.eloAtAdmission;
    return left.strategy.strategyId.localeCompare(right.strategy.strategyId);
  });
  return sorted.slice(0, capacity);
}

function hashTrainingRun(state: PopulationState, config: TrainerConfig): string {
  const champion = (() => {
    const last = state.generations[state.generations.length - 1];
    if (!last) return null;
    const best = [...last.evaluated].sort((left, right) => right.evaluation.elo - left.evaluation.elo)[0];
    return best ? { strategyId: best.strategyId, elo: best.evaluation.elo, generation: last.generation } : null;
  })();
  const payload = {
    canonicalTag: config.canonicalTag,
    contentVersion: config.contentVersion,
    trainingSeed: config.trainingSeed,
    populationSize: config.populationSize,
    generations: config.generations,
    trainerVersion: 1,
    gameDataVersion: CONFIG_VERSION,
    champion,
    finalPopulationFingerprints: state.population.map(behaviorFingerprint).sort((left, right) => left.localeCompare(right)),
    finalHallOfFameFingerprints: state.hallOfFame
      .map((entry) => entry.behaviorFingerprint)
      .sort((left, right) => left.localeCompare(right)),
    perGeneration: state.generations.map((gen) => ({
      generation: gen.generation,
      matches: gen.matchRecords.length,
      bestElo: (() => {
        const best = [...gen.evaluated].sort((left, right) => right.evaluation.elo - left.evaluation.elo)[0];
        return best ? best.evaluation.elo : 0;
      })(),
      populationFingerprints: gen.populationFingerprints,
    })),
  };
  return fnv1a64(canonicalize(payload));
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Stable JSON serialization with sorted object keys. Only primitives, arrays,
 * and plain objects are supported.
 */
function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number: ${value}`);
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error('canonicalize: non-plain object');
    const objectRecord = value as Record<string, unknown>;
    const keys = Object.keys(objectRecord).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(objectRecord[key])}`).join(',')}}`;
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}

/**
 * Top-level evolution training loop. Returns a deterministic `TrainingRunReport`.
 * Steps per generation:
 * 1. Play all non-mirrored and mirrored matches via the integrated self-play
 *    runtime (`packages/ai-training` `runSelfPlayMatch`).
 * 2. Aggregate per-strategy match outcomes into `EvaluatedGenome`.
 * 3. Admit qualifying candidates into the hall of fame, then prune to capacity.
 * 4. Tournament-select elites and produce offspring via mutation/crossover.
 * 5. Hand the next population to the following generation.
 */
export function runEvolutionTraining(config: TrainerConfig): TrainingRunReport {
  if (config.populationSize < 2) throw new Error('populationSize must be at least 2');
  if (config.generations < 0) throw new Error('generations must be >= 0');
  if (config.evaluationSeeds.length === 0) throw new Error('evaluationSeeds required');
 
 
  const initialPopulation = createInitialPopulation({
    size: config.populationSize,
    seed: `${config.trainingSeed}:pop`,
    contentVersion: config.contentVersion,
  });
  const initialState: EvolutionTrainerState = {
    nextGeneration: 0,
    currentPopulation: initialPopulation,
    ratings: {},
    hallOfFame: [],
    completedGenerations: [],
    previousGenerationHash: null,
    trainingHash: '',
    trainerVersion: 1,
  };
  return continueEvolution(config, initialState);
}
 
/**
 * Continue evolution from a given trainer state. Runs generations from
 * `state.nextGeneration` up to `config.generations`. Returns the completed
 * `TrainingRunReport`.
 */
export function continueEvolution(
  config: TrainerConfig,
  state: EvolutionTrainerState,
): TrainingRunReport {
  const initial = createInitialPopulation({
    size: Math.max(5, config.populationSize),
    seed: `${config.trainingSeed}:default`,
    contentVersion: config.contentVersion,
  });
  const fallback = initial[0];
  if (!fallback) throw new Error('createInitialPopulation returned no genomes');
  const defaultGenome: AIStrategyGenome = fallback;
 
  let population = state.currentPopulation;
  let hallOfFame = state.hallOfFame;
  const generations = [...state.completedGenerations] as GenerationRecord[];
  let matchCount = generations.reduce((sum, gen) => sum + gen.matchRecords.length, 0);
 
  for (let generation = state.nextGeneration; generation < config.generations; generation += 1) {
    const scheduleTrainingSeed = `${config.trainingSeed}:gen-${generation}`;
    const played = playMatches(generation, population, config.evaluationSeeds, scheduleTrainingSeed, config.maxTicksPerMatch, config.matchesPerGenome);
    matchCount += played.records.length;
    const primaryEval = evaluatePopulation(population, generation, played.records, scheduleTrainingSeed);

    // Hall of fame also plays matches against the population for context.
    const hofGenomes = hallOfFame.map((entry) => entry.strategy);
    const opponentScheduleTrainingSeed = `${config.trainingSeed}:gen-${generation}:hof`;
    let opponentEvaluation: EvaluatedGenome[] = [];
    let opponentRecords: MatchRecord[] = [];
    let opponentTelemetry: LeagueTelemetryRecord[] = [];
    if (hofGenomes.length > 0) {
      const opponentCombined: AIStrategyGenome[] = [...population];
      const seenIds = new Set(population.map((g) => g.strategyId));
      for (const genome of hofGenomes) if (!seenIds.has(genome.strategyId)) opponentCombined.push(genome);
      const opponentPlayed = playMatches(
        generation,
        opponentCombined,
        config.evaluationSeeds,
        opponentScheduleTrainingSeed,
        config.maxTicksPerMatch,
        config.matchesPerGenome,
      );
      opponentRecords = opponentPlayed.records;
      opponentTelemetry = opponentPlayed.telemetry;
      matchCount += opponentPlayed.records.length;
      opponentEvaluation = evaluatePopulation(opponentCombined, generation, opponentPlayed.records, opponentScheduleTrainingSeed);
    }

    // Admit primary and opponent evals into HOF (this is the only stage that
    // grows the HOF size; it never shrinks below `capacity`).
    const hofAfterAdmit = admitToHallOfFame(
      hallOfFame,
      [...primaryEval, ...opponentEvaluation],
      [...population, ...hofGenomes],
      [...population, ...hofGenomes],
      generation,
      `${config.canonicalTag}:${config.trainingSeed}:${generation}`,
      defaultGenome,
    );
    hallOfFame = pruneHallOfFame(hofAfterAdmit, config.hallOfFameOpponentCount);
    const newHofEntries = hallOfFame.filter(
      (entry) => entry.generation === generation,
    );

    const populationFingerprints = population.map(behaviorFingerprint).sort((left, right) => left.localeCompare(right));
    generations.push({
      generation,
      matchRecords: [...played.records, ...opponentRecords],
      telemetry: [...played.telemetry, ...opponentTelemetry],
      evaluated: primaryEval,
      newHallOfFameEntries: newHofEntries,
      populationFingerprints,
    });

    if (generation === config.generations) break;

    const eliteCount = Math.min(config.eliteCount, population.length);
    const elites = tournamentSelect(
      primaryEval,
      `${config.trainingSeed}:select:${generation}`,
      eliteCount,
    );
    const eliteGenomes = elites
      .map((picked) => population.find((g) => g.strategyId === picked.strategyId))
      .filter((genome): genome is AIStrategyGenome => genome !== undefined);
    const offspring = reproduceParents(
      elites,
      new Map(population.map((genome) => [genome.strategyId, genome])),
      generation + 1,
      config.mutationRatePermille,
      config.crossoverRatePermille,
      `${config.trainingSeed}:reproduce:${generation}`,
      config.contentVersion,
      'regular',
      config.populationSize - eliteGenomes.length,
    );

    population = [
      ...eliteGenomes,
      ...offspring,
    ];
    if (population.length !== config.populationSize) {
      throw new Error(`Evolution population invariant failed: expected ${config.populationSize}, got ${population.length}`);
    }
    if (new Set(population.map((genome) => genome.strategyId)).size !== config.populationSize) {
      throw new Error('Evolution population invariant failed: strategy IDs must be unique');
    }
  }

  const popState: PopulationState = { population, hallOfFame, generations, matchCount };
  const finalCanonicalHash = hashTrainingRun(popState, config);

  return {
    config,
    contentVersion: config.contentVersion,
    trainingRunId: `${config.canonicalTag}:${config.trainingSeed}`,
    generations,
    hallOfFame,
    finalCanonicalHash,
    matchCount,
    duplicateStrategyIds: detectDuplicates(popState.generations),
    startedAtTick: 0,
    currentPopulation: population,
  };
}

function detectDuplicates(generations: readonly GenerationRecord[]): readonly string[] {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const generation of generations) {
    for (const fingerprint of generation.populationFingerprints) {
      if (seen.has(fingerprint)) {
        const existing = seen.get(fingerprint);
        if (existing !== undefined) duplicates.add(existing);
        // We can't easily extract a strategyId from the fingerprint; we expose
        // a list of fingerprints instead and rely on the validator below.
      } else {
        seen.set(fingerprint, fingerprint);
      }
    }
  }
  return [...duplicates].sort();
}

export { canonicalize as canonicalizeForHash };
export { summarizeTrainingRun } from './report.js';
export type { EvolutionArchetype };
