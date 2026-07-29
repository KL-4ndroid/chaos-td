import { describe, expect, it } from 'vitest';
import { BALANCE_SCENARIOS, NO_COMMANDS, runBalanceSimulation } from './index.js';

describe('balance simulation', () => {
  const options = {
    seed: 'balance-test-001',
    maxTicks: 600,
    samplingIntervalTicks: 100,
    p1Controller: NO_COMMANDS,
    p2Controller: NO_COMMANDS,
    captureEventLog: true,
  };

  it('is deterministic for equivalent config and command generation', () => {
    const first = runBalanceSimulation(options);
    const second = runBalanceSimulation(options);

    expect(second.finalStateHash).toBe(first.finalStateHash);
    expect(second.match.commandLog).toEqual(first.match.commandLog);
    expect(second.match.eventLog).toEqual(first.match.eventLog);
    expect(second.players).toEqual(first.players);
  });

  it('keeps automatic wave spawn counts equal across battlefields', () => {
    const result = runBalanceSimulation(options);
    const p1 = result.waves.filter((wave) => wave.battlefieldId === 'lane_p1');
    const p2 = result.waves.filter((wave) => wave.battlefieldId === 'lane_p2');

    expect(p1.length).toBeGreaterThan(0);
    expect(p1.map((wave) => wave.actualSpawnCount)).toEqual(p2.map((wave) => wave.actualSpawnCount));
  });

  it('generates commands through controller profiles only', () => {
    const scenario = BALANCE_SCENARIOS.find((candidate) => candidate.id === 'aggressive-vs-defensive');
    if (!scenario) throw new Error('Missing aggressive-vs-defensive scenario');
    const result = runBalanceSimulation({ ...options, p1Controller: scenario.p1Controller, p2Controller: scenario.p2Controller });

    expect(result.match.commandLog.length).toBeGreaterThan(0);
    expect(result.match.commandLog.every((command) => command.includes('"type"'))).toBe(true);
  });
});
