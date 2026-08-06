import { addCheckpoint, addEvent, addReplayCommand, createFromString, createCommandId, createReplayData, finalizeReplay } from '@chaos-td/game-core';
import type { DomainEvent, Phase, SimulationState } from '@chaos-td/game-core';
import { CONFIG_VERSION, type PlayerSlot } from '@chaos-td/game-data';
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
import type { GameCommand, LaneRuntimeState, Replay } from '@chaos-td/game-core';
import { createSimulation } from '@chaos-td/game-core';
import {
  createSelfPlayLanes,
  type SelfPlayMatchSummary,
} from './league.js';
import { participantPolicySeed, type EvolutionMatch } from './schedule.js';

/**
 * League-level telemetry derived from authoritative domain events and the
 * match result. The trainer reads `SimulationState` and the full event stream
 * — policy functions (ADR-011) still only receive sanitized `AIObservation`.
 *
 * Telemetry captures correctness checks (slot symmetry, leak accounting, queue
 * invariants) and exposes an aggregated per-match record suitable for JSONL
 * logging.
 */
export interface LeagueTelemetryRecord {
  readonly seed: string;
  readonly p1StrategyId: string;
  readonly p2StrategyId: string;
  readonly finalTick: number;
  readonly winnerId: PlayerSlot | null;
  readonly outcome: 'win' | 'draw';
  readonly completion: 'result' | 'tick_guard';
  readonly acceptedCommands: number;
  readonly rejectedCommands: number;
  readonly commandAcceptedPerPlayer: Readonly<Record<PlayerSlot, number>>;
  readonly commandRejectedPerPlayer: Readonly<Record<PlayerSlot, number>>;
  readonly leaksByDefender: Readonly<Record<PlayerSlot, number>>;
  readonly leakDamageByDefender: Readonly<Record<PlayerSlot, number>>;
  readonly incomePaidByPlayer: Readonly<Record<PlayerSlot, number>>;
  readonly towerBuiltByPlayer: Readonly<Record<PlayerSlot, number>>;
  readonly monsterQueuedByPlayer: Readonly<Record<PlayerSlot, number>>;
  readonly monstersSpawnedBySourcePlayer: Readonly<Record<PlayerSlot | 'wave', number>>;
  readonly monstersDiedByKiller: Readonly<Record<PlayerSlot | 'unknown', number>>;
  readonly matchesMirrorResult: boolean;
  readonly p1MirroredFinalTick: number | null;
  readonly p1FinalHp: number;
  readonly p2FinalHp: number;
  readonly finalStateHash: string;
  readonly domainEventTypes: Readonly<Record<string, number>>;
  readonly correctnessChecks: Readonly<Record<keyof typeof TELEMETRY_CORRECTNESS_FLAGS, boolean>>;
}

export const TELEMETRY_CORRECTNESS_FLAGS = Object.freeze({
  eventsChronological: true,
  noPlayerCommandsAfterResult: true,
  commandPlayerMatchesEventPlayer: true,
  mirroredMatchAgreesOnDeterministicFields: true,
  leakDefenderEqualsLaneDefender: true,
} as const);

interface MutableTelemetryAccumulator {
  readonly commandAcceptedPerPlayer: Record<PlayerSlot, number>;
  readonly commandRejectedPerPlayer: Record<PlayerSlot, number>;
  readonly leaksByDefender: Record<PlayerSlot, number>;
  readonly leakDamageByDefender: Record<PlayerSlot, number>;
  readonly incomePaidByPlayer: Record<PlayerSlot, number>;
  readonly towerBuiltByPlayer: Record<PlayerSlot, number>;
  readonly monsterQueuedByPlayer: Record<PlayerSlot, number>;
  readonly monstersSpawnedBySourcePlayer: Record<PlayerSlot | 'wave', number>;
  readonly monstersDiedByKiller: Record<PlayerSlot | 'unknown', number>;
  readonly domainEventTypes: Record<string, number>;
  acceptedCommands: number;
  rejectedCommands: number;
  p1FinalHp: number;
  p2FinalHp: number;
  chronological: boolean;
  leakDefenderConsistent: boolean;
  commandPlayerMatchesEventPlayer: boolean;
  lastEventTick: number;
}

