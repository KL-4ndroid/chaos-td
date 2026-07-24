/**
 * @chaos-td/game-data - Invalid Data Fixtures
 *
 * Invalid data samples for testing validation rules.
 * These fixtures are used to verify that validation correctly rejects bad data.
 */

import type {
  GlobalConfig,
  TowerDefinition,
  MonsterDefinition,
  MapDefinition,
} from './types.js';

// ============================================================================
// Invalid Global Configs
// ============================================================================

export const INVALID_GLOBAL_CONFIG_NEGATIVE_HP: GlobalConfig = {
  configVersion: 'test-1.0.0',
  schemaVersion: 1,
  tickRate: 20,
  countdownTicks: 60,
  maxRunningTicks: 12000,
  maxResolvingTicks: 400,
  startingHp: -20, // INVALID: negative
  startingGold: 600,
  startingIncome: 100,
  incomeIntervalTicks: 200,
  sellRefundPermille: 700,
  sendQueueLimit: 30,
  slowCapPermille: 500,
};

export const INVALID_GLOBAL_CONFIG_SELL_REFUND_OOB: GlobalConfig = {
  configVersion: 'test-1.0.0',
  schemaVersion: 1,
  tickRate: 20,
  countdownTicks: 60,
  maxRunningTicks: 12000,
  maxResolvingTicks: 400,
  startingHp: 20,
  startingGold: 600,
  startingIncome: 100,
  incomeIntervalTicks: 200,
  sellRefundPermille: 1500, // INVALID: > 1000
  sendQueueLimit: 30,
  slowCapPermille: 500,
};

export const INVALID_GLOBAL_CONFIG_SLOW_CAP_OOB: GlobalConfig = {
  configVersion: 'test-1.0.0',
  schemaVersion: 1,
  tickRate: 20,
  countdownTicks: 60,
  maxRunningTicks: 12000,
  maxResolvingTicks: 400,
  startingHp: 20,
  startingGold: 600,
  startingIncome: 100,
  incomeIntervalTicks: 200,
  sellRefundPermille: 700,
  sendQueueLimit: 30,
  slowCapPermille: -100, // INVALID: negative
};

// ============================================================================
// Invalid Tower Definitions
// ============================================================================

export const INVALID_TOWER_NEGATIVE_COST: TowerDefinition = {
  id: 'archer',
  displayName: 'Archer',
  role: 'single_target',
  targeting: 'first',
  levels: [
    {
      cost: -120, // INVALID: negative
      damage: 18,
      cooldownTicks: 13,
      rangeMilliTiles: 3200,
    },
    {
      cost: 160,
      damage: 29,
      cooldownTicks: 12,
      rangeMilliTiles: 3400,
    },
    {
      cost: 240,
      damage: 46,
      cooldownTicks: 10,
      rangeMilliTiles: 3600,
    },
  ],
} as unknown as TowerDefinition;

export const INVALID_TOWER_TOO_MANY_LEVELS: TowerDefinition = {
  id: 'archer',
  displayName: 'Archer',
  role: 'single_target',
  targeting: 'first',
  levels: [
    {
      cost: 120,
      damage: 18,
      cooldownTicks: 13,
      rangeMilliTiles: 3200,
    },
    {
      cost: 160,
      damage: 29,
      cooldownTicks: 12,
      rangeMilliTiles: 3400,
    },
    {
      cost: 240,
      damage: 46,
      cooldownTicks: 10,
      rangeMilliTiles: 3600,
    },
    {
      cost: 360,
      damage: 60,
      cooldownTicks: 8,
      rangeMilliTiles: 3800,
    },
  ], // INVALID: 4 levels instead of 3
} as unknown as TowerDefinition;

export const INVALID_TOWER_INVALID_RANGE: TowerDefinition = {
  id: 'archer',
  displayName: 'Archer',
  role: 'single_target',
  targeting: 'first',
  levels: [
    {
      cost: 120,
      damage: 18,
      cooldownTicks: 13,
      rangeMilliTiles: 0, // INVALID: must be > 0
    },
    {
      cost: 160,
      damage: 29,
      cooldownTicks: 12,
      rangeMilliTiles: 3400,
    },
    {
      cost: 240,
      damage: 46,
      cooldownTicks: 10,
      rangeMilliTiles: 3600,
    },
  ],
} as unknown as TowerDefinition;

