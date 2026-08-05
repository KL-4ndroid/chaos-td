import type { GenerationRecord, TrainingRunReport } from './trainer.js';
import type { LeagueTelemetryRecord } from './telemetry.js';
import type { AISkillTier } from '@chaos-td/ai-strategy';

export interface ReportSummary {
  readonly trainingRunId: string;
  readonly contentVersion: string;
  readonly finalCanonicalHash: string;
  readonly generationsCompleted: number;
  readonly totalMatches: number;
  readonly finalHallOfFameCount: number;
  readonly bestElo: number;
  readonly bestEloStrategyId: string;
  readonly bestEloGeneration: number;
  readonly averageFinalTick: number;
  readonly perGenerationMatchCounts: readonly { generation: number; matches: number }[];
  readonly perGenerationAverageFinalTick: readonly { generation: number; averageFinalTick: number }[];
  readonly perGenerationBestElo: readonly { generation: number; bestElo: number; strategyId: string }[];
}

export interface HallOfFameSummaryEntry {
  readonly strategyId: string;
  readonly generation: number;
  readonly eloAtAdmission: number;
  readonly behaviorFingerprint: string;
  readonly schemaVersion: number;
  readonly tier: AISkillTier;
}

export interface TelemetryAggregate {
  readonly leaksByDefender: Record<'p1' | 'p2', number>;
  readonly incomePaid: Record<'p1' | 'p2', number>;
  readonly acceptedCommands: Record<'p1' | 'p2', number>;
  readonly rejectedCommands: Record<'p1' | 'p2', number>;
  readonly towerBuilt: Record<'p1' | 'p2', number>;
  readonly monsterQueued: Record<'p1' | 'p2', number>;
  readonly monstersSpawnedBySourcePlayer: Record<'p1' | 'p2' | 'wave', number>;
  readonly monstersDiedByKiller: Record<'p1' | 'p2' | 'unknown', number>;
  readonly mirrorAgreement: number;
  readonly chronologicalEventRatio: number;
  readonly total: number;
}

function emptyTelemetryAggregate(): TelemetryAggregate {
  return {
    leaksByDefender: { p1: 0, p2: 0 },
    incomePaid: { p1: 0, p2: 0 },
    acceptedCommands: { p1: 0, p2: 0 },
    rejectedCommands: { p1: 0, p2: 0 },
    towerBuilt: { p1: 0, p2: 0 },
    monsterQueued: { p1: 0, p2: 0 },
    monstersSpawnedBySourcePlayer: { p1: 0, p2: 0, wave: 0 },
    monstersDiedByKiller: { p1: 0, p2: 0, unknown: 0 },
    mirrorAgreement: 0,
    chronologicalEventRatio: 0,
    total: 0,
  };
}

interface MutableTelemetryAggregate {
  leaksByDefender: Record<'p1' | 'p2', number>;
  incomePaid: Record<'p1' | 'p2', number>;
  acceptedCommands: Record<'p1' | 'p2', number>;
  rejectedCommands: Record<'p1' | 'p2', number>;
  towerBuilt: Record<'p1' | 'p2', number>;
  monsterQueued: Record<'p1' | 'p2', number>;
  monstersSpawnedBySourcePlayer: Record<'p1' | 'p2' | 'wave', number>;
  monstersDiedByKiller: Record<'p1' | 'p2' | 'unknown', number>;
  mirrorAgreement: number;
  chronologicalEventRatio: number;
  total: number;
}

