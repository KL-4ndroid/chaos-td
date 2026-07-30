export interface GenomeEvaluation {
  readonly elo: number;
  readonly winRate: number;
  readonly drawRate: number;
  readonly slotAdjustedScore: number;
  readonly reliabilityScore: number;
  readonly diversityScore: number;
  readonly invalidCommandRate: number;
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
}): GenomeEvaluation {
  const resolved = input.wins + input.losses + input.draws;
  const winRate = resolved === 0 ? 0 : input.wins / resolved;
  const drawRate = resolved === 0 ? 0 : input.draws / resolved;
  const slotAdjustedScore = resolved === 0 ? 0 : (input.wins + input.mirroredWins - input.losses - input.mirroredLosses) / (resolved * 2);
  const commandTotal = input.acceptedCommands + input.rejectedCommands;
  const invalidCommandRate = commandTotal === 0 ? 0 : input.rejectedCommands / commandTotal;
  const reliabilityScore = Math.max(0, 1000 - input.tickGuardCount * 200 - Math.round(invalidCommandRate * 1000));
  return { elo: input.elo, winRate, drawRate, slotAdjustedScore, reliabilityScore, diversityScore: input.behaviorDiversity, invalidCommandRate };
}
