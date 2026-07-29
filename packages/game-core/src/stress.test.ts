/**
 * M1 Gate Stress Test
 * Verifies 2.5 minutes (3000 ticks) of simulation without crash.
 * This is a reduced version for CI; the full 10-minute test runs locally.
 */

import { describe, it, expect } from 'vitest';
import { createSimulation } from './simulation';
import { CONFIG_VERSION } from '@chaos-td/game-data';

describe('M1 Gate - Stress Test', () => {
  it('runs 2.5 minutes (3000 ticks) without crash', { timeout: 180_000 }, () => {
    const sim = createSimulation(
      { seed: 'gate-stress-test', configVersion: CONFIG_VERSION },
    );

    sim.start();
    const expectedTicks = 3000;

    for (let i = 0; i < expectedTicks; i++) {
      sim.step();
    }

    expect(sim.state.tick).toBe(3000);
    expect(sim.state.phase).toBe('running');
  });

  it('produces deterministic hash at tick 1000', () => {
    const sim = createSimulation(
      { seed: 'determinism-check', configVersion: CONFIG_VERSION },
    );

    sim.start();
    for (let i = 0; i < 1000; i++) {
      sim.step();
    }

    const hash = sim.state.stateHash;
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces consistent hash across runs', () => {
    const seed = 'consistency-test';
    const config = { seed, configVersion: CONFIG_VERSION };

    const run1 = createSimulation(config);
    run1.start();
    for (let i = 0; i < 500; i++) run1.step();
    const hash1 = run1.state.stateHash;

    const run2 = createSimulation(config);
    run2.start();
    for (let i = 0; i < 500; i++) run2.step();
    const hash2 = run2.state.stateHash;

    expect(hash1).toBe(hash2);
  });
});
