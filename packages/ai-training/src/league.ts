import { CONFIG_VERSION, GLOBAL_CONFIG, MVP_MIRROR_01, type PlayerSlot } from '@chaos-td/game-data';
import { createFromString, createPathSegments, calculatePathLength, createSimulation, type GameCommand, type LaneRuntimeState } from '@chaos-td/game-core';
import { createDefaultAIStrategyGenome, extractAIFeatures, generateLegalActions, scoreAIAction, selectAIAction, toGameCommand, type AIStrategyGenome } from '@chaos-td/ai-strategy';

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
      laneId, battlefieldId: laneId, defenderId: definition.defenderPlayerId, attackerId: definition.attackerPlayerId,
      waypoints: definition.waypoints, spawnPosition: definition.spawnPosition, endPosition: definition.endPosition,
      segments: createPathSegments(definition.waypoints), totalPathLength: calculatePathLength(definition.waypoints),
      spawnQueue: [], monsters: [], pendingLeaks: [], spawnCooldownTicks: 0,
    };
  };
  return { lane_p1: createLane('lane_p1'), lane_p2: createLane('lane_p2') };
}

function commandKey(command: GameCommand): string {
  const detail = command.type === 'build_tower' ? `${command.towerTypeId}:${command.cellX}:${command.cellY}`
    : command.type === 'queue_monster' ? `${command.monsterTypeId}:${command.quantity}`
      : `${command.towerEntityId}`;
  return `${command.type}:${detail}:${command.playerId}`;
}

function decideCommand(state: Parameters<typeof extractAIFeatures>[0], playerId: PlayerSlot, genome: AIStrategyGenome, policyRngSeed: string): GameCommand | null {
  const features = extractAIFeatures(state, playerId);
  const scored = generateLegalActions(state, playerId).map((action) => scoreAIAction(features, action, genome));
  const action = selectAIAction(scored, createFromString(`${policyRngSeed}:${state.tick}`));
  return toGameCommand(action, playerId, state.tick, 0);
}

export function runSelfPlayMatch(seed: string, p1Strategy: AIStrategyGenome, p2Strategy: AIStrategyGenome, maxTicks = GLOBAL_CONFIG.maxRunningTicks + GLOBAL_CONFIG.countdownTicks + GLOBAL_CONFIG.maxResolvingTicks): SelfPlayMatchSummary {
  const simulation = createSimulation({ seed, configVersion: CONFIG_VERSION }, createLanes());
  let acceptedCommands = 0;
  let rejectedCommands = 0;
  simulation.start();
  while (simulation.state.phase !== 'result' && simulation.state.tick < maxTicks) {
    const stateSnapshot = simulation.state;
    const commands = [
      decideCommand(stateSnapshot, 'p1', p1Strategy, `${seed}:p1:${p1Strategy.strategyId}`),
      decideCommand(stateSnapshot, 'p2', p2Strategy, `${seed}:p2:${p2Strategy.strategyId}`),
    ].filter((command): command is GameCommand => command !== null).sort((left, right) => commandKey(left).localeCompare(commandKey(right)));
    for (const command of commands) simulation.submitCommand(command);
    const events = simulation.step().events;
    acceptedCommands += events.filter((event) => event.type === 'command_accepted').length;
    rejectedCommands += events.filter((event) => event.type === 'command_rejected').length;
  }
  const result = simulation.state.phase === 'result' ? simulation.getCanonicalState().result : null;
  return {
    seed, p1StrategyId: p1Strategy.strategyId, p2StrategyId: p2Strategy.strategyId,
    finalTick: simulation.state.tick, winnerId: result?.winnerPlayerId ?? null,
    outcome: result?.outcome ?? 'draw', completion: result ? 'result' : 'tick_guard',
    acceptedCommands, rejectedCommands, finalStateHash: simulation.state.stateHash,
  };
}

export function createSmokePopulation(size = 16): readonly AIStrategyGenome[] {
  return Array.from({ length: size }, (_, index) => createDefaultAIStrategyGenome(`smoke-${String(index + 1).padStart(3, '0')}`));
}

export const AI_TRAINING_SMOKE_CONFIG: TrainingConfig = Object.freeze({
  populationSize: 16, generations: 2, matchesPerGenome: 1, seedRegistry: Object.freeze(['ai-smoke-001', 'ai-smoke-002', 'ai-smoke-003']),
  mutationRate: 120, crossoverRate: 500, eliteCount: 2, hallOfFameOpponentCount: 2,
});
