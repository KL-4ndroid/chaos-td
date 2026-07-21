/**
 * @chaos-td/game-core - AI Core
 *
 * Deterministic AI for Normal difficulty opponent.
 * Uses seeded PRNG for all decisions.
 */

import { fork, type SeededRng } from './prng';

/**
 * AI decision frequency: evaluate every 10 ticks
 */
export const AI_DECISION_INTERVAL_TICKS = 10;

/**
 * AI command minimum target tick offset
 */
export const AI_MIN_COMMAND_TICK_OFFSET = 2;

/**
 * Threat levels for lane assessment
 */
export type ThreatLevel = 'safe' | 'strained' | 'critical';

/**
 * AI state for a single player
 */
export interface AIState {
  /** Last tick when AI made a decision */
  lastDecisionTick: number;
  /** Gold reserved for defense */
  defenseReserve: number;
  /** Offense budget ratio (350-550 permille) */
  offenseBudgetRatioPermille: number;
  /** Recent rejected commands count */
  recentRejectedCommands: number;
  /** AI's PRNG stream */
  rng: SeededRng;
}

/**
 * Lane threat assessment
 */
export interface LaneThreatAssessment {
  /** Threat level */
  threat: ThreatLevel;
  /** Estimated damage from leaks in next 80 ticks */
  estimatedLeakRisk: number;
  /** Lane pressure score */
  pressurePoints: number;
  /** Defense capacity (effective attacks in next 4 seconds) */
  defenseCapacity: number;
}

/**
 * Create initial AI state
 */
export function createAIState(offenseBudgetRatioPermille: number): AIState {
  return {
    lastDecisionTick: 0,
    defenseReserve: 150,
    offenseBudgetRatioPermille,
    recentRejectedCommands: 0,
    rng: { version: 1, state: new Uint32Array([0]) },
  };
}

/**
 * Initialize AI RNG from match seed
 */
export function initializeAIRng(matchRng: SeededRng): { aiRng: SeededRng; remainingRng: SeededRng } {
  const aiRng = fork(matchRng);
  return { aiRng, remainingRng: matchRng };
}

/**
 * Check if AI should make a decision at current tick
 */
export function shouldMakeDecision(state: AIState, currentTick: number): boolean {
  const ticksSinceLastDecision = currentTick - state.lastDecisionTick;
  return ticksSinceLastDecision >= AI_DECISION_INTERVAL_TICKS;
}

/**
 * Calculate lane threat based on monster count and distance
 */
export function calculateLaneThreat(
  monsterCount: number,
  monstersAtRisk: number,
  _monsterSpeedAvg: number,
  distanceToEnd: number,
): ThreatLevel {
  // Critical: monsters close to end or high monster count
  if (monstersAtRisk >= 3 || (monsterCount >= 5 && distanceToEnd < 2000)) {
    return 'critical';
  }

  // Strained: moderate monster count or monsters getting close
  if (monsterCount >= 2 || (monstersAtRisk >= 1 && distanceToEnd < 4000)) {
    return 'strained';
  }

  return 'safe';
}

/**
 * Calculate lane pressure score
 * pressurePoints = Σ effectiveHp × urgencyPermille / 1000
 */
export function calculateLanePressure(
  monsters: Array<{ hp: number; shield: number; armorPermille: number; pathProgressMilliTiles: number; totalPathLength: number }>,
): number {
  let pressure = 0;

  for (const monster of monsters) {
    // Calculate effective HP considering armor
    const armorMultiplier = (1000 - Math.min(800, Math.max(0, monster.armorPermille))) / 1000;
    const effectiveHp = Math.floor((monster.hp + monster.shield) * armorMultiplier);

    // Calculate urgency based on position (50% path = 500‰, 50-75% = 800‰, 75-100% = 1200‰)
    const pathPercent = monster.pathProgressMilliTiles / monster.totalPathLength;
    let urgencyPermille: number;
    if (pathPercent < 0.5) {
      urgencyPermille = 500;
    } else if (pathPercent < 0.75) {
      urgencyPermille = 800;
    } else {
      urgencyPermille = 1200;
    }

    pressure += Math.floor(effectiveHp * urgencyPermille / 1000);
  }

  return pressure;
}

/**
 * Calculate defense capacity (attacks in next 4 seconds = 80 ticks)
 */
export function calculateDefenseCapacity(
  towers: Array<{ cooldownTicks: number }>,
  monsterCount: number,
): number {
  if (monsterCount === 0) return 0;

  let totalCapacity = 0;
  for (const tower of towers) {
    // Estimate attacks per 80 ticks (simplified: 80 / cooldown)
    const attacksPer80Ticks = Math.floor(80 / tower.cooldownTicks);
    totalCapacity += attacksPer80Ticks;
  }

  return totalCapacity;
}

/**
 * Assess lane threat
 */
