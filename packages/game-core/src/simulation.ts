/**
 * @chaos-td/game-core - Simulation
 *
 * Deterministic fixed-step simulation with phase state machine.
 * Must NOT use Date.now(), timers, or frame delta.
 *
 * Phase semantics:
 * - READY: Initial state. tick=0. Call start() to begin.
 * - COUNTDOWN: 60 ticks. No gameplay.
 * - RUNNING: Up to 12000 ticks. Full gameplay.
 * - RESOLVING: Up to 400 ticks. Cleanup only.
 * - RESULT: Final state. No more step() changes.
 */

import {
  PHASE_TICKS,
  INITIAL_GOLD,
  INITIAL_HP,
  INITIAL_INCOME,
  INCOME_INTERVAL_TICKS,
  SELL_REFUND_PERMILLE,
} from './constants';
import { type SeededRng, createFromString } from './prng';
import type { Phase, PlayerSlot, CanonicalState, MonsterState } from './canonical';
import { hashStateToString } from './canonical';
import type {
  AttackFiredEvent,
  DamageAppliedEvent,
  DomainEvent,
  MonsterDiedEvent,
  PhaseChangedEvent,
  MonsterSpawnedEvent,
  MonsterLeakedEvent,
  TowerBuiltEvent,
  TowerUpgradedEvent,
  TowerSoldEvent,
  CommandAcceptedEvent,
  CommandRejectedEvent,
  IncomePaidEvent,
} from './events';
import {
  TOWER_BY_ID,
  MONSTER_BY_ID,
  type LaneId,
  type FixedPointPosition,
} from '@chaos-td/game-data';
import { hasReachedEnd, type PathSegment, calculatePosition } from './movement';
import { compareTargetPriority, type TowerRuntimeState } from './tower';
import type { GameCommand, CommandId } from './commands';

export interface MatchConfig {
  seed: string;
  configVersion: string;
}

export interface PlayerSlotState {
  playerId: PlayerSlot;
}

export interface PlayerBattleState extends PlayerSlotState {
  hp: number;
  gold: number;
  income: number;
  totalInvested: number;
}

export interface LaneRuntimeState {
  laneId: LaneId;
  defenderId: PlayerSlot;
  attackerId: PlayerSlot;
  waypoints: readonly FixedPointPosition[];
  spawnPosition: FixedPointPosition;
  endPosition: FixedPointPosition;
  segments: readonly PathSegment[];
  totalPathLength: number;
  spawnQueue: MonsterSpawnParams[];
  monsters: MonsterRuntimeState[];
  pendingLeaks: MonsterSpawnParams[];
  spawnCooldownTicks: number;
}

export interface MonsterSpawnParams {
  entityId: number;
  ownerId: PlayerSlot;
  monsterTypeId: string;
  hp: number;
  shield: number;
  speedMilliTilesPerTick: number;
  leakDamage: number;
  spawnGapTicks: number;
}

export interface MonsterRuntimeState {
  entityId: number;
  ownerId: PlayerSlot;
  monsterTypeId: string;
  hp: number;
  shield: number;
  segmentIndex: number;
  distanceOnSegmentMilliTiles: number;
  pathProgressMilliTiles: number;
  speedMilliTilesPerTick: number;
  leakDamage: number;
}

export interface SimulationState {
  schemaVersion: 1;
  config: MatchConfig;
  phase: Phase;
  tick: number;
  runningStartedAtTick: number | null;
  resolvingStartedAtTick: number | null;
  players: Record<PlayerSlot, PlayerBattleState>;
  lanes: Record<LaneId, LaneRuntimeState>;
  towers: TowerRuntimeState[];
  nextEntityId: number;
  nextCommandIdSequence: number;
  pendingCommands: GameCommand[];
  stateHash: string;
}

export interface StepResult {
  state: SimulationState;
  events: readonly DomainEvent[];
}

