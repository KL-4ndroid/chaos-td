import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from './simulation-loop';

describe('FixedStepLoop', () => {
  it('produces the same deterministic hash at 30 and 60 FPS', () => {
    const at30 = new FixedStepLoop(50);
    const at60 = new FixedStepLoop(50);
    let hash30 = 2166136261;
    let hash60 = 2166136261;
    const advanceHash = (hash: number, tick: number): number => Math.imul(hash ^ tick, 16777619) >>> 0;

    for (let frame = 0; frame < 60; frame += 1) {
      at30.advance(1000 / 30, () => {
        hash30 = advanceHash(hash30, at30.tickCount + 1);
      });
    }
    for (let frame = 0; frame < 120; frame += 1) {
      at60.advance(1000 / 60, () => {
        hash60 = advanceHash(hash60, at60.tickCount + 1);
      });
    }

    expect(at30.tickCount).toBe(40);
    expect(at60.tickCount).toBe(40);
    expect(hash30.toString(16)).toBe(hash60.toString(16));
  });

  it('runs at most five ticks per frame and retains backlog', () => {
    const loop = new FixedStepLoop(50, 5);

    const processed = loop.advance(1000);

    expect(processed).toBe(5);
    expect(loop.tickCount).toBe(5);
    expect(loop.backlogTicks).toBe(15);
    expect(loop.advance(0)).toBe(5);
    expect(loop.backlogTicks).toBe(10);
  });

  it('pauses without consuming frame time or advancing ticks', () => {
    const loop = new FixedStepLoop(50);
    loop.pause();

    expect(loop.advance(1000)).toBe(0);
    expect(loop.tickCount).toBe(0);
    expect(loop.accumulatorMs).toBe(0);

    loop.resume();
    expect(loop.advance(50)).toBe(1);
    expect(loop.tickCount).toBe(1);
  });

  it('does not use fractional backlog as an extra tick', () => {
    const loop = new FixedStepLoop(50);

    loop.advance(125);

    expect(loop.tickCount).toBe(2);
    expect(loop.accumulatorMs).toBeCloseTo(25);
    expect(loop.backlogTicks).toBe(0);
  });
});