export function assessLaneThreat(
  monsters: Array<{ hp: number; shield: number; armorPermille: number; pathProgressMilliTiles: number; totalPathLength: number }>,
  towers: Array<{ cooldownTicks: number }>,
  _tick: number,
): LaneThreatAssessment {
  const pressurePoints = calculateLanePressure(monsters);
  const defenseCapacity = calculateDefenseCapacity(towers, monsters.length);
  const monsterCountAtRisk = monsters.filter(m => m.pathProgressMilliTiles > 0).length;

  // Calculate threat based on pressure vs capacity and monster count
  let threat: ThreatLevel;
  if (monsters.length === 0) {
    // Empty lane is safe
    threat = 'safe';
  } else if (defenseCapacity === 0) {
    // No towers to defend against monsters
    threat = 'critical';
  } else if (pressurePoints > defenseCapacity * 50 || monsterCountAtRisk >= 3) {
    threat = 'critical';
  } else if (pressurePoints > defenseCapacity * 20 || monsterCountAtRisk >= 1) {
    threat = 'strained';
  } else {
    threat = 'safe';
  }

  // Estimate leak risk in next 80 ticks
  const avgMonsterSpeed = monsters.length > 0
    ? monsters.reduce((sum, _m) => sum + 39, 0) / monsters.length // Default sheep speed
    : 0;
  const estimatedLeakRisk = threat === 'critical'
    ? Math.max(0, Math.floor(80 / avgMonsterSpeed))
    : 0;

  return {
    threat,
    estimatedLeakRisk,
    pressurePoints,
    defenseCapacity,
  };
}

/**
 * Get recommended defense reserve based on game phase
 */
export function getDefenseReserve(recommendation: number, threat: ThreatLevel): number {
  switch (threat) {
    case 'critical':
      return Math.floor(recommendation * 0.5); // Use more reserves
    case 'strained':
      return Math.floor(recommendation * 0.8);
    case 'safe':
      return recommendation;
  }
}

// ============================================================================
// Defense Decision Logic
// ============================================================================

/**
 * Defense action types
 */
export type DefenseAction =
  | { type: 'build_tower'; towerType: string; cellX: number; cellY: number; score: number }
  | { type: 'upgrade_tower'; towerEntityId: number; score: number }
  | { type: 'no_action'; reason: string };

/**
 * Tower build priority cell (center lane positions)
 */
export const AI_BUILD_PRIORITY_CELLS: readonly { cellX: number; cellY: number }[] = Object.freeze([
  { cellX: 3, cellY: 3 },
  { cellX: 4, cellY: 3 },
  { cellX: 5, cellY: 3 },
  { cellX: 6, cellY: 3 },
  { cellX: 3, cellY: 4 },
  { cellX: 4, cellY: 4 },
  { cellX: 5, cellY: 4 },
  { cellX: 6, cellY: 4 },
  { cellX: 3, cellY: 5 },
  { cellX: 4, cellY: 5 },
  { cellX: 5, cellY: 5 },
  { cellX: 6, cellY: 5 },
]);

/**
 * Calculate expected damage reduction from a tower
 */
export function calculateExpectedDamageReduction(
  towerType: string,
  cooldownTicks: number,
  damage: number,
  monstersInRange: number,
): number {
  // Simplified: estimate attacks per 80 ticks * damage * monster count
  const attacksPer80Ticks = Math.floor(80 / cooldownTicks);
  return attacksPer80Ticks * damage * Math.min(monstersInRange, 3);
}

/**
 * Calculate action score for a tower build
 */
export function calculateBuildScore(
  towerType: string,
  cost: number,
  cooldownTicks: number,
  damage: number,
  monstersInRange: number,
  gold: number,
): number {
  const expectedDamage = calculateExpectedDamageReduction(towerType, cooldownTicks, damage, monstersInRange);

  // Normalize by cost (higher is better - more damage per gold)
  const costEfficiency = expectedDamage / Math.max(cost, 1);

  // Penalty for expensive towers when gold is low
  const goldRatio = gold / Math.max(cost, 1);
  const costPenalty = goldRatio < 1.5 ? 0.5 : 1.0;

  return Math.floor(expectedDamage * costEfficiency * costPenalty);
}

/**
 * Decide on defense action based on threat and resources
 */