function aggregateTelemetry(records: readonly LeagueTelemetryRecord[]): TelemetryAggregate {
  const acc: MutableTelemetryAggregate = emptyTelemetryAggregate();
  let chronological = 0;
  for (const record of records) {
    acc.total += 1;
    if (record.correctnessChecks.eventsChronological) chronological += 1;
    if (record.matchesMirrorResult) acc.mirrorAgreement += 1;
    for (const slot of ['p1', 'p2'] as const) {
      acc.leaksByDefender[slot] += record.leaksByDefender[slot];
      acc.incomePaid[slot] += record.incomePaidByPlayer[slot];
      acc.acceptedCommands[slot] += record.commandAcceptedPerPlayer[slot];
      acc.rejectedCommands[slot] += record.commandRejectedPerPlayer[slot];
      acc.towerBuilt[slot] += record.towerBuiltByPlayer[slot];
      acc.monsterQueued[slot] += record.monsterQueuedByPlayer[slot];
    }
    for (const slot of ['p1', 'p2'] as const) {
      acc.monstersSpawnedBySourcePlayer[slot] += record.monstersSpawnedBySourcePlayer[slot];
      acc.monstersDiedByKiller[slot] += record.monstersDiedByKiller[slot];
    }
    acc.monstersSpawnedBySourcePlayer.wave += record.monstersSpawnedBySourcePlayer.wave;
    acc.monstersDiedByKiller.unknown += record.monstersDiedByKiller.unknown;
  }
  acc.chronologicalEventRatio = acc.total === 0 ? 0 : chronological / acc.total;
  return {
    leaksByDefender: { ...acc.leaksByDefender },
    incomePaid: { ...acc.incomePaid },
    acceptedCommands: { ...acc.acceptedCommands },
    rejectedCommands: { ...acc.rejectedCommands },
    towerBuilt: { ...acc.towerBuilt },
    monsterQueued: { ...acc.monsterQueued },
    monstersSpawnedBySourcePlayer: { ...acc.monstersSpawnedBySourcePlayer },
    monstersDiedByKiller: { ...acc.monstersDiedByKiller },
    mirrorAgreement: acc.mirrorAgreement,
    chronologicalEventRatio: acc.chronologicalEventRatio,
    total: acc.total,
  };
}

/**
 * Build an aggregate summary across all generations. Used for the Markdown
 * summary that goes into `reports/ai/latest/training-summary.md`.
 */
export function summarizeTrainingRun(report: TrainingRunReport): ReportSummary {
  const perGenerationMatchCounts = report.generations.map((gen) => ({ generation: gen.generation, matches: gen.matchRecords.length }));
  const perGenerationAverageFinalTick = report.generations.map((gen) => {
    const ticks = gen.matchRecords.map((match) => match.summary.finalTick);
    const sum = ticks.reduce((a, b) => a + b, 0);
    return { generation: gen.generation, averageFinalTick: ticks.length === 0 ? 0 : sum / ticks.length };
  });
  const perGenerationBestElo = report.generations.map((gen) => {
    const best = [...gen.evaluated].sort((left, right) => right.evaluation.elo - left.evaluation.elo)[0];
    return best
      ? { generation: gen.generation, bestElo: best.evaluation.elo, strategyId: best.strategyId }
      : { generation: gen.generation, bestElo: 0, strategyId: '' };
  });
  const topElo = report.generations
    .flatMap((gen) => gen.evaluated.map((entry) => ({ ...entry, generation: gen.generation })))
    .sort((left, right) => right.evaluation.elo - left.evaluation.elo)[0];
  const ticks = report.generations.flatMap((gen) => gen.matchRecords.map((match) => match.summary.finalTick));
  const averageFinalTick = ticks.length === 0 ? 0 : Math.round(ticks.reduce((a, b) => a + b, 0) / ticks.length);
  return {
    trainingRunId: report.trainingRunId,
    contentVersion: report.contentVersion,
    finalCanonicalHash: report.finalCanonicalHash,
    generationsCompleted: report.generations.length,
    totalMatches: report.matchCount,
    finalHallOfFameCount: report.hallOfFame.length,
    bestElo: topElo?.evaluation.elo ?? 0,
    bestEloStrategyId: topElo?.strategyId ?? '',
    bestEloGeneration: topElo?.generation ?? -1,
    averageFinalTick,
    perGenerationMatchCounts,
    perGenerationAverageFinalTick,
    perGenerationBestElo,
  };
}