export interface Simulation {
  readonly state: SimulationState;
  readonly rng: SeededRng;
  start(): Simulation;
  step(): StepResult;
  getCanonicalState(): CanonicalState;
  submitCommand(command: GameCommand): void;
  getNextCommandId(playerId: PlayerSlot): CommandId;
}

function computeStateHash(state: SimulationState): string {
  const monsters: MonsterState[] = [];
  for (const lane of Object.values(state.lanes)) {
    for (const monster of lane.monsters) {
      monsters.push({
        id: monster.entityId,
        ownerId: monster.ownerId,
        hp: monster.hp,
        shield: monster.shield,
        pathProgressMilliTiles: monster.pathProgressMilliTiles,
        alive: monster.hp > 0,
      });
    }
  }

  const canonical: CanonicalState = {
    schemaVersion: state.schemaVersion,
    configVersion: state.config.configVersion,
    seed: state.config.seed,
    phase: state.phase,
    tick: state.tick,
    players: state.players,
    towers: state.towers.map((tower) => ({
      id: tower.entityId,
      ownerId: tower.ownerId,
      level: tower.level,
      cellX: tower.cellX,
      cellY: tower.cellY,
    })),
    monsters,
    result: null,
  };
  return hashStateToString(canonical);
}

function createInitialPlayers(): Record<PlayerSlot, PlayerBattleState> {
  return {
    p1: { playerId: 'p1', hp: INITIAL_HP, gold: INITIAL_GOLD, income: INITIAL_INCOME, totalInvested: 0 },
    p2: { playerId: 'p2', hp: INITIAL_HP, gold: INITIAL_GOLD, income: INITIAL_INCOME, totalInvested: 0 },
  };
}

function createSimulationState(
  config: MatchConfig,
  lanes: Record<LaneId, LaneRuntimeState>,
  towers: TowerRuntimeState[],
): SimulationState {
  const state: SimulationState = {
    schemaVersion: 1,
    config,
    phase: 'ready',
    tick: 0,
    runningStartedAtTick: null,
    resolvingStartedAtTick: null,
    players: createInitialPlayers(),
    lanes,
    towers,
    nextEntityId: 1,
    nextCommandIdSequence: 0,
    pendingCommands: [],
    stateHash: '',
  };
  state.stateHash = computeStateHash(state);
  return state;
}

function transitionPhase(
  state: SimulationState,
  newPhase: Phase
): { state: SimulationState; event: PhaseChangedEvent | null } {
  const phaseEvent: PhaseChangedEvent = {
    type: 'phase_changed',
    tick: state.tick,
    fromPhase: state.phase,
    toPhase: newPhase,
  };

  const newState: SimulationState = {
    ...state,
    phase: newPhase,
  };

  if (newPhase === 'running' && state.phase === 'countdown') {
    newState.runningStartedAtTick = state.tick;
  }

  if (newPhase === 'resolving' && state.phase === 'running') {
    newState.resolvingStartedAtTick = state.tick;
  }

  newState.stateHash = computeStateHash(newState);
  return { state: newState, event: phaseEvent };
}

function processSpawns(state: SimulationState): { state: SimulationState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  const newState: SimulationState = { ...state, lanes: { ...state.lanes } };

  for (const [laneId, lane] of Object.entries(state.lanes)) {
    const newLane: LaneRuntimeState = { ...lane, monsters: [...lane.monsters] };

    // Process cooldown
    if (newLane.spawnCooldownTicks > 0) {
      newLane.spawnCooldownTicks--;
    }

    // Spawn monsters from queue
    if (newLane.spawnCooldownTicks === 0 && newLane.spawnQueue.length > 0) {
      const spawn = newLane.spawnQueue.shift();
      if (!spawn) {
        continue;
      }

      const monster: MonsterRuntimeState = {
        entityId: spawn.entityId,
        ownerId: spawn.ownerId,
        monsterTypeId: spawn.monsterTypeId,
        hp: spawn.hp,
        shield: spawn.shield,
        segmentIndex: 0,
        distanceOnSegmentMilliTiles: 0,
        pathProgressMilliTiles: 0,
        speedMilliTilesPerTick: spawn.speedMilliTilesPerTick,
        leakDamage: spawn.leakDamage,
      };

      newLane.monsters.push(monster);

      const spawnEvent: MonsterSpawnedEvent = {
        type: 'monster_spawned',
        tick: state.tick,
        playerId: spawn.ownerId,
        monsterEntityId: spawn.entityId,
        monsterType: spawn.monsterTypeId,
      };
      events.push(spawnEvent);

      // Set cooldown
      newLane.spawnCooldownTicks = spawn.spawnGapTicks;
    }

    newState.lanes[laneId as LaneId] = newLane;
  }

  return { state: newState, events };
}

