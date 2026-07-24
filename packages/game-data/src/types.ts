/**
 * @chaos-td/game-data - Type Definitions
 *
 * ID Literal Types and base type definitions.
 * These are the authoritative type definitions for game balance data.
 */

// ============================================================================
// ID Literal Types
// ============================================================================

export type PlayerSlot = 'p1' | 'p2';
export type LaneId = 'lane_p1' | 'lane_p2';
export type TowerId = 'archer' | 'mage' | 'frost' | 'sniper';
export type MonsterId =
  | 'sheep' | 'wolf' | 'treant' | 'ghost'
  | 'basic' | 'swift' | 'flying' | 'siege' | 'boss';
export type MapId = 'mvp_mirror_01';
export type EntityId = number;

// ============================================================================
// Movement Type (monster category for targeting)
// ============================================================================

/** Which path a monster uses and what can attack it */
export type MovementType = 'ground' | 'flying';

// ============================================================================
// Monster Tags (behavioral / tactical labels)
// ============================================================================

/**
 * Tags drive tower counter bonuses and client display icons.
 * - boss: very high HP, appears on boss waves, high priority
 * - siege: prioritizes attacking towers in range over advancing
 * - swift: faster movement speed, hard to intercept
 * - magic_resist: takes reduced damage from magic-type towers
 * - physical_resist: takes reduced damage from physical-type towers
 */
export type MonsterTag = 'boss' | 'siege' | 'swift' | 'magic_resist' | 'physical_resist';

// ============================================================================
// Tower Damage Type (determines which resist tag applies)
// ============================================================================

export type DamageType = 'physical' | 'magic' | 'pure';

// ============================================================================
// Grid and Position Types
// ============================================================================

/** Grid cell coordinates (0-indexed) */
export interface GridCell {
  readonly col: number;
  readonly row: number;
}

/** Fixed-point position in milli-tiles */
export interface FixedPointPosition {
  readonly xMilliTiles: number;
  readonly yMilliTiles: number;
}

// ============================================================================
// Config Version
// ============================================================================

export interface ConfigVersion {
  readonly version: string;
  readonly schemaVersion: 1;
}

// ============================================================================
// Tower Level Definition
// ============================================================================

export interface TowerLevelDefinition {
  /** Upgrade cost (L1 = build cost, L2/L3 = additional upgrade cost) */
  readonly cost: number;
  /** Damage per attack */
  readonly damage: number;
  /** Attack cooldown in ticks */
  readonly cooldownTicks: number;
  /** Attack range in milli-tiles */
  readonly rangeMilliTiles: number;
  /** Splash damage radius in milli-tiles (optional, for splash towers) */
  readonly splashRadiusMilliTiles?: number;
  /** Splash damage factor in permille (optional) */
  readonly splashFactorPermille?: number;
  /** Slow effect radius in milli-tiles (optional, for slow towers) */
  readonly slowRadiusMilliTiles?: number;
  /** Slow effect in permille (optional) */
  readonly slowPermille?: number;
  /** Slow duration in ticks (optional) */
  readonly slowDurationTicks?: number;
  /** Bonus damage multiplier in permille when the primary target has a matching tag (optional) */
  readonly bonusDamagePermille?: number;
  /** Tag that triggers bonusDamage (optional, e.g. 'boss') */
  readonly bonusDamageTag?: MonsterTag;
}

// ============================================================================
// Tower Definition
// ============================================================================

export type TowerRole = 'single_target' | 'splash' | 'slow' | 'heavy_hit';
export type TowerTargeting = 'first' | 'strong' | 'boss';

/**
 * attackTargets controls which monster movementTypes this tower can engage.
 * An empty array means the tower cannot attack any monster type.
 * Example: anti-air tower has attackTargets: ['flying'] only.
 */
export type AttackTarget = 'ground' | 'flying';

export interface TowerDefinition {
  readonly id: TowerId;
  readonly displayName: string;
  readonly role: TowerRole;
  readonly targeting: TowerTargeting;
  /** Which monster movementTypes this tower can target. Empty array = cannot attack. */
  readonly attackTargets: readonly AttackTarget[];
  /** Damage type used for resistance checks. Pure damage ignores monster resist tags. */
  readonly damageType: DamageType;
  readonly levels: readonly TowerLevelDefinition[];
}

// ============================================================================
// Monster Definition
// ============================================================================

export interface MonsterDefinition {
  readonly id: MonsterId;
  readonly displayName: string;
  /** Cost to send this monster type */
  readonly sendCost: number;
  /** Income gained when opponent kills this monster */
  readonly incomeGain: number;
  /** Bounty earned when you kill your own sent monster */
  readonly bounty: number;
  /** Health points */
  readonly hp: number;
  /** Shield (absorbs damage before HP) */
  readonly shield: number;
  /** Armor in permille (reduces physical damage) */
  readonly armorPermille: number;
  /** Movement speed in milli-tiles per tick */
  readonly speedMilliTilesPerTick: number;
  /** Damage dealt when monster reaches the end */
  readonly leakDamage: number;
  /** First tick this monster is available (from RUNNING start) */
  readonly availableAtRunningTick: number;
  /** Minimum ticks between spawns */
  readonly spawnGapTicks: number;
  /** Ground monsters use the grid path; flying monsters use a separate elevated path. */
  readonly movementType: MovementType;
  /** AI behavior preference when the monster is in a tower's range. */
  readonly targetPreference: 'base' | 'tower' | 'closest';
  /**
   * Tactical tags used for tower counter-bonus matching and client UI icons.
   * Examples: 'boss' triggers bonusDamage on anti-boss towers; 'magic_resist'
   * applies damage reduction to magic-type towers; 'siege' triggers tower-targeting AI.
   */
  readonly tags: readonly MonsterTag[];
}

