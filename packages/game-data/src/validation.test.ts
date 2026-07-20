/**
 * @chaos-td/game-data - Validation Tests
 *
 * Tests for runtime validation of game data.
 */

import { describe, it, expect } from 'vitest';
import {
  validateGlobalConfig,
  validateTowerDefinition,
  validateTowerDefinitions,
  validateMonsterDefinition,
  validateMonsterDefinitions,
  validateMapDefinition,
  validateMapDefinitions,
  validateAiConfig,
  validateGameDataBundle,
} from './validation.js';
import { GLOBAL_CONFIG } from './global-config.js';
import { TOWER_DEFINITIONS } from './towers.js';
import { MONSTER_DEFINITIONS } from './monsters.js';
import { MAP_DEFINITIONS } from './maps.js';
import { AI_CONFIGS } from './ai-config.js';
import {
  INVALID_GLOBAL_CONFIG_NEGATIVE_HP,
  INVALID_GLOBAL_CONFIG_SELL_REFUND_OOB,
  INVALID_GLOBAL_CONFIG_SLOW_CAP_OOB,
  INVALID_TOWER_NEGATIVE_COST,
  INVALID_TOWER_TOO_MANY_LEVELS,
  INVALID_TOWER_INVALID_RANGE,
  INVALID_TOWER_SPLASH_FACTOR_OOB,
  INVALID_MONSTER_SPEED_ZERO,
  INVALID_MONSTER_ARMOR_OOB,
  INVALID_MONSTER_NEGATIVE_COST,
  INVALID_MONSTER_SPAWN_GAP_ZERO,
  INVALID_MAP_TOO_FEW_WAYPOINTS,
  INVALID_MAP_DUPLICATE_WAYPOINTS,
  INVALID_MAP_CELL_OVERLAP,
  INVALID_MAP_AI_PRIORITY_NOT_BUILDABLE,
  INVALID_MAP_WAYPOINT_OOB,
} from './invalid-fixtures.js';
import type { GameDataBundle } from './types.js';

// ============================================================================
// Global Config Validation Tests
// ============================================================================

describe('GlobalConfig Validation', () => {
  it('should pass for valid global config', () => {
    const result = validateGlobalConfig(GLOBAL_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject negative HP', () => {
    const result = validateGlobalConfig(INVALID_GLOBAL_CONFIG_NEGATIVE_HP);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'GLOBAL_STARTINGHP_INVALID')).toBe(true);
  });

  it('should reject sell refund out of bounds', () => {
    const result = validateGlobalConfig(INVALID_GLOBAL_CONFIG_SELL_REFUND_OOB);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'GLOBAL_SELL_REFUND_OOB')).toBe(true);
  });

  it('should reject slow cap out of bounds', () => {
    const result = validateGlobalConfig(INVALID_GLOBAL_CONFIG_SLOW_CAP_OOB);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'GLOBAL_SLOW_CAP_OOB')).toBe(true);
  });

  it('should reject non-object', () => {
    const result = validateGlobalConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.code).toBe('GLOBAL_NOT_OBJECT');
  });
});

// ============================================================================
// Tower Definition Validation Tests
// ============================================================================

