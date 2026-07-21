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
    armorPermille: 0,
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

    expect(simulation.state.stateHash).toBe('8f2931f1db7af2c4');
  });
});

// Helper functions for M3-003 tests (module scope for sharing across describe blocks)
function createTreant(entityId: number, pathProgressMilliTiles: number): MonsterRuntimeState {
  return {
    entityId,
    ownerId: 'p2',
    monsterTypeId: 'treant',
    hp: 390,
    shield: 0,
    armorPermille: 220, // 22% damage reduction
    segmentIndex: 0,
    distanceOnSegmentMilliTiles: pathProgressMilliTiles,
    pathProgressMilliTiles,
    speedMilliTilesPerTick: 28,
    leakDamage: 2,
  };
}

function createGhost(entityId: number, pathProgressMilliTiles: number): MonsterRuntimeState {
  return {
    entityId,
    ownerId: 'p2',
    monsterTypeId: 'ghost',
    hp: 215,
    shield: 95, // Shield absorbs damage
    armorPermille: 0,
    segmentIndex: 0,
    distanceOnSegmentMilliTiles: pathProgressMilliTiles,
    pathProgressMilliTiles,
    speedMilliTilesPerTick: 44,
    leakDamage: 2,
  };
}

describe('M3-003 Advanced Combat Mechanics', () => {
  it('armor reduces damage by correct percentage', () => {
    // Treant has 220 permille armor = 22% reduction
    // Archer base damage = 18
    // Expected: max(1, floor(18 * (1000 - 220) / 1000)) = max(1, floor(14.04)) = 14
    const simulation = createCombatSimulation([createTreant(1, 1_000)]);

    const result = simulation.step();

    // HP should be 390 - 14 = 376
    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(376);
  });

  it('shield absorbs damage before HP', () => {
    // Ghost has 95 shield, archer damage is 18
    // Shield should absorb all damage, HP unchanged
    const simulation = createCombatSimulation([createGhost(1, 1_000)]);

    const result = simulation.step();

    // HP should still be 215 (shield absorbed 18 damage)
    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(215);
    expect(result.state.lanes.lane_p1.monsters[0]?.shield).toBe(77); // 95 - 18 = 77
  });

  it('shield depletes before HP takes damage', () => {
    // Ghost has 95 shield. The archer has cooldown of 13 ticks.
    // We need to wait for attacks to happen and check shield/HP changes.
    const simulation = createCombatSimulation([createGhost(1, 1_000)]);

    // Attack 1: shield 95 -> 77
    let result = simulation.step();
    expect(result.state.lanes.lane_p1.monsters[0]?.shield).toBe(77);
    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(215);

    // Advance to next attack (cooldown = 13 ticks)
    for (let i = 0; i < 12; i++) {
      simulation.step();
    }

    // Attack 2: shield 77 -> 59
    result = simulation.step();
    expect(result.state.lanes.lane_p1.monsters[0]?.shield).toBe(59);
    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(215);
  });

  it('monster without armor takes full damage', () => {
    // Sheep has 0 armor, should take full 18 damage
    const simulation = createCombatSimulation([createMonster(1, 1_000)]);

    const result = simulation.step();

    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(67); // 85 - 18 = 67
  });

  it('armor caps at 80% reduction', () => {
    // Even with very high armor, max reduction is 80%
    // Create a monster with 900 permille armor (90%)
    const tankyMonster: MonsterRuntimeState = {
      entityId: 1,
      ownerId: 'p2',
      monsterTypeId: 'treant',
      hp: 390,
      shield: 0,
      armorPermille: 900, // 90% armor, but capped at 80%
      segmentIndex: 0,
      distanceOnSegmentMilliTiles: 1_000,
      pathProgressMilliTiles: 1_000,
      speedMilliTilesPerTick: 28,
      leakDamage: 2,
    };
    const simulation = createCombatSimulation([tankyMonster]);

    const result = simulation.step();

    // With 80% cap: max(1, floor(18 * (1000 - 800) / 1000)) = max(1, floor(3.6)) = 3
    expect(result.state.lanes.lane_p1.monsters[0]?.hp).toBe(387); // 390 - 3 = 387
  });
});