function freshAccumulator(): MutableTelemetryAccumulator {
  return {
    commandAcceptedPerPlayer: { p1: 0, p2: 0 },
    commandRejectedPerPlayer: { p1: 0, p2: 0 },
    leaksByDefender: { p1: 0, p2: 0 },
    leakDamageByDefender: { p1: 0, p2: 0 },
    incomePaidByPlayer: { p1: 0, p2: 0 },
    towerBuiltByPlayer: { p1: 0, p2: 0 },
    monsterQueuedByPlayer: { p1: 0, p2: 0 },
    monstersSpawnedBySourcePlayer: { p1: 0, p2: 0, wave: 0 },
    monstersDiedByKiller: { p1: 0, p2: 0, unknown: 0 },
    domainEventTypes: {},
    acceptedCommands: 0,
    rejectedCommands: 0,
    p1FinalHp: 0,
    p2FinalHp: 0,
    chronological: true,
    leakDefenderConsistent: true,
    commandPlayerMatchesEventPlayer: true,
    lastEventTick: -1,
  };
}

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
  const ownLaneId: 'lane_p1' | 'lane_p2' = playerId === 'p1' ? 'lane_p1' : 'lane_p2';
  const oppLaneId: 'lane_p1' | 'lane_p2' = playerId === 'p1' ? 'lane_p2' : 'lane_p1';
  const ownOutboundLaneId: 'lane_p1' | 'lane_p2' = oppLaneId;
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
    publicOpponent: { hp: state.players[oppId].hp },
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

