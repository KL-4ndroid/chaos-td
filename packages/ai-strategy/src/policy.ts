import {
  MONSTER_DEFINITIONS,
  MVP_MIRROR_01,
  TOWER_DEFINITIONS,
  type MonsterTag,
  type PlayerSlot,
  type TowerId,
  type TowerRole,
} from '@chaos-td/game-data';
import {
  createCommandId,
  nextInt,
  type GameCommand,
  type SeededRng,
  type SimulationState,
} from '@chaos-td/game-core';
import type { AIStrategyGenome } from './strategy.js';

export interface AIFeatures {
  readonly playerId: PlayerSlot;
  readonly tick: number;
  readonly hp: number;
  readonly gold: number;
  readonly income: number;
  readonly towerInvestment: number;
  readonly towerRoleCoverage: Readonly<Record<TowerRole, number>>;
  readonly groundCoverage: number;
  readonly flyingCoverage: number;
  readonly splashCoverage: number;
  readonly slowCoverage: number;
  readonly bossDefenseCoverage: number;
  readonly activeMonsterPressure: number;
  readonly flyingPressure: number;
  readonly bossPressure: number;
  readonly leakRisk: number;
  readonly sendQueueCount: number;
  readonly opponentHp: number;
  readonly opponentGold: number;
  readonly opponentIncome: number;
  readonly opponentGroundCoverage: number;
  readonly opponentFlyingCoverage: number;
  readonly opponentPressure: number;
}

export type LegalAIAction =
  | { readonly type: 'build_tower'; readonly towerTypeId: string; readonly cellX: number; readonly cellY: number }
  | { readonly type: 'upgrade_tower'; readonly towerEntityId: number }
  | { readonly type: 'sell_tower'; readonly towerEntityId: number }
  | { readonly type: 'queue_monster'; readonly monsterTypeId: string; readonly quantity: number }
  | { readonly type: 'wait' };

export interface ScoredAIAction {
  readonly action: LegalAIAction;
  readonly score: number;
}

function opponentOf(playerId: PlayerSlot): PlayerSlot {
  return playerId === 'p1' ? 'p2' : 'p1';
}

function laneForDefender(playerId: PlayerSlot): 'lane_p1' | 'lane_p2' {
  return playerId === 'p1' ? 'lane_p1' : 'lane_p2';
}

function emptyRoleCoverage(): Record<TowerRole, number> {
  return { single_target: 0, splash: 0, slow: 0, heavy_hit: 0 };
}

function monsterPressure(monster: { hp: number; shield: number; leakDamage: number; pathProgressMilliTiles: number }): number {
  return monster.hp + monster.shield + monster.leakDamage * 100 + Math.floor(monster.pathProgressMilliTiles / 100);
}

function hasTag(tags: readonly MonsterTag[], tag: MonsterTag): boolean {
  return tags.includes(tag);
}