export const INVALID_TOWER_SPLASH_FACTOR_OOB: TowerDefinition = {
  id: 'mage',
  displayName: 'Mage',
  role: 'splash',
  targeting: 'first',
  levels: [
    {
      cost: 180,
      damage: 26,
      cooldownTicks: 28,
      rangeMilliTiles: 2800,
      splashRadiusMilliTiles: 750,
      splashFactorPermille: 1500, // INVALID: > 1000
    },
    {
      cost: 230,
      damage: 43,
      cooldownTicks: 26,
      rangeMilliTiles: 3000,
      splashRadiusMilliTiles: 850,
      splashFactorPermille: 700,
    },
    {
      cost: 340,
      damage: 72,
      cooldownTicks: 23,
      rangeMilliTiles: 3200,
      splashRadiusMilliTiles: 950,
      splashFactorPermille: 750,
    },
  ],
} as unknown as TowerDefinition;

export const INVALID_TOWER_DUPLICATE_ID: TowerDefinition = {
  id: 'archer',
  displayName: 'Archer',
  role: 'single_target',
  targeting: 'first',
  levels: [
    {
      cost: 120,
      damage: 18,
      cooldownTicks: 13,
      rangeMilliTiles: 3200,
    },
    {
      cost: 160,
      damage: 29,
      cooldownTicks: 12,
      rangeMilliTiles: 3400,
    },
    {
      cost: 240,
      damage: 46,
      cooldownTicks: 10,
      rangeMilliTiles: 3600,
    },
  ],
} as unknown as TowerDefinition;

// ============================================================================
// Invalid Monster Definitions
// ============================================================================

export const INVALID_MONSTER_SPEED_ZERO: MonsterDefinition = {
  id: 'sheep',
  displayName: 'Sheep',
  sendCost: 60,
  incomeGain: 6,
  bounty: 10,
  hp: 85,
  shield: 0,
  armorPermille: 0,
  speedMilliTilesPerTick: 0, // INVALID: must be > 0
  leakDamage: 1,
  availableAtRunningTick: 0,
  spawnGapTicks: 9,
  movementType: 'ground',
  targetPreference: 'closest',
  tags: [],
};

export const INVALID_MONSTER_ARMOR_OOB: MonsterDefinition = {
  id: 'wolf',
  displayName: 'Wolf',
  sendCost: 105,
  incomeGain: 10,
  bounty: 16,
  hp: 125,
  shield: 0,
  armorPermille: 1500, // INVALID: > 1000
  speedMilliTilesPerTick: 59,
  leakDamage: 1,
  availableAtRunningTick: 600,
  spawnGapTicks: 10,
  movementType: 'ground',
  targetPreference: 'closest',
  tags: [],
};

export const INVALID_MONSTER_NEGATIVE_COST: MonsterDefinition = {
  id: 'treant',
  displayName: 'Treant',
  sendCost: -185, // INVALID: negative
  incomeGain: 16,
  bounty: 26,
  hp: 390,
  shield: 0,
  armorPermille: 220,
  speedMilliTilesPerTick: 28,
  leakDamage: 2,
  availableAtRunningTick: 1800,
  spawnGapTicks: 14,
  movementType: 'ground',
  targetPreference: 'closest',
  tags: [],
};

export const INVALID_MONSTER_SPAWN_GAP_ZERO: MonsterDefinition = {
  id: 'ghost',
  displayName: 'Ghost',
  sendCost: 240,
  incomeGain: 20,
  bounty: 32,
  hp: 215,
  shield: 95,
  armorPermille: 0,
  speedMilliTilesPerTick: 44,
  leakDamage: 2,
  availableAtRunningTick: 3000,
  spawnGapTicks: 0, // INVALID: must be > 0
  movementType: 'flying',
  targetPreference: 'closest',
  tags: [],
};

// ============================================================================
// Invalid Map Definitions
// ============================================================================