function processMovement(state: SimulationState): { state: SimulationState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  const newState: SimulationState = { ...state, players: { ...state.players } };

  for (const [laneId, lane] of Object.entries(state.lanes)) {
    const newLane: LaneRuntimeState = {
      ...lane,
      monsters: lane.monsters.map((monster) => ({ ...monster })),
    };
    let defenderHp = newState.players[lane.defenderId].hp;

    for (let i = 0; i < newLane.monsters.length; i++) {
      const monster = newLane.monsters[i];
      if (!monster || monster.hp <= 0) continue;

      // Calculate movement
      const speed = monster.speedMilliTilesPerTick;
      monster.pathProgressMilliTiles += speed;
      monster.distanceOnSegmentMilliTiles += speed;

      // Update segment if needed
      while (monster.segmentIndex < newLane.segments.length - 1) {
        const currentSegment = newLane.segments[monster.segmentIndex];
        if (!currentSegment) {
          break;
        }
        if (monster.distanceOnSegmentMilliTiles >= currentSegment.lengthMilliTiles) {
          monster.distanceOnSegmentMilliTiles -= currentSegment.lengthMilliTiles;
          monster.segmentIndex++;
        } else {
          break;
        }
      }

      // Check if reached end
      if (hasReachedEnd(monster.pathProgressMilliTiles, newLane.totalPathLength)) {
        // Process leak
        const leakDamage = monster.leakDamage;
        defenderHp -= leakDamage;

        const leakEvent: MonsterLeakedEvent = {
          type: 'monster_leaked',
          tick: state.tick,
          ownerId: monster.ownerId,
          defenderId: lane.defenderId,
          monsterEntityId: monster.entityId,
          leakDamage,
          defenderNewHp: defenderHp,
        };
        events.push(leakEvent);

        // Remove monster
        monster.hp = 0;
      }
    }

    // Update defender HP
    newState.players[lane.defenderId] = {
      ...newState.players[lane.defenderId],
      hp: defenderHp,
    };

    newState.lanes[laneId as LaneId] = newLane;
  }

  return { state: newState, events };
}

