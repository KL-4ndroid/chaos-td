import {
  INITIAL_BUILD_GRACE_TICKS,
  WAVE_INTERVAL_TICKS,
  type Phase,
} from '@chaos-td/game-core';

/** @deprecated Use WAVE_INTERVAL_TICKS; retained for compatibility with callers. */
export const DEMO_WAVE_INTERVAL_TICKS = WAVE_INTERVAL_TICKS;

export function getTicksUntilNextWave(
  phase: Phase,
  tick: number,
  runningStartedAtTick: number | null,
): number {
  if (phase !== 'running' || runningStartedAtTick === null) return INITIAL_BUILD_GRACE_TICKS;
  const runningTicks = Math.max(0, tick - runningStartedAtTick);
  if (runningTicks < INITIAL_BUILD_GRACE_TICKS) {
    return INITIAL_BUILD_GRACE_TICKS - runningTicks;
  }
  const afterGraceTicks = runningTicks - INITIAL_BUILD_GRACE_TICKS;
  const remainder = afterGraceTicks % WAVE_INTERVAL_TICKS;
  return remainder === 0 ? 0 : WAVE_INTERVAL_TICKS - remainder;
}

export function isDemoWaveTick(
  phase: Phase,
  tick: number,
  runningStartedAtTick: number | null,
): boolean {
  return phase === 'running' &&
    runningStartedAtTick !== null &&
    tick - runningStartedAtTick >= INITIAL_BUILD_GRACE_TICKS &&
    (tick - runningStartedAtTick - INITIAL_BUILD_GRACE_TICKS) % WAVE_INTERVAL_TICKS === 0;
}
