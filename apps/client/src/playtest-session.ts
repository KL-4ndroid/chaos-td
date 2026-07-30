import {
  calculateLaneThreat,
  calculatePathLength,
  createAIStates,
  createPathSegments,
  createSimulation,
  processAIDecision,
  updateAIState,
  type AIState,
  type DomainEvent,
  type GameCommand,
  type LaneRuntimeState,
  type PlayerSlot,
  type Simulation,
} from '@chaos-td/game-core';
import {
  CONFIG_VERSION,
  GLOBAL_CONFIG,
  MONSTER_BY_ID,
  MVP_MIRROR_01,
  TOWER_BY_ID,
  type LaneId,
  type TowerId,
} from '@chaos-td/game-data';

export const PLAYTEST_SEED = 'phase1-human-vs-normal-ai-004';
export const PLAYTEST_CONTROLLERS = Object.freeze({ p1: 'human', p2: 'normal_ai' } as const);

export interface PlaytestCommandRecord {
  readonly command: GameCommand;
  readonly source: 'human' | 'normal_ai';
}

export interface PlaytestPlayerStats {
  readonly towerBuildCount: number;
  readonly playerSentMonsterCount: number;
  readonly waveLeakDamage: number;
  readonly opponentSendLeakDamage: number;
}

export interface PlaytestViewModel {
  readonly seed: string;
  readonly tick: number;
  readonly phase: string;
  readonly currentWave: number;
  readonly stateHash: string;
  readonly controllers: typeof PLAYTEST_CONTROLLERS;
  readonly activeMonsters: Record<PlayerSlot, number>;
  readonly waveMonsters: Record<PlayerSlot, number>;
  readonly playerSentMonsters: Record<PlayerSlot, number>;
  readonly sendQueueCounts: Record<PlayerSlot, number>;
  readonly playerStats: Record<PlayerSlot, PlaytestPlayerStats>;
  readonly lastEvents: readonly DomainEvent[];
  readonly lastCommand: PlaytestCommandRecord | null;
  readonly lastCommandOutcomes: Record<PlayerSlot, Extract<DomainEvent, { type: 'command_accepted' | 'command_rejected' }> | null>;
  readonly normalAiState: Pick<AIState, 'lastDecisionTick' | 'defenseReserve' | 'offenseBudgetRatioPermille' | 'recentRejectedCommands'>;
}

function createLanes(): Record<LaneId, LaneRuntimeState> {
  const createLane = (laneId: LaneId): LaneRuntimeState => {
    const definition = MVP_MIRROR_01.lanes.find((candidate) => candidate.id === laneId);
    if (!definition) throw new Error(`Missing lane definition: ${laneId}`);
    const segments = createPathSegments(definition.waypoints);
    return {
      laneId,
      battlefieldId: laneId,
      defenderId: definition.defenderPlayerId,
      attackerId: definition.attackerPlayerId,
      waypoints: definition.waypoints,
      spawnPosition: definition.spawnPosition,
      endPosition: definition.endPosition,
      segments,
      totalPathLength: calculatePathLength(definition.waypoints),
      spawnQueue: [],
      monsters: [],
      pendingLeaks: [],
      spawnCooldownTicks: 0,
    };
  };

  return { lane_p1: createLane('lane_p1'), lane_p2: createLane('lane_p2') };
}

function laneIdFor(playerId: PlayerSlot): LaneId {
  return playerId === 'p1' ? 'lane_p1' : 'lane_p2';
}

function opponentLaneIdFor(playerId: PlayerSlot): LaneId {
  return playerId === 'p1' ? 'lane_p2' : 'lane_p1';
}

