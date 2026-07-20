/**
 * @chaos-td/game-data - Monster Definitions
 *
 * Authoritative monster definitions for MVP.
 * All values derived from docs/03_BALANCE_BASELINE.md
 */

import type { MonsterDefinition } from './types.js';

/**
 * Monster definitions - 4 monster types.
 *
 * Speed unit: milli-tiles/tick (20 ticks/second)
 * Unlock: first tick available from RUNNING start
 * Gap: minimum ticks between spawns
 */

// ============================================================================
// Sheep - Basic cheap monster
// ============================================================================

export const SHEEP_MONSTER: MonsterDefinition = Object.freeze({
  id: 'sheep',
  displayName: 'Sheep',
  sendCost: 60,
  incomeGain: 6,
  bounty: 10,
  hp: 85,
  shield: 0,
  armorPermille: 0,
  speedMilliTilesPerTick: 39,     // ~0.78 tiles/sec
  leakDamage: 1,
  availableAtRunningTick: 0,       // available from start
  spawnGapTicks: 9,
});

// ============================================================================
// Wolf - Faster, more HP
// ============================================================================

export const WOLF_MONSTER: MonsterDefinition = Object.freeze({
  id: 'wolf',
  displayName: 'Wolf',
  sendCost: 105,
  incomeGain: 10,
  bounty: 16,
  hp: 125,
  shield: 0,
  armorPermille: 0,
  speedMilliTilesPerTick: 59,     // ~1.18 tiles/sec
  leakDamage: 1,
  availableAtRunningTick: 600,    // unlocked at 30 seconds
  spawnGapTicks: 10,
});

// ============================================================================
// Treant - Tank with armor, slow
// ============================================================================

export const TREANT_MONSTER: MonsterDefinition = Object.freeze({
  id: 'treant',
  displayName: 'Treant',
  sendCost: 185,
  incomeGain: 16,
  bounty: 26,
  hp: 390,
  shield: 0,
  armorPermille: 220,             // 22% damage reduction
  speedMilliTilesPerTick: 28,     // ~0.56 tiles/sec
  leakDamage: 2,
  availableAtRunningTick: 1800,   // unlocked at 90 seconds
  spawnGapTicks: 14,
});

// ============================================================================
// Ghost - Shield + faster
// ============================================================================

export const GHOST_MONSTER: MonsterDefinition = Object.freeze({
  id: 'ghost',
  displayName: 'Ghost',
  sendCost: 240,
  incomeGain: 20,
  bounty: 32,
  hp: 215,
  shield: 95,
  armorPermille: 0,
  speedMilliTilesPerTick: 44,     // ~0.88 tiles/sec
  leakDamage: 2,
  availableAtRunningTick: 3000,   // unlocked at 150 seconds
  spawnGapTicks: 13,
});

// ============================================================================
// Monster Registry
// ============================================================================

export const MONSTER_DEFINITIONS: readonly MonsterDefinition[] = Object.freeze([
  SHEEP_MONSTER,
  WOLF_MONSTER,
  TREANT_MONSTER,
  GHOST_MONSTER,
]);

/**
 * Monster lookup by ID - O(1) access
 */
export const MONSTER_BY_ID: ReadonlyMap<string, MonsterDefinition> = Object.freeze(
  new Map(MONSTER_DEFINITIONS.map(m => [m.id, m])),
);
