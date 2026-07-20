/**
 * @chaos-td/game-core - Tick Constants
 *
 * Fixed time-step constants for deterministic simulation.
 * All values are in ticks (integer).
 */

export const TICK_DURATION_MS = 50 as const;
export const TICKS_PER_SECOND = 20 as const;

export const PHASE_TICKS = {
  COUNTDOWN: 60 as const,
  RUNNING_MAX: 12000 as const,
  RESOLVING_MAX: 400 as const,
} as const;

export const PHASE_DURATIONS_MS = {
  COUNTDOWN: PHASE_TICKS.COUNTDOWN * TICK_DURATION_MS,
  RUNNING_MAX: PHASE_TICKS.RUNNING_MAX * TICK_DURATION_MS,
  RESOLVING_MAX: PHASE_TICKS.RESOLVING_MAX * TICK_DURATION_MS,
} as const;

export const INITIAL_GOLD = 600 as const;
export const INITIAL_HP = 20 as const;
export const INITIAL_INCOME = 100 as const;
export const INCOME_INTERVAL_TICKS = 200 as const;

export const QUEUE_LIMIT = 30 as const;
export const SELL_REFUND_PERMILLE = 700 as const;
