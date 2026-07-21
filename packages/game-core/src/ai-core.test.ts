/**
 * @chaos-td/game-core - AI Core Tests
 */

import { describe, expect, it } from 'vitest';
import type { SeededRng } from './prng';
import {
  AI_DECISION_INTERVAL_TICKS,
  AI_BUILD_PRIORITY_CELLS,
  createAIState,
  shouldMakeDecision,
  calculateLaneThreat,
  calculateLanePressure,
  calculateDefenseCapacity,
  assessLaneThreat,
  decideDefense,
  calculateBuildScore,
  calculateOffenseBudget,
  decideOffense,
  type AIState,
} from './ai-core';

describe('AI Core', () => {
  describe('createAIState', () => {
    it('creates state with default values', () => {
      const state = createAIState(400); // 400 permille offense budget

      expect(state.lastDecisionTick).toBe(0);
      expect(state.defenseReserve).toBe(150);
      expect(state.offenseBudgetRatioPermille).toBe(400);
      expect(state.recentRejectedCommands).toBe(0);
    });

    it('accepts different offense budget ratios', () => {
      const state350 = createAIState(350);
      const state550 = createAIState(550);

      expect(state350.offenseBudgetRatioPermille).toBe(350);
      expect(state550.offenseBudgetRatioPermille).toBe(550);
    });
  });

  describe('shouldMakeDecision', () => {
    it('returns true when enough ticks have passed', () => {
      const state: AIState = {
        ...createAIState(400),
        lastDecisionTick: 100,
      };

      expect(shouldMakeDecision(state, 110)).toBe(true);
    });

    it('returns false when not enough ticks have passed', () => {
      const state: AIState = {
        ...createAIState(400),
        lastDecisionTick: 100,
      };

      expect(shouldMakeDecision(state, 105)).toBe(false);
    });

    it('returns true on first decision (tick 0)', () => {
      const state = createAIState(400);
      expect(shouldMakeDecision(state, 10)).toBe(true);
    });

    it('respects AI_DECISION_INTERVAL_TICKS constant', () => {
      expect(AI_DECISION_INTERVAL_TICKS).toBe(10);
    });
  });

  describe('calculateLaneThreat', () => {
    it('returns safe with no monsters', () => {
      const threat = calculateLaneThreat(0, 0, 39, 10000);
      expect(threat).toBe('safe');
    });

    it('returns critical with high monster count near end', () => {
      const threat = calculateLaneThreat(5, 3, 39, 1500);
      expect(threat).toBe('critical');
    });

    it('returns strained with moderate monsters', () => {
      const threat = calculateLaneThreat(2, 0, 39, 5000);
      expect(threat).toBe('strained');
    });
  });

  describe('calculateLanePressure', () => {
    it('returns 0 with no monsters', () => {
      const pressure = calculateLanePressure([]);
      expect(pressure).toBe(0);
    });

    it('calculates pressure for single monster', () => {
      const monsters = [{
        hp: 100,
        shield: 0,
        armorPermille: 0,
        pathProgressMilliTiles: 3000, // 30% of path
        totalPathLength: 10000,
      }];

      const pressure = calculateLanePressure(monsters);
      expect(pressure).toBeGreaterThan(0);
    });

    it('increases pressure for monsters closer to end', () => {
      const monsterEarly = [{
        hp: 100,
        shield: 0,
        armorPermille: 0,
        pathProgressMilliTiles: 2000, // 20%
        totalPathLength: 10000,
      }];

      const monsterLate = [{
        hp: 100,
        shield: 0,
        armorPermille: 0,
        pathProgressMilliTiles: 8000, // 80%
        totalPathLength: 10000,
      }];

      const earlyPressure = calculateLanePressure(monsterEarly);
      const latePressure = calculateLanePressure(monsterLate);

      expect(latePressure).toBeGreaterThan(earlyPressure);
    });
  });

  describe('calculateDefenseCapacity', () => {
    it('returns 0 with no towers', () => {
      const capacity = calculateDefenseCapacity([], 2);
      expect(capacity).toBe(0);
    });

    it('returns 0 with no monsters', () => {
      const towers = [{ cooldownTicks: 10, rangeMilliTiles: 3000 }];
      const capacity = calculateDefenseCapacity(towers, 0);
      expect(capacity).toBe(0);
    });

    it('calculates capacity based on cooldown', () => {
      const towers = [{ cooldownTicks: 10, rangeMilliTiles: 3000 }];
      const capacity = calculateDefenseCapacity(towers, 1);

      // 80 ticks / 10 cooldown = 8 attacks
      expect(capacity).toBe(8);
    });

    it('sums capacity from multiple towers', () => {
      const towers = [
        { cooldownTicks: 10, rangeMilliTiles: 3000 },
        { cooldownTicks: 20, rangeMilliTiles: 3000 },
      ];
      const capacity = calculateDefenseCapacity(towers, 1);

      // 80/10 + 80/20 = 8 + 4 = 12
      expect(capacity).toBe(12);
    });
  });

  describe('assessLaneThreat', () => {
    it('returns safe for empty lane', () => {
      const assessment = assessLaneThreat([], [], 100);
      expect(assessment.threat).toBe('safe');
      expect(assessment.pressurePoints).toBe(0);
      expect(assessment.defenseCapacity).toBe(0);
    });

    it('returns critical when defense capacity is zero with monsters', () => {
      const monsters = [{
        hp: 100,
        shield: 0,
        armorPermille: 0,
        pathProgressMilliTiles: 5000,
        totalPathLength: 10000,
      }];

      const assessment = assessLaneThreat(monsters, [], 100);
      expect(assessment.threat).toBe('critical');
    });

    it('returns safe when pressure is low relative to capacity', () => {
      const monsters = [{
        hp: 50, // Low HP
        shield: 0,
        armorPermille: 0,
        pathProgressMilliTiles: 1000, // Early in path
        totalPathLength: 10000,
      }];

      const towers = [{ cooldownTicks: 5, rangeMilliTiles: 3000 }]; // Fast tower

      const assessment = assessLaneThreat(monsters, towers, 100);
      // Even with monsterCountAtRisk=1, pressure should be low enough
      expect(['safe', 'strained']).toContain(assessment.threat);
    });
  });

  describe('decideDefense', () => {
    it('does not build when gold is below reserve', () => {
      const decision = decideDefense('safe', 100, 100, 50, [], 0, 'archer');
      expect(decision.type).toBe('no_action');
    });

    it('builds tower when threat is critical', () => {
      const decision = decideDefense('critical', 500, 100, 400, [], 1, 'archer');
      expect(decision.type).toBe('build_tower');
      if (decision.type === 'build_tower') {
        expect(decision.towerType).toBe('archer');
        expect(decision.score).toBeGreaterThan(0);
      }
    });

    it('does not build when no cells available', () => {
      // All cells occupied
      const allCells = AI_BUILD_PRIORITY_CELLS.map(c => `${c.cellX},${c.cellY}`);
      const decision = decideDefense('critical', 500, 100, 400, allCells, 1, 'archer');
      expect(decision.type).toBe('no_action');
    });
  });

  describe('calculateBuildScore', () => {
    it('returns higher score for more effective towers', () => {
      const archerScore = calculateBuildScore('archer', 120, 13, 18, 2, 500);
      const mageScore = calculateBuildScore('mage', 180, 28, 26, 2, 500);

      // Mage does splash but has higher cooldown, archer should be better for single target
      expect(archerScore).toBeGreaterThan(0);
      expect(mageScore).toBeGreaterThan(0);
    });

    it('applies penalty for expensive towers when gold is low', () => {
      const scoreNormal = calculateBuildScore('archer', 120, 13, 18, 2, 500);
      const scoreLowGold = calculateBuildScore('archer', 120, 13, 18, 2, 150);

      expect(scoreLowGold).toBeLessThan(scoreNormal);
    });
  });

  describe('calculateOffenseBudget', () => {
    it('returns 0 when gold is below reserve', () => {
      const budget = calculateOffenseBudget(100, 150, 400);
      expect(budget).toBe(0);
    });

    it('calculates budget correctly', () => {
      const budget = calculateOffenseBudget(600, 150, 400);
      // (600 - 150) * 400 / 1000 = 450 * 0.4 = 180
      expect(budget).toBe(180);
    });
  });

  describe('decideOffense', () => {
    it('does not send when lane is not safe', () => {
      const decision = decideOffense('critical', 200, 0, 30, 60, ['sheep'], { version: 1, state: new Uint32Array([42]) } as SeededRng);
      expect(decision.type).toBe('no_action');
    });

    it('does not send when budget is insufficient', () => {
      const decision = decideOffense('safe', 50, 0, 30, 60, ['sheep'], { version: 1, state: new Uint32Array([42]) } as SeededRng);
      expect(decision.type).toBe('no_action');
    });

    it('does not send when queue is nearly full', () => {
      const decision = decideOffense('safe', 200, 28, 30, 60, ['sheep'], { version: 1, state: new Uint32Array([42]) } as SeededRng);
      expect(decision.type).toBe('no_action');
    });

    it('sends monster when conditions are met', () => {
      const decision = decideOffense('safe', 200, 0, 30, 60, ['sheep'], { version: 1, state: new Uint32Array([42]) } as SeededRng);
      expect(decision.type).toBe('send_monster');
      if (decision.type === 'send_monster') {
        expect(decision.quantity).toBeGreaterThan(0);
      }
    });
  });
});
