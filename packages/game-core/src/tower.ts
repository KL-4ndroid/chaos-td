/**
 * @chaos-td/game-core - Tower State
 *
 * Tower runtime state for simulation.
 */

import type { PlayerSlot } from './canonical';
import type { TowerId, TowerTargeting } from '@chaos-td/game-data';

export type TowerLevel = 1 | 2 | 3;

export interface TowerRuntimeState {
  /** Entity ID */
  readonly entityId: number;
  /** Owner player */
  readonly ownerId: PlayerSlot;
  /** Tower type ID */
  readonly towerTypeId: TowerId;
  /** Current level */
  level: 1 | 2 | 3;
  /** Cell position X */
  cellX: number;
  /** Cell position Y */
  cellY: number;
  /** Cooldown remaining ticks */
  cooldownTicks: number;
  /** Target monster entity ID or null */
  targetId: number | null;
  /** Total gold invested in this tower (for sell refund) */
  totalInvested: number;
}

/**
 * Create initial tower state.
 */
export function createTowerState(
  entityId: number,
  ownerId: PlayerSlot,
  towerTypeId: TowerId,
  cellX: number,
  cellY: number,
  totalInvested: number = 0,
): TowerRuntimeState {
  return {
    entityId,
    ownerId,
    towerTypeId,
    level: 1,
    cellX,
    cellY,
    cooldownTicks: 0,
    targetId: null,
    totalInvested,
  };
}

/**
 * Tower targeting helper.
 * Returns comparison result for sorting: negative if a has higher priority.
 */
export function compareTargetPriority(
  a: { entityId: number; pathProgressMilliTiles: number; hp: number; shield: number },
  b: { entityId: number; pathProgressMilliTiles: number; hp: number; shield: number },
  targeting: TowerTargeting,
): number {
  switch (targeting) {
    case 'first':
      // FIRST: Highest progress first
      if (a.pathProgressMilliTiles !== b.pathProgressMilliTiles) {
        return b.pathProgressMilliTiles - a.pathProgressMilliTiles;
      }
      break;
    case 'strong': {
      // STRONG: Highest HP+Shield first
      const aTotal = a.hp + a.shield;
      const bTotal = b.hp + b.shield;
      if (aTotal !== bTotal) {
        return bTotal - aTotal;
      }
      break;
    }
  }

  // Tie breaker: Entity ID
  return a.entityId - b.entityId;
}
