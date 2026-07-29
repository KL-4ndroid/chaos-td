import { describe, expect, it } from 'vitest';
import { MONSTER_DEFINITIONS } from './monsters';
import { TOWER_DEFINITIONS } from './towers';
import { WAVE_MONSTER_DEFINITIONS } from './waveMonsters';
import { validateCounterMatrix } from './counter-matrix';
import { validateTowerDefinition } from './validation';

describe('counter matrix validation', () => {
  it('accepts the complete MVP tower and monster matrix', () => {
    const result = validateCounterMatrix(TOWER_DEFINITIONS, [...MONSTER_DEFINITIONS, ...WAVE_MONSTER_DEFINITIONS.values()]);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a tower with no target movement type or damage type', () => {
    const archer = TOWER_DEFINITIONS[0];
    if (!archer) throw new Error('Archer definition is required for this test');
    const invalidTower = { ...archer, attackTargets: [], damageType: undefined };
    const definitionResult = validateTowerDefinition(invalidTower);
    const matrixResult = validateCounterMatrix([{ ...archer, attackTargets: [] }], MONSTER_DEFINITIONS);

    expect(definitionResult.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'TOWER_DAMAGE_TYPE_INVALID',
    ]));
    expect(matrixResult.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'COUNTER_TOWER_NO_ATTACK_TARGETS',
      'COUNTER_MOVEMENT_UNCOVERED',
    ]));
  });

  it('rejects unused bonus tags and a resistance with no unaffected counter', () => {
    const archer = TOWER_DEFINITIONS[0];
    if (!archer) throw new Error('Archer definition is required for this test');
    const invalidTower = {
      ...archer,
      damageType: 'physical' as const,
      levels: archer.levels.map((level) => ({
        ...level,
        bonusDamagePermille: 500,
        bonusDamageTag: 'boss' as const,
      })),
    };
    const sheep = MONSTER_DEFINITIONS[0];
    if (!sheep) throw new Error('Sheep definition is required for this test');
    const physicalOnlyMonster = {
      ...sheep,
      tags: ['physical_resist'] as const,
    };
    const result = validateCounterMatrix([invalidTower], [physicalOnlyMonster]);

    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'COUNTER_BONUS_TAG_UNUSED',
      'COUNTER_RESISTANCE_NO_UNAFFECTED_COUNTER',
    ]));
  });
});
