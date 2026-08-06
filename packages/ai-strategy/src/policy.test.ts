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

  it('changes candidate scores when each newly active control changes', () => {
    const simulation = runningSimulation();
    const obs = buildAIObservation('p1', buildObsInput(simulation, 'p1'));
    const features = {
      ...extractAIFeaturesFromObservation(obs),
      gold: 800,
      income: 100,
      incomeGrowthOpportunity: 900,
      leakRisk: 800,
      activeMonsterPressure: 800,
      opponentPressure: 800,
    };
    const base = createDefaultAIStrategyGenome('sensitivity');
    const build = { type: 'build_tower' as const, towerTypeId: 'archer', cellX: 3, cellY: 12 };
    const send = { type: 'queue_monster' as const, monsterTypeId: 'sheep', quantity: 1 };
    expect(scoreAIAction(features, build, { ...base, buildThreshold: 0 }).score).not.toBe(scoreAIAction(features, build, { ...base, buildThreshold: 1000 }).score);
    expect(scoreAIAction(features, build, { ...base, emergencyDefenseThreshold: 0 }).score).not.toBe(scoreAIAction(features, build, { ...base, emergencyDefenseThreshold: 1000 }).score);
    const normalFeatures = { ...features, leakRisk: 0, activeMonsterPressure: 0 };
    expect(scoreAIAction(normalFeatures, build, { ...base, reserveGoldRatio: 0 }).score).not.toBe(scoreAIAction(normalFeatures, build, { ...base, reserveGoldRatio: 1000 }).score);
    expect(scoreAIAction(normalFeatures, build, { ...base, incomeInvestmentRatio: 0 }).score).not.toBe(scoreAIAction(normalFeatures, build, { ...base, incomeInvestmentRatio: 1000 }).score);
    expect(scoreAIAction(features, send, { ...base, economyWeight: 0 }).score).not.toBe(scoreAIAction(features, send, { ...base, economyWeight: 1000 }).score);
    expect(scoreAIAction(features, send, { ...base, sendInvestmentRatio: 0 }).score).not.toBe(scoreAIAction(features, send, { ...base, sendInvestmentRatio: 1000 }).score);
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

  it('offers affordable multi-monster bursts and favors using surplus gold for further towers', () => {
    const simulation = runningSimulation();
    const richInput = buildObsInput(simulation, 'p1');
    const richObs = buildAIObservation('p1', { ...richInput, selfPlayer: { ...richInput.selfPlayer, gold: 1_000 } });
    const actions = generateLegalActions(richObs, towerEntityMap(simulation.state.towers));
    expect(actions.some((action) => action.type === 'queue_monster' && action.quantity === 5)).toBe(true);

    const genome = createDefaultAIStrategyGenome('spend-surplus');
    const features = { ...extractAIFeaturesFromObservation(richObs), gold: 1_000, towerRoleCoverage: { basic: 4 } };
    const build = { type: 'build_tower' as const, towerTypeId: 'archer', cellX: 3, cellY: 14 };
    expect(scoreAIAction(features, build, genome).score).toBeGreaterThan(scoreAIAction({ ...features, gold: 100 }, build, genome).score);
  });

  it('builds a defensive baseline before spending surplus on outgoing monsters', () => {
    const simulation = runningSimulation();
    const input = buildObsInput(simulation, 'p1');
    const obs = buildAIObservation('p1', { ...input, selfPlayer: { ...input.selfPlayer, gold: 600, income: 100 }, ownTowers: [] });
    const genome = createDefaultAIStrategyGenome('balanced-opening');
    const features = extractAIFeaturesFromObservation(obs);
    const scored = generateLegalActions(obs, new Map()).map((action) => scoreAIAction(features, action, genome));
    expect(selectAIAction(scored, createFromString('balanced-opening-seed')).type).toBe('build_tower');
  });

  it('never liquidates towers while the defensive baseline is unmet', () => {
    const genome = createDefaultAIStrategyGenome('no-liquidation');
    const features = {
      playerId: 'p1' as const, tick: 100, hp: 20, gold: 600, income: 100, towerInvestment: 0,
      towerRoleCoverage: { basic: 3 }, groundCoverage: 0, flyingCoverage: 0, splashCoverage: 0, slowCoverage: 0,
      bossDefenseCoverage: 0, activeMonsterPressure: 0, flyingPressure: 0, bossPressure: 0, leakRisk: 0,
      sendQueueCount: 0, opponentHp: 20, opponentGroundCoverage: 0, opponentFlyingCoverage: 0, opponentPressure: 0,
    };
    expect(scoreAIAction(features, { type: 'sell_tower', towerEntityId: 1 }, genome).score).toBeLessThan(0);
  });
});
