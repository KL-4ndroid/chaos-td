/**
 * @chaos-td/game-core - Domain Events
 *
 * Tick-based domain events for game state changes.
 * Events are immutable records that do NOT affect simulation determinism.
 *
 * Each step() call returns a fresh array of events for that tick.
 * Events do not accumulate internally.
 */

import type { Phase, PlayerSlot } from './canonical';

export type DomainEvent =
  | CommandAcceptedEvent
  | CommandRejectedEvent
  | PhaseChangedEvent
  | IncomePaidEvent
  | MatchEndedEvent
  | TowerBuiltEvent
  | TowerUpgradedEvent
  | TowerSoldEvent
  | MonsterQueuedEvent
  | MonsterSpawnedEvent
  | MonsterDiedEvent
  | MonsterLeakedEvent
  | AttackFiredEvent
  | DamageAppliedEvent
  | ShieldBrokenEvent
  | SlowAppliedEvent
  | WaveStartedEvent
  | WaveMonsterSpawnedEvent
  | WaveEndedEvent;

export interface CommandAcceptedEvent {
  type: 'command_accepted';
  tick: number;
  playerId: PlayerSlot;
  commandId: string;
}

export interface CommandRejectedEvent {
  type: 'command_rejected';
  tick: number;
  playerId: PlayerSlot;
  commandId: string;
  reason: string;
}

export interface PhaseChangedEvent {
  type: 'phase_changed';
  tick: number;
  fromPhase: Phase;
  toPhase: Phase;
}

export interface IncomePaidEvent {
  type: 'income_paid';
  tick: number;
  playerId: PlayerSlot;
  amount: number;
  newGold: number;
}

export interface MatchEndedEvent {
  type: 'match_ended';
  tick: number;
  winnerId: PlayerSlot | null;
  outcome: 'win' | 'draw';
  reason: string;
}

export interface TowerBuiltEvent {
  type: 'tower_built';
  tick: number;
  playerId: PlayerSlot;
  towerEntityId: number;
  towerType: string;
  cellX: number;
  cellY: number;
}

export interface TowerUpgradedEvent {
  type: 'tower_upgraded';
  tick: number;
  playerId: PlayerSlot;
  towerEntityId: number;
  newLevel: 1 | 2 | 3;
}

export interface TowerSoldEvent {
  type: 'tower_sold';
  tick: number;
  playerId: PlayerSlot;
  towerEntityId: number;
  refund: number;
}

export interface MonsterQueuedEvent {
  type: 'monster_queued';
  tick: number;
  playerId: PlayerSlot;
  monsterType: string;
  quantity: number;
}

export interface MonsterSpawnedEvent {
  type: 'monster_spawned';
  tick: number;
  playerId: PlayerSlot;
  monsterEntityId: number;
  monsterType: string;
}

export interface MonsterDiedEvent {
  type: 'monster_died';
  tick: number;
  playerId: PlayerSlot;
  monsterEntityId: number;
  killerPlayerId: PlayerSlot | null;
}

export interface MonsterLeakedEvent {
  type: 'monster_leaked';
  tick: number;
  ownerId: PlayerSlot;
  defenderId: PlayerSlot;
  monsterEntityId: number;
  leakDamage: number;
  defenderNewHp: number;
}

export interface AttackFiredEvent {
  type: 'attack_fired';
  tick: number;
  towerEntityId: number;
  targetMonsterId: number;
}

export interface DamageAppliedEvent {
  type: 'damage_applied';
  tick: number;
  monsterEntityId: number;
  damage: number;
  newHp: number;
}

export interface ShieldBrokenEvent {
  type: 'shield_broken';
  tick: number;
  monsterEntityId: number;
}

export interface SlowAppliedEvent {
  type: 'slow_applied';
  tick: number;
  monsterEntityId: number;
  slowPermille: number;
  durationTicks: number;
}

// ============================================================================
// Wave System Events
// ============================================================================

/** Emitted when a new wave begins. */
export interface WaveStartedEvent {
  type: 'wave_started';
  tick: number;
  waveNumber: number;
}

/**
 * Emitted when a wave monster spawns.
 * ownerId is the system lane the monster belongs to (the lane being defended).
 */
export interface WaveMonsterSpawnedEvent {
  type: 'wave_monster_spawned';
  tick: number;
  waveNumber: number;
  monsterEntityId: number;
  monsterType: string;
}

/** Emitted when all groups in a wave have finished spawning. */
export interface WaveEndedEvent {
  type: 'wave_ended';
  tick: number;
  waveNumber: number;
}
