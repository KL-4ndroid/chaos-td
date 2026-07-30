import { CONFIG_VERSION, TOWER_DEFINITIONS, MONSTER_DEFINITIONS } from '@chaos-td/game-data';
import { validateAIStrategyGenome, type AIStrategyGenome } from '@chaos-td/ai-strategy';
import type { FrozenStrategyPool } from '@chaos-td/ai-strategy';

export type CompatibilityResult = 'compatible' | 'requires_reevaluation' | 'requires_retraining' | 'unsupported';

export interface CompatibilityCheck {
  readonly strategyId: string;
  readonly schemaValid: boolean;
  readonly contentValid: boolean;
  readonly hasNewTowerRoles: boolean;
  readonly hasNewDamageTypes: boolean;
  readonly hasNewMonsterMovementTypes: boolean;
  readonly hasNewMonsterTags: boolean;
  readonly result: CompatibilityResult;
}

export interface PoolCompatibilityReport {
  readonly contentVersion: string;
  readonly checkedAt: string;
  readonly poolSchemaVersion: number;
  readonly totalStrategies: number;
  readonly results: readonly CompatibilityCheck[];
  readonly overallResult: CompatibilityResult;
}

const KNOWN_TOWER_ROLES = new Set(['single_target', 'splash', 'slow', 'heavy_hit']);
const KNOWN_DAMAGE_TYPES = new Set(['physical', 'magic', 'pure']);
const KNOWN_MOVEMENT_TYPES = new Set(['ground', 'flying']);
const KNOWN_MONSTER_TAGS = new Set(['boss', 'siege', 'swift', 'magic_resist', 'physical_resist']);

export function checkStrategyCompatibility(genome: AIStrategyGenome): CompatibilityCheck {
  let schemaValid = true;
  let contentValid = true;
  let hasNewTowerRoles = false;
  let hasNewDamageTypes = false;
  let hasNewMonsterMovementTypes = false;
  let hasNewMonsterTags = false;

  const genomeResult = validateAIStrategyGenome(genome);
  if (!genomeResult.ok) {
    if (genomeResult.errors.some((e) => e === 'unsupported_schema_version' || e === 'incompatible_content_version')) contentValid = false;
    else schemaValid = false;
  }

  for (const tower of TOWER_DEFINITIONS) {
    if (!KNOWN_TOWER_ROLES.has(tower.role)) hasNewTowerRoles = true;
    if (!KNOWN_DAMAGE_TYPES.has(tower.damageType)) hasNewDamageTypes = true;
  }
  for (const monster of MONSTER_DEFINITIONS) {
    if (!KNOWN_MOVEMENT_TYPES.has(monster.movementType)) hasNewMonsterMovementTypes = true;
    for (const tag of monster.tags) {
      if (!KNOWN_MONSTER_TAGS.has(tag)) hasNewMonsterTags = true;
    }
  }

  let result: CompatibilityResult = 'compatible';
  if (!schemaValid || !contentValid) result = 'unsupported';
  else if (hasNewTowerRoles || hasNewDamageTypes) result = 'requires_reevaluation';
  else if (hasNewMonsterMovementTypes || hasNewMonsterTags) result = 'requires_retraining';

  return { strategyId: genome.strategyId, schemaValid, contentValid, hasNewTowerRoles, hasNewDamageTypes, hasNewMonsterMovementTypes, hasNewMonsterTags, result };
}

export function checkPoolCompatibility(pool: FrozenStrategyPool): PoolCompatibilityReport {
  const results = pool.strategies.map((strategy) => checkStrategyCompatibility(strategy.genome));
  const overallResult = results.some((r) => r.result === 'unsupported')
    ? 'unsupported'
    : results.some((r) => r.result === 'requires_reevaluation')
      ? 'requires_reevaluation'
      : results.some((r) => r.result === 'requires_retraining')
        ? 'requires_retraining'
        : 'compatible';

  return {
    contentVersion: CONFIG_VERSION,
    checkedAt: new Date().toISOString(),
    poolSchemaVersion: pool.schemaVersion,
    totalStrategies: pool.strategies.length,
    results,
    overallResult,
  };
}