function toCommand(simulation: Simulation, playerId: PlayerSlot, decision: ReturnType<typeof processAIDecision>): GameCommand | null {
  const params = decision.params;
  if (
    decision.action === 'build_tower'
    && params?.towerType
    && params.cellX !== undefined
    && params.cellY !== undefined
    && TOWER_BY_ID.has(params.towerType)
  ) {
    return {
      type: 'build_tower',
      commandId: simulation.getNextCommandId(playerId),
      playerId,
      towerTypeId: params.towerType as TowerId,
      cellX: params.cellX,
      cellY: params.cellY,
    };
  }
  if (
    decision.action === 'queue_monster'
    && params?.monsterType
    && params.quantity !== undefined
    && MONSTER_BY_ID.has(params.monsterType)
  ) {
    return {
      type: 'queue_monster',
      commandId: simulation.getNextCommandId(playerId),
      playerId,
      monsterTypeId: params.monsterType,
      quantity: params.quantity,
    };
  }
  return null;
}

export class PlaytestSession {
  readonly simulation: Simulation;
  private normalAiState: AIState;
  private readonly eventHistory: DomainEvent[] = [];
  private readonly playerStats: Record<PlayerSlot, { towerBuildCount: number; playerSentMonsterCount: number; waveLeakDamage: number; opponentSendLeakDamage: number }> = {
    p1: { towerBuildCount: 0, playerSentMonsterCount: 0, waveLeakDamage: 0, opponentSendLeakDamage: 0 },
    p2: { towerBuildCount: 0, playerSentMonsterCount: 0, waveLeakDamage: 0, opponentSendLeakDamage: 0 },
  };
  private lastCommand: PlaytestCommandRecord | null = null;
  private readonly lastCommandOutcomes: Record<PlayerSlot, Extract<DomainEvent, { type: 'command_accepted' | 'command_rejected' }> | null> = { p1: null, p2: null };

  constructor(readonly seed = PLAYTEST_SEED) {
    this.simulation = createSimulation({ seed, configVersion: CONFIG_VERSION }, createLanes());
    this.normalAiState = createAIStates(seed).p2;
    this.simulation.start();
  }

  submitHuman(command: GameCommand): void {
    if (command.playerId !== 'p1') throw new Error('Playtest human commands must belong to p1');
    this.simulation.submitCommand(command);
    this.lastCommand = { command, source: 'human' };
  }

  buildHumanTower(towerTypeId: TowerId, cellX: number, cellY: number): void {
    this.submitHuman({
      type: 'build_tower',
      commandId: this.simulation.getNextCommandId('p1'),
      playerId: 'p1',
      towerTypeId,
      cellX,
      cellY,
    });
  }

  queueHumanMonster(monsterTypeId: string, quantity = 1): void {
    this.submitHuman({
      type: 'queue_monster',
      commandId: this.simulation.getNextCommandId('p1'),
      playerId: 'p1',
      monsterTypeId,
      quantity,
    });
  }

  step(): { readonly events: readonly DomainEvent[] } {
    this.submitNormalAiDecision();
    const result = this.simulation.step();
    this.eventHistory.push(...result.events);
    if (this.eventHistory.length > 10) this.eventHistory.splice(0, this.eventHistory.length - 10);
    for (const event of result.events) {
      if (event.type === 'command_accepted' || event.type === 'command_rejected') {
        this.lastCommandOutcomes[event.playerId] = event;
      }
      if (event.type === 'tower_built') this.playerStats[event.playerId].towerBuildCount += 1;
      if (event.type === 'monster_queued') this.playerStats[event.playerId].playerSentMonsterCount += event.quantity;
      if (event.type === 'monster_leaked') {
        if (event.source.type === 'wave') this.playerStats[event.defenderId].waveLeakDamage += event.leakDamage;
        else this.playerStats[event.defenderId].opponentSendLeakDamage += event.leakDamage;
      }
    }
    return { events: result.events };
  }

