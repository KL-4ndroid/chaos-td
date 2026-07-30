import { checkPoolCompatibility } from '@chaos-td/ai-training';
import { createDefaultAIStrategyGenome, type FrozenStrategyPool } from '@chaos-td/ai-strategy';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { canonicalSerializeAIStrategyGenome } from '@chaos-td/ai-strategy';

// Smoke baseline: 4 strategies
const smokePool: FrozenStrategyPool = {
  schemaVersion: 1,
  contentVersion: CONFIG_VERSION,
  strategies: ['001', '002', '003', '004'].map((n) => {
    const genome = createDefaultAIStrategyGenome(`smoke-${n}`);
    return {
      id: `smoke-${n}`,
      displayName: `Smoke ${n}`,
      schemaVersion: 1,
      contentVersion: CONFIG_VERSION,
      skillRating: 1200,
      tier: n === '004' ? 'Advanced' : 'Normal',
      archetype: 'adaptive',
      genome,
      behaviorFingerprint: canonicalSerializeAIStrategyGenome(genome),
      trainingRunId: 'smoke-run-v1',
      evaluationSummary: { elo: 1200, winRate: 0.5, invalidCommandRate: 0 },
      finalValidationHash: 'smoke-v1',
    };
  }),
};

const report = checkPoolCompatibility(smokePool);
console.log(JSON.stringify(report, null, 2));
process.exit(report.overallResult === 'compatible' ? 0 : 1);