export function decideDefense(
  threat: ThreatLevel,
  gold: number,
  defenseReserve: number,
  availableGold: number,
  existingTowerTypes: string[],
  _monstersInRange: number,
  preferredTower: string = 'archer',
): DefenseAction {
  // Don't spend if gold is below reserve
  if (availableGold <= defenseReserve) {
    return { type: 'no_action', reason: 'gold_below_reserve' };
  }

  switch (threat) {
    case 'critical': {
      // Must build/upgrade - find affordable action
      const affordableTowers = AI_BUILD_PRIORITY_CELLS.filter(
        (cell) => !existingTowerTypes.includes(`${cell.cellX},${cell.cellY}`),
      );

      if (affordableTowers.length > 0) {
        const cell = affordableTowers[0]!;
        return {
          type: 'build_tower',
          towerType: preferredTower,
          cellX: cell.cellX,
          cellY: cell.cellY,
          score: 100, // High priority
        };
      }
      return { type: 'no_action', reason: 'no_available_cells' };
    }

    case 'strained': {
      // Build if we have extra gold
      const extraGold = availableGold - defenseReserve;
      if (extraGold > gold * 0.3) {
        const affordableTowers = AI_BUILD_PRIORITY_CELLS.filter(
          (cell) => !existingTowerTypes.includes(`${cell.cellX},${cell.cellY}`),
        );

        if (affordableTowers.length > 0) {
          const cell = affordableTowers[0]!;
          return {
            type: 'build_tower',
            towerType: preferredTower,
            cellX: cell.cellX,
            cellY: cell.cellY,
            score: 50,
          };
        }
      }
      return { type: 'no_action', reason: 'insufficient_extra_gold' };
    }

    case 'safe':
    default: {
      // Don't build unless we have lots of extra gold
      if (availableGold > defenseReserve + gold * 0.5) {
        const affordableTowers = AI_BUILD_PRIORITY_CELLS.filter(
          (cell) => !existingTowerTypes.includes(`${cell.cellX},${cell.cellY}`),
        );

        if (affordableTowers.length > 0) {
          const cell = affordableTowers[0]!;
          return {
            type: 'build_tower',
            towerType: preferredTower,
            cellX: cell.cellX,
            cellY: cell.cellY,
            score: 10,
          };
        }
      }
      return { type: 'no_action', reason: 'lane_safe' };
    }
  }
}

// ============================================================================
// Offense Decision Logic
// ============================================================================

/**
 * Offense action types
 */
export type OffenseAction =
  | { type: 'send_monster'; monsterType: string; quantity: number; score: number }
  | { type: 'no_action'; reason: string };

/**
 * Monster type selection weights based on lane state
 */
export const MONSTER_PREFERENCES: Readonly<Record<string, {
  baseWeight: number;
  vsLowFirepower: number;
  vsHighFirepower: number;
  vsSplash: number;
  vsSlow: number;
}>> = Object.freeze({
  sheep: { baseWeight: 100, vsLowFirepower: 120, vsHighFirepower: 60, vsSplash: 80, vsSlow: 70 },
  wolf: { baseWeight: 80, vsLowFirepower: 100, vsHighFirepower: 70, vsSplash: 60, vsSlow: 90 },
  treant: { baseWeight: 50, vsLowFirepower: 80, vsHighFirepower: 40, vsSplash: 20, vsSlow: 50 },
  ghost: { baseWeight: 40, vsLowFirepower: 60, vsHighFirepower: 100, vsSplash: 50, vsSlow: 30 },
});

/**
 * Calculate offense budget based on gold and reserve
 */
export function calculateOffenseBudget(
  gold: number,
  defenseReserve: number,
  offenseBudgetRatioPermille: number,
): number {
  const available = gold - defenseReserve;
  if (available <= 0) return 0;
  return Math.floor(available * offenseBudgetRatioPermille / 1000);
}

/**
 * Select monster type based on lane state
 */
export function selectMonsterType(
  laneThreat: ThreatLevel,
  preferredTypes: readonly string[],
  rng: SeededRng,
): string {
  // Default to sheep for safe lanes
  if (laneThreat === 'safe') {
    // Use PRNG to pick between sheep and wolf
    const useWolf = rng.state[0]! % 2 === 0;
    return useWolf && preferredTypes.includes('wolf') ? 'wolf' : 'sheep';
  }

  // For strained/critical, prefer tankier monsters
  if (laneThreat === 'strained' && preferredTypes.includes('wolf')) {
    return 'wolf';
  }

  return 'sheep';
}

/**
 * Decide on offense action based on lane state and budget
 */
export function decideOffense(
  laneThreat: ThreatLevel,
  offenseBudget: number,
  queueLength: number,
  maxQueueSize: number,
  monsterCost: number,
  preferredTypes: readonly string[],
  rng: SeededRng,
): OffenseAction {
  // Only send when lane is safe
  if (laneThreat !== 'safe') {
    return { type: 'no_action', reason: 'lane_not_safe' };
  }

  // Don't flood queue
  if (queueLength >= maxQueueSize - 2) {
    return { type: 'no_action', reason: 'queue_nearly_full' };
  }

  // Check budget
  if (offenseBudget < monsterCost) {
    return { type: 'no_action', reason: 'insufficient_budget' };
  }

  // Select monster type
  const monsterType = selectMonsterType(laneThreat, preferredTypes, rng);

  // Calculate quantity (max 5, based on budget)
  const maxAffordable = Math.floor(offenseBudget / monsterCost);
  const quantity = Math.min(5, Math.max(1, maxAffordable));

  return {
    type: 'send_monster',
    monsterType,
    quantity,
    score: 50, // Base score
  };
}
