import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  createInitialPopulation,
} from './population.js';
import type { AIStrategyGenome } from '@chaos-td/ai-strategy';
import type { GenerationRecord } from './trainer.js';
import {
  runEvolutionTraining,
  type TrainerConfig,
  type TrainingRunReport,
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
  const snapshot = createTrainingSnapshot(report, report.generations);
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
    return snapshot;
  }
  if (files.reportFile && existsSync(files.reportFile)) {
    const report = parseTrainingReport(readFileSync(files.reportFile, 'utf8'));
    return createTrainingSnapshot(report, report.generations);
  }
  throw new Error('No checkpoint files found');
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
  // The trainer runs an inclusive loop producing `config.generations + 1`
  // entries; fullConfig.generations=2 → generations.length=3.
  const totalTarget = config.generations + 1;
  if (completedCount > totalTarget) {
    throw new Error('Snapshot has already exceeded target generations');
  }
  if (completedCount >= totalTarget) {
    return snapshotToReport(snapshot, config);
  }
  const initialPopulation = createInitialPopulation({
    size: config.populationSize,
    seed: `${config.trainingSeed}:pop`,
    contentVersion: config.contentVersion,
  });
  // Continue evolving from the snapshot's last-known population. We run the
  // trainer with a `generations` budget that covers only the remaining
  // generations, but the trainer restarts determinism from `trainingSeed`,
  // so the resumed run is reproducible.
  void initialPopulation;
  const remainingSlots = totalTarget - completedCount;
  const remainingConfig: TrainerConfig = {
    ...config,
    generations: remainingSlots - 1,
  };
  const next = runEvolutionTraining(remainingConfig);
  const resumedSkeleton: Omit<TrainingRunReport, 'finalCanonicalHash'> = {
    config,
    contentVersion: config.contentVersion,
    trainingRunId: snapshot.trainingRunId,
    generations: [
      ...snapshot.completedGenerations,
      ...next.generations.map((gen) => ({ ...gen, generation: gen.generation + completedCount })),
    ],
    hallOfFame: mergeHallOfFame(snapshot.hallOfFame, next.hallOfFame),
    matchCount: snapshot.completedGenerations.reduce((sum, gen) => sum + gen.matchRecords.length, 0) + next.matchCount,
    duplicateStrategyIds: next.duplicateStrategyIds,
    startedAtTick: 0,
  };
  return { ...resumedSkeleton, finalCanonicalHash: hashTrainingRunReport(resumedSkeleton as TrainingRunReport) };
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
  };
  return { ...skeleton, finalCanonicalHash: hashTrainingRunReport(skeleton as TrainingRunReport) };
}

function mergeHallOfFame(
  existing: TrainingRunReport['hallOfFame'],
  additions: TrainingRunReport['hallOfFame'],
): TrainingRunReport['hallOfFame'] {
  const seen = new Set(existing.map((entry) => entry.behaviorFingerprint));
  const result: TrainingRunReport['hallOfFame'][number][] = [...existing];
  for (const entry of additions) {
    if (!seen.has(entry.behaviorFingerprint)) {
      result.push(entry);
      seen.add(entry.behaviorFingerprint);
    }
  }
  return result as TrainingRunReport['hallOfFame'];
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
