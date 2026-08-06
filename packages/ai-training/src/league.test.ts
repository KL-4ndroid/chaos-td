import { describe, expect, it } from 'vitest';
import { createDefaultAIStrategyGenome } from '@chaos-td/ai-strategy';
import { runSelfPlayMatch } from './league';

describe('deterministic self-play league', () => {
  it('reproduces the same headless result for the same strategies and seed', () => {
    const p1 = createDefaultAIStrategyGenome('p1');
    const p2 = createDefaultAIStrategyGenome('p2');
    expect(runSelfPlayMatch('self-play-deterministic', p1, p2, 300)).toEqual(runSelfPlayMatch('self-play-deterministic', p1, p2, 300));
  });

  it('uses the deterministic final adjudicator for identical policies', () => {
    const policy = createDefaultAIStrategyGenome('mirror');
    const result = runSelfPlayMatch('self-play-mirror', policy, policy, 300);
    expect(result.winnerId).toBe('p1');
    expect(result.outcome).toBe('win');
  });
});
