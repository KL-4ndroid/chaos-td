import { describe, expect, it } from 'vitest';
import { NORMAL_AI, NO_COMMANDS } from './profiles.js';
import { detectFirstMirrorDivergence } from './fairness.js';
import { runBalanceSimulation } from './runner.js';

const baseOptions = {
  seed: 'balance-001',
  maxTicks: 12_600,
  samplingIntervalTicks: 100,
} as const;

describe('player slot fairness', () => {
  it('keeps normal AI mirror state symmetric for a fixed seed', () => {
    expect(detectFirstMirrorDivergence({
      ...baseOptions,
      p1Controller: NORMAL_AI,
      p2Controller: NORMAL_AI,
    })).toBeNull();
  }, 120_000);

  it('swaps the winner when Normal AI changes slots', () => {
    const noneVsNormal = runBalanceSimulation({ ...baseOptions, p1Controller: NO_COMMANDS, p2Controller: NORMAL_AI });
    const normalVsNone = runBalanceSimulation({ ...baseOptions, p1Controller: NORMAL_AI, p2Controller: NO_COMMANDS });

    expect(noneVsNormal.match.winnerId).toBe('p2');
    expect(normalVsNone.match.winnerId).toBe('p1');
    expect(noneVsNormal.match.outcome).toBe(normalVsNone.match.outcome);
  }, 120_000);

  it('keeps wave-only matches neutral', () => {
    const result = runBalanceSimulation({ ...baseOptions, p1Controller: NO_COMMANDS, p2Controller: NO_COMMANDS });

    expect(result.match.outcome).toBe('draw');
    expect(result.match.winnerId).toBeNull();
    expect(result.players.p1).toMatchObject({
      hp: result.players.p2.hp,
      gold: result.players.p2.gold,
      income: result.players.p2.income,
    });
    expect(result.waves.filter((wave) => wave.battlefieldId === 'lane_p1').map((wave) => wave.actualSpawnCount))
      .toEqual(result.waves.filter((wave) => wave.battlefieldId === 'lane_p2').map((wave) => wave.actualSpawnCount));
  }, 120_000);
});
