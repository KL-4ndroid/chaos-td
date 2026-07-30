import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { createDefaultAIStrategyGenome, type AIStrategyGenome } from '@chaos-td/ai-strategy';
import { checkStrategyCompatibility, checkPoolCompatibility } from './compat';

describe('content compatibility checks', () => {
  it('returns compatible when all content definitions are known', () => {
    const genome = createDefaultAIStrategyGenome('current');
    const result = checkStrategyCompatibility(genome);
    expect(result.result).toBe('compatible');
    expect(result.schemaValid).toBe(true);
    expect(result.contentValid).toBe(true);
  });

  it('returns unsupported for mismatched content version', () => {
    const stale: AIStrategyGenome = { ...createDefaultAIStrategyGenome('stale'), compatibleContentVersion: 'old-content-0' };
    const result = checkStrategyCompatibility(stale);
    expect(result.result).toBe('unsupported');
    expect(result.contentValid).toBe(false);
  });

  it('returns requires_retraining when new monster types are detected', () => {
    const genome = createDefaultAIStrategyGenome('flexible');
    const report = checkPoolCompatibility({
      schemaVersion: 1, contentVersion: CONFIG_VERSION, strategies: [{ id: 'flex', displayName: 'flex', schemaVersion: 1, contentVersion: CONFIG_VERSION, skillRating: 1200, tier: 'Normal', archetype: 'adaptive', genome, behaviorFingerprint: 'fp', trainingRunId: 'run', evaluationSummary: { elo: 1200, winRate: 0.5, invalidCommandRate: 0 }, finalValidationHash: 'h',
    }],
    });
    expect(report.overallResult).toBe('compatible');
    expect(report.totalStrategies).toBe(1);
  });
});
