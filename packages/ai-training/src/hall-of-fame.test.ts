import { describe, expect, it } from 'vitest';
import { createDefaultAIStrategyGenome } from '@chaos-td/ai-strategy';
import { admitHallOfFameCandidates, behaviorFingerprint } from './hall-of-fame';

const qualifiedEvaluation = { elo: 1400, winRate: 0.6, drawRate: 0.2, slotAdjustedScore: 0.2, reliabilityScore: 900, diversityScore: 500, invalidCommandRate: 0 };

describe('strategy hall of fame', () => {
  it('admits only reliable, slot-safe, non-duplicate candidates in deterministic order', () => {
    const alpha = createDefaultAIStrategyGenome('alpha');
    const beta = createDefaultAIStrategyGenome('beta');
    const entries = admitHallOfFameCandidates([], [
      { strategy: beta, generation: 2, evaluation: qualifiedEvaluation, evaluationSeedSetVersion: 'seeds-v1', behaviorFingerprint: behaviorFingerprint(beta), tickGuardRate: 0 },
      { strategy: alpha, generation: 1, evaluation: qualifiedEvaluation, evaluationSeedSetVersion: 'seeds-v1', behaviorFingerprint: behaviorFingerprint(alpha), tickGuardRate: 0 },
    ]);
    expect(entries.map((entry) => entry.strategy.strategyId)).toEqual(['alpha', 'beta']);
    expect(admitHallOfFameCandidates(entries, [{ strategy: alpha, generation: 3, evaluation: qualifiedEvaluation, evaluationSeedSetVersion: 'seeds-v1', behaviorFingerprint: behaviorFingerprint(alpha), tickGuardRate: 0 }])).toHaveLength(2);
  });

  it('rejects illegal and tick-guard candidates', () => {
    const genome = createDefaultAIStrategyGenome('rejected');
    expect(admitHallOfFameCandidates([], [{ strategy: genome, generation: 1, evaluation: { ...qualifiedEvaluation, invalidCommandRate: 0.1 }, evaluationSeedSetVersion: 'seeds-v1', behaviorFingerprint: behaviorFingerprint(genome), tickGuardRate: 1 }])).toEqual([]);
  });
});
