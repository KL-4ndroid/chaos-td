import {
  TOWER_DEFINITIONS,
  type MonsterTag,
  type PlayerSlot,
  type TowerRole,
} from '@chaos-td/game-data';
import type {
  DomainEvent,
  Phase,
} from '@chaos-td/game-core';
import type { AIStrategyGenome } from './strategy.js';

export const AI_OBSERVATION_SCHEMA_VERSION = 1 as const;

export type GamePhase = Exclude<Phase, 'ready' | 'resolving'>;

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

export interface BattlefieldObservation {
  readonly activeMonsterCount: number;
  readonly totalMonsterHp: number;
  readonly totalMonsterShield: number;
  readonly flyingMonsterCount: number;
  readonly flyingMonsterHp: number;
  readonly bossMonsterCount: number;
  readonly sendQueueLength: number;
  readonly visibleTowers: readonly VisibleTower[];
  readonly groundCoverage: number;
  readonly flyingCoverage: number;
  readonly splashCoverage: number;
  readonly slowCoverage: number;
  readonly antiBossCoverage: number;
}

export interface SelfAIObservation {
  readonly hp: number;
  readonly gold: number;
  readonly income: number;
  readonly totalInvested: number;
  readonly towerCount: number;
  readonly towerRoleCoverage: Readonly<Record<TowerRole, number>>;
  readonly sendQueueLength: number;
}

export interface PublicOpponentObservation {
  readonly hp: number;
  readonly visibleTowers: readonly VisibleTower[];
  readonly estimatedEcon: OpponentEconomyEstimate;
  readonly groundCoverage: number;
  readonly flyingCoverage: number;
  readonly splashCoverage: number;
  readonly slowCoverage: number;
  readonly antiBossCoverage: number;
  readonly opponentSendQueueLength: number;
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

function opponentOf(playerId: PlayerSlot): PlayerSlot {
  return playerId === 'p1' ? 'p2' : 'p1';
}

function laneForDefender(playerId: PlayerSlot): 'lane_p1' | 'lane_p2' {
  return playerId === 'p1' ? 'lane_p1' : 'lane_p2';
}

function towerRoleCoverage(towers: readonly { entityId: number; towerTypeId: string; level: number; cellX: number; cellY: number }[]): Record<TowerRole, number> {
  const coverage: Record<TowerRole, number> = { single_target: 0, splash: 0, slow: 0, heavy_hit: 0 };
  for (const tower of towers) {
    const def = TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId);
    if (def) coverage[def.role] += 1;
  }
  return coverage;
}

function groundCoverage(towers: readonly { entityId: number; towerTypeId: string; level: number; cellX: number; cellY: number }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.attackTargets.includes('ground') ?? false,
  ).length;
}

function flyingCoverage(towers: readonly { entityId: number; towerTypeId: string; level: number; cellX: number; cellY: number }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.attackTargets.includes('flying') ?? false,
  ).length;
}

function splashCoverage(towers: readonly { entityId: number; towerTypeId: string; level: number; cellX: number; cellY: number }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.role === 'splash',
  ).length;
}

function slowCoverage(towers: readonly { entityId: number; towerTypeId: string; level: number; cellX: number; cellY: number }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.role === 'slow',
  ).length;
}

function antiBossCoverage(towers: readonly { entityId: number; towerTypeId: string; level: number; cellX: number; cellY: number }[]): number {
  return towers.filter((tower) =>
    TOWER_DEFINITIONS.find((d) => d.id === tower.towerTypeId)?.levels.some((l) => l.bonusDamageTag === 'boss'),
  ).length;
}

function visibleTowers(towers: readonly { entityId: number; towerTypeId: string; level: number; cellX: number; cellY: number }[]): readonly VisibleTower[] {
  return towers.map((tower) => ({
    towerTypeId: tower.towerTypeId,
    level: tower.level as 1 | 2 | 3,
    cellX: tower.cellX,
    cellY: tower.cellY,
  }));
}

function monsterPressure(
  monsters: readonly { hp: number; shield: number; leakDamage: number; pathProgressMilliTiles: number }[],
): number {
  return monsters.reduce((total, m) => total + m.hp + m.shield + m.leakDamage * 100 + Math.floor(m.pathProgressMilliTiles / 100), 0);
}

function battlefieldObservation(
  lane: { monsters: readonly { hp: number; shield: number; movementType: string; tags: readonly MonsterTag[]; pathProgressMilliTiles: number; leakDamage: number }[]; spawnQueue: readonly unknown[] },
  towers: readonly { entityId: number; towerTypeId: string; level: number; cellX: number; cellY: number }[],
): BattlefieldObservation {
  const allMonsters = lane.monsters;
  const flying = allMonsters.filter((m) => m.movementType === 'flying');
  const boss = allMonsters.filter((m) => m.tags.includes('boss'));
  return {
    activeMonsterCount: allMonsters.length,
    totalMonsterHp: allMonsters.reduce((sum, m) => sum + m.hp, 0),
    totalMonsterShield: allMonsters.reduce((sum, m) => sum + m.shield, 0),
    flyingMonsterCount: flying.length,
    flyingMonsterHp: flying.reduce((sum, m) => sum + m.hp, 0),
    bossMonsterCount: boss.length,
    sendQueueLength: lane.spawnQueue.length,
    visibleTowers: visibleTowers(towers),
    groundCoverage: groundCoverage(towers),
    flyingCoverage: flyingCoverage(towers),
    splashCoverage: splashCoverage(towers),
    slowCoverage: slowCoverage(towers),
    antiBossCoverage: antiBossCoverage(towers),
  };
}

