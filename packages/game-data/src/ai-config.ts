/**
 * @chaos-td/game-data - AI Configuration
 *
 * Authoritative AI behavior configuration for MVP.
 */

import type { AiConfig, AiLaneConfig, PlayerSlot, LaneId, TowerId } from './types.js';
import { CONFIG_VERSION } from './global-config.js';

/**
 * Create default lane AI config
 */
function createDefaultLaneConfig(
  laneId: LaneId,
  _playerId: PlayerSlot,
): AiLaneConfig {
  return Object.freeze({
    laneId,
    difficulty: 'medium',
    personality: 'balanced',
    preferredTowers: Object.freeze(['archer', 'mage', 'frost', 'sniper'] as readonly TowerId[]),
    phaseBudget: Object.freeze({
      early: 300,
      mid: 600,
      late: 1000,
    }),
  });
}

/**
 * Create default AI config for a player
 */
function createDefaultAiConfig(playerId: PlayerSlot): AiConfig {
  const isP1 = playerId === 'p1';
  return Object.freeze({
    configVersion: CONFIG_VERSION,
    schemaVersion: 1,
    playerId,
    difficulty: 'medium',
    personality: 'balanced',
    lanes: Object.freeze([
      createDefaultLaneConfig(isP1 ? 'lane_p1' : 'lane_p2', playerId),
    ]),
  });
}

/**
 * Default AI config for p1 (defender on lane_p1)
 */
export const AI_CONFIG_P1: AiConfig = createDefaultAiConfig('p1');

/**
 * Default AI config for p2 (defender on lane_p2)
 */
export const AI_CONFIG_P2: AiConfig = createDefaultAiConfig('p2');

/**
 * All AI configs
 */
export const AI_CONFIGS: readonly AiConfig[] = Object.freeze([
  AI_CONFIG_P1,
  AI_CONFIG_P2,
]);

/**
 * AI config lookup by player ID - O(1) access
 */
export const AI_CONFIG_BY_PLAYER: ReadonlyMap<PlayerSlot, AiConfig> = Object.freeze(
  new Map(AI_CONFIGS.map(c => [c.playerId, c])),
);

/**
 * Difficulty multipliers (future use for scaling AI difficulty)
 * These are placeholder values - actual implementation would use these
 */
export const DIFFICULTY_MULTIPLIERS: Readonly<Record<string, number>> = Object.freeze({
  easy: 0.8,
  medium: 1.0,
  hard: 1.2,
});

/**
 * Personality traits (future use for AI decision making)
 */
export const PERSONALITY_TRAITS: Readonly<Record<string, {
  sendFrequency: number;
  buildAggression: number;
  ecoVsUnit: number;
}>> = Object.freeze({
  aggressive: { sendFrequency: 1.2, buildAggression: 1.3, ecoVsUnit: 0.8 },
  balanced: { sendFrequency: 1.0, buildAggression: 1.0, ecoVsUnit: 1.0 },
  defensive: { sendFrequency: 0.8, buildAggression: 0.7, ecoVsUnit: 1.2 },
});
