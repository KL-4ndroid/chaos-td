/**
 * @chaos-td/game-core - AI Runner Tests
 */

import { describe, expect, it } from 'vitest';
import {
  createAIStates,
  processAIDecision,
  updateAIState,
  validateAIDecision,
  calculateRejectionRate,
} from './ai-runner';

describe('AI Runner', () => {
  describe('createAIStates', () => {
    it('creates AI states for both players', () => {
      const states = createAIStates('test-seed-123');

      expect(states.p1).toBeDefined();
      expect(states.p2).toBeDefined();
      expect(states.p1.offenseBudgetRatioPermille).toBeGreaterThanOrEqual(350);
      expect(states.p1.offenseBudgetRatioPermille).toBeLessThanOrEqual(549);
    });
  });

  describe('processAIDecision', () => {
    it('returns none when not decision tick', () => {
      const states = createAIStates('test-seed');
      states.p1.lastDecisionTick = 100;

      const decision = processAIDecision(
        'p1',
        states.p1,
        105, // Less than 10 ticks since last decision
        600,
        'safe',
        [],
        0,
        30,
        60,
        ['sheep'],
      );

      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('not_decision_tick');
    });

    it('makes decision on decision tick', () => {
      const states = createAIStates('test-seed');

      const decision = processAIDecision(
        'p1',
        states.p1,
        10, // First decision tick
        600,
        'safe',
        [],
        0,
        30,
        60,
        ['sheep'],
      );

      // Should make some decision
      expect(decision.targetTick).toBe(12); // currentTick + 2
    });
  });

  describe('updateAIState', () => {
    it('updates lastDecisionTick', () => {
      const state = createAIStates('test-seed').p1;
      const updated = updateAIState(state, 100);

      expect(updated.lastDecisionTick).toBe(100);
    });
  });

  describe('validateAIDecision', () => {
    it('validates build_tower decision', () => {
      const valid = validateAIDecision(
        { playerId: 'p1', action: 'build_tower', targetTick: 100, params: { towerType: 'archer', cellX: 3, cellY: 4 } },
        600,
        120,
        60,
      );

      expect(valid.valid).toBe(true);
    });

    it('rejects build_tower with insufficient gold', () => {
      const valid = validateAIDecision(
        { playerId: 'p1', action: 'build_tower', targetTick: 100, params: { towerType: 'archer', cellX: 3, cellY: 4 } },
        100, // Not enough gold
        120,
        60,
      );

      expect(valid.valid).toBe(false);
      expect(valid.reason).toBe('insufficient_gold_for_tower');
    });

    it('validates queue_monster decision', () => {
      const valid = validateAIDecision(
        { playerId: 'p1', action: 'queue_monster', targetTick: 100, params: { monsterType: 'sheep', quantity: 1 } },
        600,
        120,
        60,
      );

      expect(valid.valid).toBe(true);
    });

    it('rejects queue_monster with insufficient gold', () => {
      const valid = validateAIDecision(
        { playerId: 'p1', action: 'queue_monster', targetTick: 100, params: { monsterType: 'sheep', quantity: 1 } },
        50, // Not enough gold
        120,
        60,
      );

      expect(valid.valid).toBe(false);
      expect(valid.reason).toBe('insufficient_gold_for_monster');
    });
  });

  describe('calculateRejectionRate', () => {
    it('returns 0 when no decisions', () => {
      const rate = calculateRejectionRate(0, 0);
      expect(rate).toBe(0);
    });

    it('calculates rejection rate correctly', () => {
      const rate = calculateRejectionRate(98, 2);
      expect(rate).toBeCloseTo(2, 1); // ~2%
    });

    it('returns 100 when all rejected', () => {
      const rate = calculateRejectionRate(0, 100);
      expect(rate).toBe(100);
    });
  });
});
