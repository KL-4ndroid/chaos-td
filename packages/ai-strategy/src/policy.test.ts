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

function towerEntityMap(towers: readonly { entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: 'p1' | 'p2'; level: number }[]) {
  const map = new Map<string, number>();
  for (const tower of towers) {
    map.set(`${tower.towerTypeId}:${tower.cellX}:${tower.cellY}`, tower.entityId);
  }
  return map;
}

function buildObsInput(sim: ReturnType<typeof createSimulation>, playerId: 'p1' | 'p2') {
  const oppId: 'p1' | 'p2' = playerId === 'p1' ? 'p2' : 'p1';
  const ownLaneId: 'lane_p1' | 'lane_p2' = playerId === 'p1' ? 'lane_p1' : 'lane_p2';
  const oppLaneId: 'lane_p1' | 'lane_p2' = playerId === 'p1' ? 'lane_p2' : 'lane_p1';
  return {
    selfPlayer: {
      hp: sim.state.players[playerId].hp,
      gold: sim.state.players[playerId].gold,
      income: sim.state.players[playerId].income,
      totalInvested: sim.state.players[playerId].totalInvested,
    },
    publicOpponent: {
      hp: sim.state.players[oppId].hp,
    },
    ownBattlefield: {
      monsters: sim.state.lanes[ownLaneId].monsters as Parameters<typeof buildAIObservation>[1]['ownBattlefield']['monsters'],
      outboundQueue: sim.state.lanes[oppLaneId].spawnQueue,
    },
    opponentBattlefield: {
      monsters: sim.state.lanes[oppLaneId].monsters as Parameters<typeof buildAIObservation>[1]['opponentBattlefield']['monsters'],
    },
    ownTowers: sim.state.towers
      .filter((t) => t.ownerId === playerId)
      .map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
    opponentTowers: sim.state.towers
      .filter((t) => t.ownerId === oppId)
      .map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
    tick: sim.state.tick,
    phase: sim.state.phase as 'countdown' | 'running' | 'result',
    waveNumber: sim.state.waveScheduler.currentWaveNumber,
  };
}

function runningSimulation() {
  const simulation = createSimulation({ seed: 'policy-test', configVersion: CONFIG_VERSION });
  simulation.start();
  for (let index = 0; index < 80; index += 1) simulation.step();
  return simulation;
}

