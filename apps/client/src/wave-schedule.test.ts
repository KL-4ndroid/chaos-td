import { describe, expect, it } from 'vitest';
import { DEMO_WAVE_INTERVAL_TICKS, getTicksUntilNextWave, isDemoWaveTick } from './wave-schedule';

describe('demo wave schedule', () => {
  it('does not trigger before the running phase', () => {
    expect(isDemoWaveTick('countdown', 59, null)).toBe(false);
    expect(getTicksUntilNextWave('countdown', 59, null)).toBe(DEMO_WAVE_INTERVAL_TICKS);
  });

  it('counts down from the running start using simulation ticks', () => {
    expect(getTicksUntilNextWave('running', 60, 60)).toBe(120);
    expect(getTicksUntilNextWave('running', 119, 60)).toBe(61);
    expect(getTicksUntilNextWave('running', 179, 60)).toBe(1);
  });

  it('triggers at each interval and resets the countdown', () => {
    expect(isDemoWaveTick('running', 180, 60)).toBe(true);
    expect(isDemoWaveTick('running', 300, 60)).toBe(true);
    expect(getTicksUntilNextWave('running', 180, 60)).toBe(0);
    expect(getTicksUntilNextWave('running', 181, 60)).toBe(119);
  });
});