function processCombat(state: SimulationState): { state: SimulationState; events: DomainEvent[] } {
  if (state.towers.length === 0) {
    return { state, events: [] };
  }

  const events: DomainEvent[] = [];
  const newState: SimulationState = {
    ...state,
    lanes: { ...state.lanes },
    towers: state.towers.map((tower) => ({ ...tower })),
  };

  for (const lane of Object.values(state.lanes)) {
    newState.lanes[lane.laneId] = {
      ...lane,
      monsters: lane.monsters.map((monster) => ({ ...monster })),
    };
  }

  const orderedTowers = [...newState.towers].sort((a, b) => a.entityId - b.entityId);
  for (const tower of orderedTowers) {
    tower.cooldownTicks = Math.max(0, tower.cooldownTicks - 1);
    tower.targetId = null;
    if (tower.cooldownTicks > 0 || tower.towerTypeId !== 'archer') {
      continue;
    }

    const definition = TOWER_BY_ID.get(tower.towerTypeId);
    const level = definition?.levels[tower.level - 1];
    const lane = newState.lanes[tower.ownerId === 'p1' ? 'lane_p1' : 'lane_p2'];
    if (!definition || !level) {
      continue;
    }

    const towerX = tower.cellX * 1000 + 500;
    const towerY = tower.cellY * 1000 + 500;
    const rangeSquared = level.rangeMilliTiles * level.rangeMilliTiles;
    const candidates = lane.monsters.filter((monster) => {
      if (monster.hp <= 0) {
        return false;
      }
      const position = calculatePosition(lane.waypoints, lane.segments, monster.pathProgressMilliTiles);
      const dx = position.x - towerX;
      const dy = position.y - towerY;
      return dx * dx + dy * dy <= rangeSquared;
    });
    candidates.sort((a, b) => compareTargetPriority(a, b, definition.targeting));

    const target = candidates[0];
    if (!target) {
      continue;
    }

    tower.targetId = target.entityId;
    target.hp = Math.max(0, target.hp - level.damage);
    tower.cooldownTicks = level.cooldownTicks;

    const attackEvent: AttackFiredEvent = {
      type: 'attack_fired',
      tick: state.tick,
      towerEntityId: tower.entityId,
      targetMonsterId: target.entityId,
    };
    const damageEvent: DamageAppliedEvent = {
      type: 'damage_applied',
      tick: state.tick,
      monsterEntityId: target.entityId,
      damage: level.damage,
      newHp: target.hp,
    };
    events.push(attackEvent, damageEvent);

    if (target.hp === 0) {
      const deathEvent: MonsterDiedEvent = {
        type: 'monster_died',
        tick: state.tick,
        playerId: target.ownerId,
        monsterEntityId: target.entityId,
        killerPlayerId: tower.ownerId,
      };
      events.push(deathEvent);
    }
  }

  newState.towers.sort((a, b) => a.entityId - b.entityId);
  return { state: newState, events };
}

