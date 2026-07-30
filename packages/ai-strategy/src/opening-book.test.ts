import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import type { AIFeatures, ScoredAIAction } from './policy';
import { applyOpeningBookPreferences, validateAIOpeningBook, type AIOpeningBook } from './opening-book';

const features: AIFeatures = {
  playerId: 'p1', tick: 80, hp: 20, gold: 600, income: 100, towerInvestment: 0,
  towerRoleCoverage: { single_target: 0, splash: 0, slow: 0, heavy_hit: 0 },
  groundCoverage: 0, flyingCoverage: 0, splashCoverage: 0, slowCoverage: 0, bossDefenseCoverage: 0,
  activeMonsterPressure: 0, flyingPressure: 0, bossPressure: 0, leakRisk: 0, sendQueueCount: 0,
  opponentHp: 20, opponentGroundCoverage: 0, opponentFlyingCoverage: 0, opponentPressure: 0,
};

const book: AIOpeningBook = {
  id: 'test-book', contentVersion: CONFIG_VERSION,
  steps: [{ id: 'early-single-target', maxWave: 2, kind: 'prefer_tower_role', weight: 100 }],
};

describe('adaptive opening books', () => {
  it('uses a semantic preference rather than a fixed cell or tick command', () => {
    const actions: readonly ScoredAIAction[] = [
      { action: { type: 'build_tower', towerTypeId: 'archer', cellX: 3, cellY: 12 }, score: 10 },
      { action: { type: 'build_tower', towerTypeId: 'mage', cellX: 4, cellY: 12 }, score: 10 },
    ];
    const applied = applyOpeningBookPreferences(actions, features, book);
    expect(applied[0]?.score).toBe(110);
    expect(applied[1]?.score).toBe(10);
  });

  it('falls back to live scoring once the opening preference expires', () => {
    const actions: readonly ScoredAIAction[] = [{ action: { type: 'wait' }, score: 42 }];
    expect(applyOpeningBookPreferences(actions, { ...features, tick: 800 }, book)).toEqual(actions);
  });

  it('rejects incompatible content rather than silently loading a book', () => {
    expect(() => validateAIOpeningBook({ ...book, contentVersion: 'old-content' })).toThrow('Incompatible');
  });
});
