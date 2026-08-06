import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { assertValidAIStrategyGenome, type AIStrategyGenome } from '@chaos-td/ai-strategy';
import type { GenerationRecord } from './trainer.js';
import {
  continueEvolution,
  type TrainerConfig,
  type TrainingRunReport,
  type EvolutionTrainerState,
} from './trainer.js';
import {
  createTrainingSnapshot,
  hashTrainingRunReport,
  validateTrainingSnapshot,
  type TrainingSnapshot,
  type ValidationIssue,
} from './validation.js';

export interface CheckpointPaths {
  readonly reportFile: string;
  readonly snapshotFile: string;
}

export interface CheckpointWrite {
  readonly snapshot: TrainingSnapshot;
  readonly report: TrainingRunReport;
  readonly issues: readonly ValidationIssue[];
}

/**
 * Serialize a training run to JSON. Numbers and strings round-trip cleanly;
 * bigints are emitted as decimal strings.
 */
export function serializeTrainingReport(report: TrainingRunReport): string {
  return JSON.stringify(report, deterministicReplacer);
}

/**
 * Parse a JSON training report previously written by `serializeTrainingReport`.
 * The returned object is not yet validated; call `validateTrainingReport`
 * from `validation.ts` to verify the contract.
 */
export function parseTrainingReport(json: string): TrainingRunReport {
  return JSON.parse(json) as TrainingRunReport;
}

function deterministicReplacer(_key: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/**
 * Build a checkpoint snapshot and re-validate. Pure (no FS).
 */
export function buildCheckpoint(report: TrainingRunReport): CheckpointWrite {
  const snapshot = createTrainingSnapshot(report, report.generations, report.currentPopulation, {});
  const issues = [...validateTrainingSnapshot(snapshot)];
  return { snapshot, report, issues };
}

/**
 * Persist a checkpoint to disk. Node-only.
 */
export function writeCheckpoint(paths: CheckpointPaths, report: TrainingRunReport): CheckpointWrite {
  const checkpoint = buildCheckpoint(report);
  writeFileSync(paths.reportFile, serializeTrainingReport(checkpoint.report), 'utf8');
  writeFileSync(paths.snapshotFile, JSON.stringify(checkpoint.snapshot, deterministicReplacer), 'utf8');
  return checkpoint;
}

/**
 * Read a checkpoint snapshot from disk. Returns the snapshot or throws if
 * no readable source is found.
 */
export function readCheckpoint(files: { readonly reportFile?: string; readonly snapshotFile?: string }): TrainingSnapshot {
  if (files.snapshotFile && existsSync(files.snapshotFile)) {
    const content = readFileSync(files.snapshotFile, 'utf8');
    const snapshot = JSON.parse(content) as TrainingSnapshot;
    return normalizeSnapshotGenomes(snapshot);
  }
  if (files.reportFile && existsSync(files.reportFile)) {
    const report = parseTrainingReport(readFileSync(files.reportFile, 'utf8'));
    return normalizeSnapshotGenomes(createTrainingSnapshot(report, report.generations, report.currentPopulation, {}));
  }
  throw new Error('No checkpoint files found');
}

/** Adds defaults for newly introduced evolvable genes when loading old checkpoints. */
function normalizeSnapshotGenomes(snapshot: TrainingSnapshot): TrainingSnapshot {
  const normalize = (genome: AIStrategyGenome) => assertValidAIStrategyGenome(genome, snapshot.contentVersion);
  return {
    ...snapshot,
    currentPopulation: snapshot.currentPopulation.map(normalize),
    hallOfFame: snapshot.hallOfFame.map((entry) => ({ ...entry, strategy: normalize(entry.strategy) })),
  };
}

/**
 * Resume a training run from a snapshot up to `config.generations`. The
 * returned report is the original snapshot extended with the remaining
 * generations. Determinism is anchored to the original `trainingSeed`.
 */
export function resumeTraining(
  config: TrainerConfig,
  snapshot: TrainingSnapshot,
): TrainingRunReport {
  const completedCount = snapshot.completedGenerations.length;
  // `generations` is the number of evaluated generations. A snapshot records
  // completed generations and the population produced for the next one.
  const totalTarget = config.generations;
  if (completedCount > totalTarget) {
    throw new Error('Snapshot has already exceeded target generations');
  }
  if (completedCount >= totalTarget) {
    return snapshotToReport(snapshot, config);
  }
  const state: EvolutionTrainerState = {
    nextGeneration: completedCount,
    currentPopulation: snapshot.currentPopulation,
    ratings: snapshot.ratings,
    hallOfFame: snapshot.hallOfFame,
    completedGenerations: snapshot.completedGenerations,
    previousGenerationHash: null,
    trainingHash: '',
    trainerVersion: 1,
  };
  // continueEvolution retains completed generations in `state`; it must use
  // the original full configuration so generation-specific seeds and the
  // reproduction sequence remain identical to an uninterrupted run.
  return continueEvolution(config, state);
}

function snapshotToReport(snapshot: TrainingSnapshot, config: TrainerConfig): TrainingRunReport {
  const skeleton: Omit<TrainingRunReport, 'finalCanonicalHash'> = {
    config,
    contentVersion: snapshot.contentVersion,
    trainingRunId: snapshot.trainingRunId,
    generations: snapshot.completedGenerations,
    hallOfFame: snapshot.hallOfFame,
    matchCount: snapshot.completedGenerations.reduce((sum, gen) => sum + gen.matchRecords.length, 0),
    duplicateStrategyIds: [],
    startedAtTick: 0,
    currentPopulation: snapshot.currentPopulation,
  };
  return { ...skeleton, finalCanonicalHash: hashTrainingRunReport(skeleton as TrainingRunReport) };
}

/**
 * Verify a loaded checkpoint reproduces its stored canonical hash.
 */
export function verifyCheckpoint(snapshot: TrainingSnapshot): { readonly valid: boolean; readonly issues: readonly ValidationIssue[] } {
  const issues = [...validateTrainingSnapshot(snapshot)];
  const report = snapshotToReport(snapshot, snapshot.config);
  const recomputed = report.finalCanonicalHash;
  if (recomputed !== snapshot.canonicalHash) {
    issues.push({ code: 'snapshot_canonical_hash_mismatch', message: `snapshot hash ${snapshot.canonicalHash} != computed ${recomputed}`, generation: -1, strategyId: '' });
  }
  return { valid: issues.length === 0, issues };
}

// Keep AIStrategyGenome referenced for downstream tests.
export type { AIStrategyGenome, GenerationRecord };