// ============================================================================
// Lane Definition
// ============================================================================

export interface LaneDefinition {
  readonly id: LaneId;
  readonly defenderPlayerId: PlayerSlot;
  readonly attackerPlayerId: PlayerSlot;
  /** Waypoints defining the monster path */
  readonly waypoints: readonly FixedPointPosition[];
  readonly spawnPosition: FixedPointPosition;
  readonly endPosition: FixedPointPosition;
  /** Cells monsters may traverse; towers placed here become path obstacles. */
  readonly navigationCells: readonly GridCell[];
  readonly buildableCells: readonly GridCell[];
  readonly blockedCells: readonly GridCell[];
  readonly aiBuildPriorityCells: readonly GridCell[];
}

// ============================================================================
// Map Definition
// ============================================================================

export interface MapDefinition {
  readonly id: MapId;
  readonly schemaVersion: 1;
  readonly displayName: string;
  readonly gridColumns: number;
  readonly gridRows: number;
  readonly lanes: readonly LaneDefinition[];
}

// ============================================================================
// Global Config
// ============================================================================

export interface GlobalConfig {
  readonly configVersion: string;
  readonly schemaVersion: 1;
  /** Simulation tick rate */
  readonly tickRate: number;
  /** Countdown duration in ticks */
  readonly countdownTicks: number;
  /** Maximum RUNNING ticks before timeout */
  readonly maxRunningTicks: number;
  /** Maximum RESOLVING ticks */
  readonly maxResolvingTicks: number;
  /** Starting HP for each player */
  readonly startingHp: number;
  /** Starting gold for each player */
  readonly startingGold: number;
  /** Starting income for each player */
  readonly startingIncome: number;
  /** Ticks between income payments */
  readonly incomeIntervalTicks: number;
  /** Sell refund percentage in permille */
  readonly sellRefundPermille: number;
  /** Maximum send queue size */
  readonly sendQueueLimit: number;
  /** Minimum slow effect permille (slow cap) */
  readonly slowCapPermille: number;
}

// ============================================================================
// Wave System Types
// ============================================================================

export type WaveMonsterType = 'basic' | 'swift' | 'flying' | 'siege' | 'boss';

/** Single wave event: which monster type spawns, how many, and at what difficulty multiplier. */
export interface WaveGroup {
  readonly monsterType: WaveMonsterType;
  readonly count: number;
  /** Scale factor applied to monster HP and damage for difficulty progression */
  readonly difficultyMultiplier: number;
}

/** A wave is a sequence of monster groups spawned in order. */
export interface WaveDefinition {
  /** 1-based wave number */
  readonly waveNumber: number;
  readonly groups: readonly WaveGroup[];
  /** Total tick duration of this wave from first spawn to last spawn */
  readonly totalDurationTicks: number;
}

/** Runtime state for a wave that is actively spawning. */
export interface WaveRuntimeState {
  readonly waveNumber: number;
  readonly groups: readonly WaveGroup[];
  currentGroupIndex: number;
  ticksUntilNextSpawn: number;
}

/** AI difficulty level */
export type AiDifficulty = 'easy' | 'medium' | 'hard';

/** AI personality for decision making */
export type AiPersonality = 'aggressive' | 'balanced' | 'defensive';

/** Cell priority for AI building decisions */
export interface AiCellPriority {
  readonly cell: GridCell;
  readonly priority: number;
}

/** Lane-specific AI configuration */
export interface AiLaneConfig {
  readonly laneId: LaneId;
  readonly difficulty: AiDifficulty;
  readonly personality: AiPersonality;
  /** Preferred tower build order (tower IDs) */
  readonly preferredTowers: readonly TowerId[];
  /** Budget allocation per phase */
  readonly phaseBudget: Readonly<{
    early: number;   // countdown + early running
    mid: number;     // mid game
    late: number;    // late game
  }>;
}

/** AI configuration for a player */
export interface AiConfig {
  readonly configVersion: string;
  readonly schemaVersion: 1;
  readonly playerId: PlayerSlot;
  readonly difficulty: AiDifficulty;
  readonly personality: AiPersonality;
  /** Lane-specific AI settings */
  readonly lanes: readonly AiLaneConfig[];
}

// ============================================================================
// Game Data Bundle
// ============================================================================

export interface GameDataBundle {
  readonly configVersion: string;
  readonly global: GlobalConfig;
  readonly towers: readonly TowerDefinition[];
  readonly monsters: readonly MonsterDefinition[];
  readonly maps: readonly MapDefinition[];
  readonly aiConfigs: readonly AiConfig[];
}
