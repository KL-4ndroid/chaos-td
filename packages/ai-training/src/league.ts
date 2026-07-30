import { CONFIG_VERSION, MVP_MIRROR_01, type PlayerSlot } from '@chaos-td/game-data';
import { createFromString, createSimulation, type GameCommand, type LaneRuntimeState } from '@chaos-td/game-core';
import {
  buildAIObservation,
  createDefaultAIStrategyGenome,
  extractAIFeaturesFromObservation,
  generateLegalActions,
  scoreAIAction,
  selectAIAction,
  toGameCommand,
  type AIStrategyGenome,
  type AIObservation,
  type BuildAIObservationInput,
} from '@chaos-td/ai-strategy';

export interface TrainingConfig {
  readonly populationSize: number;
  readonly generations: number;
  readonly matchesPerGenome: number;
  readonly seedRegistry: readonly string[];
  readonly mutationRate: number;
  readonly crossoverRate: number;
  readonly eliteCount: number;
  readonly hallOfFameOpponentCount: number;
}

export interface SelfPlayMatchSummary {
  readonly seed: string;
  readonly p1StrategyId: string;
  readonly p2StrategyId: string;
  readonly finalTick: number;
  readonly winnerId: PlayerSlot | null;
  readonly outcome: 'win' | 'draw';
  readonly completion: 'result' | 'tick_guard';
  readonly acceptedCommands: number;
  readonly rejectedCommands: number;
  readonly finalStateHash: string;
}

function createLanes(): Record<'lane_p1' | 'lane_p2', LaneRuntimeState> {
  const createLane = (laneId: 'lane_p1' | 'lane_p2'): LaneRuntimeState => {
    const definition = MVP_MIRROR_01.lanes.find((lane) => lane.id === laneId);
    if (!definition) throw new Error(`Missing lane ${laneId}`);
    return {
      laneId,
      battlefieldId: laneId,
      defenderId: definition.defenderPlayerId,
      attackerId: definition.attackerPlayerId,
      waypoints: [],
      spawnPosition: { xMilliTiles: 0, yMilliTiles: 0 },
      endPosition: { xMilliTiles: 0, yMilliTiles: 0 },
      segments: [],
      totalPathLength: 0,
      spawnQueue: [],
      monsters: [],
      pendingLeaks: [],
      spawnCooldownTicks: 0,
    };
  };
  return { lane_p1: createLane('lane_p1'), lane_p2: createLane('lane_p2') };
}

function buildTowerEntityMap(towers: readonly { entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: PlayerSlot }[]): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const tower of towers) {
    map.set(`${tower.towerTypeId}:${tower.cellX}:${tower.cellY}`, tower.entityId);
  }
  return map;
}

function commandKey(command: GameCommand): string {
  const detail =
    command.type === 'build_tower'
      ? `${command.towerTypeId}:${command.cellX}:${command.cellY}`
      : command.type === 'queue_monster'
        ? `${command.monsterTypeId}:${command.quantity}`
        : `${command.towerEntityId}`;
  return `${command.type}:${detail}:${command.playerId}`;
}

/**
 * Builds a sanitized observation input from simulation state.
 *
 * INTEGRATED: Self-play (this module) is the sole official runtime adapter.
 * The caller (league self-play) is trusted to construct the input from
 * authoritative simulation state. The type system prevents opponent gold/income
 * from reaching the builder.
 *
 * Balance sim: NOT_INTEGRATED — must construct its own adapter.
 * Client: NOT_INTEGRATED — no Playtest adapter yet.
 */
export function decideStrategyCommand(
  obs: AIObservation,
  genome: AIStrategyGenome,
  policyRandomSeed: string,
  towerEntityMap: ReadonlyMap<string, number>,
): GameCommand | null {
  const features = extractAIFeaturesFromObservation(obs);
  const scored = generateLegalActions(obs, towerEntityMap).map((action) => scoreAIAction(features, action, genome));
  const action = selectAIAction(scored, createFromString(policyRandomSeed));
  return toGameCommand(action, obs.playerId, obs.tick, 0);
}

/**
 * Self-play only: constructs BuildAIObservationInput from the authoritative simulation state.
 * Exposes self gold/income and opponent HP only.
 */
