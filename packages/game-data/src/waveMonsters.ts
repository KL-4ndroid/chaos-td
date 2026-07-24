/**
 * @chaos-td/game-data - Wave Monster Definitions
 *
 * Wave monsters are the authoritative stats for auto-wave system monsters.
 * WaveMonsterType → MonsterId mapping + per-type stat definitions.
 *
 * These are separate from player-sent monsters (sheep/wolf/treant/ghost) but
 * share the same lane and HP system in game-core.
 */

import type { MonsterDefinition, WaveMonsterType, MonsterTag, MovementType } from './types.js';

/** Map WaveMonsterType (logical wave slot) to base MonsterId */
export const WAVE_MONSTER_ID: Record<WaveMonsterType, string> = Object.freeze({
  basic: 'basic',
  swift: 'swift',
  flying: 'flying',
  siege: 'siege',
  boss: 'boss',
});

// ============================================================================
// Wave Monster Stat Definitions
// Base stats before difficultyMultiplier scaling.
// ============================================================================

function freezeMonster(monster: MonsterDefinition): MonsterDefinition {
  return Object.freeze(monster);
}

/** Basic ground monster — cheap, medium HP, no tags */
const BASIC_MONSTER: MonsterDefinition = freezeMonster({
  id: 'basic',
  displayName: 'Basic',
  sendCost: 0,
  incomeGain: 0,
  bounty: 5,
  hp: 80,
  shield: 0,
  armorPermille: 0,
  speedMilliTilesPerTick: 40,
  leakDamage: 1,
  availableAtRunningTick: 0,
  spawnGapTicks: 10,
  movementType: 'ground' as MovementType,
  targetPreference: 'closest',
  tags: [] as readonly MonsterTag[],
});

/** Swift ground monster — fast, fragile */
const SWIFT_MONSTER: MonsterDefinition = freezeMonster({
  id: 'swift',
  displayName: 'Swift',
  sendCost: 0,
  incomeGain: 0,
  bounty: 8,
  hp: 60,
  shield: 0,
  armorPermille: 0,
  speedMilliTilesPerTick: 70,
  leakDamage: 1,
  availableAtRunningTick: 0,
  spawnGapTicks: 8,
  movementType: 'ground' as MovementType,
  targetPreference: 'closest',
  tags: ['swift'] as readonly MonsterTag[],
});

/** Flying monster — immune to ground-only towers, magic resist */
const FLYING_MONSTER: MonsterDefinition = freezeMonster({
  id: 'flying',
  displayName: 'Flying',
  sendCost: 0,
  incomeGain: 0,
  bounty: 20,
  hp: 120,
  shield: 40,
  armorPermille: 0,
  speedMilliTilesPerTick: 45,
  leakDamage: 2,
  availableAtRunningTick: 0,
  spawnGapTicks: 12,
  movementType: 'flying' as MovementType,
  targetPreference: 'closest',
  tags: ['magic_resist'] as readonly MonsterTag[],
});

/** Siege monster — targets towers when in range */
const SIEGE_MONSTER: MonsterDefinition = freezeMonster({
  id: 'siege',
  displayName: 'Siege',
  sendCost: 0,
  incomeGain: 0,
  bounty: 30,
  hp: 250,
  shield: 0,
  armorPermille: 150,
  speedMilliTilesPerTick: 25,
  leakDamage: 3,
  availableAtRunningTick: 0,
  spawnGapTicks: 15,
  movementType: 'ground' as MovementType,
  targetPreference: 'tower',
  tags: ['siege', 'physical_resist'] as readonly MonsterTag[],
});

/** Boss monster — very high HP, resists all damage types, appears on every 10th wave */
const BOSS_MONSTER: MonsterDefinition = freezeMonster({
  id: 'boss',
  displayName: 'Boss',
  sendCost: 0,
  incomeGain: 0,
  bounty: 100,
  hp: 1500,
  shield: 300,
  armorPermille: 300,
  speedMilliTilesPerTick: 20,
  leakDamage: 5,
  availableAtRunningTick: 0,
  spawnGapTicks: 20,
  movementType: 'ground' as MovementType,
  targetPreference: 'closest',
  tags: ['boss', 'physical_resist'] as readonly MonsterTag[],
});

// ============================================================================
// Registry
// ============================================================================

const WAVE_MONSTER_DEFINITIONS: ReadonlyMap<WaveMonsterType, MonsterDefinition> = Object.freeze(
  new Map<WaveMonsterType, MonsterDefinition>([
    ['basic', BASIC_MONSTER],
    ['swift', SWIFT_MONSTER],
    ['flying', FLYING_MONSTER],
    ['siege', SIEGE_MONSTER],
    ['boss', BOSS_MONSTER],
  ]),
);

/**
 * Get the base MonsterDefinition for a WaveMonsterType (before difficulty scaling).
 */
export function getWaveMonsterDefinition(type: WaveMonsterType): MonsterDefinition {
  const def = WAVE_MONSTER_DEFINITIONS.get(type);
  if (!def) {
    throw new Error(`Unknown WaveMonsterType: ${type}`);
  }
  return def;
}

/**
 * Scale monster HP and leak damage by difficulty multiplier.
 * Returns a frozen MonsterRuntimeParams-compatible object.
 */
export function scaleWaveMonster(
  type: WaveMonsterType,
  difficultyMultiplier: number,
): {
  hp: number;
  shield: number;
  leakDamage: number;
  speedMilliTilesPerTick: number;
  monsterTypeId: string;
} {
  const base = getWaveMonsterDefinition(type);
  const scaledHp = Math.round(base.hp * difficultyMultiplier);
  const scaledLeak = Math.max(1, Math.round(base.leakDamage * difficultyMultiplier));
  return {
    hp: scaledHp,
    shield: Math.round(base.shield * difficultyMultiplier),
    leakDamage: scaledLeak,
    speedMilliTilesPerTick: base.speedMilliTilesPerTick,
    monsterTypeId: base.id,
  };
}
