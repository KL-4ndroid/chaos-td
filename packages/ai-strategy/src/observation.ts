import {
  TOWER_DEFINITIONS,
  type MonsterTag,
  type PlayerSlot,
  type TowerRole,
} from '@chaos-td/game-data';

export const AI_OBSERVATION_SCHEMA_VERSION = 1 as const;

export type GamePhase = 'countdown' | 'running' | 'result';

/** Hidden: exact opponent gold and income are never exposed to the policy layer. */
export interface OpponentEconomyEstimate {
  readonly hasEstimate: false;
  readonly estimatedGoldMinimum: 0;
  readonly estimatedGoldMaximum: 0;
  readonly estimatedIncomeMinimum: 0;
  readonly estimatedIncomeMaximum: 0;
  readonly confidencePermille: 0;
}

export interface VisibleTower {
  readonly towerTypeId: string;
  readonly level: 1 | 2 | 3;
  readonly cellX: number;
  readonly cellY: number;
}

/**
 * Battlefield-level aggregates for the public battlefield state.
 * Does NOT include opponent send queue — queued monsters are not yet spawned.
 */
export interface BattlefieldObservation {
  readonly activeMonsterCount: number;
  readonly totalMonsterHp: number;
  readonly totalMonsterShield: number;
  readonly flyingMonsterCount: number;
  readonly flyingMonsterHp: number;
  readonly bossMonsterCount: number;
  /** Self-only: outbound queue length for the owning AI's own decisions. */
  readonly outboundQueueLength: number;
  readonly visibleTowers: readonly VisibleTower[];
  readonly groundCoverage: number;
  readonly flyingCoverage: number;
  readonly splashCoverage: number;
  readonly slowCoverage: number;
  readonly antiBossCoverage: number;
}

/**
 * Self-only AI observation.
 * Includes own economy and outbound send queue — observable private state.
 */
export interface SelfAIObservation {
  readonly hp: number;
  readonly gold: number;
  readonly income: number;
  readonly totalInvested: number;
  readonly towerCount: number;
  readonly towerRoleCoverage: Readonly<Record<TowerRole, number>>;
  readonly outboundQueueLength: number;
}

/**
 * Public opponent observation.
 * Opponent gold / income / send queue are intentionally absent.
 * Only officially spawned monsters and visible towers are included.
 */
export interface PublicOpponentObservation {
  readonly hp: number;
  readonly visibleTowers: readonly VisibleTower[];
  readonly estimatedEcon: OpponentEconomyEstimate;
  readonly groundCoverage: number;
  readonly flyingCoverage: number;
  readonly splashCoverage: number;
  readonly slowCoverage: number;
  readonly antiBossCoverage: number;
  readonly opponentActiveMonsterCount: number;
  readonly opponentTotalMonsterHp: number;
}

export interface AIObservation {
  readonly schemaVersion: typeof AI_OBSERVATION_SCHEMA_VERSION;
  readonly playerId: PlayerSlot;
  readonly tick: number;
  readonly phase: GamePhase;
  readonly waveNumber: number;
  readonly self: SelfAIObservation;
  readonly opponent: PublicOpponentObservation;
  readonly ownBattlefield: BattlefieldObservation;
  readonly opponentBattlefield: BattlefieldObservation;
  readonly selfActiveMonsterPressure: number;
  readonly selfFlyingPressure: number;
  readonly selfBossPressure: number;
  readonly opponentActiveMonsterPressure: number;
  readonly opponentFlyingPressure: number;
  readonly opponentBossPressure: number;
  readonly selfLeakRisk: number;
  readonly opponentLeakRisk: number;
  readonly selfGroundCoverage: number;
  readonly selfFlyingCoverage: number;
  readonly opponentGroundCoverage: number;
  readonly opponentFlyingCoverage: number;
}

function towerRoleCoverage(towers: readonly { towerTypeId: string }[]): Record<TowerRole, number> {
  const coverage: Record<TowerRole, number> = { single_target: 0, splash: 0, slow: 0, heavy_hit: 0 };
  for (const tower of towers) {
    const def = TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId);
    if (def) coverage[def.role] += 1;
  }
  return coverage;
}

function groundCoverage(towers: readonly { towerTypeId: string }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.attackTargets.includes('ground') ?? false,
  ).length;
}

function flyingCoverage(towers: readonly { towerTypeId: string }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.attackTargets.includes('flying') ?? false,
  ).length;
}