function currentWave(tick: number): number {
  return Math.max(1, Math.floor(tick / 400) + 1);
}

export interface BuildObservationInput {
  readonly players: Record<PlayerSlot, { hp: number; gold: number; income: number; totalInvested: number }>;
  readonly lanes: Record<'lane_p1' | 'lane_p2', {
    monsters: readonly { hp: number; shield: number; leakDamage: number; pathProgressMilliTiles: number; movementType: string; tags: readonly MonsterTag[] }[];
    spawnQueue: readonly unknown[];
  }>;
  readonly towers: readonly {
    readonly entityId: number;
    readonly ownerId: PlayerSlot;
    readonly towerTypeId: string;
    readonly level: number;
    readonly cellX: number;
    readonly cellY: number;
  }[];
  readonly tick: number;
  readonly phase: 'countdown' | 'running' | 'result';
}

export function buildAIObservation(
  playerId: PlayerSlot,
  input: BuildObservationInput,
): AIObservation {
  const opponentId = opponentOf(playerId);
  const ownLaneId = laneForDefender(playerId);
  const oppLaneId = laneForDefender(opponentId);
  const ownTowers = input.towers.filter((t) => t.ownerId === playerId);
  const oppTowers = input.towers.filter((t) => t.ownerId === opponentId);

  const self = input.players[playerId];
  const oppPlayer = input.players[opponentId];

  const selfObs: SelfAIObservation = {
    hp: self.hp,
    gold: self.gold,
    income: self.income,
    totalInvested: self.totalInvested,
    towerCount: ownTowers.length,
    towerRoleCoverage: towerRoleCoverage(ownTowers),
    sendQueueLength: input.lanes[oppLaneId].spawnQueue.length,
  };

  const oppObs: PublicOpponentObservation = {
    hp: oppPlayer.hp,
    visibleTowers: visibleTowers(oppTowers),
    estimatedEcon: { hasEstimate: false, estimatedGoldMinimum: 0, estimatedGoldMaximum: 0, estimatedIncomeMinimum: 0, estimatedIncomeMaximum: 0, confidencePermille: 0 },
    groundCoverage: groundCoverage(oppTowers),
    flyingCoverage: flyingCoverage(oppTowers),
    splashCoverage: splashCoverage(oppTowers),
    slowCoverage: slowCoverage(oppTowers),
    antiBossCoverage: antiBossCoverage(oppTowers),
    opponentSendQueueLength: input.lanes[ownLaneId].spawnQueue.length,
    opponentActiveMonsterCount: input.lanes[ownLaneId].monsters.length,
    opponentTotalMonsterHp: input.lanes[ownLaneId].monsters.reduce((s, m) => s + m.hp, 0),
  };

  const ownBattlefield = battlefieldObservation(input.lanes[ownLaneId], ownTowers);
  const oppBattlefield = battlefieldObservation(input.lanes[oppLaneId], oppTowers);

  const ownMonsters = input.lanes[ownLaneId].monsters;
  const oppMonsters = input.lanes[oppLaneId].monsters;

  const selfPressure = monsterPressure(ownMonsters);
  const oppPressure = monsterPressure(oppMonsters);

  const selfFlying = monsterPressure(ownMonsters.filter((m) => m.movementType === 'flying'));
  const oppFlying = monsterPressure(oppMonsters.filter((m) => m.movementType === 'flying'));

  const selfBoss = monsterPressure(ownMonsters.filter((m) => m.tags.includes('boss')));
  const oppBoss = monsterPressure(oppMonsters.filter((m) => m.tags.includes('boss')));

  return {
    schemaVersion: AI_OBSERVATION_SCHEMA_VERSION,
    playerId,
    tick: input.tick,
    phase: input.phase as GamePhase,
    waveNumber: currentWave(input.tick),
    self: selfObs,
    opponent: oppObs,
    ownBattlefield,
    opponentBattlefield: oppBattlefield,
    selfActiveMonsterPressure: selfPressure,
    selfFlyingPressure: selfFlying,
    selfBossPressure: selfBoss,
    opponentActiveMonsterPressure: oppPressure,
    opponentFlyingPressure: oppFlying,
    opponentBossPressure: oppBoss,
    selfLeakRisk: Math.max(0, selfPressure - (ownBattlefield.groundCoverage + ownBattlefield.flyingCoverage) * 200),
    opponentLeakRisk: Math.max(0, oppPressure - (oppBattlefield.groundCoverage + oppBattlefield.flyingCoverage) * 200),
    selfGroundCoverage: ownBattlefield.groundCoverage,
    selfFlyingCoverage: ownBattlefield.flyingCoverage,
    opponentGroundCoverage: oppBattlefield.groundCoverage,
    opponentFlyingCoverage: oppBattlefield.flyingCoverage,
  };
}

export function observationFromDomainEvents(
  _events: readonly DomainEvent[],
  _playerId: PlayerSlot,
  _genome: AIStrategyGenome,
): AIObservation | null {
  return null;
}
