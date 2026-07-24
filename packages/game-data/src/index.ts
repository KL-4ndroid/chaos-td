/**
 * @chaos-td/game-data
 *
 * Game balance data - towers, monsters, maps, AI config.
 * Runtime validation and config versioning.
 *
 * This package is the authoritative source of truth for game balance data.
 * All numeric values in the game should come from this package.
 */

// ============================================================================
// Types
// ============================================================================

export type {
  PlayerSlot,
  LaneId,
  TowerId,
  MonsterId,
  MapId,
  EntityId,
  GridCell,
  FixedPointPosition,
  MovementType,
  MonsterTag,
  DamageType,
  AttackTarget,
  TowerRole,
  TowerTargeting,
  TowerLevelDefinition,
  TowerDefinition,
  MonsterDefinition,
  LaneDefinition,
  MapDefinition,
  GlobalConfig,
  WaveMonsterType,
  WaveGroup,
  WaveDefinition,
  WaveRuntimeState,
  AiDifficulty,
  AiPersonality,
  AiCellPriority,
  AiLaneConfig,
  AiConfig,
  GameDataBundle,
} from './types.js';

// ============================================================================
// Config Version
// ============================================================================

export { CONFIG_VERSION } from './global-config.js';

// ============================================================================
// Global Config
// ============================================================================

export { GLOBAL_CONFIG } from './global-config.js';

// ============================================================================
// Tower Definitions
// ============================================================================

export {
  ARCHER_TOWER,
  MAGE_TOWER,
  FROST_TOWER,
  SNIPER_TOWER,
  TOWER_DEFINITIONS,
  TOWER_BY_ID,
} from './towers.js';

// ============================================================================
// Monster Definitions
// ============================================================================

export {
  SHEEP_MONSTER,
  WOLF_MONSTER,
  TREANT_MONSTER,
  GHOST_MONSTER,
  MONSTER_DEFINITIONS,
  MONSTER_BY_ID,
} from './monsters.js';

// ============================================================================
// Map Definitions
// ============================================================================

export {
  MVP_MIRROR_01,
  MAP_DEFINITIONS,
  MAP_BY_ID,
} from './maps.js';

// ============================================================================
// AI Config
// ============================================================================

export {
  AI_CONFIG_P1,
  AI_CONFIG_P2,
  AI_CONFIGS,
  AI_CONFIG_BY_PLAYER,
  DIFFICULTY_MULTIPLIERS,
  PERSONALITY_TRAITS,
} from './ai-config.js';

// ============================================================================
// Wave System Data
// ============================================================================

export {
  WAVE_DEFINITIONS,
  generateWaveDefinitions,
} from './waveData.js';

// ============================================================================
// Wave Monster Stats
// ============================================================================

export {
  WAVE_MONSTER_ID,
  getWaveMonsterDefinition,
  scaleWaveMonster,
} from './waveMonsters.js';

// ============================================================================
// Validation
// ============================================================================

export {
  validateGlobalConfig,
  validateTowerDefinition,
  validateTowerDefinitions,
  validateMonsterDefinition,
  validateMonsterDefinitions,
  validateMapDefinition,
  validateMapDefinitions,
  validateAiConfig,
  validateGameDataBundle,
  formatValidationErrors,
} from './validation.js';

export type {
  ValidationError,
  ValidationResult,
} from './validation.js';

// ============================================================================
// Invalid Fixtures (for testing)
// ============================================================================

export {
  INVALID_GLOBAL_CONFIG_NEGATIVE_HP,
  INVALID_GLOBAL_CONFIG_SELL_REFUND_OOB,
  INVALID_GLOBAL_CONFIG_SLOW_CAP_OOB,
  INVALID_TOWER_NEGATIVE_COST,
  INVALID_TOWER_TOO_MANY_LEVELS,
  INVALID_TOWER_INVALID_RANGE,
  INVALID_TOWER_SPLASH_FACTOR_OOB,
  INVALID_TOWER_DUPLICATE_ID,
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