function splashCoverage(towers: readonly { towerTypeId: string }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.role === 'splash',
  ).length;
}

function slowCoverage(towers: readonly { towerTypeId: string }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.role === 'slow',
  ).length;
}

function antiBossCoverage(towers: readonly { towerTypeId: string }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.levels.some((l) => l.bonusDamageTag === 'boss'),
  ).length;
}

/** Canonical sort: towerTypeId → cellX → cellY → level */
function sortVisibleTowers(towers: readonly VisibleTower[]): readonly VisibleTower[] {
  return [...towers].sort((a, b) => {
    const type = a.towerTypeId.localeCompare(b.towerTypeId);
    if (type !== 0) return type;
    const cx = a.cellX - b.cellX;
    if (cx !== 0) return cx;
    const cy = a.cellY - b.cellY;
    if (cy !== 0) return cy;
    return a.level - b.level;
  });
}

function buildVisibleTowers(
  towers: readonly { towerTypeId: string; level: number; cellX: number; cellY: number }[],
): readonly VisibleTower[] {
  return sortVisibleTowers(
    towers.map((tower) => ({
      towerTypeId: tower.towerTypeId,
      level: tower.level as 1 | 2 | 3,
      cellX: tower.cellX,
      cellY: tower.cellY,
    })),
  );
}

function monsterPressure(
  monsters: readonly { hp: number; shield: number; leakDamage: number; pathProgressMilliTiles: number }[],
): number {
  return monsters.reduce((total, m) => total + m.hp + m.shield + m.leakDamage * 100 + Math.floor(m.pathProgressMilliTiles / 100), 0);
}

function battlefieldObservation(
  lane: {
    monsters: readonly { hp: number; shield: number; leakDamage: number; pathProgressMilliTiles: number; movementType: string; tags: readonly MonsterTag[] }[];
    /** Outbound spawn queue for the battlefield owner. */
    outboundQueue: readonly unknown[];
  },
  towers: readonly { towerTypeId: string; level: number; cellX: number; cellY: number }[],
): BattlefieldObservation {
  const allMonsters = lane.monsters;
  const flying = allMonsters.filter((m) => m.movementType === 'flying');
  const boss = allMonsters.filter((m) => m.tags.includes('boss'));
  const visibleSorted = buildVisibleTowers(towers);
  return {
    activeMonsterCount: allMonsters.length,
    totalMonsterHp: allMonsters.reduce((sum, m) => sum + m.hp, 0),
    totalMonsterShield: allMonsters.reduce((sum, m) => sum + m.shield, 0),
    flyingMonsterCount: flying.length,
    flyingMonsterHp: flying.reduce((sum, m) => sum + m.hp, 0),
    bossMonsterCount: boss.length,
    outboundQueueLength: lane.outboundQueue.length,
    visibleTowers: visibleSorted,
    groundCoverage: groundCoverage(towers),
    flyingCoverage: flyingCoverage(towers),
    splashCoverage: splashCoverage(towers),
    slowCoverage: slowCoverage(towers),
    antiBossCoverage: antiBossCoverage(towers),
  };
}

/**
 * Input to buildAIObservation.
 *
 * Type-level isolation: opponent.gold and opponent.income are NOT present.
 * Callers (self-play, balance sim, client) are responsible for constructing
 * this input from the simulation state, never leaking hidden information.
 */
export interface BuildAIObservationInput {
  readonly selfPlayer: {
    readonly hp: number;
    readonly gold: number;
    readonly income: number;
    readonly totalInvested: number;
  };

  readonly publicOpponent: {
    /** Only HP is publicly observable. */
    readonly hp: number;
  };

  readonly ownBattlefield: {
    readonly monsters: readonly {
      readonly hp: number;
      readonly shield: number;
      readonly leakDamage: number;
      readonly pathProgressMilliTiles: number;
      readonly movementType: string;
      readonly tags: readonly MonsterTag[];
    }[];
    /** Own outbound queue — self-only, needed for send decision. */
    readonly outboundQueue: readonly unknown[];
  };

  readonly opponentBattlefield: {
    readonly monsters: readonly {
      readonly hp: number;
      readonly shield: number;
      readonly leakDamage: number;
      readonly pathProgressMilliTiles: number;
      readonly movementType: string;
      readonly tags: readonly MonsterTag[];
    }[];
    /** Opponent outbound queue — intentionally absent from input. */
  };

