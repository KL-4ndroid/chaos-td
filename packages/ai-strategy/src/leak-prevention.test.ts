import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { createSimulation } from '@chaos-td/game-core';
import {
  buildAIObservation,
  createDefaultAIStrategyGenome,
  extractAIFeaturesFromObservation,
  generateLegalActions,
  scoreAIAction,
  selectAIAction,
  toGameCommand,
  type AIObservation,
} from './index';

function runningSim() {
  const sim = createSimulation({ seed: 'leak-test', configVersion: CONFIG_VERSION });
  sim.start();
  for (let i = 0; i < 80; i += 1) sim.step();
  return sim;
}

function towerMap(towers: readonly { entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: 'p1' | 'p2'; level: number }[]) {
  const m = new Map<string, number>();
  for (const t of towers) m.set(`${t.towerTypeId}:${t.cellX}:${t.cellY}`, t.entityId);
  return m;
}

function buildObs(overrides: Partial<{
  p2Gold: number;
  p2Income: number;
}> = {}) {
  const sim = runningSim();
  const obs = buildAIObservation('p1', {
    players: {
      p1: sim.state.players.p1,
      p2: {
        ...sim.state.players.p2,
        gold: overrides.p2Gold ?? sim.state.players.p2.gold,
        income: overrides.p2Income ?? sim.state.players.p2.income,
      },
    },
    lanes: sim.state.lanes,
    towers: sim.state.towers,
    tick: sim.state.tick,
    phase: sim.state.phase as 'countdown' | 'running' | 'result',
  });
  return { obs, sim };
}

function decideSameSeed(obs: AIObservation, towers: Parameters<typeof towerMap>[0]) {
  const genome = createDefaultAIStrategyGenome('test');
  const features = extractAIFeaturesFromObservation(obs);
  const scored = generateLegalActions(obs, towerMap(towers)).map((a) => scoreAIAction(features, a, genome));
  return selectAIAction(scored, { state: new Uint32Array([42]), version: 1 } as never);
}

describe('leak-prevention: opponent gold and income are hidden', () => {
  it('hidden opponent Gold does not affect AI action', () => {
    const { obs: normal, sim } = buildObs({});
    const { obs: rich } = buildObs({ p2Gold: 99_999 });
    const { obs: poor } = buildObs({ p2Gold: 1 });
    expect(decideSameSeed(normal, sim.state.towers)).toEqual(decideSameSeed(rich, sim.state.towers));
    expect(decideSameSeed(normal, sim.state.towers)).toEqual(decideSameSeed(poor, sim.state.towers));
  });

  it('hidden opponent Income does not affect AI action', () => {
    const { obs: normal, sim } = buildObs({});
    const { obs: high } = buildObs({ p2Income: 9_999 });
    const { obs: low } = buildObs({ p2Income: 1 });
    expect(decideSameSeed(normal, sim.state.towers)).toEqual(decideSameSeed(high, sim.state.towers));
    expect(decideSameSeed(normal, sim.state.towers)).toEqual(decideSameSeed(low, sim.state.towers));
  });

  it('opponent economy fields are always zero / absent', () => {
    const { obs } = buildObs({ p2Gold: 99_999, p2Income: 9_999 });
    expect(obs.opponent.estimatedEcon.hasEstimate).toBe(false);
    expect(obs.opponent.estimatedEcon.estimatedGoldMinimum).toBe(0);
    expect(obs.opponent.estimatedEcon.estimatedGoldMaximum).toBe(0);
    expect(obs.opponent.estimatedEcon.estimatedIncomeMinimum).toBe(0);
    expect(obs.opponent.estimatedEcon.estimatedIncomeMaximum).toBe(0);
    expect(obs.opponent.estimatedEcon.confidencePermille).toBe(0);
  });

  it('visible tower info is correctly mirrored from opponent battlefield', () => {
    const { obs } = buildObs({});
    expect(obs.opponent.visibleTowers).toBeDefined();
    for (const tower of obs.opponent.visibleTowers) {
      expect(tower.towerTypeId).toBeDefined();
      expect(tower.level).toBeGreaterThanOrEqual(1);
      expect(tower.level).toBeLessThanOrEqual(3);
    }
  });
});

describe('leak-prevention: policy does not accept SimulationState', () => {
  it('toGameCommand returns null for wait', () => {
    expect(toGameCommand({ type: 'wait' }, 'p1', 100, 0)).toBeNull();
  });

  it('toGameCommand produces valid build command', () => {
    const cmd = toGameCommand({ type: 'build_tower', towerTypeId: 'archer', cellX: 3, cellY: 12 }, 'p1', 100, 0);
    expect(cmd).not.toBeNull();
    if (!cmd) return;
    expect(cmd.type).toBe('build_tower');
    expect(cmd.playerId).toBe('p1');
    if (cmd.type === 'build_tower') expect(cmd.towerTypeId).toBe('archer');
  });

  it('toGameCommand produces valid upgrade and sell commands', () => {
    for (const type of ['upgrade_tower', 'sell_tower'] as const) {
      const cmd = toGameCommand({ type, towerEntityId: 7 }, 'p2', 50, 1);
      expect(cmd).not.toBeNull();
      if (!cmd) return;
      expect(cmd.type).toBe(type);
      expect(cmd.playerId).toBe('p2');
      if (cmd.type === 'upgrade_tower' || cmd.type === 'sell_tower') expect(cmd.towerEntityId).toBe(7);
    }
  });

  it('toGameCommand produces valid queue command', () => {
    const cmd = toGameCommand({ type: 'queue_monster', monsterTypeId: 'sheep', quantity: 1 }, 'p1', 200, 0);
    expect(cmd).not.toBeNull();
    if (!cmd) return;
    expect(cmd.type).toBe('queue_monster');
    if (cmd.type === 'queue_monster') expect(cmd.monsterTypeId).toBe('sheep');
  });
});
