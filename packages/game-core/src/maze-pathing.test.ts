import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, MVP_MIRROR_01, type LaneDefinition, type LaneId } from '@chaos-td/game-data';
import { createPathSegments } from './movement';
import {
  calculateMonsterPosition,
  createSimulation,
  type LaneRuntimeState,
  type MonsterRuntimeState,
  type Simulation,
} from './simulation';

function createLane(definition: LaneDefinition): LaneRuntimeState {
  const segments = createPathSegments(definition.waypoints);
  return {
    laneId: definition.id,
    battlefieldId: definition.id,
    defenderId: definition.defenderPlayerId,
    attackerId: definition.attackerPlayerId,
    waypoints: definition.waypoints,
    spawnPosition: definition.spawnPosition,
    endPosition: definition.endPosition,
    segments,
    totalPathLength: segments.reduce((total, segment) => total + segment.lengthMilliTiles, 0),
    spawnQueue: [],
    monsters: [],
    pendingLeaks: [],
    spawnCooldownTicks: 0,
  };
}

function createRunningSimulation(): Simulation {
  const lanes = Object.fromEntries(
    MVP_MIRROR_01.lanes.map((lane) => [lane.id, createLane(lane)]),
  ) as Record<LaneId, LaneRuntimeState>;
  const simulation = createSimulation({ seed: 'maze-pathing', configVersion: CONFIG_VERSION }, lanes);
  simulation.start();
  for (let tick = 0; tick < 60; tick += 1) simulation.step();
  simulation.state.players.p1.gold = 10_000;
  return simulation;
}

function build(simulation: Simulation, cellX: number, cellY: number) {
  simulation.submitCommand({
    type: 'build_tower',
    commandId: simulation.getNextCommandId('p1'),
    playerId: 'p1',
    towerTypeId: 'archer',
    cellX,
    cellY,
  });
  return simulation.step();
}

