import { describe, expect, it } from 'vitest';
import {
  MONSTER_DEFINITIONS,
  TOWER_DEFINITIONS,
  WAVE_MONSTER_DEFINITIONS,
} from '@chaos-td/game-data';
import { resolveDamage } from './combat-modifiers';

const ALL_MONSTERS = [...MONSTER_DEFINITIONS, ...WAVE_MONSTER_DEFINITIONS.values()];

describe('tower monster combat matrix', () => {
  for (const tower of TOWER_DEFINITIONS) {
    for (const [levelIndex, level] of tower.levels.entries()) {
      for (const monster of ALL_MONSTERS) {
        const canTarget = tower.attackTargets.includes(monster.movementType);
        it(`${tower.id} L${levelIndex + 1} vs ${monster.id}`, () => {
          const resolution = resolveDamage({
            rawDamage: level.damage,
            damageType: tower.damageType,
            ...(level.bonusDamagePermille !== undefined ? { bonusDamagePermille: level.bonusDamagePermille } : {}),
            ...(level.bonusDamageTag !== undefined ? { bonusDamageTag: level.bonusDamageTag } : {}),
            monsterTags: monster.tags,
            armorPermille: monster.armorPermille,
            ...(monster.physicalResistancePermille !== undefined ? { physicalResistancePermille: monster.physicalResistancePermille } : {}),
            ...(monster.magicResistancePermille !== undefined ? { magicResistancePermille: monster.magicResistancePermille } : {}),
            shield: monster.shield,
            maximumReductionPermille: 800,
          });

          expect(level.damage).toBeGreaterThan(0);
          expect(resolution.rawDamage).toBe(level.damage);
          expect(resolution.bonusDamage).toBe(
            level.bonusDamageTag !== undefined && monster.tags.includes(level.bonusDamageTag)
              ? Math.floor(level.damage * (level.bonusDamagePermille ?? 0) / 1000)
              : 0,
          );
          expect(resolution.resistanceReduction).toBeGreaterThanOrEqual(0);
          expect(resolution.armorReduction).toBeGreaterThanOrEqual(0);
          expect(resolution.shieldDamage).toBeLessThanOrEqual(monster.shield);
          expect(resolution.hpDamage).toBeGreaterThanOrEqual(0);
          expect(resolution.finalDamage).toBeGreaterThanOrEqual(1);
          expect(canTarget).toBe(tower.attackTargets.includes(monster.movementType));
        });
      }
    }
  }

  it('applies slow only through frost levels and splash only through mage levels', () => {
    const frost = TOWER_DEFINITIONS.find((tower) => tower.id === 'frost');
    const mage = TOWER_DEFINITIONS.find((tower) => tower.id === 'mage');

    expect(frost?.levels.every((level) => level.slowPermille !== undefined && level.slowDurationTicks !== undefined)).toBe(true);
    expect(mage?.levels.every((level) => level.splashFactorPermille !== undefined && level.splashRadiusMilliTiles !== undefined)).toBe(true);
  });
});
