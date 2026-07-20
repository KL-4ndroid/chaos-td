/**
 * @chaos-td/game-core - Lane State
 *
 * Lane management for monster spawning and tracking.
 */

import type { PlayerSlot } from './canonical';
import type { LaneId, FixedPointPosition } from '@chaos-td/game-data';
import type { MonsterRuntimeState, MonsterSpawnParams } from './monster';

/**
 * Lane state for simulation.
 */
export interface LaneState {
  /** Lane identifier */
  readonly laneId: LaneId;
  /** Defender player */
  readonly defenderId: PlayerSlot;
  /** Attacker player (sender) */
  readonly attackerId: PlayerSlot;
  /** Spawn position */
  readonly spawnPosition: FixedPointPosition;
  /** End position */
  readonly endPosition: FixedPointPosition;
  /** Spawn queue (monsters waiting to spawn) */
  spawnQueue: MonsterSpawnParams[];
  /** Monsters currently on the path */
  monsters: MonsterRuntimeState[];
  /** Pending leaks to be processed */
  pendingLeaks: MonsterRuntimeState[];
  /** Next spawn cooldown ticks */
  spawnCooldownTicks: number;
  /** Monster definitions reference (speed, leak damage, etc.) */
  monsterDefinitions: ReadonlyMap<string, {
    speedMilliTilesPerTick: number;
    leakDamage: number;
    hp: number;
    shield: number;
  }>;
}

/**
 * Create lane state.
 */
export function createLaneState(
  laneId: LaneId,
  defenderId: PlayerSlot,
  attackerId: PlayerSlot,
  spawnPosition: FixedPointPosition,
  endPosition: FixedPointPosition,
  monsterDefinitions: ReadonlyMap<string, {
    speedMilliTilesPerTick: number;
    leakDamage: number;
    hp: number;
    shield: number;
  }>,
): LaneState {
  return {
    laneId,
    defenderId,
    attackerId,
    spawnPosition,
    endPosition,
    spawnQueue: [],
    monsters: [],
    pendingLeaks: [],
    spawnCooldownTicks: 0,
    monsterDefinitions,
  };
}

/**
 * Add monsters to spawn queue.
 */
export function queueMonsters(
  lane: LaneState,
  params: MonsterSpawnParams[],
): void {
  lane.spawnQueue.push(...params);
}

/**
 * Process spawn queue and spawn monsters.
 * Returns spawned monsters.
 */
export function processSpawns(lane: LaneState): MonsterRuntimeState[] {
  const spawned: MonsterRuntimeState[] = [];

  // If cooldown is active, decrement and return
  if (lane.spawnCooldownTicks > 0) {
    lane.spawnCooldownTicks--;
    return spawned;
  }

  // Spawn next monster from queue
  if (lane.spawnQueue.length > 0) {
    const params = lane.spawnQueue.shift();
    if (!params) {
      return spawned;
    }

    const monster: MonsterRuntimeState = {
      entityId: params.entityId,
      ownerId: params.ownerId,
      monsterTypeId: params.monsterTypeId,
      hp: params.hp,
      shield: params.shield,
      status: 'spawned',
      segmentIndex: 0,
      distanceOnSegmentMilliTiles: 0,
      pathProgressMilliTiles: 0,
      speedMultiplierPermille: 1000,
      slowDurationTicks: 0,
    };

    spawned.push(monster);
    lane.monsters.push(monster);

    // Set cooldown based on monster type
    const def = lane.monsterDefinitions.get(params.monsterTypeId);
    if (def) {
      // spawnGapTicks is handled separately based on monster type
      // For MVP, we use a simple cooldown based on speed
      lane.spawnCooldownTicks = Math.ceil(1000 / def.speedMilliTilesPerTick);
    }
  }

  return spawned;
}

/**
 * Remove dead/leaked monsters from lane.
 */
export function cleanupMonsters(lane: LaneState): void {
  lane.monsters = lane.monsters.filter(m => m.status === 'spawned');
}
