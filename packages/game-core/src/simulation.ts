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
import type { Phase, PlayerSlot, CanonicalState } from './canonical';
import { hashStateToString } from './canonical';
import type { DomainEvent, PhaseChangedEvent } from './events';

export interface MatchConfig {
  seed: string;
  configVersion: string;
}

export interface PlayerSlotState {
  playerId: PlayerSlot;
}

export interface SimulationState {
  schemaVersion: 1;
  config: MatchConfig;
  phase: Phase;
  tick: number;
  runningStartedAtTick: number | null;
  resolvingStartedAtTick: number | null;
  players: Record<PlayerSlot, PlayerSlotState>;
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
}

function computeStateHash(state: SimulationState): string {
  const canonical: CanonicalState = {
    schemaVersion: state.schemaVersion,
    configVersion: state.config.configVersion,
    seed: state.config.seed,
    phase: state.phase,
    tick: state.tick,
    players: state.players,
    towers: [],
    monsters: [],
    result: null,
  };
  return hashStateToString(canonical);
}

function createInitialPlayers(): Record<PlayerSlot, PlayerSlotState> {
  return {
    p1: { playerId: 'p1' },
    p2: { playerId: 'p2' },
  };
}

function createSimulationState(config: MatchConfig): SimulationState {
  const state: SimulationState = {
    schemaVersion: 1,
    config,
    phase: 'ready',
    tick: 0,
    runningStartedAtTick: null,
    resolvingStartedAtTick: null,
    players: createInitialPlayers(),
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

function stepSimulation(state: SimulationState): { state: SimulationState; events: readonly DomainEvent[] } {
  const events: DomainEvent[] = [];

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
        if (event) events.push(event);
      }
      break;

    case 'running': {
      currentState = { ...currentState, tick: currentState.tick + 1 };
      const tickInRunning = currentState.tick - (currentState.runningStartedAtTick ?? 0);
      const shouldResolve = tickInRunning >= PHASE_TICKS.RUNNING_MAX;

      if (shouldResolve) {
        const { state: newState, event } = transitionPhase(currentState, 'resolving');
        currentState = newState;
        if (event) events.push(event);
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
        if (event) events.push(event);
      }
      break;
    }
  }

  currentState.stateHash = computeStateHash(currentState);
  return { state: currentState, events };
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
    return {
      schemaVersion: this._state.schemaVersion,
      configVersion: this._state.config.configVersion,
      seed: this._state.config.seed,
      phase: this._state.phase,
      tick: this._state.tick,
      players: this._state.players,
      towers: [],
      monsters: [],
      result: null,
    };
  }
}

export function createSimulation(config: MatchConfig): Simulation {
  const state = createSimulationState(config);
  const rng = createFromString(config.seed);
  return new SimulationImpl(state, rng);
}

export function createWithRng(state: SimulationState, rng: SeededRng): Simulation {
  return new SimulationImpl(state, rng);
}
