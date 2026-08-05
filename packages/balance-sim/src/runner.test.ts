import { describe, expect, it } from 'vitest';
import { BALANCE_SCENARIOS, NO_COMMANDS, NORMAL_AI, runBalanceSimulation } from './index.js';
import { createDefaultAIStrategyGenome } from '@chaos-td/ai-strategy';
import { CONFIG_VERSION } from '@chaos-td/game-data';

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
    const scenario = BALANCE_SCENARIOS.find((candidate) => candidate.id === 'normal-ai-vs-normal-ai');
    if (!scenario) throw new Error('Missing normal-ai-vs-normal-ai scenario');
    const result = runBalanceSimulation({ ...options, p1Controller: scenario.p1Controller, p2Controller: scenario.p2Controller });

    expect(scenario.p1Controller).toBe(NORMAL_AI);
    expect(result.match.commandLog.length).toBeGreaterThan(0);
    expect(result.match.commandLog.every((command) => command.includes('"type"'))).toBe(true);
  });

  it('runs the shared strategy policy deterministically through a sanitized balance adapter', () => {
    const strategy = { id: 'strategy-test', kind: 'strategy_ai' as const, genome: createDefaultAIStrategyGenome('balance-policy', CONFIG_VERSION) };
    const first = runBalanceSimulation({ ...options, p1Controller: strategy, p2Controller: strategy });
    const second = runBalanceSimulation({ ...options, p1Controller: strategy, p2Controller: strategy });

    expect(first.finalStateHash).toBe(second.finalStateHash);
    expect(first.match.commandLog).toEqual(second.match.commandLog);
    expect(first.match.commandLog.length).toBeGreaterThan(0);
  });
});
