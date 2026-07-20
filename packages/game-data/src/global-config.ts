/**
 * @chaos-td/game-data - Global Configuration
 *
 * Authoritative game balance constants.
 * These values are the single source of truth for game configuration.
 */

import type { GlobalConfig } from './types.js';

/**
 * MVP Config Version
 * Updated whenever any global, tower, monster, or map values change.
 * Format: "{major}-{minor}-{patch}" or custom identifier.
 */
export const CONFIG_VERSION = 'mvp-0.1.0' as const;

/**
 * Global game configuration for MVP.
 * All values derived from docs/03_BALANCE_BASELINE.md
 */
export const GLOBAL_CONFIG: GlobalConfig = Object.freeze({
  configVersion: CONFIG_VERSION,
  schemaVersion: 1,

  // Simulation timing
  tickRate: 20,                    // ticks per second
  countdownTicks: 60,              // 3 seconds
  maxRunningTicks: 12000,          // 600 seconds
  maxResolvingTicks: 400,          // 20 seconds

  // Player starting values
  startingHp: 20,
  startingGold: 600,
  startingIncome: 100,

  // Economy
  incomeIntervalTicks: 200,        // 10 seconds

  // Game rules
  sellRefundPermille: 700,         // 70% refund
  sendQueueLimit: 30,
  slowCapPermille: 500,            // minimum slow effect (50%)
});
