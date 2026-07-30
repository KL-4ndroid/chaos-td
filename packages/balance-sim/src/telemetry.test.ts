import { describe, expect, it } from 'vitest';
import { runBalanceSimulation } from './runner.js';
import { NO_COMMANDS, NORMAL_AI } from './profiles.js';

describe('balance telemetry attribution', () => {
  it('separates wave telemetry by canonical battlefield ID', () => {
    const result = runBalanceSimulation({
      seed: 'balance-wave-attribution',
      maxTicks: 1_000,
      samplingIntervalTicks: 100,
      p1Controller: NORMAL_AI,
      p2Controller: NORMAL_AI,
    });

    expect(result.waves.some((wave) => wave.battlefieldId === 'lane_p1')).toBe(true);
    expect(result.waves.some((wave) => wave.battlefieldId === 'lane_p2')).toBe(true);
    expect(result.monsters.some((monster) => monster.source === 'wave' && monster.spawnCount > 0)).toBe(true);
    expect(result.waves.every((wave) => wave.peakConcurrentMonsterCount <= wave.actualSpawnCount)).toBe(true);
    expect(result.waves.every((wave) => wave.peakTotalBattlefieldPressure >= wave.peakConcurrentMonsterCount)).toBe(true);
  });

  it('derives player send spend from accepted monster queue events', () => {
    const result = runBalanceSimulation({
      seed: 'balance-send-spend',
      maxTicks: 1_000,
      samplingIntervalTicks: 100,
      p1Controller: NORMAL_AI,
      p2Controller: NORMAL_AI,
      captureEventLog: true,
    });

    expect(result.players.p1.monsterSendSpend).toBeGreaterThanOrEqual(0);
    expect(result.match.eventLog.some((event) => event.includes('"type":"command_accepted"'))).toBe(true);
  });

  it('attributes the same completed result with or without event log capture', () => {
    const options = {
      seed: 'balance-result-attribution',
      maxTicks: 12_600,
      samplingIntervalTicks: 100,
      p1Controller: NO_COMMANDS,
      p2Controller: NORMAL_AI,
    } as const;
    const captured = runBalanceSimulation({ ...options, captureEventLog: true });
    const uncaptured = runBalanceSimulation({ ...options, captureEventLog: false });

    expect(uncaptured.match.eventLog).toEqual([]);
    expect(uncaptured.match.winnerId).toBe(captured.match.winnerId);
    expect(uncaptured.match.outcome).toBe(captured.match.outcome);
    expect(uncaptured.match.reason).toBe(captured.match.reason);
    expect(uncaptured.match.finalTick).toBe(captured.match.finalTick);
    expect(uncaptured.finalStateHash).toBe(captured.finalStateHash);
  });

  it('marks a tick guard as incomplete instead of a formal draw', () => {
    const result = runBalanceSimulation({
      seed: 'balance-tick-guard',
      maxTicks: 1,
      samplingIntervalTicks: 1,
      p1Controller: NORMAL_AI,
      p2Controller: NORMAL_AI,
    });

    expect(result.match.completion).toBe('tick_guard');
    expect(result.match.reason).toBe('tick_guard');
  });

  it('preserves a winner in a minimal asymmetric runner fixture', () => {
    const result = runBalanceSimulation({
      seed: 'balance-asymmetric-winner',
      maxTicks: 12_600,
      samplingIntervalTicks: 100,
      p1Controller: NO_COMMANDS,
      p2Controller: NORMAL_AI,
    });

    expect(result.match.completion).toBe('result');
    expect(result.match.outcome).toBe('win');
    expect(result.match.winnerId).toBe('p2');
  });
});
