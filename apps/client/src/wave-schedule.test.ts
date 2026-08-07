import { describe, expect, it } from 'vitest';
import { INITIAL_BUILD_GRACE_TICKS, WAVE_INTERVAL_TICKS } from '@chaos-td/game-core';
import { getTicksUntilNextWave, isDemoWaveTick } from './wave-schedule';

describe('demo wave schedule', () => {
  it('does not trigger before the running phase', () => {
    expect(isDemoWaveTick('countdown', 59, null)).toBe(false);
    expect(getTicksUntilNextWave('countdown', 59, null)).toBe(INITIAL_BUILD_GRACE_TICKS);
  });

  it('counts down from the running start using simulation ticks', () => {
    expect(getTicksUntilNextWave('running', 60, 60)).toBe(INITIAL_BUILD_GRACE_TICKS);
    expect(getTicksUntilNextWave('running', 259, 60)).toBe(1);
    expect(getTicksUntilNextWave('running', 260, 60)).toBe(0);
  });

  it('triggers at each interval and resets the countdown', () => {
    expect(isDemoWaveTick('running', 260, 60)).toBe(true);
    expect(isDemoWaveTick('running', 260 + WAVE_INTERVAL_TICKS, 60)).toBe(true);
    expect(getTicksUntilNextWave('running', 260, 60)).toBe(0);
    expect(getTicksUntilNextWave('running', 261, 60)).toBe(WAVE_INTERVAL_TICKS - 1);
  });
});
