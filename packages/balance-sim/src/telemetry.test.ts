import { describe, expect, it } from 'vitest';
import { runBalanceSimulation } from './runner.js';
import { aiProfile } from './profiles.js';

describe('balance telemetry attribution', () => {
  it('separates wave telemetry by canonical battlefield ID', () => {
    const result = runBalanceSimulation({
      seed: 'balance-wave-attribution',
      maxTicks: 1_000,
      samplingIntervalTicks: 100,
      p1Controller: aiProfile('medium', 'balanced'),
      p2Controller: aiProfile('medium', 'balanced'),
    });

    expect(result.waves.some((wave) => wave.battlefieldId === 'lane_p1')).toBe(true);
    expect(result.waves.some((wave) => wave.battlefieldId === 'lane_p2')).toBe(true);
    expect(result.monsters.some((monster) => monster.source === 'wave' && monster.spawnCount > 0)).toBe(true);
  });

  it('derives player send spend from accepted monster queue events', () => {
    const result = runBalanceSimulation({
      seed: 'balance-send-spend',
      maxTicks: 1_000,
      samplingIntervalTicks: 100,
      p1Controller: aiProfile('medium', 'balanced'),
      p2Controller: aiProfile('medium', 'defensive'),
      captureEventLog: true,
    });

    expect(result.players.p1.monsterSendSpend).toBeGreaterThan(0);
    expect(result.match.eventLog.some((event) => event.includes('"type":"monster_queued"'))).toBe(true);
  });
});