export function extractAIFeatures(state: SimulationState, playerId: PlayerSlot): AIFeatures {
  const opponentId = opponentOf(playerId);
  const ownLane = state.lanes[laneForDefender(playerId)];
  const opponentLane = state.lanes[laneForDefender(opponentId)];
  const roleCoverage = emptyRoleCoverage();
  let groundCoverage = 0;
  let flyingCoverage = 0;
  let bossDefenseCoverage = 0;

  for (const tower of state.towers) {
    if (tower.ownerId !== playerId) continue;
    const definition = TOWER_DEFINITIONS.find((candidate) => candidate.id === tower.towerTypeId);
    if (!definition) continue;
    roleCoverage[definition.role] += 1;
    if (definition.attackTargets.includes('ground')) groundCoverage += 1;
    if (definition.attackTargets.includes('flying')) flyingCoverage += 1;
    if (definition.levels.some((level) => level.bonusDamageTag === 'boss')) bossDefenseCoverage += 1;
  }

  const ownPressure = ownLane.monsters.reduce((total, monster) => total + monsterPressure(monster), 0);
  const opponentPressure = opponentLane.monsters.reduce((total, monster) => total + monsterPressure(monster), 0);
  const flyingPressure = ownLane.monsters.filter((monster) => monster.movementType === 'flying').reduce((total, monster) => total + monsterPressure(monster), 0);
  const bossPressure = ownLane.monsters.filter((monster) => hasTag(monster.tags, 'boss')).reduce((total, monster) => total + monsterPressure(monster), 0);
  const opponentRoleCoverage = { ground: 0, flying: 0 };
  for (const tower of state.towers) {
    if (tower.ownerId !== opponentId) continue;
    const definition = TOWER_DEFINITIONS.find((candidate) => candidate.id === tower.towerTypeId);
    if (!definition) continue;
    if (definition.attackTargets.includes('ground')) opponentRoleCoverage.ground += 1;
    if (definition.attackTargets.includes('flying')) opponentRoleCoverage.flying += 1;
  }

  const player = state.players[playerId];
  const opponent = state.players[opponentId];
  return {
    playerId,
    tick: state.tick,
    hp: player.hp,
    gold: player.gold,
    income: player.income,
    towerInvestment: player.totalInvested,
    towerRoleCoverage: roleCoverage,
    groundCoverage,
    flyingCoverage,
    splashCoverage: roleCoverage.splash,
    slowCoverage: roleCoverage.slow,
    bossDefenseCoverage,
    activeMonsterPressure: ownPressure,
    flyingPressure,
    bossPressure,
    leakRisk: Math.max(0, ownPressure - (groundCoverage + flyingCoverage) * 200),
    sendQueueCount: state.lanes[laneForDefender(opponentId)].spawnQueue.length,
    opponentHp: opponent.hp,
    opponentGold: opponent.gold,
    opponentIncome: opponent.income,
    opponentGroundCoverage: opponentRoleCoverage.ground,
    opponentFlyingCoverage: opponentRoleCoverage.flying,
    opponentPressure,
  };
}

export function generateLegalActions(state: SimulationState, playerId: PlayerSlot): LegalAIAction[] {
  const player = state.players[playerId];
  const laneDefinition = MVP_MIRROR_01.lanes.find((lane) => lane.defenderPlayerId === playerId);
  if (!laneDefinition) throw new Error(`Missing lane definition for ${playerId}`);
  const occupiedCells = new Set(state.towers.filter((tower) => tower.ownerId === playerId).map((tower) => `${tower.cellX}:${tower.cellY}`));
  const actions: LegalAIAction[] = [{ type: 'wait' }];

  for (const definition of TOWER_DEFINITIONS) {
    const level = definition.levels[0];
    if (!level || player.gold < level.cost) continue;
    for (const cell of laneDefinition.buildableCells) {
      if (!occupiedCells.has(`${cell.col}:${cell.row}`)) actions.push({ type: 'build_tower', towerTypeId: definition.id, cellX: cell.col, cellY: cell.row });
    }
  }
  for (const tower of state.towers) {
    if (tower.ownerId !== playerId) continue;
    const definition = TOWER_DEFINITIONS.find((candidate) => candidate.id === tower.towerTypeId);
    const upgrade = definition?.levels[tower.level];
    if (upgrade && player.gold >= upgrade.cost) actions.push({ type: 'upgrade_tower', towerEntityId: tower.entityId });
    actions.push({ type: 'sell_tower', towerEntityId: tower.entityId });
  }
  if (state.lanes[laneForDefender(opponentOf(playerId))].spawnQueue.length < 30) {
    for (const definition of MONSTER_DEFINITIONS) {
      if (player.gold >= definition.sendCost && state.tick >= definition.availableAtRunningTick) {
        actions.push({ type: 'queue_monster', monsterTypeId: definition.id, quantity: 1 });
      }
    }
  }
  return actions;
}

