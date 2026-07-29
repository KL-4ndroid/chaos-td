import type { MonsterDefinition, MonsterTag, TowerDefinition } from './types.js';
import { validateTowerDefinitions, validateMonsterDefinitions } from './validation.js';

const RESISTANCE_TAGS = ['physical_resist', 'magic_resist'] as const;
const MOVEMENT_TYPES = ['ground', 'flying'] as const;

export interface CounterMatrixRow {
  readonly monsterId: string;
  readonly movementType: string;
  readonly tags: readonly MonsterTag[];
  readonly counters: Readonly<Record<string, boolean>>;
  readonly effectiveCounters: readonly string[];
}

export function getCounterMatrixRows(
  towers: readonly TowerDefinition[],
  monsters: readonly MonsterDefinition[],
): readonly CounterMatrixRow[] {
  return monsters.map((monster) => {
    const counters = Object.fromEntries(towers.map((tower) => [
      tower.id,
      tower.attackTargets.includes(monster.movementType) && tower.levels.some((level) => level.damage > 0),
    ]));
    return {
      monsterId: monster.id,
      movementType: monster.movementType,
      tags: monster.tags,
      counters,
      effectiveCounters: Object.entries(counters).filter(([, effective]) => effective).map(([towerId]) => towerId),
    };
  });
}

export function validateCounterMatrix(
  towers: readonly TowerDefinition[],
  monsters: readonly MonsterDefinition[],
) {
  const errors = [
    ...validateTowerDefinitions(towers).errors,
    ...validateMonsterDefinitions(monsters).errors,
  ];
  for (const tower of towers) {
    if (tower.attackTargets.length === 0) {
      errors.push({ code: 'COUNTER_TOWER_NO_ATTACK_TARGETS', message: `Tower ${tower.id} has no attackTargets`, path: `towers.${tower.id}.attackTargets` });
    }
    if (!tower.damageType) {
      errors.push({ code: 'COUNTER_TOWER_DAMAGE_TYPE_MISSING', message: `Tower ${tower.id} has no damageType`, path: `towers.${tower.id}.damageType` });
    }
    for (const [levelIndex, level] of tower.levels.entries()) {
      if (level.bonusDamagePermille !== undefined && (level.bonusDamagePermille < 0 || level.bonusDamagePermille > 1000)) {
        errors.push({ code: 'COUNTER_BONUS_PERMILLE_OOB', message: `Tower ${tower.id} L${levelIndex + 1} bonusDamagePermille is outside 0-1000` });
      }
    }
  }

  for (const movementType of MOVEMENT_TYPES) {
    if (!towers.some((tower) => tower.attackTargets.includes(movementType))) {
      errors.push({ code: 'COUNTER_MOVEMENT_UNCOVERED', message: `No tower attacks ${movementType}` });
    }
  }

  for (const tower of towers) {
    if (!MOVEMENT_TYPES.some((movementType) => tower.attackTargets.includes(movementType))) {
      errors.push({ code: 'COUNTER_TOWER_MOVEMENT_INVALID', message: `Tower ${tower.id} has no valid movement counter` });
    }
  }

  for (const tower of towers) {
    for (const level of tower.levels) {
      const bonusDamageTag = level.bonusDamageTag;
      if (bonusDamageTag !== undefined && !monsters.some((monster) => monster.tags.includes(bonusDamageTag))) {
        errors.push({ code: 'COUNTER_BONUS_TAG_UNUSED', message: `Bonus tag ${bonusDamageTag} is unused` });
      }
    }
  }

  for (const resistanceTag of RESISTANCE_TAGS) {
    const damageType = resistanceTag === 'physical_resist' ? 'physical' : 'magic';
    if (monsters.some((monster) => monster.tags.includes(resistanceTag)) &&
      !towers.some((tower) => tower.damageType !== damageType && tower.attackTargets.includes('ground'))) {
      errors.push({ code: 'COUNTER_RESISTANCE_NO_UNAFFECTED_COUNTER', message: `No counter bypasses ${resistanceTag}` });
    }
  }

  for (const monster of monsters) {
    if (!towers.some((tower) => tower.attackTargets.includes(monster.movementType) && tower.levels.some((level) => level.damage > 0))) {
      errors.push({ code: 'COUNTER_MONSTER_UNDEFENDED', message: `Monster ${monster.id} has no damaging counter` });
    }
  }

  return { valid: errors.length === 0, errors };
}
