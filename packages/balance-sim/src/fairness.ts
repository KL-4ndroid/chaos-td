import type { BalanceSimulationOptions, BalanceSimulationResult, PlayerSnapshot } from './types.js';
import { runBalanceSimulation } from './runner.js';

export interface FirstDivergence {
  readonly seed: string;
  readonly tick: number;
  readonly field: string;
  readonly p1Value: string | number;
  readonly mirroredP2Value: string | number;
}

function compareSnapshot(seed: string, tick: number, p1: PlayerSnapshot, p2: PlayerSnapshot): FirstDivergence | null {
  for (const field of ['hp', 'gold', 'income', 'netWorth'] as const) {
    if (p1[field] !== p2[field]) {
      return { seed, tick, field: `players.${field}`, p1Value: p1[field], mirroredP2Value: p2[field] };
    }
  }
  return null;
}

function sortedWaves(result: BalanceSimulationResult, battlefieldId: 'lane_p1' | 'lane_p2'): string {
  return result.waves
    .filter((wave) => wave.battlefieldId === battlefieldId)
    .map((wave) => `${wave.waveNumber}:${wave.actualSpawnCount}:${wave.deaths}:${wave.leaks}:${wave.peakConcurrentMonsterCount}`)
    .join('|');
}

export function detectFirstMirrorDivergence(options: BalanceSimulationOptions): FirstDivergence | null {
  const result = runBalanceSimulation({ ...options, samplingIntervalTicks: 1 });
  for (const sample of result.samples) {
    const divergence = compareSnapshot(result.match.seed, sample.tick, sample.p1, sample.p2);
    if (divergence) return divergence;
  }
  const p1Waves = sortedWaves(result, 'lane_p1');
  const p2Waves = sortedWaves(result, 'lane_p2');
  if (p1Waves !== p2Waves) {
    return { seed: result.match.seed, tick: result.match.finalTick, field: 'waveRuntime', p1Value: p1Waves, mirroredP2Value: p2Waves };
  }
  if (result.players.p1.commandsAccepted !== result.players.p2.commandsAccepted) {
    return { seed: result.match.seed, tick: result.match.finalTick, field: 'commands.accepted', p1Value: result.players.p1.commandsAccepted, mirroredP2Value: result.players.p2.commandsAccepted };
  }
  if (result.players.p1.commandsRejected !== result.players.p2.commandsRejected) {
    return { seed: result.match.seed, tick: result.match.finalTick, field: 'commands.rejected', p1Value: result.players.p1.commandsRejected, mirroredP2Value: result.players.p2.commandsRejected };
  }
  if (result.match.winnerId !== null || result.match.outcome !== 'draw') {
    return { seed: result.match.seed, tick: result.match.finalTick, field: 'result', p1Value: result.match.winnerId ?? 'draw', mirroredP2Value: 'draw' };
  }
  return null;
}
