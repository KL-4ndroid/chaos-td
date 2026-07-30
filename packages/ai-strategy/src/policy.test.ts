import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, MVP_MIRROR_01 } from '@chaos-td/game-data';
import { createFromString, createSimulation } from '@chaos-td/game-core';
import {
  buildAIObservation,
  createDefaultAIStrategyGenome,
  extractAIFeaturesFromObservation,
  generateLegalActions,
  scoreAIAction,
  selectAIAction,
  toGameCommand,
} from './index';

function runningSimulation() {
  const simulation = createSimulation({ seed: 'policy-test', configVersion: CONFIG_VERSION });
  simulation.start();
  for (let index = 0; index < 80; index += 1) simulation.step();
  return simulation;
}

function towerEntityMap(towers: readonly { entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: 'p1' | 'p2'; level: number }[]) {
  const map = new Map<string, number>();
  for (const tower of towers) {
    map.set(`${tower.towerTypeId}:${tower.cellX}:${tower.cellY}`, tower.entityId);
  }
  return map;
}

describe('feature-driven policy', () => {
  it('selects the same action for same observation, genome, and seed', () => {
    const simulation = runningSimulation();
    const obs = buildAIObservation('p1', {
      players: simulation.state.players,
      lanes: simulation.state.lanes,
      towers: simulation.state.towers,
      tick: simulation.state.tick,
      phase: simulation.state.phase as 'countdown' | 'running' | 'result',
    });
    const genome = createDefaultAIStrategyGenome('deterministic');
    const features = extractAIFeaturesFromObservation(obs);
    const actions = generateLegalActions(obs, towerEntityMap(simulation.state.towers)).map((action) => scoreAIAction(features, action, genome));
    expect(selectAIAction(actions, createFromString('decision-seed'))).toEqual(selectAIAction(actions, createFromString('decision-seed')));
  });

  it('derives build candidates from definitions and map cells', () => {
    const simulation = runningSimulation();
    const obs = buildAIObservation('p1', {
      players: simulation.state.players,
      lanes: simulation.state.lanes,
      towers: simulation.state.towers,
      tick: simulation.state.tick,
      phase: simulation.state.phase as 'countdown' | 'running' | 'result',
    });
    const candidates = generateLegalActions(obs, towerEntityMap(simulation.state.towers)).filter((action) => action.type === 'build_tower');
    const p1Lane = MVP_MIRROR_01.lanes.find((lane) => lane.defenderPlayerId === 'p1');
    if (!p1Lane) throw new Error('Expected p1 lane');
    expect(candidates).toHaveLength(p1Lane.buildableCells.length * 4);
    expect(new Set(candidates.map((action) => action.towerTypeId))).toEqual(new Set(['archer', 'mage', 'frost', 'sniper']));
  });

  it('raises anti-air and anti-boss tower scores for matching pressure features', () => {
    const genome = createDefaultAIStrategyGenome('pressure');
    const simulation = runningSimulation();
    const obs = buildAIObservation('p1', {
      players: simulation.state.players,
      lanes: simulation.state.lanes,
      towers: simulation.state.towers,
      tick: simulation.state.tick,
      phase: simulation.state.phase as 'countdown' | 'running' | 'result',
    });
    const base = extractAIFeaturesFromObservation(obs);
    const airAction = { type: 'build_tower' as const, towerTypeId: 'mage', cellX: 3, cellY: 12 };
    const bossAction = { type: 'build_tower' as const, towerTypeId: 'sniper', cellX: 3, cellY: 12 };
    expect(scoreAIAction({ ...base, flyingPressure: 5000 }, airAction, genome).score).toBeGreaterThan(scoreAIAction(base, airAction, genome).score);
    expect(scoreAIAction({ ...base, bossPressure: 5000 }, bossAction, genome).score).toBeGreaterThan(scoreAIAction(base, bossAction, genome).score);
  });

  it('does not generate unaffordable actions and routes a selected command through core', () => {
    const simulation = runningSimulation();
    const poorState = {
      players: { ...simulation.state.players, p1: { ...simulation.state.players.p1, gold: 0 } },
      lanes: simulation.state.lanes,
      towers: simulation.state.towers,
      tick: simulation.state.tick,
      phase: simulation.state.phase as 'countdown' | 'running' | 'result',
    };
    const obs = buildAIObservation('p1', poorState);
    const actions = generateLegalActions(obs, towerEntityMap(simulation.state.towers));
    expect(actions).toEqual([{ type: 'wait' }]);

    const obs2 = buildAIObservation('p1', {
      players: { ...simulation.state.players, p1: { ...simulation.state.players.p1, gold: 600 } },
      lanes: simulation.state.lanes,
      towers: simulation.state.towers,
      tick: simulation.state.tick,
      phase: simulation.state.phase as 'countdown' | 'running' | 'result',
    });
    const legalBuild = generateLegalActions(obs2, towerEntityMap(simulation.state.towers)).find((action) => action.type === 'build_tower');
    if (!legalBuild) throw new Error('Expected legal build action');
    if (legalBuild.type !== 'build_tower') throw new Error('Expected build action');
    const command = toGameCommand(legalBuild, 'p1', simulation.state.tick, 1);
    expect(command).not.toBeNull();
    if (!command) throw new Error('Expected game command');
    simulation.submitCommand(command);
    expect(simulation.step().events.some((event) => event.type === 'command_accepted' && event.playerId === 'p1')).toBe(true);
  });
});
