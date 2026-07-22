/**
 * @chaos-td/game-core
 *
 * Pure TypeScript game logic package.
 * Must NOT import: Phaser, DOM, Canvas, WebSocket, LocalStorage, Audio
 * Must NOT use: Math.random(), Date.now(), timers, render delta
 */

// Constants
export {
  TICK_DURATION_MS,
  TICKS_PER_SECOND,
  PHASE_TICKS,
  PHASE_DURATIONS_MS,
  INITIAL_GOLD,
  INITIAL_HP,
  INITIAL_INCOME,
  INCOME_INTERVAL_TICKS,
  SELL_REFUND_PERMILLE,
} from './constants';

// PRNG
export {
  PRNG_VERSION,
  type SeededRng,
  parseSeed,
  create,
  createFromString,
  next,
  nextInt,
  fork,
} from './prng';

// Canonical State
export {
  type PlayerSlot,
  type Phase,
  type PlayerSlotState,
  type TowerState,
  type MonsterState,
  type MatchResult,
  type CanonicalState,
  type StateHash,
  STATE_HASH_ALGORITHM,
  STATE_HASH_VERSION,
  canonicalize,
  hashState,
  hashStateToString,
} from './canonical';

// Events
export {
  type DomainEvent,
  type CommandAcceptedEvent,
  type CommandRejectedEvent,
  type PhaseChangedEvent,
  type IncomePaidEvent,
  type MatchEndedEvent,
  type TowerBuiltEvent,
  type TowerUpgradedEvent,
  type TowerSoldEvent,
  type MonsterQueuedEvent,
  type MonsterSpawnedEvent,
  type MonsterDiedEvent,
  type MonsterLeakedEvent,
  type AttackFiredEvent,
  type DamageAppliedEvent,
  type ShieldBrokenEvent,
  type SlowAppliedEvent,
} from './events';

// Simulation
export {
  type MatchConfig,
  type SimulationState,
  type Simulation,
  type StepResult,
  type PlayerBattleState,
  type LaneRuntimeState,
  type MonsterSpawnParams,
  type MonsterRuntimeState,
  createSimulation,
  createWithRng,
} from './simulation';

// Movement
export {
  MILLI_TILES_PER_TILE,
  createPathSegments,
  calculatePosition,
  calculatePathLength,
  hasReachedEnd,
  type PathSegment,
} from './movement';

// Tower combat helpers
export {
  createTowerState,
  compareTargetPriority,
  type TowerLevel,
  type TowerRuntimeState,
} from './tower';

// Replay
export {
  type Replay,
  REPLAY_CHECKPOINT_INTERVAL,
  createReplayData,
  addCheckpoint,
  addEvent,
  finalizeReplay,
  serializeReplay,
  deserializeReplay,
  verifyReplayIntegrity,
  getReplaySummary,
} from './replay';

// Commands
export {
  type GameCommand,
  type CommandId,
  type BuildTowerCommand,
  type UpgradeTowerCommand,
  type SellTowerCommand,
  type QueueMonsterCommand,
  createCommandId,
} from './commands';