  getViewModel(): PlaytestViewModel {
    const state = this.simulation.state;
    const activeMonsters: Record<PlayerSlot, number> = { p1: 0, p2: 0 };
    const waveMonsters: Record<PlayerSlot, number> = { p1: 0, p2: 0 };
    const playerSentMonsters: Record<PlayerSlot, number> = { p1: 0, p2: 0 };
    const sendQueueCounts: Record<PlayerSlot, number> = {
      p1: state.lanes.lane_p2.spawnQueue.length,
      p2: state.lanes.lane_p1.spawnQueue.length,
    };

    for (const playerId of ['p1', 'p2'] as const) {
      const lane = state.lanes[laneIdFor(playerId)];
      activeMonsters[playerId] = lane.monsters.filter((monster) => monster.hp > 0).length;
      waveMonsters[playerId] = lane.monsters.filter((monster) => monster.hp > 0 && monster.source.type === 'wave').length;
      playerSentMonsters[playerId] = lane.monsters.filter((monster) => monster.hp > 0 && monster.source.type === 'player').length;
    }

    return {
      seed: this.seed,
      tick: state.tick,
      phase: state.phase,
      currentWave: state.waveScheduler.currentWaveNumber,
      stateHash: state.stateHash,
      controllers: PLAYTEST_CONTROLLERS,
      activeMonsters,
      waveMonsters,
      playerSentMonsters,
      sendQueueCounts,
      playerStats: {
        p1: { ...this.playerStats.p1 },
        p2: { ...this.playerStats.p2 },
      },
      lastEvents: [...this.eventHistory],
      lastCommand: this.lastCommand,
      lastCommandOutcomes: { ...this.lastCommandOutcomes },
      normalAiState: {
        lastDecisionTick: this.normalAiState.lastDecisionTick,
        defenseReserve: this.normalAiState.defenseReserve,
        offenseBudgetRatioPermille: this.normalAiState.offenseBudgetRatioPermille,
        recentRejectedCommands: this.normalAiState.recentRejectedCommands,
      },
    };
  }

  private submitNormalAiDecision(): void {
    const state = this.simulation.state;
    if (state.phase !== 'running') return;

    const playerId: PlayerSlot = 'p2';
    const battlefieldId = laneIdFor(playerId);
    const lane = state.lanes[battlefieldId];
    const monstersAtRisk = lane.monsters.filter((monster) => monster.pathProgressMilliTiles * 4 >= lane.totalPathLength * 3).length;
    const laneDefinition = MVP_MIRROR_01.lanes.find((candidate) => candidate.id === battlefieldId);
    if (!laneDefinition) throw new Error(`Missing normal AI lane: ${battlefieldId}`);

    const decision = processAIDecision(
      playerId,
      this.normalAiState,
      state.tick,
      state.players[playerId].gold,
      calculateLaneThreat(lane.monsters.length, monstersAtRisk, 0, lane.totalPathLength),
      state.towers.filter((tower) => tower.ownerId === playerId).map((tower) => `${tower.cellX},${tower.cellY}`),
      state.lanes[opponentLaneIdFor(playerId)].spawnQueue.length,
      GLOBAL_CONFIG.sendQueueLimit,
      MONSTER_BY_ID.get('sheep')?.sendCost ?? 0,
      ['archer', 'mage', 'frost', 'sniper'],
      laneDefinition.aiBuildPriorityCells.map((cell) => ({ cellX: cell.col, cellY: cell.row })),
    );
    if (decision.reason !== 'not_decision_tick') {
      this.normalAiState = updateAIState(this.normalAiState, state.tick);
    }
    const command = toCommand(this.simulation, playerId, decision);
    if (command) {
      this.simulation.submitCommand(command);
      this.lastCommand = { command, source: 'normal_ai' };
    }
  }
}

export function createNextPlaytestSeed(previousSeed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < previousSeed.length; index += 1) {
    hash = Math.imul(hash ^ previousSeed.charCodeAt(index), 16777619) >>> 0;
  }
  return `phase1-playtest-${hash.toString(16).padStart(8, '0')}`;
}