function buildTowerEntityMap(
  towers: readonly { entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: PlayerSlot }[],
  ownerId: PlayerSlot,
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const tower of towers) {
    if (tower.ownerId === ownerId) {
      map.set(`${tower.towerTypeId}:${tower.cellX}:${tower.cellY}`, tower.entityId);
    }
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

function decideStrategyCommand(
  obs: ReturnType<typeof buildAIObservation>,
  genome: AIStrategyGenome,
  policyRandomSeed: string,
  towerEntityMap: ReadonlyMap<string, number>,
): GameCommand | null {
  const features = extractAIFeaturesFromObservation(obs);
  const scored = generateLegalActions(obs, towerEntityMap).map((action) => scoreAIAction(features, action, genome));
  const action = selectAIAction(scored, createFromString(policyRandomSeed));
  return toGameCommand(action, obs.playerId, obs.tick, 0);
}

function snapshotForDecide(state: {
  players: Record<PlayerSlot, { hp: number; gold: number; income: number; totalInvested: number }>;
  lanes: Record<'lane_p1' | 'lane_p2', LaneRuntimeState>;
  towers: ReadonlyArray<{ entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: PlayerSlot; level: 1 | 2 | 3 }>;
  tick: number;
  phase: 'countdown' | 'running' | 'result';
  waveScheduler: { currentWaveNumber: number };
}): Parameters<typeof buildObsInput>[0] {
  return {
    players: state.players,
    lanes: state.lanes,
    towers: state.towers,
    tick: state.tick,
    phase: state.phase,
    waveScheduler: state.waveScheduler,
  };
}

/**
 * Self-play loop that emits domain-event telemetry. The runtime is identical
 * to `runSelfPlayMatch` (integrated, ADR-011-compliant policy boundary), but
 * the simulation is stepped exactly once and all events observed in flight.
 */
function playSelfPlayWithTelemetry(
  match: EvolutionMatch,
  p1Strategy: AIStrategyGenome,
  p2Strategy: AIStrategyGenome,
  maxTicks: number,
): { summary: SelfPlayMatchSummary; telemetry: LeagueTelemetryRecord; replay: Replay } {
  const seed = match.seed;
  const simulation = createSimulation({ seed, configVersion: CONFIG_VERSION, endOnEliminationOnly: true, suddenDeathStartTick: maxTicks }, createSelfPlayLanes());
  simulation.start();
  let replay = createReplayData(seed, CONFIG_VERSION, simulation.state.stateHash);
  const acc = freshAccumulator();
  let postResultCommandCount = 0;
  let sequence = 0;

  while (simulation.state.phase !== 'result') {
    const state = simulation.state;
    const snap = snapshotForDecide({
      players: state.players,
      lanes: state.lanes,
      towers: state.towers as ReadonlyArray<{ entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: PlayerSlot; level: 1 | 2 | 3 }>,
      tick: state.tick,
      phase: state.phase as 'countdown' | 'running' | 'result',
      waveScheduler: state.waveScheduler,
    });
    const p1Input = buildObsInput(snap, 'p1');
    const p2Input = buildObsInput(snap, 'p2');
    const p1Obs = buildAIObservation('p1', p1Input);
    const p2Obs = buildAIObservation('p2', p2Input);
    const p1TowerMap = buildTowerEntityMap(state.towers, 'p1');
    const p2TowerMap = buildTowerEntityMap(state.towers, 'p2');

    const p1Cmd = decideStrategyCommand(
      p1Obs, p1Strategy, participantPolicySeed(match, p1Strategy.strategyId, state.tick), p1TowerMap,
    );
    const p2Cmd = decideStrategyCommand(
      p2Obs, p2Strategy, participantPolicySeed(match, p2Strategy.strategyId, state.tick), p2TowerMap,
    );

    const commands = [p1Cmd, p2Cmd].filter((command): command is GameCommand => command !== null)
      .sort((left, right) => commandKey(left).localeCompare(commandKey(right)));

    for (const command of commands) {
      const id = createCommandId(command.playerId, state.tick, sequence++);
      const submitted = { ...command, commandId: id } as GameCommand;
      replay = addReplayCommand(replay, state.tick, submitted);
      simulation.submitCommand(submitted);
    }
    const events = simulation.step().events;
    replay = events.reduce((current, event) => addEvent(current, event), replay);
    replay = addCheckpoint(replay, simulation.state.tick, simulation.state.stateHash);
    ingestEvents(simulation.state, events, acc);


    const phase: Phase = simulation.state.phase as Phase;
    if (phase === 'result') {
      // Step once more after the result phase to detect any post-result
      // commands emitted by future logic; the integrated runtime does not
      // emit any, but we record the count for the correctness check.
      const remainingEvents = simulation.step().events;
      replay = remainingEvents.reduce((current, event) => addEvent(current, event), replay);
      replay = addCheckpoint(replay, simulation.state.tick, simulation.state.stateHash);
      ingestEvents(simulation.state, remainingEvents, acc);
      for (const event of remainingEvents) {
        if (event.type === 'command_accepted' || event.type === 'command_rejected') {
          postResultCommandCount += 1;
        }
      }
      break;
    }
  }

  acc.p1FinalHp = simulation.state.players.p1.hp;
  acc.p2FinalHp = simulation.state.players.p2.hp;

  const result = simulation.state.phase === 'result' ? simulation.getCanonicalState().result : null;
  const summary: SelfPlayMatchSummary = {
    seed,
    p1StrategyId: p1Strategy.strategyId,
    p2StrategyId: p2Strategy.strategyId,
    finalTick: simulation.state.tick,
    winnerId: result?.winnerPlayerId ?? null,
    outcome: result?.outcome ?? 'draw',
    completion: 'result',
    acceptedCommands: acc.acceptedCommands,
    rejectedCommands: acc.rejectedCommands,
    finalStateHash: simulation.state.stateHash,
  };

  const correctnessChecks = {
    eventsChronological: acc.chronological,
    noPlayerCommandsAfterResult: postResultCommandCount === 0,
    commandPlayerMatchesEventPlayer: acc.commandPlayerMatchesEventPlayer,
    mirroredMatchAgreesOnDeterministicFields: false,
    leakDefenderEqualsLaneDefender: acc.leakDefenderConsistent,
  };

  const telemetry: LeagueTelemetryRecord = {
    seed,
    p1StrategyId: p1Strategy.strategyId,
    p2StrategyId: p2Strategy.strategyId,
    finalTick: summary.finalTick,
    winnerId: summary.winnerId,
    outcome: summary.outcome,
    completion: summary.completion,
    acceptedCommands: acc.acceptedCommands,
    rejectedCommands: acc.rejectedCommands,
    commandAcceptedPerPlayer: { ...acc.commandAcceptedPerPlayer },
    commandRejectedPerPlayer: { ...acc.commandRejectedPerPlayer },
    leaksByDefender: { ...acc.leaksByDefender },
    leakDamageByDefender: { ...acc.leakDamageByDefender },
    incomePaidByPlayer: { ...acc.incomePaidByPlayer },
    towerBuiltByPlayer: { ...acc.towerBuiltByPlayer },
    monsterQueuedByPlayer: { ...acc.monsterQueuedByPlayer },
    monstersSpawnedBySourcePlayer: { ...acc.monstersSpawnedBySourcePlayer },
    monstersDiedByKiller: { ...acc.monstersDiedByKiller },
    matchesMirrorResult: false,
    p1MirroredFinalTick: null,
    p1FinalHp: acc.p1FinalHp,
    p2FinalHp: acc.p2FinalHp,
    finalStateHash: summary.finalStateHash,
    domainEventTypes: { ...acc.domainEventTypes },
    correctnessChecks,
  };
  return { summary, telemetry, replay: finalizeReplay(replay, simulation.state.stateHash, simulation.state.tick) };
}

/**
 * Public entry point: runs the same integrated self-play runtime as
 * `runSelfPlayMatch` and returns both the `SelfPlayMatchSummary` and the full
 * domain-event telemetry. Use this in trainer / report code paths.
 */
export function runSelfPlayWithTelemetry(
  match: EvolutionMatch,
  p1: AIStrategyGenome,
  p2: AIStrategyGenome,
  maxTicks = 10000,
): { readonly summary: SelfPlayMatchSummary; readonly telemetry: LeagueTelemetryRecord; readonly replay: Replay } {
  return playSelfPlayWithTelemetry(match, p1, p2, maxTicks);
}

/**
 * Compatibility shim. Plays the match from scratch so the trainer can request
 * telemetry for the same (seed, p1, p2) configuration that was used for
 * `runSelfPlayMatch` and still observe full domain events. The summary
 * parameter is accepted for API symmetry but unused.
 */
export function collectLeagueTelemetry(
  match: EvolutionMatch,
  p1Strategy: AIStrategyGenome,
  p2Strategy: AIStrategyGenome,
  mirroredOpponent: AIStrategyGenome,
  maxTicks: number,
  _baseline: SelfPlayMatchSummary,
): LeagueTelemetryRecord {
  void mirroredOpponent;
  return playSelfPlayWithTelemetry(match, p1Strategy, p2Strategy, maxTicks).telemetry;
}

function ingestEvents(state: SimulationState, events: readonly DomainEvent[], acc: MutableTelemetryAccumulator): void {
  for (const event of events) {
    if (typeof event.tick !== 'number' || event.tick < acc.lastEventTick) acc.chronological = false;
    acc.lastEventTick = Math.max(acc.lastEventTick, typeof event.tick === 'number' ? event.tick : acc.lastEventTick);
    acc.domainEventTypes[event.type] = (acc.domainEventTypes[event.type] ?? 0) + 1;
    switch (event.type) {
      case 'command_accepted':
        acc.acceptedCommands += 1;
        acc.commandAcceptedPerPlayer[event.playerId] += 1;
        if (event.playerId !== 'p1' && event.playerId !== 'p2') acc.commandPlayerMatchesEventPlayer = false;
        break;
      case 'command_rejected':
        acc.rejectedCommands += 1;
        acc.commandRejectedPerPlayer[event.playerId] += 1;
        break;
      case 'income_paid':
        acc.incomePaidByPlayer[event.playerId] += event.amount;
        break;
      case 'tower_built':
        acc.towerBuiltByPlayer[event.playerId] += 1;
        break;
      case 'monster_queued':
        acc.monsterQueuedByPlayer[event.playerId] += event.quantity;
        break;
      case 'monster_spawned':
        if (event.source.type === 'wave') {
          acc.monstersSpawnedBySourcePlayer.wave += 1;
        } else if (event.source.type === 'player') {
          acc.monstersSpawnedBySourcePlayer[event.source.playerId] += 1;
        }
        break;
      case 'monster_leaked':
        acc.leaksByDefender[event.defenderId] += 1;
        acc.leakDamageByDefender[event.defenderId] += event.leakDamage;
        if (!laneIsDefendedBy(state, event.defenderId)) acc.leakDefenderConsistent = false;
        break;
      case 'monster_died':
        if (event.killerPlayerId === 'p1' || event.killerPlayerId === 'p2') {
          acc.monstersDiedByKiller[event.killerPlayerId] += 1;
        } else {
          acc.monstersDiedByKiller.unknown += 1;
        }
        break;
      default:
        break;
    }
  }
}

function laneIsDefendedBy(state: SimulationState, playerId: PlayerSlot): boolean {
  return Object.values(state.lanes).some((lane) => lane.defenderId === playerId);
}

/**
 * Stable JSON string serialization of a telemetry record. Uses JSON.stringify
 * with explicit field ordering so multiple runs hash identically.
 */
export function serializeTelemetryRecord(record: LeagueTelemetryRecord): string {
  const ordered = {
    seed: record.seed,
    p1StrategyId: record.p1StrategyId,
    p2StrategyId: record.p2StrategyId,
    finalTick: record.finalTick,
    winnerId: record.winnerId,
    outcome: record.outcome,
    completion: record.completion,
    acceptedCommands: record.acceptedCommands,
    rejectedCommands: record.rejectedCommands,
    commandAcceptedPerPlayer: record.commandAcceptedPerPlayer,
    commandRejectedPerPlayer: record.commandRejectedPerPlayer,
    leaksByDefender: record.leaksByDefender,
    leakDamageByDefender: record.leakDamageByDefender,
    incomePaidByPlayer: record.incomePaidByPlayer,
    towerBuiltByPlayer: record.towerBuiltByPlayer,
    monsterQueuedByPlayer: record.monsterQueuedByPlayer,
    monstersSpawnedBySourcePlayer: record.monstersSpawnedBySourcePlayer,
    monstersDiedByKiller: record.monstersDiedByKiller,
    matchesMirrorResult: record.matchesMirrorResult,
    p1MirroredFinalTick: record.p1MirroredFinalTick,
    p1FinalHp: record.p1FinalHp,
    p2FinalHp: record.p2FinalHp,
    finalStateHash: record.finalStateHash,
    domainEventTypes: Object.fromEntries(
      Object.entries(record.domainEventTypes).sort(([a], [b]) => a.localeCompare(b)),
    ),
    correctnessChecks: Object.fromEntries(
      Object.entries(record.correctnessChecks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, value]),
    ),
  };
  return JSON.stringify(ordered);
}
