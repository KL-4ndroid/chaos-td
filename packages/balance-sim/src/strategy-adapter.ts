import { createFromString, type GameCommand, type SimulationState } from '@chaos-td/game-core';
import type { PlayerSlot } from '@chaos-td/game-data';
import {
  buildAIObservation,
  extractAIFeaturesFromObservation,
  generateLegalActions,
  scoreAIAction,
  selectAIAction,
  toGameCommand,
  type AIStrategyGenome,
  type BuildAIObservationInput,
} from '@chaos-td/ai-strategy';

function laneIdFor(playerId: PlayerSlot): 'lane_p1' | 'lane_p2' {
  return playerId === 'p1' ? 'lane_p1' : 'lane_p2';
}

function observationInput(state: SimulationState, playerId: PlayerSlot): BuildAIObservationInput {
  const opponentId: PlayerSlot = playerId === 'p1' ? 'p2' : 'p1';
  const ownLaneId = laneIdFor(playerId);
  const opponentLaneId = laneIdFor(opponentId);
  return {
    selfPlayer: state.players[playerId],
    publicOpponent: { hp: state.players[opponentId].hp },
    ownBattlefield: {
      monsters: state.lanes[ownLaneId].monsters,
      outboundQueue: state.lanes[opponentLaneId].spawnQueue,
    },
    opponentBattlefield: { monsters: state.lanes[opponentLaneId].monsters },
    ownTowers: state.towers.filter((tower) => tower.ownerId === playerId),
    opponentTowers: state.towers.filter((tower) => tower.ownerId === opponentId),
    tick: state.tick,
    // `ready` and `resolving` are simulation-internal phases, not policy
    // phases. The adapter is normally called only while running.
    phase: state.phase === 'running' ? 'running' : state.phase === 'result' ? 'result' : 'countdown',
    waveNumber: state.waveScheduler.currentWaveNumber,
  };
}

function towerEntityIds(state: SimulationState, playerId: PlayerSlot): ReadonlyMap<string, number> {
  return new Map(state.towers
    .filter((tower) => tower.ownerId === playerId)
    .map((tower) => [`${tower.towerTypeId}:${tower.cellX}:${tower.cellY}`, tower.entityId]));
}

/**
 * Balance-simulation adapter for the production strategy policy. It exposes
 * the exact same sanitized observation contract used by self-play; the raw
 * authoritative state never crosses the policy boundary.
 */
export function decideBalanceStrategyCommand(
  state: SimulationState,
  playerId: PlayerSlot,
  genome: AIStrategyGenome,
): GameCommand | null {
  const observation = buildAIObservation(playerId, observationInput(state, playerId));
  const features = extractAIFeaturesFromObservation(observation);
  const scored = generateLegalActions(observation, towerEntityIds(state, playerId))
    .map((action) => scoreAIAction(features, action, genome));
  const action = selectAIAction(scored, createFromString(`balance:${genome.strategyId}:${state.tick}`));
  return toGameCommand(action, playerId, state.tick, 0);
}
