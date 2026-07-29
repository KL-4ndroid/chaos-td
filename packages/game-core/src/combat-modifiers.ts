import type { DamageType, MonsterTag } from '@chaos-td/game-data';

export interface DamageResolutionInput {
  readonly rawDamage: number;
  readonly damageType: DamageType;
  readonly bonusDamagePermille?: number;
  readonly bonusDamageTag?: MonsterTag;
  readonly monsterTags: readonly MonsterTag[];
  readonly armorPermille: number;
  readonly physicalResistancePermille?: number;
  readonly magicResistancePermille?: number;
  readonly shield: number;
  readonly maximumReductionPermille: number;
}

export interface DamageResolution {
  readonly rawDamage: number;
  readonly bonusDamage: number;
  readonly resistanceReduction: number;
  readonly armorReduction: number;
  readonly shieldDamage: number;
  readonly hpDamage: number;
  readonly finalDamage: number;
}

function reductionDamage(damage: number, reductionPermille: number, maximumReductionPermille: number): number {
  const clampedReduction = Math.min(maximumReductionPermille, Math.max(0, reductionPermille));
  return Math.floor(damage * (1000 - clampedReduction) / 1000);
}

export function resolveDamage(input: DamageResolutionInput): DamageResolution {
  const bonusDamage = input.bonusDamagePermille !== undefined && input.bonusDamageTag !== undefined &&
    input.monsterTags.includes(input.bonusDamageTag)
    ? Math.floor(input.rawDamage * input.bonusDamagePermille / 1000)
    : 0;
  const afterBonus = input.rawDamage + bonusDamage;

  const resistancePermille = input.damageType === 'physical' && input.monsterTags.includes('physical_resist')
    ? input.physicalResistancePermille ?? 0
    : input.damageType === 'magic' && input.monsterTags.includes('magic_resist')
      ? input.magicResistancePermille ?? 0
      : 0;
  const afterResistance = input.damageType === 'pure'
    ? afterBonus
    : reductionDamage(afterBonus, resistancePermille, input.maximumReductionPermille);
  const resistanceReduction = afterBonus - afterResistance;

  const afterArmor = input.damageType === 'physical'
    ? reductionDamage(afterResistance, input.armorPermille, input.maximumReductionPermille)
    : afterResistance;
  const armorReduction = afterResistance - afterArmor;
  const finalDamage = Math.max(1, afterArmor);
  const shieldDamage = Math.min(input.shield, finalDamage);

  return {
    rawDamage: input.rawDamage,
    bonusDamage,
    resistanceReduction,
    armorReduction,
    shieldDamage,
    hpDamage: finalDamage - shieldDamage,
    finalDamage,
  };
}