describe('tower maze pathing', () => {
  it('reroutes the lane when a tower occupies a navigation cell', () => {
    const simulation = createRunningSimulation();
    const originalLength = simulation.state.lanes.lane_p1.totalPathLength;

    const result = build(simulation, 3, 15);

    expect(result.events.some((event) => event.type === 'tower_built')).toBe(true);
    expect(result.state.lanes.lane_p1.totalPathLength).toBeGreaterThan(originalLength);
  });

  it('keeps an active monster at its current position when the lane reroutes', () => {
    const simulation = createRunningSimulation();
    const lane = simulation.state.lanes.lane_p1;
    const monster: MonsterRuntimeState = {
      entityId: 99,
      source: { type: 'player', playerId: 'p2' },
      battlefieldId: 'lane_p1',
      monsterTypeId: 'sheep',
      hp: 100,
      shield: 0,
      armorPermille: 0,
      segmentIndex: 0,
      distanceOnSegmentMilliTiles: 2500,
      pathProgressMilliTiles: 2500,
      speedMilliTilesPerTick: 0,
      leakDamage: 1,
      movementType: 'ground',
      tags: [],
      routeWaypoints: lane.waypoints,
      routeSegments: lane.segments,
      routeTotalPathLength: lane.totalPathLength,
    };
    lane.monsters.push(monster);
    const before = calculateMonsterPosition(lane, monster);

    build(simulation, 3, 15);

    const reroutedLane = simulation.state.lanes.lane_p1;
    const reroutedMonster = reroutedLane.monsters[0];
    expect(reroutedMonster).toBeDefined();
    if (!reroutedMonster) return;
    const after = calculateMonsterPosition(reroutedLane, reroutedMonster);
    expect({ x: after.x, y: after.y }).toEqual({ x: before.x, y: before.y });
  });

  it('moves only by rule speed on the tick that an active monster reroutes', () => {
    const simulation = createRunningSimulation();
    const lane = simulation.state.lanes.lane_p1;
    const monster: MonsterRuntimeState = {
      entityId: 99,
      source: { type: 'player', playerId: 'p2' },
      battlefieldId: 'lane_p1',
      monsterTypeId: 'sheep',
      hp: 100,
      shield: 0,
      armorPermille: 0,
      segmentIndex: 0,
      distanceOnSegmentMilliTiles: 2500,
      pathProgressMilliTiles: 2500,
      speedMilliTilesPerTick: 100,
      leakDamage: 1,
      movementType: 'ground',
      tags: [],
      routeWaypoints: lane.waypoints,
      routeSegments: lane.segments,
      routeTotalPathLength: lane.totalPathLength,
    };
    lane.monsters.push(monster);
    const before = calculateMonsterPosition(lane, monster);

    build(simulation, 3, 15);

    const reroutedLane = simulation.state.lanes.lane_p1;
    const reroutedMonster = reroutedLane.monsters[0];
    expect(reroutedMonster).toBeDefined();
    if (!reroutedMonster) return;
    const after = calculateMonsterPosition(reroutedLane, reroutedMonster);
    const movement = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
    expect(movement).toBe(100);
    expect(after.x).toBeGreaterThanOrEqual(500);
    expect(after.x).toBeLessThanOrEqual(7500);
    expect(after.y).toBeGreaterThanOrEqual(11_500);
    expect(after.y).toBeLessThanOrEqual(20_500);
  });

  it('keeps active monsters inside their lane through successive reroutes', () => {
    const simulation = createRunningSimulation();
    const lane = simulation.state.lanes.lane_p1;
    lane.monsters.push({
      entityId: 99,
      source: { type: 'player', playerId: 'p2' },
      battlefieldId: 'lane_p1',
      monsterTypeId: 'sheep',
      hp: 10_000,
      shield: 0,
      armorPermille: 0,
      segmentIndex: 0,
      distanceOnSegmentMilliTiles: 3200,
      pathProgressMilliTiles: 3200,
      speedMilliTilesPerTick: 100,
      leakDamage: 1,
      movementType: 'ground',
      tags: [],
      routeWaypoints: lane.waypoints,
      routeSegments: lane.segments,
      routeTotalPathLength: lane.totalPathLength,
    });

    for (const [cellX, cellY] of [[3, 15], [4, 15], [2, 15], [5, 15]] as const) {
      const beforeMonster = simulation.state.lanes.lane_p1.monsters[0];
      expect(beforeMonster).toBeDefined();
      if (!beforeMonster) return;
      const before = calculateMonsterPosition(simulation.state.lanes.lane_p1, beforeMonster);
      const result = build(simulation, cellX, cellY);
      expect(result.events.some((event) => event.type === 'tower_built')).toBe(true);
      const afterMonster = result.state.lanes.lane_p1.monsters[0];
      expect(afterMonster).toBeDefined();
      if (!afterMonster) return;
      const after = calculateMonsterPosition(result.state.lanes.lane_p1, afterMonster);
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBe(100);
      expect(after.x).toBeGreaterThanOrEqual(500);
      expect(after.x).toBeLessThanOrEqual(7500);
      expect(after.y).toBeGreaterThanOrEqual(11_500);
      expect(after.y).toBeLessThanOrEqual(20_500);
    }
  });

  it('includes rerouted monster waypoints in the canonical state', () => {
    const simulation = createRunningSimulation();
    const lane = simulation.state.lanes.lane_p1;
    lane.monsters.push({
      entityId: 99,
      source: { type: 'player', playerId: 'p2' },
      battlefieldId: 'lane_p1',
      monsterTypeId: 'sheep',
      hp: 100,
      shield: 0,
      armorPermille: 0,
      segmentIndex: 0,
      distanceOnSegmentMilliTiles: 2500,
      pathProgressMilliTiles: 2500,
      speedMilliTilesPerTick: 0,
      leakDamage: 1,
      movementType: 'ground',
      tags: [],
      routeWaypoints: lane.waypoints,
      routeSegments: lane.segments,
      routeTotalPathLength: lane.totalPathLength,
    });

    build(simulation, 3, 15);

    expect(simulation.getCanonicalState().monsters[0]?.routeWaypoints).toEqual(
      simulation.state.lanes.lane_p1.monsters[0]?.routeWaypoints,
    );
  });

  it('rejects the final tower that would completely seal the route', () => {
    const simulation = createRunningSimulation();
    for (let col = 0; col < 7; col += 1) {
      expect(build(simulation, col, 15).events.some((event) => event.type === 'tower_built')).toBe(true);
    }
    const goldBefore = simulation.state.players.p1.gold;

    const result = build(simulation, 7, 15);

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'command_rejected',
      reason: 'path_blocked',
    }));
    expect(result.state.towers).toHaveLength(7);
    expect(result.state.players.p1.gold).toBe(goldBefore);
  });

  it('rejects cells outside the defending player navigation area', () => {
    const simulation = createRunningSimulation();

    const result = build(simulation, 3, 5);

    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'command_rejected',
      reason: 'invalid_cell',
    }));
    expect(result.state.towers).toHaveLength(0);
  });
});