function inferTier(elo: number): AISkillTier {
  if (elo >= 1800) return 'Elite';
  if (elo >= 1500) return 'Advanced';
  if (elo >= 1300) return 'Normal';
  return 'Beginner';
}

export function summarizeHallOfFame(report: TrainingRunReport): readonly HallOfFameSummaryEntry[] {
  return report.hallOfFame.map((entry) => ({
    strategyId: entry.strategy.strategyId,
    generation: entry.generation,
    eloAtAdmission: entry.eloAtAdmission,
    behaviorFingerprint: entry.behaviorFingerprint,
    schemaVersion: entry.strategy.schemaVersion,
    tier: inferTier(entry.eloAtAdmission),
  }));
}

export function aggregateTelemetryForRun(report: TrainingRunReport): TelemetryAggregate {
  const flat = report.generations.flatMap((gen) => gen.telemetry);
  return aggregateTelemetry(flat);
}

/**
 * Format a training run summary as a Markdown report. Pure (no FS).
 */
export function renderTrainingSummaryMarkdown(summary: ReportSummary): string {
  const lines: string[] = [];
  lines.push(`# AI Training Run ${summary.trainingRunId}`);
  lines.push('');
  lines.push(`- Content version: \`${summary.contentVersion}\``);
  lines.push(`- Final canonical hash: \`${summary.finalCanonicalHash}\``);
  lines.push(`- Generations completed: ${summary.generationsCompleted}`);
  lines.push(`- Total matches played: ${summary.totalMatches}`);
  lines.push(`- Hall of fame entries: ${summary.finalHallOfFameCount}`);
  lines.push(`- Average final tick: ${summary.averageFinalTick}`);
  lines.push(`- Best Elo: ${summary.bestElo} (${summary.bestEloStrategyId} @ gen ${summary.bestEloGeneration})`);
  lines.push('');
  lines.push('## Per-generation');
  lines.push('');
  lines.push('| Gen | Matches | Avg final tick | Best Elo | Strategy |');
  lines.push('|----:|--------:|---------------:|---------:|----------|');
  for (let i = 0; i < summary.perGenerationMatchCounts.length; i += 1) {
    const matches = summary.perGenerationMatchCounts[i];
    const finalTick = summary.perGenerationAverageFinalTick[i];
    const bestElo = summary.perGenerationBestElo[i];
    if (!matches || !finalTick || !bestElo) continue;
    lines.push(`| ${matches.generation} | ${matches.matches} | ${finalTick.averageFinalTick.toFixed(2)} | ${bestElo.bestElo} | ${bestElo.strategyId || '—'} |`);
  }
  return lines.join('\n');
}

export function renderHallOfFameJson(summary: readonly HallOfFameSummaryEntry[]): string {
  return JSON.stringify(summary, (_, value) => (typeof value === 'number' ? value : value), 2);
}

/**
 * Emit a stable, low-cardinality view of a single generation's evaluation
 * table. Useful for tests and CI smoke logs.
 */
export function summarizeGeneration(generation: GenerationRecord): {
  readonly evaluated: readonly { readonly strategyId: string; readonly elo: number; readonly winRate: number; readonly slotAdjustedScore: number; readonly invalidCommandRate: number }[];
  readonly matchCount: number;
} {
  const evaluated = [...generation.evaluated]
    .sort((left, right) => left.strategyId.localeCompare(right.strategyId))
    .map((entry) => ({
      strategyId: entry.strategyId,
      elo: entry.evaluation.elo,
      winRate: entry.evaluation.winRate,
      slotAdjustedScore: entry.evaluation.slotAdjustedScore,
      invalidCommandRate: entry.evaluation.invalidCommandRate,
    }));
  return { evaluated, matchCount: generation.matchRecords.length };
}
