/**
 * @chaos-td/game-data - Tower Definitions
 *
 * Authoritative tower definitions for MVP.
 * All values derived from docs/03_BALANCE_BASELINE.md
 */

import type { TowerDefinition } from './types.js';

/**
 * Tower definitions - 4 tower types with 3 levels each.
 *
 * Cost convention: L1 is the build cost; L2/L3 are additional upgrade costs.
 * Damage, range, and cooldown improve with each level.
 */

// ============================================================================
// Archer Tower - FIRST targeting, single target
// ============================================================================

export const ARCHER_TOWER: TowerDefinition = Object.freeze({
  id: 'archer',
  displayName: 'Archer',
  role: 'single_target',
  targeting: 'first',
  levels: Object.freeze([
    Object.freeze({
      cost: 120,
      damage: 18,
      cooldownTicks: 13,
      rangeMilliTiles: 3200,
    }),
    Object.freeze({
      cost: 160,
      damage: 29,
      cooldownTicks: 12,
      rangeMilliTiles: 3400,
    }),
    Object.freeze({
      cost: 240,
      damage: 46,
      cooldownTicks: 10,
      rangeMilliTiles: 3600,
    }),
  ]),
});

// ============================================================================
// Mage Tower - FIRST targeting, splash damage
// ============================================================================

export const MAGE_TOWER: TowerDefinition = Object.freeze({
  id: 'mage',
  displayName: 'Mage',
  role: 'splash',
  targeting: 'first',
  levels: Object.freeze([
    Object.freeze({
      cost: 180,
      damage: 26,
      cooldownTicks: 28,
      rangeMilliTiles: 2800,
      splashRadiusMilliTiles: 750,
      splashFactorPermille: 650,    // 65% splash damage
    }),
    Object.freeze({
      cost: 230,
      damage: 43,
      cooldownTicks: 26,
      rangeMilliTiles: 3000,
      splashRadiusMilliTiles: 850,
      splashFactorPermille: 700,    // 70% splash damage
    }),
    Object.freeze({
      cost: 340,
      damage: 72,
      cooldownTicks: 23,
      rangeMilliTiles: 3200,
      splashRadiusMilliTiles: 950,
      splashFactorPermille: 750,    // 75% splash damage
    }),
  ]),
});

// ============================================================================
// Frost Tower - FIRST targeting, slow effect
// ============================================================================

export const FROST_TOWER: TowerDefinition = Object.freeze({
  id: 'frost',
  displayName: 'Frost',
  role: 'slow',
  targeting: 'first',
  levels: Object.freeze([
    Object.freeze({
      cost: 150,
      damage: 7,
      cooldownTicks: 20,
      rangeMilliTiles: 2700,
      slowRadiusMilliTiles: 550,   // effect radius
      slowPermille: 250,           // 25% slow
      slowDurationTicks: 30,
    }),
    Object.freeze({
      cost: 190,
      damage: 11,
      cooldownTicks: 18,
      rangeMilliTiles: 2900,
      slowRadiusMilliTiles: 550,
      slowPermille: 320,           // 32% slow
      slowDurationTicks: 34,
    }),
    Object.freeze({
      cost: 280,
      damage: 17,
      cooldownTicks: 16,
      rangeMilliTiles: 3100,
      slowRadiusMilliTiles: 550,
      slowPermille: 400,           // 40% slow
      slowDurationTicks: 40,
    }),
  ]),
});

// ============================================================================
// Sniper Tower - STRONG targeting, heavy single target damage
// ============================================================================

export const SNIPER_TOWER: TowerDefinition = Object.freeze({
  id: 'sniper',
  displayName: 'Sniper',
  role: 'heavy_hit',
  targeting: 'strong',
  levels: Object.freeze([
    Object.freeze({
      cost: 260,
      damage: 95,
      cooldownTicks: 48,
      rangeMilliTiles: 5500,
    }),
    Object.freeze({
      cost: 330,
      damage: 165,
      cooldownTicks: 44,
      rangeMilliTiles: 5800,
    }),
    Object.freeze({
      cost: 500,
      damage: 285,
      cooldownTicks: 40,
      rangeMilliTiles: 6200,
    }),
  ]),
});

// ============================================================================
// Tower Registry
// ============================================================================

export const TOWER_DEFINITIONS: readonly TowerDefinition[] = Object.freeze([
  ARCHER_TOWER,
  MAGE_TOWER,
  FROST_TOWER,
  SNIPER_TOWER,
]);

/**
 * Tower lookup by ID - O(1) access
 */
export const TOWER_BY_ID: ReadonlyMap<string, TowerDefinition> = Object.freeze(
  new Map(TOWER_DEFINITIONS.map(t => [t.id, t])),
);
