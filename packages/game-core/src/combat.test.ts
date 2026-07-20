import { describe, expect, it } from 'vitest';
import type { LaneId } from '@chaos-td/game-data';
import { createPathSegments } from './movement';
import {
  createSimulation,
  type LaneRuntimeState,
  type MonsterRuntimeState,
} from './simulation';
import { createTowerState } from './tower';

const CONFIG = { seed: 'm1-002-combat', configVersion: '1.0.0' } as const;
const WAYPOINTS = [
  { xMilliTiles: 0, yMilliTiles: 500 },
  { xMilliTiles: 10_000, yMilliTiles: 500 },
] as const;

function createMonster(
  entityId: number,
  pathProgressMilliTiles: number,
  hp = 85,
  speedMilliTilesPerTick = 0,
): MonsterRuntimeState {
  return {
    entityId,
    ownerId: 'p2',
    monsterTypeId: 'sheep',
    hp,
    shield: 0,
    segmentIndex: 0,
    distanceOnSegmentMilliTiles: pathProgressMilliTiles,
    pathProgressMilliTiles,
    speedMilliTilesPerTick,
    leakDamage: 1,
  };
}

function createLane(monsters: MonsterRuntimeState[]): LaneRuntimeState {
  const segments = createPathSegments(WAYPOINTS);
  return {
    laneId: 'lane_p1',
    defenderId: 'p1',
    attackerId: 'p2',
    waypoints: WAYPOINTS,
    spawnPosition: WAYPOINTS[0],
    endPosition: WAYPOINTS[1],
    segments,
    totalPathLength: 10_000,
    spawnQueue: [],
    monsters,
    pendingLeaks: [],
    spawnCooldownTicks: 0,
  };
}

function createEmptyLane(laneId: LaneId): LaneRuntimeState {
  const defenderId = laneId === 'lane_p1' ? 'p1' : 'p2';
  const attackerId = defenderId === 'p1' ? 'p2' : 'p1';
  return {
    ...createLane([]),
    laneId,
    defenderId,
    attackerId,
  };
}

function createCombatSimulation(
  monsters: MonsterRuntimeState[],
  towerCellX = 0,
  towerCellY = 0,
) {
  const lanes = {
    lane_p1: createLane(monsters),
    lane_p2: createEmptyLane('lane_p2'),
  };
  const tower = createTowerState(100, 'p1', 'archer', towerCellX, towerCellY);
  const simulation = createSimulation(CONFIG, lanes, [tower]);
  simulation.start();
  for (let tick = 0; tick < 60; tick += 1) {
    simulation.step();
  }
  return simulation;
}

describe('Archer vs Sheep combat', () => {
  it('does not attack a sheep outside range', () => {
    const simulation = createCombatSimulation([createMonster(1, 4_000)]);

    const result = simulation.step();

    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(85);
    expect(result.events.some((event) => event.type === 'attack_fired')).toBe(false);
  });

  it('includes a sheep exactly on the range boundary', () => {
    const simulation = createCombatSimulation([createMonster(1, 3_700)]);

    const result = simulation.step();

    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(67);
  });

  it('targets the sheep with greatest progress using FIRST', () => {
    const simulation = createCombatSimulation([
      createMonster(1, 500),
      createMonster(2, 2_000),
    ]);

    const result = simulation.step();

    expect(result.state.lanes.lane_p1.monsters.find((monster) => monster.entityId === 1)?.hp).toBe(85);
    expect(result.state.lanes.lane_p1.monsters.find((monster) => monster.entityId === 2)?.hp).toBe(67);
  });

  it('breaks equal-priority ties by lowest entity ID', () => {
    const simulation = createCombatSimulation([
      createMonster(8, 2_000),
      createMonster(3, 2_000),
    ]);

    const result = simulation.step();
    const attack = result.events.find((event) => event.type === 'attack_fired');

    expect(attack).toMatchObject({ targetMonsterId: 3 });
  });

  it('applies hitscan damage and emits attack and damage events on the attack tick', () => {
    const simulation = createCombatSimulation([createMonster(1, 1_000)]);

    const result = simulation.step();

    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(67);
    expect(result.events).toContainEqual({
      type: 'attack_fired',
      tick: 61,
      towerEntityId: 100,
      targetMonsterId: 1,
    });
    expect(result.events).toContainEqual({
      type: 'damage_applied',
      tick: 61,
      monsterEntityId: 1,
      damage: 18,
      newHp: 67,
    });
  });

  it('never makes cooldown negative and attacks again after 13 ticks', () => {
    const simulation = createCombatSimulation([createMonster(1, 1_000, 200)]);

    simulation.step();
    expect(simulation.state.towers[0]?.cooldownTicks).toBe(13);

    for (let elapsed = 1; elapsed < 13; elapsed += 1) {
      const result = simulation.step();
      expect(result.events.some((event) => event.type === 'attack_fired')).toBe(false);
      expect(result.state.towers[0]?.cooldownTicks).toBeGreaterThanOrEqual(0);
    }

    const result = simulation.step();
    expect(result.events.some((event) => event.type === 'attack_fired')).toBe(true);
    expect(result.state.towers[0]?.cooldownTicks).toBe(13);
  });

  it('does not target dead sheep and emits death once', () => {
    const simulation = createCombatSimulation([
      createMonster(1, 2_000, 18),
      createMonster(2, 1_000),
    ]);

    const killResult = simulation.step();
    expect(killResult.events.filter((event) => event.type === 'monster_died')).toHaveLength(1);

    for (let elapsed = 1; elapsed <= 13; elapsed += 1) {
      simulation.step();
    }

    expect(simulation.state.lanes.lane_p1.monsters.find((monster) => monster.entityId === 1)?.hp).toBe(0);
    expect(simulation.state.lanes.lane_p1.monsters.find((monster) => monster.entityId === 2)?.hp).toBe(67);
  });

  it('does not leak a sheep killed before reaching the end', () => {
    const monster = createMonster(1, 9_900, 18);
    const simulation = createCombatSimulation([monster], 7, 0);

    const killResult = simulation.step();
    expect(killResult.events.some((event) => event.type === 'monster_died')).toBe(true);

    for (let tick = 0; tick < 10; tick += 1) {
      const result = simulation.step();
      expect(result.events.some((event) => event.type === 'monster_leaked')).toBe(false);
    }
    expect(simulation.state.players.p1.hp).toBe(20);
  });

  it('matches the deterministic combat fixture hash', () => {
    const simulation = createCombatSimulation([
      createMonster(1, 500),
      createMonster(2, 2_000),
    ]);

    for (let tick = 0; tick < 20; tick += 1) {
      simulation.step();
    }

    expect(simulation.state.stateHash).toBe('f9f4e973fa6554a4');
  });
});
