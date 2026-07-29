import { describe, expect, it } from 'vitest';
import { resolveDamage } from './combat-modifiers';

describe('resolveDamage', () => {
  it('applies an additional bonus permille only for a matching tag', () => {
    const matched = resolveDamage({
      rawDamage: 100,
      damageType: 'pure',
      bonusDamagePermille: 500,
      bonusDamageTag: 'boss',
      monsterTags: ['boss'],
      armorPermille: 0,
      physicalResistancePermille: 0,
      magicResistancePermille: 0,
      shield: 0,
      maximumReductionPermille: 800,
    });
    const unmatched = resolveDamage({
      rawDamage: 100,
      damageType: 'pure',
      bonusDamagePermille: 500,
      bonusDamageTag: 'boss',
      monsterTags: [],
      armorPermille: 0,
      physicalResistancePermille: 0,
      magicResistancePermille: 0,
      shield: 0,
      maximumReductionPermille: 800,
    });

    expect(matched).toMatchObject({ rawDamage: 100, bonusDamage: 50, finalDamage: 150, hpDamage: 150 });
    expect(unmatched).toMatchObject({ rawDamage: 100, bonusDamage: 0, finalDamage: 100, hpDamage: 100 });
  });

  it('applies resistance before physical-only armor, then shield', () => {
    const result = resolveDamage({
      rawDamage: 100,
      damageType: 'physical',
      bonusDamagePermille: 0,
      monsterTags: ['physical_resist'],
      armorPermille: 200,
      physicalResistancePermille: 250,
      magicResistancePermille: 0,
      shield: 30,
      maximumReductionPermille: 800,
    });

    expect(result).toMatchObject({
      rawDamage: 100,
      bonusDamage: 0,
      resistanceReduction: 25,
      armorReduction: 15,
      finalDamage: 60,
      shieldDamage: 30,
      hpDamage: 30,
    });
  });

  it('does not apply physical armor to magic damage', () => {
    const result = resolveDamage({
      rawDamage: 100,
      damageType: 'magic',
      bonusDamagePermille: 0,
      monsterTags: [],
      armorPermille: 800,
      physicalResistancePermille: 0,
      magicResistancePermille: 0,
      shield: 0,
      maximumReductionPermille: 800,
    });

    expect(result).toMatchObject({ armorReduction: 0, finalDamage: 100, hpDamage: 100 });
  });

  it('lets pure damage ignore type resistance and armor while retaining bonus', () => {
    const result = resolveDamage({
      rawDamage: 100,
      damageType: 'pure',
      bonusDamagePermille: 500,
      bonusDamageTag: 'boss',
      monsterTags: ['boss', 'physical_resist', 'magic_resist'],
      armorPermille: 800,
      physicalResistancePermille: 800,
      magicResistancePermille: 800,
      shield: 0,
      maximumReductionPermille: 800,
    });

    expect(result).toMatchObject({ bonusDamage: 50, resistanceReduction: 0, armorReduction: 0, finalDamage: 150 });
  });
});
