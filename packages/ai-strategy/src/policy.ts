import {
  GLOBAL_CONFIG,
  MONSTER_DEFINITIONS,
  MVP_MIRROR_01,
  TOWER_DEFINITIONS,
  type MonsterTag,
  type PlayerSlot,
  type TowerId,
} from '@chaos-td/game-data';
import {
  createCommandId,
  nextInt,
  type GameCommand,
  type SeededRng,
} from '@chaos-td/game-core';
import type { AIStrategyGenome } from './strategy.js';
import type { AIObservation } from './observation.js';

export interface AIFeatures {
  readonly playerId: PlayerSlot;
  readonly tick: number;
  readonly hp: number;
  readonly gold: number;
  readonly income: number;
  readonly towerInvestment: number;
  readonly towerRoleCoverage: Readonly<Record<string, number>>;
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
  readonly opponentGroundCoverage: number;
  readonly opponentFlyingCoverage: number;
  readonly opponentPressure: number;
  readonly incomeGrowthOpportunity?: number;
  readonly reserveGold?: number;
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

export function extractAIFeaturesFromObservation(obs: AIObservation): AIFeatures {
  return {
    playerId: obs.playerId,
    tick: obs.tick,
    hp: obs.self.hp,
    gold: obs.self.gold,
    income: obs.self.income,
    towerInvestment: obs.self.totalInvested,
    towerRoleCoverage: obs.self.towerRoleCoverage,
    groundCoverage: obs.selfGroundCoverage,
    flyingCoverage: obs.selfFlyingCoverage,
    splashCoverage: obs.ownBattlefield.splashCoverage,
    slowCoverage: obs.ownBattlefield.slowCoverage,
    bossDefenseCoverage: obs.ownBattlefield.antiBossCoverage,
    activeMonsterPressure: obs.selfActiveMonsterPressure,
    flyingPressure: obs.selfFlyingPressure,
    bossPressure: obs.selfBossPressure,
    leakRisk: obs.selfLeakRisk,
    sendQueueCount: obs.self.outboundQueueLength,
    opponentHp: obs.opponent.hp,
    opponentGroundCoverage: obs.opponentGroundCoverage,
    opponentFlyingCoverage: obs.opponentFlyingCoverage,
    opponentPressure: obs.opponentActiveMonsterPressure,
    incomeGrowthOpportunity: Math.max(0, 1000 - obs.self.income),
    reserveGold: Math.floor((obs.self.gold * 350) / 1000),
  };
}

export function generateLegalActions(
  obs: AIObservation,
  towerEntityIds: ReadonlyMap<string, number>,
): LegalAIAction[] {
  const playerId = obs.playerId;
  const laneDefinition = MVP_MIRROR_01.lanes.find((lane) => lane.defenderPlayerId === playerId);
  if (!laneDefinition) throw new Error(`Missing lane definition for ${playerId}`);
  const occupiedCells = new Set(obs.ownBattlefield.visibleTowers.map((t) => `${t.cellX}:${t.cellY}`));
  const actions: LegalAIAction[] = [{ type: 'wait' }];

  for (const definition of TOWER_DEFINITIONS) {
    const level = definition.levels[0];
    if (!level || obs.self.gold < level.cost) continue;
    for (const cell of laneDefinition.buildableCells) {
      if (!occupiedCells.has(`${cell.col}:${cell.row}`)) {
        actions.push({ type: 'build_tower', towerTypeId: definition.id, cellX: cell.col, cellY: cell.row });
      }
    }
  }
  for (const visibleTower of obs.ownBattlefield.visibleTowers) {
    const entityId = towerEntityIds.get(`${visibleTower.towerTypeId}:${visibleTower.cellX}:${visibleTower.cellY}`);
    if (!entityId) continue;
    if (visibleTower.level < 3) {
      const def = TOWER_DEFINITIONS.find((d) => d.id === visibleTower.towerTypeId);
      const upgrade = def?.levels[visibleTower.level];
      if (upgrade && obs.self.gold >= upgrade.cost) {
        actions.push({ type: 'upgrade_tower', towerEntityId: entityId });
      }
    }
    // Selling is deliberately not an ordinary evolutionary action.  The
    // one-action-per-tick policy otherwise discovers profitable-looking
    // build/sell loops instead of expanding a durable defence.
  }
  if (obs.self.outboundQueueLength < GLOBAL_CONFIG.sendQueueLimit) {
    const queueCapacity = GLOBAL_CONFIG.sendQueueLimit - obs.self.outboundQueueLength;
    for (const definition of MONSTER_DEFINITIONS) {
      if (obs.self.gold >= definition.sendCost && obs.tick >= definition.availableAtRunningTick) {
        // A single command may legally send up to five monsters. Exposing the
        // full affordable burst range lets a high-bankroll strategy convert
        // surplus gold before the match reaches its tick limit.
        const maximumQuantity = Math.min(5, queueCapacity, Math.floor(obs.self.gold / definition.sendCost));
        for (let quantity = 1; quantity <= maximumQuantity; quantity += 1) {
          actions.push({ type: 'queue_monster', monsterTypeId: definition.id, quantity });
        }
      }
    }
  }
  return actions;
}

function hasTag(tags: readonly MonsterTag[], tag: MonsterTag): boolean {
  return tags.includes(tag);
}

export function scoreAIAction(features: AIFeatures, action: LegalAIAction, genome: AIStrategyGenome): ScoredAIAction {
  const towerCount = Object.values(features.towerRoleCoverage).reduce((sum, count) => sum + count, 0);
  const reserveGold = Math.floor((features.gold * genome.goldRetentionRatio) / 1000);
  // Keep a growing defensive baseline before converting surplus into income
  // and pressure. This is intentionally derived from public observations so
  // evolutionary genomes tune proportions, not basic economic safety.
  const desiredTowerCount = Math.floor(genome.defenseBaselineThreshold / 100);
  const towerDeficit = Math.max(0, desiredTowerCount - towerCount);
  const cheapestTowerCost = Math.min(...TOWER_DEFINITIONS.map((tower) => tower.levels[0]?.cost ?? Number.MAX_SAFE_INTEGER));
  let score = 0;
  if (action.type === 'wait') {
    // Holding a genome-selected reserve is valid, but surplus must compete
    // poorly with any productive action.  This prevents passive idling while
    // retaining `goldRetentionRatio` as the evolved safety control.
    score = features.gold > reserveGold ? -Math.max(1, features.gold - reserveGold) : 1;
  }
  if (action.type === 'build_tower') {
    const definition = TOWER_DEFINITIONS.find((candidate) => candidate.id === action.towerTypeId);
    if (!definition) return { action, score: Number.MIN_SAFE_INTEGER };
    const pressure = features.leakRisk + Math.floor((features.activeMonsterPressure * genome.pressureTimingWeight) / 1000);
    const emergency = features.leakRisk >= genome.emergencyDefenseThreshold || features.activeMonsterPressure >= genome.emergencyDefenseThreshold;
    const reserve = emergency ? 0 : reserveGold;
    const surplusGold = Math.max(0, features.gold - reserve);
    const growthOpportunity = features.incomeGrowthOpportunity ?? Math.max(0, 1000 - features.income);
    const investment = Math.floor((growthOpportunity * genome.incomeInvestmentRatio) / 1000);
    // Surplus gold must remain productive: repeated tower roles are useful
    // once the economy is comfortably above the chosen reserve.
    const surplusBuildPressure = Math.min(1200, surplusGold * 2);
    score = genome.defenseWeight + pressure + investment + surplusBuildPressure - reserve - genome.buildThreshold;
    score += towerDeficit * 900;
    if (emergency) score += genome.emergencyDefenseThreshold;
    if (definition.attackTargets.includes('flying')) score += Math.floor((features.flyingPressure * genome.antiAirPriority) / 1000);
    if (definition.role === 'splash') score += Math.floor((features.activeMonsterPressure * genome.splashPriority) / 1000);
    if (definition.role === 'slow') score += Math.floor((features.activeMonsterPressure * genome.slowPriority) / 1000);
    if (definition.levels.some((level) => level.bonusDamageTag === 'boss')) score += Math.floor((features.bossPressure * genome.antiBossPriority) / 1000);
    const roleCount = features.towerRoleCoverage[definition.role] ?? 0;
    const rolePenalty = Math.max(0, roleCount * genome.diversityPreference - surplusBuildPressure);
    score -= rolePenalty;
    const lane = MVP_MIRROR_01.lanes.find((candidate) => candidate.defenderPlayerId === features.playerId);
    if (lane?.aiBuildPriorityCells.some((cell) => cell.col === action.cellX && cell.row === action.cellY)) score += 250;
  }
  if (action.type === 'upgrade_tower') score = genome.defenseWeight + features.activeMonsterPressure - genome.upgradeThreshold;
  if (action.type === 'sell_tower') {
    score = genome.sellThreshold - features.activeMonsterPressure - features.leakRisk;
  }
  if (action.type === 'queue_monster') {
    const definition = MONSTER_DEFINITIONS.find((candidate) => candidate.id === action.monsterTypeId);
    if (!definition) return { action, score: Number.MIN_SAFE_INTEGER };
    const defenseBudget = towerDeficit > 0 ? cheapestTowerCost : 0;
    const availableGold = Math.max(0, features.gold - reserveGold - defenseBudget);
    const attackBudget = Math.floor((availableGold * genome.sendInvestmentRatio) / 1000);
    const incomeValue = Math.floor((definition.incomeGain * action.quantity * genome.economyWeight) / 10);
    score = genome.aggressionWeight + Math.floor((features.opponentPressure * genome.counterOpponentWeight) / 1000) + incomeValue;
    const burstCost = definition.sendCost * action.quantity;
    if (burstCost > attackBudget) score -= genome.sendInvestmentRatio * 2;
    else score += genome.sendInvestmentRatio + (action.quantity - 1) * 100;
    if (definition.movementType === 'flying') {
      score += Math.max(0, features.opponentGroundCoverage - features.opponentFlyingCoverage) * genome.antiAirPriority;
    }
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
  const tied = scoredActions
    .filter((candidate) => candidate.score === bestScore)
    .sort((a, b) => actionKey(a.action).localeCompare(actionKey(b.action)));
  const { value: picked } = nextInt(seededPolicyRandom, 0, tied.length - 1);
  return tied[picked]?.action ?? { type: 'wait' };
}

export function toGameCommand(
  action: LegalAIAction,
  playerId: PlayerSlot,
  tick: number,
  sequence: number,
): GameCommand | null {
  const commandId = createCommandId(playerId, tick, sequence);
  switch (action.type) {
    case 'build_tower': return { type: 'build_tower', commandId, playerId, towerTypeId: action.towerTypeId as TowerId, cellX: action.cellX, cellY: action.cellY };
    case 'upgrade_tower': return { type: 'upgrade_tower', commandId, playerId, towerEntityId: action.towerEntityId };
    case 'sell_tower': return { type: 'sell_tower', commandId, playerId, towerEntityId: action.towerEntityId };
    case 'queue_monster': return { type: 'queue_monster', commandId, playerId, monsterTypeId: action.monsterTypeId, quantity: action.quantity };
    case 'wait': return null;
  }
}