  readonly ownTowers: readonly {
    readonly towerTypeId: string;
    readonly level: number;
    readonly cellX: number;
    readonly cellY: number;
  }[];

  readonly opponentTowers: readonly {
    readonly towerTypeId: string;
    readonly level: number;
    readonly cellX: number;
    readonly cellY: number;
  }[];

  readonly tick: number;
  readonly phase: GamePhase;
  /**
   * Canonical wave number from the authoritative wave scheduler.
   * Must NOT be recalculated from tick inside the builder.
   */
  readonly waveNumber: number;
}

export function buildAIObservation(
  playerId: PlayerSlot,
  input: BuildAIObservationInput,
): AIObservation {
  const selfObs: SelfAIObservation = {
    hp: input.selfPlayer.hp,
    gold: input.selfPlayer.gold,
    income: input.selfPlayer.income,
    totalInvested: input.selfPlayer.totalInvested,
    towerCount: input.ownTowers.length,
    towerRoleCoverage: towerRoleCoverage(input.ownTowers),
    outboundQueueLength: input.ownBattlefield.outboundQueue.length,
  };

  const oppObs: PublicOpponentObservation = {
    hp: input.publicOpponent.hp,
    visibleTowers: buildVisibleTowers(input.opponentTowers),
    estimatedEcon: {
      hasEstimate: false,
      estimatedGoldMinimum: 0,
      estimatedGoldMaximum: 0,
      estimatedIncomeMinimum: 0,
      estimatedIncomeMaximum: 0,
      confidencePermille: 0,
    },
    groundCoverage: groundCoverage(input.opponentTowers),
    flyingCoverage: flyingCoverage(input.opponentTowers),
    splashCoverage: splashCoverage(input.opponentTowers),
    slowCoverage: slowCoverage(input.opponentTowers),
    antiBossCoverage: antiBossCoverage(input.opponentTowers),
    opponentActiveMonsterCount: input.opponentBattlefield.monsters.length,
    opponentTotalMonsterHp: input.opponentBattlefield.monsters.reduce((s, m) => s + m.hp, 0),
  };

  const ownBattlefield = battlefieldObservation(
    { monsters: input.ownBattlefield.monsters, outboundQueue: input.ownBattlefield.outboundQueue },
    input.ownTowers,
  );
  const oppBattlefield = battlefieldObservation(
    { monsters: input.opponentBattlefield.monsters, outboundQueue: [] },
    input.opponentTowers,
  );

  const ownPressure = monsterPressure(input.ownBattlefield.monsters);
  const oppPressure = monsterPressure(input.opponentBattlefield.monsters);

  const selfFlying = monsterPressure(input.ownBattlefield.monsters.filter((m) => m.movementType === 'flying'));
  const oppFlying = monsterPressure(input.opponentBattlefield.monsters.filter((m) => m.movementType === 'flying'));

  const selfBoss = monsterPressure(input.ownBattlefield.monsters.filter((m) => m.tags.includes('boss')));
  const oppBoss = monsterPressure(input.opponentBattlefield.monsters.filter((m) => m.tags.includes('boss')));

  return {
    schemaVersion: AI_OBSERVATION_SCHEMA_VERSION,
    playerId,
    tick: input.tick,
    phase: input.phase,
    waveNumber: input.waveNumber,
    self: selfObs,
    opponent: oppObs,
    ownBattlefield,
    opponentBattlefield: oppBattlefield,
    selfActiveMonsterPressure: ownPressure,
    selfFlyingPressure: selfFlying,
    selfBossPressure: selfBoss,
    opponentActiveMonsterPressure: oppPressure,
    opponentFlyingPressure: oppFlying,
    opponentBossPressure: oppBoss,
    selfLeakRisk: Math.max(0, ownPressure - (ownBattlefield.groundCoverage + ownBattlefield.flyingCoverage) * 200),
    opponentLeakRisk: Math.max(0, oppPressure - (oppBattlefield.groundCoverage + oppBattlefield.flyingCoverage) * 200),
    selfGroundCoverage: ownBattlefield.groundCoverage,
    selfFlyingCoverage: ownBattlefield.flyingCoverage,
    opponentGroundCoverage: oppBattlefield.groundCoverage,
    opponentFlyingCoverage: oppBattlefield.flyingCoverage,
  };
}