export function scoreAIAction(features: AIFeatures, action: LegalAIAction, genome: AIStrategyGenome): ScoredAIAction {
  let score = 0;
  if (action.type === 'wait') score = 1;
  if (action.type === 'build_tower') {
    const definition = TOWER_DEFINITIONS.find((candidate) => candidate.id === action.towerTypeId);
    if (!definition) return { action, score: Number.MIN_SAFE_INTEGER };
    score = genome.defenseWeight + features.leakRisk + (features.activeMonsterPressure * genome.pressureTimingWeight) / 1000;
    if (definition.attackTargets.includes('flying')) score += (features.flyingPressure * genome.antiAirPriority) / 1000;
    if (definition.role === 'splash') score += (features.activeMonsterPressure * genome.splashPriority) / 1000;
    if (definition.role === 'slow') score += (features.activeMonsterPressure * genome.slowPriority) / 1000;
    if (definition.levels.some((level) => level.bonusDamageTag === 'boss')) score += (features.bossPressure * genome.antiBossPriority) / 1000;
    score -= features.towerRoleCoverage[definition.role] * genome.diversityPreference;
  }
  if (action.type === 'upgrade_tower') score = genome.defenseWeight + features.activeMonsterPressure - genome.upgradeThreshold;
  if (action.type === 'sell_tower') score = genome.sellThreshold - features.activeMonsterPressure - features.leakRisk;
  if (action.type === 'queue_monster') {
    const definition = MONSTER_DEFINITIONS.find((candidate) => candidate.id === action.monsterTypeId);
    if (!definition) return { action, score: Number.MIN_SAFE_INTEGER };
    score = genome.aggressionWeight + (features.opponentPressure * genome.counterOpponentWeight) / 1000;
    if (definition.movementType === 'flying') score += Math.max(0, features.opponentGroundCoverage - features.opponentFlyingCoverage) * genome.antiAirPriority;
    if (hasTag(definition.tags, 'swift')) score += genome.pressureTimingWeight;
  }
  return { action, score: Math.floor(score) };
}

function actionKey(action: LegalAIAction): string {
  switch (action.type) {
    case 'build_tower': return `build:${action.towerTypeId}:${action.cellX}:${action.cellY}`;
    case 'upgrade_tower': return `upgrade:${action.towerEntityId}`;
    case 'sell_tower': return `sell:${action.towerEntityId}`;
    case 'queue_monster': return `queue:${action.monsterTypeId}:${action.quantity}`;
    case 'wait': return 'wait';
  }
}

export function selectAIAction(scoredActions: readonly ScoredAIAction[], seededPolicyRandom: SeededRng): LegalAIAction {
  if (scoredActions.length === 0) return { type: 'wait' };
  const bestScore = Math.max(...scoredActions.map((candidate) => candidate.score));
  const tied = scoredActions.filter((candidate) => candidate.score === bestScore).sort((a, b) => actionKey(a.action).localeCompare(actionKey(b.action)));
  const picked = nextInt(seededPolicyRandom, 0, tied.length - 1).value;
  return tied[picked]?.action ?? { type: 'wait' };
}

export function toGameCommand(action: LegalAIAction, playerId: PlayerSlot, tick: number, sequence: number): GameCommand | null {
  const commandId = createCommandId(playerId, tick, sequence);
  switch (action.type) {
    case 'build_tower': return { type: 'build_tower', commandId, playerId, towerTypeId: action.towerTypeId as TowerId, cellX: action.cellX, cellY: action.cellY };
    case 'upgrade_tower': return { type: 'upgrade_tower', commandId, playerId, towerEntityId: action.towerEntityId };
    case 'sell_tower': return { type: 'sell_tower', commandId, playerId, towerEntityId: action.towerEntityId };
    case 'queue_monster': return { type: 'queue_monster', commandId, playerId, monsterTypeId: action.monsterTypeId, quantity: action.quantity };
    case 'wait': return null;
  }
}
