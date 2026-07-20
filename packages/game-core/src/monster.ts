/**
 * @chaos-td/game-core - Monster Types
 *
 * Monster state and definition types for simulation.
 * References game-data for actual monster definitions.
 */

import type { PlayerSlot } from './canonical';

/**
 * Monster status on the path.
 */
export type MonsterStatus = 'pending' | 'spawned' | 'dead' | 'leaked';

/**
 * Runtime monster state for simulation.
 */
export interface MonsterRuntimeState {
  /** Entity ID */
  readonly entityId: number;
  /** Owner player (sender) */
  readonly ownerId: PlayerSlot;
  /** Monster type ID from game-data */
  readonly monsterTypeId: string;
  /** Current HP */
  hp: number;
  /** Current shield */
  shield: number;
  /** Current status */
  status: MonsterStatus;
  /** Segment index in path */
  segmentIndex: number;
  /** Distance traveled on current segment (milli-tiles) */
  distanceOnSegmentMilliTiles: number;
  /** Total path progress (milli-tiles) */
  pathProgressMilliTiles: number;
  /** Current speed multiplier (for slow effects, 1000 = 100%) */
  speedMultiplierPermille: number;
  /** Slow duration remaining (ticks) */
  slowDurationTicks: number;
}

/**
 * Create initial monster runtime state.
 */
export function createMonsterState(
  entityId: number,
  ownerId: PlayerSlot,
  monsterTypeId: string,
  initialHp: number,
  initialShield: number,
): MonsterRuntimeState {
  return {
    entityId,
    ownerId,
    monsterTypeId,
    hp: initialHp,
    shield: initialShield,
    status: 'pending',
    segmentIndex: 0,
    distanceOnSegmentMilliTiles: 0,
    pathProgressMilliTiles: 0,
    speedMultiplierPermille: 1000,
    slowDurationTicks: 0,
  };
}

/**
 * Monster spawn parameters from queue.
 */
export interface MonsterSpawnParams {
  readonly entityId: number;
  readonly ownerId: PlayerSlot;
  readonly monsterTypeId: string;
  readonly hp: number;
  readonly shield: number;
  readonly speedMilliTilesPerTick: number;
  readonly leakDamage: number;
}
