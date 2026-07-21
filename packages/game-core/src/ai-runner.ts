/**
 * @chaos-td/game-core - AI Runner
 *
 * Headless AI execution for simulation.
 * Runs AI decisions in deterministic order.
 */

import {
  createAIState,
  shouldMakeDecision,
  decideDefense,
  decideOffense,
  calculateOffenseBudget,
  type AIState,
  type ThreatLevel,
} from './ai-core';

/**
 * AI decision result
 */
export interface AIDecision {
  playerId: 'p1' | 'p2';
  action: 'build_tower' | 'upgrade_tower' | 'queue_monster' | 'none';
  targetTick: number;
  params?: {
    towerType?: string;
    cellX?: number;
    cellY?: number;
    monsterType?: string;
    quantity?: number;
  };
  reason?: string;
}

/**
 * Create AI state for both players
 */
export function createAIStates(seed: string): { p1: AIState; p2: AIState } {
  // Derive offense budget from seed
  const seedNum = parseInt(seed.replace(/\D/g, '').slice(0, 4) || '400', 10);
  const offenseBudget = 350 + (seedNum % 200); // 350-549

  return {
    p1: { ...createAIState(offenseBudget), rng: { version: 1, state: new Uint32Array([seedNum]) } },
    p2: { ...createAIState(offenseBudget), rng: { version: 1, state: new Uint32Array([seedNum + 1]) } },
  };
}

/**
 * Process AI decision for a player
 */
export function processAIDecision(
  playerId: 'p1' | 'p2',
  state: AIState,
  currentTick: number,
  gold: number,
  laneThreat: ThreatLevel,
  existingTowerTypes: string[],
  queueLength: number,
  maxQueueSize: number,
  monsterCost: number,
  preferredTypes: readonly string[],
): AIDecision {
  // Check if AI should make a decision
  if (!shouldMakeDecision(state, currentTick)) {
    return { playerId, action: 'none', targetTick: currentTick, reason: 'not_decision_tick' };
  }

  // Calculate budgets
  const availableGold = gold;
  const defenseReserve = state.defenseReserve;
  const offenseBudget = calculateOffenseBudget(gold, defenseReserve, state.offenseBudgetRatioPermille);

  // Decide defense action
  const defenseAction = decideDefense(
    laneThreat,
    gold,
    defenseReserve,
    availableGold,
    existingTowerTypes,
    1, // monstersInRange
    preferredTypes[0] || 'archer',
  );

  if (defenseAction.type !== 'no_action') {
    return {
      playerId,
      action: defenseAction.type === 'build_tower' ? 'build_tower' : 'upgrade_tower',
      targetTick: currentTick + 2,
      params: {
        towerType: defenseAction.towerType,
        cellX: 'cellX' in defenseAction ? defenseAction.cellX : undefined,
        cellY: 'cellY' in defenseAction ? defenseAction.cellY : undefined,
      },
    };
  }

  // Decide offense action
  const offenseAction = decideOffense(
    laneThreat,
    offenseBudget,
    queueLength,
    maxQueueSize,
    monsterCost,
    preferredTypes,
    state.rng,
  );

  if (offenseAction.type === 'send_monster') {
    return {
      playerId,
      action: 'queue_monster',
      targetTick: currentTick + 2,
      params: {
        monsterType: offenseAction.monsterType,
        quantity: offenseAction.quantity,
      },
    };
  }

  return {
    playerId,
    action: 'none',
    targetTick: currentTick,
    reason: offenseAction.reason || defenseAction.reason || 'no_action',
  };
}

/**
 * Update AI state after a decision
 */
export function updateAIState(state: AIState, currentTick: number): AIState {
  return {
    ...state,
    lastDecisionTick: currentTick,
  };
}

/**
 * Validate AI decision (check for issues)
 */
export function validateAIDecision(
  decision: AIDecision,
  gold: number,
  minTowerCost: number,
  minMonsterCost: number,
): { valid: boolean; reason?: string } {
  if (decision.action === 'none') {
    return { valid: true };
  }

  if (decision.action === 'build_tower') {
    if (gold < minTowerCost) {
      return { valid: false, reason: 'insufficient_gold_for_tower' };
    }
    return { valid: true };
  }

  if (decision.action === 'queue_monster') {
    if (gold < minMonsterCost) {
      return { valid: false, reason: 'insufficient_gold_for_monster' };
    }
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Calculate rejection rate from decisions
 */
export function calculateRejectionRate(
  acceptedDecisions: number,
  rejectedDecisions: number,
): number {
  const total = acceptedDecisions + rejectedDecisions;
  if (total === 0) return 0;
  return (rejectedDecisions / total) * 100;
}
