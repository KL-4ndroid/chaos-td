import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { createDefaultAIStrategyGenome } from '@chaos-td/ai-strategy';
import {
  collectLeagueTelemetry,
  runSelfPlayWithTelemetry,
  serializeTelemetryRecord,
  TELEMETRY_CORRECTNESS_FLAGS,
} from './telemetry';
import type { EvolutionMatch } from './schedule';

function match(seed: string, p1StrategyId: string, p2StrategyId: string, mirrored = false): EvolutionMatch {
  const participantAId = mirrored ? p2StrategyId : p1StrategyId;
  const participantBId = mirrored ? p1StrategyId : p2StrategyId;
  return {
    generation: 0,
    pairId: `pair:${seed}`,
    seed,
    participantAId,
    participantBId,
    p1StrategyId,
    p2StrategyId,
    mirrored,
  };
}

describe('league telemetry from domain events', () => {
  it('produces deterministic, chronological, slot-symmetric telemetry for the same seed', () => {
    const p1 = createDefaultAIStrategyGenome('alpha', CONFIG_VERSION);
    const p2 = createDefaultAIStrategyGenome('beta', CONFIG_VERSION);
    const first = collectLeagueTelemetry(match('seed-1', p1.strategyId, p2.strategyId), p1, p2, p1, 240, {
      seed: 'seed-1', p1StrategyId: p1.strategyId, p2StrategyId: p2.strategyId, finalTick: 0, winnerId: null, outcome: 'draw', completion: 'tick_guard', acceptedCommands: 0, rejectedCommands: 0, finalStateHash: 'placeholder',
    });
    const second = collectLeagueTelemetry(match('seed-1', p1.strategyId, p2.strategyId), p1, p2, p1, 240, {
      seed: 'seed-1', p1StrategyId: p1.strategyId, p2StrategyId: p2.strategyId, finalTick: 0, winnerId: null, outcome: 'draw', completion: 'tick_guard', acceptedCommands: 0, rejectedCommands: 0, finalStateHash: 'placeholder',
    });
    expect(first).toEqual(second);
    expect(first.correctnessChecks.eventsChronological).toBe(true);
    expect(first.correctnessChecks.noPlayerCommandsAfterResult).toBe(true);
    expect(first.correctnessChecks.commandPlayerMatchesEventPlayer).toBe(true);
    expect(first.correctnessChecks.leakDefenderEqualsLaneDefender).toBe(true);
  });

  it('runs through the public self-play path and returns baseline + telemetry', () => {
    const p1 = createDefaultAIStrategyGenome('alpha', CONFIG_VERSION);
    const p2 = createDefaultAIStrategyGenome('beta', CONFIG_VERSION);
    const { summary, telemetry } = runSelfPlayWithTelemetry(match('seed-2', p1.strategyId, p2.strategyId), p1, p2, 200);
    expect(summary.p1StrategyId).toBe('alpha');
    expect(summary.p2StrategyId).toBe('beta');
    expect(telemetry.commandAcceptedPerPlayer.p1).toBeGreaterThanOrEqual(0);
    expect(telemetry.commandAcceptedPerPlayer.p2).toBeGreaterThanOrEqual(0);
    expect(telemetry.commandAcceptedPerPlayer.p1 + telemetry.commandAcceptedPerPlayer.p2).toBe(summary.acceptedCommands);
  });

  it('serializes telemetry to a canonical stable JSON string', () => {
    const p1 = createDefaultAIStrategyGenome('alpha');
    const p2 = createDefaultAIStrategyGenome('beta');
    const first = collectLeagueTelemetry(match('seed-3', p1.strategyId, p2.strategyId), p1, p2, p1, 120, {
      seed: 'seed-3', p1StrategyId: p1.strategyId, p2StrategyId: p2.strategyId, finalTick: 0, winnerId: null, outcome: 'draw', completion: 'tick_guard', acceptedCommands: 0, rejectedCommands: 0, finalStateHash: 'placeholder',
    });
    const serialized = serializeTelemetryRecord(first);
    expect(JSON.parse(serialized)).toEqual(first);
    expect(serialized).toContain('correctnessChecks');
    expect(Object.keys(TELEMETRY_CORRECTNESS_FLAGS)).toHaveLength(5);
  });
});