function processCommands(state: SimulationState): { state: SimulationState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  const newState: SimulationState = {
    ...state,
    players: {
      p1: { ...state.players.p1 },
      p2: { ...state.players.p2 },
    },
    towers: state.towers.map((tower) => ({ ...tower })),
    pendingCommands: [...state.pendingCommands],
    lanes: {
      lane_p1: state.lanes.lane_p1 ? { ...state.lanes.lane_p1, spawnQueue: [...state.lanes.lane_p1.spawnQueue] } : state.lanes.lane_p1,
      lane_p2: state.lanes.lane_p2 ? { ...state.lanes.lane_p2, spawnQueue: [...state.lanes.lane_p2.spawnQueue] } : state.lanes.lane_p2,
    },
  };

  // Sort commands by player ID then sequence for deterministic processing
  const sortedCommands = [...newState.pendingCommands].sort((a, b) => {
    if (a.commandId.playerId !== b.commandId.playerId) {
      return a.commandId.playerId.localeCompare(b.commandId.playerId);
    }
    return a.commandId.sequence - b.commandId.sequence;
  });

  for (const command of sortedCommands) {
    const player = newState.players[command.playerId];

    switch (command.type) {
      case 'build_tower': {
        const towerDef = TOWER_BY_ID.get(command.towerTypeId);
        if (!towerDef || !towerDef.levels[0]) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'invalid_tower_type',
          };
          events.push(rejectEvent);
          continue;
        }

        const buildCost = towerDef.levels[0].cost;
        if (player.gold < buildCost) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'insufficient_gold',
          };
          events.push(rejectEvent);
          continue;
        }

        // Check if cell is already occupied
        const occupied = newState.towers.some(
          (t) => t.cellX === command.cellX && t.cellY === command.cellY && t.ownerId === command.playerId,
        );
        if (occupied) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'cell_occupied',
          };
          events.push(rejectEvent);
          continue;
        }

        // Build the tower
        const newTower: TowerRuntimeState = {
          entityId: newState.nextEntityId++,
          ownerId: command.playerId,
          towerTypeId: command.towerTypeId,
          level: 1,
          cellX: command.cellX,
          cellY: command.cellY,
          cooldownTicks: 0,
          targetId: null,
          totalInvested: buildCost,
        };

        newState.towers.push(newTower);
        player.gold -= buildCost;
        player.totalInvested += buildCost;

        const acceptEvent: CommandAcceptedEvent = {
          type: 'command_accepted',
          tick: state.tick,
          playerId: command.playerId,
          commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
        };
        const buildEvent: TowerBuiltEvent = {
          type: 'tower_built',
          tick: state.tick,
          playerId: command.playerId,
          towerEntityId: newTower.entityId,
          towerType: command.towerTypeId,
          cellX: command.cellX,
          cellY: command.cellY,
        };
        events.push(acceptEvent, buildEvent);
        break;
      }

      case 'upgrade_tower': {
        const tower = newState.towers.find((t) => t.entityId === command.towerEntityId && t.ownerId === command.playerId);
        if (!tower) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'tower_not_found',
          };
          events.push(rejectEvent);
          continue;
        }

        if (tower.level >= 3) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'max_level',
          };
          events.push(rejectEvent);
          continue;
        }

        const towerDef = TOWER_BY_ID.get(tower.towerTypeId);
        if (!towerDef) continue;

        const nextLevel = tower.level + 1;
        const levelDef = towerDef.levels[nextLevel - 1];
        if (!levelDef) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'max_level',
          };
          events.push(rejectEvent);
          continue;
        }

        const upgradeCost = levelDef.cost;
        if (player.gold < upgradeCost) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'insufficient_gold',
          };
          events.push(rejectEvent);
          continue;
        }

        tower.level = nextLevel as 1 | 2 | 3;
        tower.totalInvested += upgradeCost;
        player.gold -= upgradeCost;
        player.totalInvested += upgradeCost;

        const acceptEvent: CommandAcceptedEvent = {
          type: 'command_accepted',
          tick: state.tick,
          playerId: command.playerId,
          commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
        };
        const upgradeEvent: TowerUpgradedEvent = {
          type: 'tower_upgraded',
          tick: state.tick,
          playerId: command.playerId,
          towerEntityId: tower.entityId,
          newLevel: tower.level,
        };
        events.push(acceptEvent, upgradeEvent);
        break;
      }

      case 'sell_tower': {
        const towerIndex = newState.towers.findIndex(
          (t) => t.entityId === command.towerEntityId && t.ownerId === command.playerId,
        );
        if (towerIndex === -1) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'tower_not_found',
          };
          events.push(rejectEvent);
          continue;
        }

        const tower = newState.towers[towerIndex];
        if (!tower) {
          continue;
        }
        const refund = Math.floor((tower.totalInvested * SELL_REFUND_PERMILLE) / 1000);

        newState.towers.splice(towerIndex, 1);
        player.gold += refund;

        const acceptEvent: CommandAcceptedEvent = {
          type: 'command_accepted',
          tick: state.tick,
          playerId: command.playerId,
          commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
        };
        const sellEvent: TowerSoldEvent = {
          type: 'tower_sold',
          tick: state.tick,
          playerId: command.playerId,
          towerEntityId: tower.entityId,
          refund,
        };
        events.push(acceptEvent, sellEvent);
        break;
      }

      case 'queue_monster': {
        const laneId: LaneId = command.playerId === 'p1' ? 'lane_p2' : 'lane_p1';
        const lane = newState.lanes[laneId];
        const player = newState.players[command.playerId];

        const monsterDef = MONSTER_BY_ID.get(command.monsterTypeId);
        if (!monsterDef) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'invalid_monster_type',
          };
          events.push(rejectEvent);
          continue;
        }

        if (command.quantity < 1 || command.quantity > 5) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'invalid_quantity',
          };
          events.push(rejectEvent);
          continue;
        }

        if (lane.spawnQueue.length + command.quantity > 30) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'queue_full',
          };
          events.push(rejectEvent);
          continue;
        }

        // Deduct send cost and grant income for each monster
        const totalSendCost = monsterDef.sendCost * command.quantity;
        const totalIncomeGain = monsterDef.incomeGain * command.quantity;

        if (player.gold < totalSendCost) {
          const rejectEvent: CommandRejectedEvent = {
            type: 'command_rejected',
            tick: state.tick,
            playerId: command.playerId,
            commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
            reason: 'insufficient_gold',
          };
          events.push(rejectEvent);
          continue;
        }

        player.gold -= totalSendCost;
        player.income += totalIncomeGain;

        for (let i = 0; i < command.quantity; i++) {
          const spawn: MonsterSpawnParams = {
            entityId: newState.nextEntityId++,
            ownerId: command.playerId,
            monsterTypeId: command.monsterTypeId,
            hp: monsterDef.hp,
            shield: monsterDef.shield,
            speedMilliTilesPerTick: monsterDef.speedMilliTilesPerTick,
            leakDamage: monsterDef.leakDamage,
            spawnGapTicks: monsterDef.spawnGapTicks,
          };
          lane.spawnQueue.push(spawn);
        }

        const acceptEvent: CommandAcceptedEvent = {
          type: 'command_accepted',
          tick: state.tick,
          playerId: command.playerId,
          commandId: `${command.commandId.playerId}-${command.commandId.tick}-${command.commandId.sequence}`,
        };
        events.push(acceptEvent);
        break;
      }
    }

    // Clear pending commands after processing
    newState.pendingCommands = [];
  }

  return { state: newState, events };
}

