import { CONFIG_VERSION } from '@chaos-td/game-data';
import { canonicalSerializeAIStrategyGenome, type AIStrategyGenome } from '@chaos-td/ai-strategy';
import type { GenomeEvaluation } from './fitness.js';

export interface HallOfFameEntry {
  readonly strategy: AIStrategyGenome;
  readonly generation: number;
  readonly eloAtAdmission: number;
  readonly evaluationSeedSetVersion: string;
  readonly contentVersion: string;
  readonly behaviorFingerprint: string;
}

export interface HallOfFameCandidate {
  readonly strategy: AIStrategyGenome;
  readonly generation: number;
  readonly evaluation: GenomeEvaluation;
  readonly evaluationSeedSetVersion: string;
  readonly behaviorFingerprint: string;
  readonly tickGuardRate: number;
  readonly benchmark: { readonly wins: number; readonly losses: number; readonly score: number };
  readonly champion: { readonly wins: number; readonly losses: number; readonly score: number };
}

export function admitHallOfFameCandidates(existing: readonly HallOfFameEntry[], candidates: readonly HallOfFameCandidate[]): readonly HallOfFameEntry[] {
  const fingerprints = new Set(existing.map((entry) => entry.behaviorFingerprint));
  const admitted = candidates
    .filter((candidate) => candidate.evaluation.invalidCommandRate === 0 && candidate.evaluation.slotAdjustedScore >= 0 && candidate.evaluation.reliabilityScore >= 800 && (candidate.benchmark.wins > candidate.benchmark.losses || candidate.champion.wins > candidate.champion.losses) && !fingerprints.has(candidate.behaviorFingerprint))
    .map((candidate) => ({ strategy: candidate.strategy, generation: candidate.generation, eloAtAdmission: candidate.evaluation.elo, evaluationSeedSetVersion: candidate.evaluationSeedSetVersion, contentVersion: candidate.strategy.compatibleContentVersion, behaviorFingerprint: candidate.behaviorFingerprint }));
  return [...existing, ...admitted].sort((left, right) => left.generation - right.generation || right.eloAtAdmission - left.eloAtAdmission || left.strategy.strategyId.localeCompare(right.strategy.strategyId));
}

export function behaviorFingerprint(genome: AIStrategyGenome): string {
  return canonicalSerializeAIStrategyGenome(genome);
}

export const HALL_OF_FAME_SCHEMA = Object.freeze({ schemaVersion: 1, contentVersion: CONFIG_VERSION });
