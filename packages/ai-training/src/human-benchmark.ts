import {
  createDefaultAIStrategyGenome,
  type AIStrategyGenome,
} from '@chaos-td/ai-strategy';
import { CONFIG_VERSION } from '@chaos-td/game-data';

export interface HumanGuidanceProfile {
  readonly schemaVersion: 1;
  readonly source: 'human_guided_match';
  readonly recordedAt: string;
  readonly samples: number;
  readonly genomeOverrides: Readonly<Partial<Pick<AIStrategyGenome,
    'defenseBaselineThreshold' | 'goldRetentionRatio' | 'incomeInvestmentRatio' | 'sendInvestmentRatio' | 'diversityPreference'>>>
}

/**
 * A configurable approximation of the human player's macro style.
 *
 * This intentionally models strategic priorities rather than click-level
 * execution. Change this one function after reviewing human replays to make
 * the curriculum benchmark reflect the current player population.
 */
export function createHumanBenchmarkGenome(
  strategyId = 'human-v1',
  compatibleContentVersion = CONFIG_VERSION,
  overrides: HumanGuidanceProfile['genomeOverrides'] = {},
): AIStrategyGenome {
  return {
    ...createDefaultAIStrategyGenome(strategyId, compatibleContentVersion),
    strategyVersion: 1,
    defenseBaselineThreshold: 450,
    goldRetentionRatio: 600,
    incomeInvestmentRatio: 800,
    sendInvestmentRatio: 300,
    diversityPreference: 200,
    ...overrides,
  };
}