function processIncome(state: SimulationState): { state: SimulationState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  const newState: SimulationState = {
    ...state,
    players: {
      p1: { ...state.players.p1 },
      p2: { ...state.players.p2 },
    },
  };

  for (const playerId of ['p1', 'p2'] as const) {
    const player = newState.players[playerId];
    const tickInRunning = state.tick - (state.runningStartedAtTick ?? 0);

    if (tickInRunning > 0 && tickInRunning % INCOME_INTERVAL_TICKS === 0) {
      player.gold += player.income;
      const incomeEvent: IncomePaidEvent = {
        type: 'income_paid',
        tick: state.tick,
        playerId,
        amount: player.income,
        newGold: player.gold,
      };
      events.push(incomeEvent);
    }
  }

  return { state: newState, events };
}

function stepSimulation(state: SimulationState): { state: SimulationState; events: readonly DomainEvent[] } {
  const allEvents: DomainEvent[] = [];

  let currentState: SimulationState = state;

  switch (currentState.phase) {
    case 'ready':
    case 'result':
      break;

    case 'countdown':
      currentState = { ...currentState, tick: currentState.tick + 1 };
      if (currentState.tick >= PHASE_TICKS.COUNTDOWN) {
        const { state: newState, event } = transitionPhase(currentState, 'running');
        currentState = newState;
        if (event) allEvents.push(event);
      }
      break;

    case 'running': {
      currentState = { ...currentState, tick: currentState.tick + 1 };

      // Process commands first
      const { state: afterCommands, events: commandEvents } = processCommands(currentState);
      currentState = afterCommands;
      allEvents.push(...commandEvents);

      // Process income
      const { state: afterIncome, events: incomeEvents } = processIncome(currentState);
      currentState = afterIncome;
      allEvents.push(...incomeEvents);

      // Process spawns
      const { state: afterSpawn, events: spawnEvents } = processSpawns(currentState);
      currentState = afterSpawn;
      allEvents.push(...spawnEvents);

      // Process movement and leaks before target acquisition.
      const { state: afterMovement, events: moveEvents } = processMovement(currentState);
      currentState = afterMovement;
      allEvents.push(...moveEvents);

      const { state: afterCombat, events: combatEvents } = processCombat(currentState);
      currentState = afterCombat;
      allEvents.push(...combatEvents);

      const tickInRunning = currentState.tick - (currentState.runningStartedAtTick ?? 0);
      const shouldResolve = tickInRunning >= PHASE_TICKS.RUNNING_MAX;

      if (shouldResolve) {
        const { state: newState, event } = transitionPhase(currentState, 'resolving');
        currentState = newState;
        if (event) allEvents.push(event);
      }
      break;
    }

    case 'resolving': {
      currentState = { ...currentState, tick: currentState.tick + 1 };
      const tickInResolving = currentState.tick - (currentState.resolvingStartedAtTick ?? 0);
      const shouldResult = tickInResolving >= PHASE_TICKS.RESOLVING_MAX;

      if (shouldResult) {
        const { state: newState, event } = transitionPhase(currentState, 'result');
        currentState = newState;
        if (event) allEvents.push(event);
      }
      break;
    }
  }

  currentState.stateHash = computeStateHash(currentState);
  return { state: currentState, events: allEvents };
}

