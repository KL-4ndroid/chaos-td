export const EVOLUTION_FITNESS_VERSION = '1.0.0';
export const EVOLUTION_FITNESS_WEIGHTS = Object.freeze({
  // Formal match victory is deliberately the dominant selector: 1,200 of
  // 1,950 positive points (61.5%). Auxiliary signals may break ties but
  // cannot outweigh actual wins.
  elo: 150,
  winRate: 1200,
  slotFairness: 50,
  reliability: 100,
  invalidCommands: 50,
  tickGuard: 50,
  pressure: 150,
  benchmark: 200,
} as const);

export interface GenomeEvaluation {
  readonly version: string;
  readonly elo: number;
  readonly winRate: number;
  readonly drawRate: number;
  readonly slotAdjustedScore: number;
  readonly reliabilityScore: number;
  readonly diversityScore: number;
  readonly invalidCommandRate: number;
  readonly tickGuardPenalty: number;
  readonly pressureScore: number;
  /** Score against the fixed benchmark, normalized to -1000..1000. */
  readonly benchmarkScore: number;
  readonly totalScore: number;
}

export interface EloUpdate {
  readonly p1: number;
  readonly p2: number;
}

export function expectedEloScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function updateElo(p1Rating: number, p2Rating: number, p1Score: 0 | 0.5 | 1, kFactor = 32): EloUpdate {
  const p1 = Math.round((p1Rating + kFactor * (p1Score - expectedEloScore(p1Rating, p2Rating))) * 1000) / 1000;
  const p2 = Math.round((p2Rating + kFactor * ((1 - p1Score) - expectedEloScore(p2Rating, p1Rating))) * 1000) / 1000;
  return { p1, p2 };
}

export function calculateEvaluation(input: {
  readonly elo: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly mirroredWins: number;
  readonly mirroredLosses: number;
  readonly acceptedCommands: number;
  readonly rejectedCommands: number;
  readonly tickGuardCount: number;
  readonly matchCount: number;
  readonly behaviorDiversity: number;
  /** Net leak damage dealt to the opponent across matches. */
  readonly netLeakDamage: number;
  readonly benchmarkScore?: number;
}): GenomeEvaluation {
  const resolved = input.wins + input.losses + input.draws;
  const winRate = resolved === 0 ? 0 : input.wins / resolved;
  const drawRate = resolved === 0 ? 0 : input.draws / resolved;
  const slotAdjustedScore = resolved === 0 ? 0 : (input.wins + input.mirroredWins - input.losses - input.mirroredLosses) / (resolved * 2);
  const commandTotal = input.acceptedCommands + input.rejectedCommands;
  const invalidCommandRate = commandTotal === 0 ? 0 : input.rejectedCommands / commandTotal;
  const tickGuardPenalty = input.matchCount === 0 ? 0 : Math.min(1000, Math.round((input.tickGuardCount / input.matchCount) * 1000));
  const reliabilityScore = Math.max(0, 1000 - tickGuardPenalty - Math.round(invalidCommandRate * 1000));
  const pressureScore = input.matchCount === 0 ? 0 : Math.max(-1000, Math.min(1000, Math.round((input.netLeakDamage / input.matchCount) * 100)));
  const totalScore = Math.round(
    (input.elo / 2000) * EVOLUTION_FITNESS_WEIGHTS.elo
      + winRate * EVOLUTION_FITNESS_WEIGHTS.winRate
      + ((slotAdjustedScore + 1) / 2) * EVOLUTION_FITNESS_WEIGHTS.slotFairness
      + (reliabilityScore / 1000) * EVOLUTION_FITNESS_WEIGHTS.reliability
      - invalidCommandRate * EVOLUTION_FITNESS_WEIGHTS.invalidCommands
      - (tickGuardPenalty / 1000) * EVOLUTION_FITNESS_WEIGHTS.tickGuard
      + ((pressureScore + 1000) / 2000) * EVOLUTION_FITNESS_WEIGHTS.pressure
      + (((input.benchmarkScore ?? 0) + 1000) / 2000) * EVOLUTION_FITNESS_WEIGHTS.benchmark,
  );
  return { version: EVOLUTION_FITNESS_VERSION, elo: input.elo, winRate, drawRate, slotAdjustedScore, reliabilityScore, diversityScore: input.behaviorDiversity, invalidCommandRate, tickGuardPenalty, pressureScore, benchmarkScore: input.benchmarkScore ?? 0, totalScore };
}