describe('M3-003 Splash and Slow Mechanics', () => {
  function createMageTower(cellX = 0, cellY = 0): ReturnType<typeof createTowerState> {
    return createTowerState(100, 'p1', 'mage', cellX, cellY);
  }

  function createFrostTower(cellX = 0, cellY = 0): ReturnType<typeof createTowerState> {
    return createTowerState(100, 'p1', 'frost', cellX, cellY);
  }

  function createMageSimulation(
    monsters: MonsterRuntimeState[],
    towerCellX = 0,
    towerCellY = 0,
  ) {
    const lanes = {
      lane_p1: createLane(monsters),
      lane_p2: createEmptyLane('lane_p2'),
    };
    const tower = createMageTower(towerCellX, towerCellY);
    const simulation = createSimulation(CONFIG, lanes, [tower]);
    simulation.start();
    for (let tick = 0; tick < 60; tick += 1) {
      simulation.step();
    }
    return simulation;
  }

  function createFrostSimulation(
    monsters: MonsterRuntimeState[],
    towerCellX = 0,
    towerCellY = 0,
  ) {
    const lanes = {
      lane_p1: createLane(monsters),
      lane_p2: createEmptyLane('lane_p2'),
    };
    const tower = createFrostTower(towerCellX, towerCellY);
    const simulation = createSimulation(CONFIG, lanes, [tower]);
    simulation.start();
    for (let tick = 0; tick < 60; tick += 1) {
      simulation.step();
    }
    return simulation;
  }

  it('mage tower deals splash damage to nearby monsters', () => {
    // Two sheep at positions 500 and 600 (within 750 milli-tiles radius)
    const simulation = createMageSimulation([
      createMonster(1, 500),
      createMonster(2, 600), // Within splash radius
    ]);

    const result = simulation.step();

    // Both monsters should take damage (main + splash)
    const monster1 = result.state.lanes.lane_p1.monsters.find((m) => m.entityId === 1);
    const monster2 = result.state.lanes.lane_p1.monsters.find((m) => m.entityId === 2);

    // Both should be damaged
    expect(monster1?.hp).toBeLessThan(85);
    expect(monster2?.hp).toBeLessThan(85);
  });

  it('mage splash damage applies to armor', () => {
    // Treant has armor that reduces damage
    const simulation = createMageSimulation([createTreant(1, 500)]);

    const result = simulation.step();
    const treant = result.state.lanes.lane_p1.monsters.find((m) => m.entityId === 1);

    // Treant should take some damage due to mage attack
    // The exact amount depends on armor, but it should be reduced
    expect(treant?.hp).toBeLessThan(390);
  });

  it('frost tower applies slow effect', () => {
    const simulation = createFrostSimulation([createMonster(1, 500)]);

    const result = simulation.step();

    // The slow_applied event should be emitted
    const slowEvents = result.events.filter((e) => e.type === 'slow_applied');
    expect(slowEvents.length).toBeGreaterThan(0);
  });

  it('slow effect reduces monster speed', () => {
    const simulation = createFrostSimulation([createMonster(1, 500)]);

    // Apply slow
    simulation.step();

    // Monster should now have slowPermille set
    const monster = simulation.state.lanes.lane_p1.monsters[0];
    expect(monster?.slowPermille).toBeDefined();
    expect(monster?.slowPermille).toBeGreaterThan(0);
  });

  it('frost tower does not slow out-of-range monsters', () => {
    // Monster at position 5000 (out of frost range ~2700)
    const simulation = createFrostSimulation([createMonster(1, 5_000)]);

    const result = simulation.step();

    // No slow_applied event should be emitted
    const slowEvents = result.events.filter((e) => e.type === 'slow_applied');
    expect(slowEvents.length).toBe(0);
  });
});