class SimulationImpl implements Simulation {
  private _state: SimulationState;
  private _rng: SeededRng;

  constructor(state: SimulationState, rng: SeededRng) {
    this._state = state;
    this._rng = rng;
  }

  get state(): SimulationState {
    return this._state;
  }

  get rng(): SeededRng {
    return this._rng;
  }

  start(): Simulation {
    if (this._state.phase !== 'ready') {
      throw new Error(`start() can only be called in READY phase, current phase: ${this._state.phase}`);
    }

    const { state: newState, event } = transitionPhase(this._state, 'countdown');
    if (event) {
      this._state = newState;
    } else {
      this._state = newState;
    }
    return this;
  }

  step(): StepResult {
    if (this._state.phase === 'result') {
      return { state: this._state, events: [] };
    }

    if (this._state.phase === 'ready') {
      throw new Error(`step() cannot be called in READY phase. Call start() first.`);
    }

    const { state, events } = stepSimulation(this._state);
    this._state = state;
    return { state, events };
  }

  getCanonicalState(): CanonicalState {
    const monsters: MonsterState[] = [];
    for (const lane of Object.values(this._state.lanes)) {
      for (const monster of lane.monsters) {
        monsters.push({
          id: monster.entityId,
          ownerId: monster.ownerId,
          hp: monster.hp,
          shield: monster.shield,
          pathProgressMilliTiles: monster.pathProgressMilliTiles,
          alive: monster.hp > 0,
        });
      }
    }

    return {
      schemaVersion: this._state.schemaVersion,
      configVersion: this._state.config.configVersion,
      seed: this._state.config.seed,
      phase: this._state.phase,
      tick: this._state.tick,
      players: this._state.players,
      towers: this._state.towers.map((tower) => ({
        id: tower.entityId,
        ownerId: tower.ownerId,
        level: tower.level,
        cellX: tower.cellX,
        cellY: tower.cellY,
      })),
      monsters,
      result: null,
    };
  }

  submitCommand(command: GameCommand): void {
    if (this._state.phase !== 'running') {
      return;
    }
    this._state.pendingCommands.push(command);
  }

  getNextCommandId(playerId: PlayerSlot): CommandId {
    return {
      playerId,
      tick: this._state.tick,
      sequence: this._state.nextCommandIdSequence++,
    };
  }
}

export function createSimulation(
  config: MatchConfig,
  lanes?: Record<LaneId, LaneRuntimeState>,
  towers: TowerRuntimeState[] = [],
): Simulation {
  const state = createSimulationState(
    config,
    lanes ?? {
      lane_p1: createEmptyLane('lane_p1', 'p1', 'p2'),
      lane_p2: createEmptyLane('lane_p2', 'p2', 'p1'),
    },
    towers,
  );
  const rng = createFromString(config.seed);
  return new SimulationImpl(state, rng);
}

function createEmptyLane(laneId: LaneId, defenderId: PlayerSlot, attackerId: PlayerSlot): LaneRuntimeState {
  return {
    laneId,
    defenderId,
    attackerId,
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
}

export function createWithRng(state: SimulationState, rng: SeededRng): Simulation {
  return new SimulationImpl(state, rng);
}