export const INVALID_MAP_TOO_FEW_WAYPOINTS: MapDefinition = {
  id: 'invalid_map',
  schemaVersion: 1,
  displayName: 'Invalid Map',
  gridColumns: 16,
  gridRows: 9,
  lanes: [
    {
      id: 'lane_p1',
      defenderPlayerId: 'p1',
      attackerPlayerId: 'p2',
      waypoints: [
        { xMilliTiles: 0, yMilliTiles: 8000 },
      ], // INVALID: only 1 waypoint
      spawnPosition: { xMilliTiles: 0, yMilliTiles: 8000 },
      endPosition: { xMilliTiles: 0, yMilliTiles: 8000 },
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
} as unknown as MapDefinition;

export const INVALID_MAP_DUPLICATE_WAYPOINTS: MapDefinition = {
  id: 'invalid_map',
  schemaVersion: 1,
  displayName: 'Invalid Map',
  gridColumns: 16,
  gridRows: 9,
  lanes: [
    {
      id: 'lane_p1',
      defenderPlayerId: 'p1',
      attackerPlayerId: 'p2',
      waypoints: [
        { xMilliTiles: 0, yMilliTiles: 8000 },
        { xMilliTiles: 0, yMilliTiles: 8000 }, // INVALID: duplicate
      ],
      spawnPosition: { xMilliTiles: 0, yMilliTiles: 8000 },
      endPosition: { xMilliTiles: 0, yMilliTiles: 8000 },
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
} as unknown as MapDefinition;

export const INVALID_MAP_CELL_OVERLAP: MapDefinition = {
  id: 'invalid_map',
  schemaVersion: 1,
  displayName: 'Invalid Map',
  gridColumns: 16,
  gridRows: 9,
  lanes: [
    {
      id: 'lane_p1',
      defenderPlayerId: 'p1',
      attackerPlayerId: 'p2',
      waypoints: [
        { xMilliTiles: 0, yMilliTiles: 0 },
        { xMilliTiles: 1000, yMilliTiles: 0 },
      ],
      spawnPosition: { xMilliTiles: 0, yMilliTiles: 0 },
      endPosition: { xMilliTiles: 1000, yMilliTiles: 0 },
      buildableCells: [
        { col: 5, row: 5 }, // Cell 5,5 is both buildable...
      ],
      blockedCells: [
        { col: 5, row: 5 }, // ...and blocked (INVALID)
      ],
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
} as unknown as MapDefinition;

export const INVALID_MAP_AI_PRIORITY_NOT_BUILDABLE: MapDefinition = {
  id: 'invalid_map',
  schemaVersion: 1,
  displayName: 'Invalid Map',
  gridColumns: 16,
  gridRows: 9,
  lanes: [
    {
      id: 'lane_p1',
      defenderPlayerId: 'p1',
      attackerPlayerId: 'p2',
      waypoints: [
        { xMilliTiles: 0, yMilliTiles: 0 },
        { xMilliTiles: 1000, yMilliTiles: 0 },
      ],
      spawnPosition: { xMilliTiles: 0, yMilliTiles: 0 },
      endPosition: { xMilliTiles: 1000, yMilliTiles: 0 },
      buildableCells: [
        { col: 5, row: 5 },
      ],
      blockedCells: [],
      aiBuildPriorityCells: [
        { col: 6, row: 6 }, // INVALID: not in buildable cells
      ],
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
} as unknown as MapDefinition;

export const INVALID_MAP_WAYPOINT_OOB: MapDefinition = {
  id: 'invalid_map',
  schemaVersion: 1,
  displayName: 'Invalid Map',
  gridColumns: 16,
  gridRows: 9,
  lanes: [
    {
      id: 'lane_p1',
      defenderPlayerId: 'p1',
      attackerPlayerId: 'p2',
      waypoints: [
        { xMilliTiles: 0, yMilliTiles: 0 },
        { xMilliTiles: 20000, yMilliTiles: 0 }, // INVALID: x > 16000
      ],
      spawnPosition: { xMilliTiles: 0, yMilliTiles: 0 },
      endPosition: { xMilliTiles: 20000, yMilliTiles: 0 },
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
} as unknown as MapDefinition;
