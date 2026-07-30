import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, MVP_MIRROR_01 } from '@chaos-td/game-data';
import { createFromString, createSimulation } from '@chaos-td/game-core';
import {
  createDefaultAIStrategyGenome,
  extractAIFeatures,
  generateLegalActions,
  scoreAIAction,
  selectAIAction,
  toGameCommand,
} from './index';

function runningSimulation() {
  const simulation = createSimulation({ seed: 'policy-test', configVersion: CONFIG_VERSION });
  simulation.start();
  for (let index = 0; index <= 60; index += 1) simulation.step();
  return simulation;
}

describe('feature-driven policy', () => {
  it('selects the same action for same state, genome, and seed', () => {
    const simulation = runningSimulation();
    const genome = createDefaultAIStrategyGenome('deterministic');
    const features = extractAIFeatures(simulation.state, 'p1');
    const actions = generateLegalActions(simulation.state, 'p1').map((action) => scoreAIAction(features, action, genome));
    expect(selectAIAction(actions, createFromString('decision-seed'))).toEqual(selectAIAction(actions, createFromString('decision-seed')));
  });

  it('derives build candidates from definitions and map cells', () => {
    const simulation = runningSimulation();
    const candidates = generateLegalActions(simulation.state, 'p1').filter((action) => action.type === 'build_tower');
    const p1Lane = MVP_MIRROR_01.lanes.find((lane) => lane.defenderPlayerId === 'p1');
    if (!p1Lane) throw new Error('Expected p1 lane');
    expect(candidates).toHaveLength(p1Lane.buildableCells.length * 4);
    expect(new Set(candidates.map((action) => action.towerTypeId))).toEqual(new Set(['archer', 'mage', 'frost', 'sniper']));
  });

  it('raises anti-air and anti-boss tower scores for matching pressure features', () => {
    const genome = createDefaultAIStrategyGenome('pressure');
    const base = extractAIFeatures(runningSimulation().state, 'p1');
    const airAction = { type: 'build_tower', towerTypeId: 'mage', cellX: 3, cellY: 12 } as const;
    const bossAction = { type: 'build_tower', towerTypeId: 'sniper', cellX: 3, cellY: 12 } as const;
    expect(scoreAIAction({ ...base, flyingPressure: 5000 }, airAction, genome).score).toBeGreaterThan(scoreAIAction(base, airAction, genome).score);
    expect(scoreAIAction({ ...base, bossPressure: 5000 }, bossAction, genome).score).toBeGreaterThan(scoreAIAction(base, bossAction, genome).score);
  });

  it('does not generate unaffordable actions and routes a selected command through core', () => {
    const simulation = runningSimulation();
    const poorState = {
      ...simulation.state,
      players: { ...simulation.state.players, p1: { ...simulation.state.players.p1, gold: 0 } },
    };
    const actions = generateLegalActions(poorState, 'p1');
    expect(actions).toEqual([{ type: 'wait' }]);

    const legalBuild = generateLegalActions(simulation.state, 'p1').find((action) => action.type === 'build_tower');
    expect(legalBuild).toBeDefined();
    if (!legalBuild || legalBuild.type !== 'build_tower') throw new Error('Expected legal build action');
    const command = toGameCommand(legalBuild, 'p1', simulation.state.tick, 1);
    expect(command).not.toBeNull();
    if (!command) throw new Error('Expected game command');
    simulation.submitCommand(command);
    expect(simulation.step().events.some((event) => event.type === 'command_accepted' && event.playerId === 'p1')).toBe(true);
  });
});