function buildObsInput(
  state: {
    readonly players: Record<PlayerSlot, { hp: number; gold: number; income: number; totalInvested: number }>;
    readonly lanes: Record<'lane_p1' | 'lane_p2', {
      monsters: readonly { hp: number; shield: number; leakDamage: number; pathProgressMilliTiles: number; movementType: string; tags: readonly string[] }[];
      spawnQueue: readonly unknown[];
    }>;
    readonly towers: readonly { entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: PlayerSlot; level: number }[];
    readonly tick: number;
    readonly phase: 'countdown' | 'running' | 'result';
    readonly waveScheduler: { currentWaveNumber: number };
  },
  playerId: PlayerSlot,
): BuildAIObservationInput {
  const oppId: PlayerSlot = playerId === 'p1' ? 'p2' : 'p1';

  // p1 attacks lane_p2 (defended by p2), p2 attacks lane_p1 (defended by p1)
  // ownBattlefield = lane this player is defending (wave monsters on own side)
  // opponentBattlefield = lane opponent is defending (wave monsters on opponent's side)
  const ownLaneId: 'lane_p1' | 'lane_p2' = playerId === 'p1' ? 'lane_p1' : 'lane_p2';
  const oppLaneId: 'lane_p1' | 'lane_p2' = playerId === 'p1' ? 'lane_p2' : 'lane_p1';

  // Own outbound queue is the queue in the lane this player attacks (opponent's lane)
  const ownOutboundLaneId: 'lane_p1' | 'lane_p2' = oppLaneId;
  // Opponent outbound queue is the queue in the lane the opponent attacks (own lane) — hidden

  const ownTowers = state.towers
    .filter((t) => t.ownerId === playerId)
    .map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY }));

  const oppTowers = state.towers
    .filter((t) => t.ownerId === oppId)
    .map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY }));

  return {
    selfPlayer: {
      hp: state.players[playerId].hp,
      gold: state.players[playerId].gold,
      income: state.players[playerId].income,
      totalInvested: state.players[playerId].totalInvested,
    },
    publicOpponent: {
      hp: state.players[oppId].hp,
    },
    ownBattlefield: {
      monsters: state.lanes[ownLaneId].monsters as BuildAIObservationInput['ownBattlefield']['monsters'],
      outboundQueue: state.lanes[ownOutboundLaneId].spawnQueue,
    },
    opponentBattlefield: {
      monsters: state.lanes[oppLaneId].monsters as BuildAIObservationInput['opponentBattlefield']['monsters'],
    },
    ownTowers,
    opponentTowers: oppTowers,
    tick: state.tick,
    phase: state.phase,
    waveNumber: state.waveScheduler.currentWaveNumber,
  };
}

export function runSelfPlayMatch(
  seed: string,
  p1Strategy: AIStrategyGenome,
  p2Strategy: AIStrategyGenome,
  maxTicks = 10000,
): SelfPlayMatchSummary {
  const simulation = createSimulation({ seed, configVersion: CONFIG_VERSION }, createLanes());
  let acceptedCommands = 0;
  let rejectedCommands = 0;
  simulation.start();

  while (simulation.state.phase !== 'result' && simulation.state.tick < maxTicks) {
    const state = simulation.state;

    const stateForP1 = {
      players: state.players,
      lanes: state.lanes,
      towers: state.towers,
      tick: state.tick,
      phase: state.phase as 'countdown' | 'running' | 'result',
      waveScheduler: state.waveScheduler,
    };

    const p1Input = buildObsInput(stateForP1, 'p1');
    const p2Input = buildObsInput(stateForP1, 'p2');

    const p1Obs = buildAIObservation('p1', p1Input);
    const p2Obs = buildAIObservation('p2', p2Input);

    const towerMap = buildTowerEntityMap(state.towers);

    const p1Cmd = decideStrategyCommand(p1Obs, p1Strategy, `${seed}:p1:${p1Strategy.strategyId}:${state.tick}`, towerMap);
    const p2Cmd = decideStrategyCommand(p2Obs, p2Strategy, `${seed}:p2:${p2Strategy.strategyId}:${state.tick}`, towerMap);

    const commands = [p1Cmd, p2Cmd].filter((command): command is GameCommand => command !== null)
      .sort((left, right) => commandKey(left).localeCompare(commandKey(right)));

    for (const command of commands) simulation.submitCommand(command);
    const events = simulation.step().events;
    acceptedCommands += events.filter((e) => e.type === 'command_accepted').length;
    rejectedCommands += events.filter((e) => e.type === 'command_rejected').length;
  }

  const result = simulation.state.phase === 'result' ? simulation.getCanonicalState().result : null;
  return {
    seed,
    p1StrategyId: p1Strategy.strategyId,
    p2StrategyId: p2Strategy.strategyId,
    finalTick: simulation.state.tick,
    winnerId: result?.winnerPlayerId ?? null,
    outcome: result?.outcome ?? 'draw',
    completion: result ? 'result' : 'tick_guard',
    acceptedCommands,
    rejectedCommands,
    finalStateHash: simulation.state.stateHash,
  };
}

export function createSmokePopulation(size = 16): readonly AIStrategyGenome[] {
  return Array.from({ length: size }, (_, index) =>
    createDefaultAIStrategyGenome(`smoke-${String(index + 1).padStart(3, '0')}`),
  );
}

export const AI_TRAINING_SMOKE_CONFIG: TrainingConfig = Object.freeze({
  populationSize: 16,
  generations: 2,
  matchesPerGenome: 1,
  seedRegistry: Object.freeze(['ai-smoke-001', 'ai-smoke-002', 'ai-smoke-003']),
  mutationRate: 120,
  crossoverRate: 500,
  eliteCount: 2,
  hallOfFameOpponentCount: 2,
});