describe('Tower Definition Validation', () => {
  it('should pass for all valid towers', () => {
    const result = validateTowerDefinitions(TOWER_DEFINITIONS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject tower with negative cost', () => {
    const result = validateTowerDefinition(INVALID_TOWER_NEGATIVE_COST);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LEVEL_COST_NEGATIVE')).toBe(true);
  });

  it('should reject tower with wrong number of levels', () => {
    const result = validateTowerDefinition(INVALID_TOWER_TOO_MANY_LEVELS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TOWER_LEVELS_COUNT')).toBe(true);
  });

  it('should reject tower with invalid range', () => {
    const result = validateTowerDefinition(INVALID_TOWER_INVALID_RANGE);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LEVEL_RANGE_INVALID')).toBe(true);
  });

  it('should reject splash factor out of bounds', () => {
    const result = validateTowerDefinition(INVALID_TOWER_SPLASH_FACTOR_OOB);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LEVEL_SPLASH_FACTOR_OOB')).toBe(true);
  });

  it('should reject tower without 3 levels', () => {
    const badTower = {
      id: 'bad',
      displayName: 'Bad',
      role: 'single_target',
      targeting: 'first',
      levels: [
        { cost: 100, damage: 10, cooldownTicks: 10, rangeMilliTiles: 1000 },
      ],
    };
    const result = validateTowerDefinition(badTower);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TOWER_LEVELS_COUNT')).toBe(true);
  });

  it('should reject tower with missing id', () => {
    const badTower = {
      displayName: 'Bad',
      role: 'single_target',
      targeting: 'first',
      levels: [
        { cost: 100, damage: 10, cooldownTicks: 10, rangeMilliTiles: 1000 },
        { cost: 150, damage: 15, cooldownTicks: 9, rangeMilliTiles: 1100 },
        { cost: 200, damage: 20, cooldownTicks: 8, rangeMilliTiles: 1200 },
      ],
    };
    const result = validateTowerDefinition(badTower);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TOWER_ID_MISSING')).toBe(true);
  });

  it('should reject tower with invalid role', () => {
    const badTower = {
      id: 'bad',
      displayName: 'Bad',
      role: 'invalid_role',
      targeting: 'first',
      levels: [
        { cost: 100, damage: 10, cooldownTicks: 10, rangeMilliTiles: 1000 },
        { cost: 150, damage: 15, cooldownTicks: 9, rangeMilliTiles: 1100 },
        { cost: 200, damage: 20, cooldownTicks: 8, rangeMilliTiles: 1200 },
      ],
    };
    const result = validateTowerDefinition(badTower);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'TOWER_ROLE_INVALID')).toBe(true);
  });
});

// ============================================================================
// Monster Definition Validation Tests
// ============================================================================

describe('Monster Definition Validation', () => {
  it('should pass for all valid monsters', () => {
    const result = validateMonsterDefinitions(MONSTER_DEFINITIONS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject monster with zero speed', () => {
    const result = validateMonsterDefinition(INVALID_MONSTER_SPEED_ZERO);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MONSTER_SPEEDMILLITILESPERTICK_INVALID')).toBe(true);
  });

  it('should reject monster with armor out of bounds', () => {
    const result = validateMonsterDefinition(INVALID_MONSTER_ARMOR_OOB);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MONSTER_ARMOR_OOB')).toBe(true);
  });

  it('should reject monster with negative cost', () => {
    const result = validateMonsterDefinition(INVALID_MONSTER_NEGATIVE_COST);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MONSTER_SENDCOST_INVALID')).toBe(true);
  });

  it('should reject monster with zero spawn gap', () => {
    const result = validateMonsterDefinition(INVALID_MONSTER_SPAWN_GAP_ZERO);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MONSTER_SPAWNGAPTICKS_INVALID')).toBe(true);
  });

  it('should reject monster with missing id', () => {
    const badMonster = {
      displayName: 'Bad',
      sendCost: 60,
      incomeGain: 6,
      bounty: 10,
      hp: 85,
      shield: 0,
      armorPermille: 0,
      speedMilliTilesPerTick: 39,
      leakDamage: 1,
      availableAtRunningTick: 0,
      spawnGapTicks: 9,
    };
    const result = validateMonsterDefinition(badMonster);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MONSTER_ID_MISSING')).toBe(true);
  });
});

// ============================================================================
// Map Definition Validation Tests
// ============================================================================

describe('Map Definition Validation', () => {
  it('should pass for valid maps', () => {
    const result = validateMapDefinitions(MAP_DEFINITIONS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject map with too few waypoints', () => {
    const result = validateMapDefinition(INVALID_MAP_TOO_FEW_WAYPOINTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LANE_WAYPOINTS_COUNT')).toBe(true);
  });

  it('should reject map with duplicate waypoints', () => {
    const result = validateMapDefinition(INVALID_MAP_DUPLICATE_WAYPOINTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LANE_WAYPOINT_DUPLICATE')).toBe(true);
  });

  it('should reject map with cell overlap', () => {
    const result = validateMapDefinition(INVALID_MAP_CELL_OVERLAP);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MAP_CELL_OVERLAP')).toBe(true);
  });

  it('should reject map with AI priority not buildable', () => {
    const result = validateMapDefinition(INVALID_MAP_AI_PRIORITY_NOT_BUILDABLE);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'MAP_AI_PRIORITY_NOT_BUILDABLE')).toBe(true);
  });

  it('should reject map with waypoint out of bounds', () => {
    const result = validateMapDefinition(INVALID_MAP_WAYPOINT_OOB);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LANE_WAYPOINT_OOB')).toBe(true);
  });

  it('should reject lane with same defender and attacker', () => {
    const badMap = {
      id: 'bad',
      schemaVersion: 1,
      displayName: 'Bad Map',
      gridColumns: 16,
      gridRows: 9,
      lanes: [
        {
          id: 'lane_p1',
          defenderPlayerId: 'p1',
          attackerPlayerId: 'p1', // Same as defender
          waypoints: [
            { xMilliTiles: 0, yMilliTiles: 0 },
            { xMilliTiles: 1000, yMilliTiles: 0 },
          ],
          spawnPosition: { xMilliTiles: 0, yMilliTiles: 0 },
          endPosition: { xMilliTiles: 1000, yMilliTiles: 0 },
          buildableCells: [],
          blockedCells: [],
          aiBuildPriorityCells: [],
        },
        {
          id: 'lane_p2',
          defenderPlayerId: 'p2',
          attackerPlayerId: 'p1',
          waypoints: [
            { xMilliTiles: 0, yMilliTiles: 0 },
            { xMilliTiles: 1000, yMilliTiles: 0 },
          ],
          spawnPosition: { xMilliTiles: 0, yMilliTiles: 0 },
          endPosition: { xMilliTiles: 1000, yMilliTiles: 0 },
          buildableCells: [],
          blockedCells: [],
          aiBuildPriorityCells: [],
        },
      ],
    };
    const result = validateMapDefinition(badMap);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'LANE_SAME_PLAYER')).toBe(true);
  });
});

