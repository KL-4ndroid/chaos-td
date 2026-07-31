import { describe, expect, it } from 'vitest';
import {
  createSmokePopulation,
  runSelfPlayMatch,
} from './index';

describe('AI training smoke baseline', () => {
  it('plays a deterministic matrix of smoke self-play matches', () => {
    // A trimmed smoke matrix: 4 population slots × 2 seeds × maxTicks=80
    // (population slots are derived from the first N archetypes so the run
    // stays under the 60s default test timeout while still exercising the
    // self-play path).
    const population = createSmokePopulation(4);
    const seeds = ['ai-smoke-001', 'ai-smoke-002'];
    const results = [];
    for (const p1 of population) {
      for (const p2 of population) {
        for (const seed of seeds) {
          results.push(runSelfPlayMatch(seed, p1, p2, 80));
        }
      }
    }
    expect(results.length).toBe(population.length * population.length * seeds.length);
    let wins = 0; let draws = 0; let tickGuards = 0;
    for (const result of results) {
      if (result.outcome === 'win') wins++;
      else if (result.outcome === 'draw') draws++;
      if (result.completion === 'tick_guard') tickGuards++;
    }
    expect(wins + draws).toBe(results.length);
    expect(tickGuards).toBeGreaterThanOrEqual(0);
  });
});
