import type { Phase } from '@chaos-td/game-core';

export const DEMO_WAVE_INTERVAL_TICKS = 120 as const;

export function getTicksUntilNextWave(
  phase: Phase,
  tick: number,
  runningStartedAtTick: number | null,
): number {
  if (phase !== 'running' || runningStartedAtTick === null) return DEMO_WAVE_INTERVAL_TICKS;
  const runningTicks = Math.max(0, tick - runningStartedAtTick);
  const remainder = runningTicks % DEMO_WAVE_INTERVAL_TICKS;
  return remainder === 0 && runningTicks > 0 ? 0 : DEMO_WAVE_INTERVAL_TICKS - remainder;
}

export function isDemoWaveTick(
  phase: Phase,
  tick: number,
  runningStartedAtTick: number | null,
): boolean {
  return phase === 'running' &&
    runningStartedAtTick !== null &&
    tick > runningStartedAtTick &&
    (tick - runningStartedAtTick) % DEMO_WAVE_INTERVAL_TICKS === 0;
}
