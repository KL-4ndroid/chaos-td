import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { assertValidAIStrategyGenome } from '@chaos-td/ai-strategy';
import { createHumanBenchmarkGenome } from './human-benchmark';

describe('human benchmark genome', () => {
  it('models the defensive, income-first human macro profile', () => {
    const genome = createHumanBenchmarkGenome('human-test', CONFIG_VERSION);
    expect(assertValidAIStrategyGenome(genome, CONFIG_VERSION)).toEqual(genome);
    expect(genome.strategyId).toBe('human-test');
    expect(genome.defenseBaselineThreshold).toBe(450);
    expect(genome.goldRetentionRatio).toBe(600);
    expect(genome.incomeInvestmentRatio).toBe(800);
    expect(genome.sendInvestmentRatio).toBe(300);
    expect(genome.diversityPreference).toBe(200);
  });
});