// ============================================================================
// AI Config Validation Tests
// ============================================================================

describe('AI Config Validation', () => {
  it('should pass for valid AI configs', () => {
    for (const config of AI_CONFIGS) {
      const result = validateAiConfig(config);
      expect(result.valid).toBe(true);
    }
  });

  it('should reject AI with invalid player', () => {
    const badConfig = {
      playerId: 'p3', // Invalid
      difficulty: 'medium',
      personality: 'balanced',
    };
    const result = validateAiConfig(badConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'AI_PLAYER_INVALID')).toBe(true);
  });

  it('should reject AI with invalid difficulty', () => {
    const badConfig = {
      playerId: 'p1',
      difficulty: 'impossible', // Invalid
      personality: 'balanced',
    };
    const result = validateAiConfig(badConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'AI_DIFFICULTY_INVALID')).toBe(true);
  });

  it('should reject AI with invalid personality', () => {
    const badConfig = {
      playerId: 'p1',
      difficulty: 'medium',
      personality: 'chaotic', // Invalid
    };
    const result = validateAiConfig(badConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'AI_PERSONALITY_INVALID')).toBe(true);
  });
});

// ============================================================================
// Bundle Validation Tests
// ============================================================================

describe('GameDataBundle Validation', () => {
  it('should pass for complete valid bundle', () => {
    const bundle: GameDataBundle = {
      configVersion: 'mvp-0.1.0',
      global: GLOBAL_CONFIG,
      towers: TOWER_DEFINITIONS,
      monsters: MONSTER_DEFINITIONS,
      maps: MAP_DEFINITIONS,
      aiConfigs: AI_CONFIGS,
    };
    const result = validateGameDataBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-object bundle', () => {
    const result = validateGameDataBundle(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.code).toBe('BUNDLE_NOT_OBJECT');
  });
});

// ============================================================================
// Config Version Tests
// ============================================================================

describe('Config Version', () => {
  it('should have valid config version string', () => {
    expect(GLOBAL_CONFIG.configVersion).toBeTruthy();
    expect(typeof GLOBAL_CONFIG.configVersion).toBe('string');
    expect(GLOBAL_CONFIG.configVersion.length).toBeGreaterThan(0);
  });

  it('should have schema version 1', () => {
    expect(GLOBAL_CONFIG.schemaVersion).toBe(1);
  });
});