describe('feature-driven policy', () => {
  it('selects the same action for same observation, genome, and seed', () => {
    const simulation = runningSimulation();
    const obs = buildAIObservation('p1', buildObsInput(simulation, 'p1'));
    const genome = createDefaultAIStrategyGenome('deterministic');
    const features = extractAIFeaturesFromObservation(obs);
    const actions = generateLegalActions(obs, towerEntityMap(simulation.state.towers)).map((action) => scoreAIAction(features, action, genome));
    expect(selectAIAction(actions, createFromString('decision-seed'))).toEqual(selectAIAction(actions, createFromString('decision-seed')));
  });

  it('derives build candidates from definitions and map cells', () => {
    const simulation = runningSimulation();
    const obs = buildAIObservation('p1', buildObsInput(simulation, 'p1'));
    const candidates = generateLegalActions(obs, towerEntityMap(simulation.state.towers)).filter((action) => action.type === 'build_tower');
    const p1Lane = MVP_MIRROR_01.lanes.find((lane) => lane.defenderPlayerId === 'p1');
    if (!p1Lane) throw new Error('Expected p1 lane');
    expect(candidates).toHaveLength(p1Lane.buildableCells.length * 4);
    expect(new Set(candidates.map((action) => action.towerTypeId))).toEqual(new Set(['archer', 'mage', 'frost', 'sniper']));
  });

  it('raises anti-air and anti-boss tower scores for matching pressure features', () => {
    const genome = createDefaultAIStrategyGenome('pressure');
    const simulation = runningSimulation();
    const obs = buildAIObservation('p1', buildObsInput(simulation, 'p1'));
    const base = extractAIFeaturesFromObservation(obs);
    const airAction = { type: 'build_tower' as const, towerTypeId: 'mage', cellX: 3, cellY: 12 };
    const bossAction = { type: 'build_tower' as const, towerTypeId: 'sniper', cellX: 3, cellY: 12 };
    expect(scoreAIAction({ ...base, flyingPressure: 5000 }, airAction, genome).score).toBeGreaterThan(scoreAIAction(base, airAction, genome).score);
    expect(scoreAIAction({ ...base, bossPressure: 5000 }, bossAction, genome).score).toBeGreaterThan(scoreAIAction(base, bossAction, genome).score);
  });

  it('does not generate unaffordable actions and routes a selected command through core', () => {
    const simulation = runningSimulation();
    const poorObs = buildAIObservation('p1', {
      selfPlayer: { hp: simulation.state.players.p1.hp, gold: 0, income: simulation.state.players.p1.income, totalInvested: simulation.state.players.p1.totalInvested },
      publicOpponent: { hp: simulation.state.players.p2.hp },
      ownBattlefield: {
        monsters: simulation.state.lanes.lane_p1.monsters as Parameters<typeof buildAIObservation>[1]['ownBattlefield']['monsters'],
        outboundQueue: simulation.state.lanes.lane_p2.spawnQueue,
      },
      opponentBattlefield: {
        monsters: simulation.state.lanes.lane_p2.monsters as Parameters<typeof buildAIObservation>[1]['opponentBattlefield']['monsters'],
      },
      ownTowers: simulation.state.towers.filter((t) => t.ownerId === 'p1').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
      opponentTowers: simulation.state.towers.filter((t) => t.ownerId === 'p2').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
      tick: simulation.state.tick,
      phase: simulation.state.phase as 'countdown' | 'running' | 'result',
      waveNumber: simulation.state.waveScheduler.currentWaveNumber,
    });
    const actions = generateLegalActions(poorObs, towerEntityMap(simulation.state.towers));
    expect(actions).toEqual([{ type: 'wait' }]);

    const richObs = buildAIObservation('p1', {
      selfPlayer: { hp: simulation.state.players.p1.hp, gold: 600, income: simulation.state.players.p1.income, totalInvested: simulation.state.players.p1.totalInvested },
      publicOpponent: { hp: simulation.state.players.p2.hp },
      ownBattlefield: {
        monsters: simulation.state.lanes.lane_p1.monsters as Parameters<typeof buildAIObservation>[1]['ownBattlefield']['monsters'],
        outboundQueue: simulation.state.lanes.lane_p2.spawnQueue,
      },
      opponentBattlefield: {
        monsters: simulation.state.lanes.lane_p2.monsters as Parameters<typeof buildAIObservation>[1]['opponentBattlefield']['monsters'],
      },
      ownTowers: simulation.state.towers.filter((t) => t.ownerId === 'p1').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
      opponentTowers: simulation.state.towers.filter((t) => t.ownerId === 'p2').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
      tick: simulation.state.tick,
      phase: simulation.state.phase as 'countdown' | 'running' | 'result',
      waveNumber: simulation.state.waveScheduler.currentWaveNumber,
    });
    const legalBuild = generateLegalActions(richObs, towerEntityMap(simulation.state.towers)).find((action) => action.type === 'build_tower');
    if (!legalBuild) throw new Error('Expected legal build action');
    if (legalBuild.type !== 'build_tower') throw new Error('Expected build action');
    const command = toGameCommand(legalBuild, 'p1', simulation.state.tick, 1);
    expect(command).not.toBeNull();
    if (!command) throw new Error('Expected game command');
    simulation.submitCommand(command);
    expect(simulation.step().events.some((event) => event.type === 'command_accepted' && event.playerId === 'p1')).toBe(true);
  });
});
