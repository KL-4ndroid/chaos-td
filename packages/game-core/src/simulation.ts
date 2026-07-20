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

import { PHASE_TICKS } from './constants';
import { type SeededRng, createFromString } from './prng';
import type { Phase, PlayerSlot, CanonicalState, MonsterState } from './canonical';
import { hashStateToString } from './canonical';
import type { DomainEvent, PhaseChangedEvent, MonsterSpawnedEvent, MonsterLeakedEvent } from './events';
import type { LaneId, FixedPointPosition } from '@chaos-td/game-data';
import { hasReachedEnd, type PathSegment } from './movement';

export interface MatchConfig {
  seed: string;
  configVersion: string;
}

export interface PlayerSlotState {
  playerId: PlayerSlot;
}

export interface PlayerBattleState extends PlayerSlotState {
  hp: number;
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
  nextEntityId: number;
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
  queueMonster(playerId: PlayerSlot, monsterTypeId: string, quantity: number): void;
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
    towers: [],
    monsters,
    result: null,
  };
  return hashStateToString(canonical);
}

function createInitialPlayers(): Record<PlayerSlot, PlayerBattleState> {
  return {
    p1: { playerId: 'p1', hp: 20 },
    p2: { playerId: 'p2', hp: 20 },
  };
}

function createSimulationState(config: MatchConfig, lanes: Record<LaneId, LaneRuntimeState>): SimulationState {
  const state: SimulationState = {
    schemaVersion: 1,
    config,
    phase: 'ready',
    tick: 0,
    runningStartedAtTick: null,
    resolvingStartedAtTick: null,
    players: createInitialPlayers(),
    lanes,
    nextEntityId: 1,
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
      const spawn = newLane.spawnQueue.shift()!;

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
    const newLane: LaneRuntimeState = { ...lane, monsters: [...lane.monsters] };
    let defenderHp = newState.players[lane.defenderId].hp;

    for (let i = 0; i < newLane.monsters.length; i++) {
      const monster = newLane.monsters[i];

      // Skip dead monsters
      if (monster.hp <= 0) continue;

      // Calculate movement
      const speed = monster.speedMilliTilesPerTick;
      monster.pathProgressMilliTiles += speed;
      monster.distanceOnSegmentMilliTiles += speed;

      // Update segment if needed
      while (monster.segmentIndex < newLane.segments.length - 1) {
        const currentSegment = newLane.segments[monster.segmentIndex]!;
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

      // Process spawns
      const { state: afterSpawn, events: spawnEvents } = processSpawns(currentState);
      currentState = afterSpawn;
      allEvents.push(...spawnEvents);

      // Process movement
      const { state: afterMovement, events: moveEvents } = processMovement(currentState);
      currentState = afterMovement;
      allEvents.push(...moveEvents);

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
      towers: [],
      monsters,
      result: null,
    };
  }

  queueMonster(playerId: PlayerSlot, monsterTypeId: string, quantity: number): void {
    if (this._state.phase !== 'running') {
      return; // Only queue in running phase
    }

    const laneId: LaneId = playerId === 'p1' ? 'lane_p2' : 'lane_p1';
    const lane = this._state.lanes[laneId];

    // Get monster stats from game-data (simplified for now)
    const monsterStats: Record<string, { hp: number; shield: number; speed: number; leak: number; gap: number }> = {
      sheep: { hp: 85, shield: 0, speed: 39, leak: 1, gap: 9 },
      wolf: { hp: 125, shield: 0, speed: 59, leak: 1, gap: 10 },
      treant: { hp: 390, shield: 0, speed: 28, leak: 2, gap: 14 },
      ghost: { hp: 215, shield: 95, speed: 44, leak: 2, gap: 13 },
    };

    const stats = monsterStats[monsterTypeId];
    if (!stats) return;

    for (let i = 0; i < quantity; i++) {
      const spawn: MonsterSpawnParams = {
        entityId: this._state.nextEntityId++,
        ownerId: playerId,
        monsterTypeId,
        hp: stats.hp,
        shield: stats.shield,
        speedMilliTilesPerTick: stats.speed,
        leakDamage: stats.leak,
        spawnGapTicks: stats.gap,
      };
      lane.spawnQueue.push(spawn);
    }
  }
}

export function createSimulation(
  config: MatchConfig,
  lanes?: Record<LaneId, LaneRuntimeState>
): Simulation {
  const state = createSimulationState(config, lanes ?? { lane_p1: createEmptyLane('lane_p1', 'p1', 'p2'), lane_p2: createEmptyLane('lane_p2', 'p2', 'p1') });
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
