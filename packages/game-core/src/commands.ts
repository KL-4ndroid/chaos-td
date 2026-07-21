/**
 * @chaos-td/game-core - Game Commands
 *
 * Deterministic command types for player interactions.
 * Commands are validated and processed in fixed order within each tick.
 */

import type { PlayerSlot } from './canonical';
import type { TowerId } from '@chaos-td/game-data';

/**
 * Command types supported in the simulation.
 */
export type GameCommand =
  | BuildTowerCommand
  | UpgradeTowerCommand
  | SellTowerCommand
  | QueueMonsterCommand;

/**
 * Unique command identifier for idempotency.
 */
export interface CommandId {
  readonly playerId: PlayerSlot;
  readonly tick: number;
  readonly sequence: number;
}

/**
 * Build a tower at the specified cell.
 */
export interface BuildTowerCommand {
  readonly type: 'build_tower';
  readonly commandId: CommandId;
  readonly playerId: PlayerSlot;
  readonly towerTypeId: TowerId;
  readonly cellX: number;
  readonly cellY: number;
}

/**
 * Upgrade an existing tower to the next level.
 */
export interface UpgradeTowerCommand {
  readonly type: 'upgrade_tower';
  readonly commandId: CommandId;
  readonly playerId: PlayerSlot;
  readonly towerEntityId: number;
}

/**
 * Sell a tower and receive refund.
 */
export interface SellTowerCommand {
  readonly type: 'sell_tower';
  readonly commandId: CommandId;
  readonly playerId: PlayerSlot;
  readonly towerEntityId: number;
}

/**
 * Queue monsters to send to the opponent's lane.
 */
export interface QueueMonsterCommand {
  readonly type: 'queue_monster';
  readonly commandId: CommandId;
  readonly playerId: PlayerSlot;
  readonly monsterTypeId: string;
  readonly quantity: number;
}

/**
 * Command validation result.
 */
export interface CommandValidation {
  readonly valid: boolean;
  readonly reason?: string;
}

/**
 * Create a unique command ID.
 */
export function createCommandId(
  playerId: PlayerSlot,
  tick: number,
  sequence: number,
): CommandId {
  return { playerId, tick, sequence };
}
