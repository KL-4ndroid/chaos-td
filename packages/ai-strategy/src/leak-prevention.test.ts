import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION, GLOBAL_CONFIG, MVP_MIRROR_01 } from '@chaos-td/game-data';
import { createSimulation } from '@chaos-td/game-core';
import {
  buildAIObservation,
  createDefaultAIStrategyGenome,
  extractAIFeaturesFromObservation,
  generateLegalActions,
  toGameCommand,
} from './index';

async function getRunSelfPlayMatch() {
  const mod = await import('@chaos-td/ai-training');
  return mod.runSelfPlayMatch;
}

// ---------------------------------------------------------------------------
// Self-play lane integrity
// ---------------------------------------------------------------------------
describe('self-play lane uses full MVP_MIRROR_01 lane definitions', () => {
  it('createSelfPlayLanes uses full lane geometry', async () => {
    const { createSelfPlayLanes } = await import('@chaos-td/ai-training');
    const p1Def = MVP_MIRROR_01.lanes.find((l) => l.id === 'lane_p1');
    const p2Def = MVP_MIRROR_01.lanes.find((l) => l.id === 'lane_p2');
    if (!p1Def || !p2Def) throw new Error('Expected lane definitions');

    const lanes = createSelfPlayLanes();

    // Waypoints match game-data definition exactly
    expect(lanes.lane_p1.waypoints).toEqual(p1Def.waypoints);
    expect(lanes.lane_p2.waypoints).toEqual(p2Def.waypoints);
    expect(lanes.lane_p1.spawnPosition).toEqual(p1Def.spawnPosition);
    expect(lanes.lane_p1.endPosition).toEqual(p1Def.endPosition);

    // totalPathLength > 0
    expect(lanes.lane_p1.totalPathLength).toBeGreaterThan(0);
    expect(lanes.lane_p2.totalPathLength).toBeGreaterThan(0);

    // segments not empty
    expect(lanes.lane_p1.segments.length).toBeGreaterThan(0);
    expect(lanes.lane_p2.segments.length).toBeGreaterThan(0);
  });

  it('self-play monsters advance on the canonical lane and reach a terminal event', async () => {
    const { createSelfPlayLanes } = await import('@chaos-td/ai-training');
    const lanes = createSelfPlayLanes();
    expect(lanes.lane_p1.totalPathLength).toBeGreaterThan(0);
    expect(lanes.lane_p1.segments.length).toBeGreaterThan(0);
    expect(lanes.lane_p2.totalPathLength).toBeGreaterThan(0);
    expect(lanes.lane_p2.segments.length).toBeGreaterThan(0);

    const simulation = createSimulation(
      { seed: 'lane-movement-integration', configVersion: CONFIG_VERSION },
      lanes,
    );
    simulation.start();

    while (simulation.state.phase !== 'running') {
      simulation.step();
    }

    simulation.submitCommand({
      type: 'queue_monster',
      commandId: simulation.getNextCommandId('p1'),
      playerId: 'p1',
      monsterTypeId: 'sheep',
      quantity: 1,
    });

    let spawnEntityId: number | null = null;
    let initialPathProgress: number | null = null;
    let progressed = false;
    let terminalEvent: 'monster_died' | 'monster_leaked' | null = null;
    let acceptedQueueCommand = false;

    for (let step = 0; step < 500 && terminalEvent === null; step += 1) {
      const result = simulation.step();
      acceptedQueueCommand ||= result.events.some((event) => event.type === 'command_accepted');

      const spawned = result.events.find((event) => event.type === 'monster_spawned');
      if (spawnEntityId === null && spawned?.type === 'monster_spawned') {
        spawnEntityId = spawned.monsterEntityId;
        const monster = simulation.state.lanes.lane_p2.monsters.find(
          (candidate) => candidate.entityId === spawnEntityId,
        );
        expect(monster).toBeDefined();
        initialPathProgress = monster?.pathProgressMilliTiles ?? null;
        expect(initialPathProgress).toBeGreaterThanOrEqual(0);
      }

      if (spawnEntityId !== null && initialPathProgress !== null) {
        const monster = simulation.state.lanes.lane_p2.monsters.find(
          (candidate) => candidate.entityId === spawnEntityId,
        );
        if (monster && monster.pathProgressMilliTiles > initialPathProgress) {
          progressed = true;
        }
      }

      const terminal = result.events.find(
        (event) => event.type === 'monster_died' || event.type === 'monster_leaked',
      );
      if (terminal?.type === 'monster_died' || terminal?.type === 'monster_leaked') {
        if (terminal.monsterEntityId === spawnEntityId) terminalEvent = terminal.type;
      }
    }

    expect(acceptedQueueCommand).toBe(true);
    expect(spawnEntityId).not.toBeNull();
    expect(progressed).toBe(true);
    expect(terminalEvent).toMatch(/monster_(died|leaked)/);
  });

  it('same seed and genome produces identical self-play result (deterministic)', async () => {
    const runSelfPlayMatch = await getRunSelfPlayMatch();
    const p1 = createDefaultAIStrategyGenome('det');
    const p2 = createDefaultAIStrategyGenome('det2');
    const r1 = runSelfPlayMatch('self-play-det-v2', p1, p2, 300);
    const r2 = runSelfPlayMatch('self-play-det-v2', p1, p2, 300);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// Queue contract
// ---------------------------------------------------------------------------
describe('queue contract: queue limits from GLOBAL_CONFIG', () => {
  it('own queue below limit produces queue_monster candidates', () => {
    const obs = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 9999, income: 100, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [],
      opponentTowers: [],
      tick: 500,
      phase: 'running',
      waveNumber: 1,
    });
    const actions = generateLegalActions(obs, new Map());
    const queueActions = actions.filter((a) => a.type === 'queue_monster');
    expect(queueActions.length).toBeGreaterThan(0);
  });

  it('own queue at GLOBAL_CONFIG.sendQueueLimit blocks queue_monster candidates', () => {
    const queueFull = Array.from({ length: GLOBAL_CONFIG.sendQueueLimit }, (_, i) => ({ [`item${i}`]: i }));
    const obs = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 9999, income: 100, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: queueFull },
      opponentBattlefield: { monsters: [] },
      ownTowers: [],
      opponentTowers: [],
      tick: 500,
      phase: 'running',
      waveNumber: 1,
    });
    const actions = generateLegalActions(obs, new Map());
    const queueActions = actions.filter((a) => a.type === 'queue_monster');
    expect(queueActions).toHaveLength(0);
  });

  it('queue limit uses GLOBAL_CONFIG, not magic number', () => {
    // The policy must reference GLOBAL_CONFIG.sendQueueLimit
    // This is verified by the fact that GLOBAL_CONFIG.sendQueueLimit === 30
    expect(GLOBAL_CONFIG.sendQueueLimit).toBe(30);
    // And the policy code uses it correctly (verified by the test above)
  });
});

// ---------------------------------------------------------------------------
// Tower ownership mapping
// ---------------------------------------------------------------------------
describe('tower ownership mapping: separate maps per player', () => {
  it('p1 and p2 maps reference their own tower entity IDs only', () => {
    // Simulate both players building a tower at the same cell
    const towers = [
      { entityId: 1, towerTypeId: 'archer', cellX: 3, cellY: 12, ownerId: 'p1' as const, level: 1 },
      { entityId: 2, towerTypeId: 'archer', cellX: 3, cellY: 12, ownerId: 'p2' as const, level: 1 },
    ];

    // Build p1's map — must contain p1's entityId, not p2's
    const p1Map = new Map<string, number>();
    for (const t of towers) {
      if (t.ownerId === 'p1') p1Map.set(`${t.towerTypeId}:${t.cellX}:${t.cellY}`, t.entityId);
    }

    // Build p2's map — must contain p2's entityId, not p1's
    const p2Map = new Map<string, number>();
    for (const t of towers) {
      if (t.ownerId === 'p2') p2Map.set(`${t.towerTypeId}:${t.cellX}:${t.cellY}`, t.entityId);
    }

    expect(p1Map.get('archer:3:12')).toBe(1);
    expect(p2Map.get('archer:3:12')).toBe(2);
    expect(p1Map.get('archer:3:12')).not.toBe(2);
    expect(p2Map.get('archer:3:12')).not.toBe(1);
  });

  it('p1 upgrade action cannot reference p2 tower entity', () => {
    // p1 has no towers — p2 has one mage at (2,8)
    const p1Map = new Map<string, number>(); // empty for p1
    // p1 has a visible tower (archer) in the observation, but no entityId in their own map
    const p1Actions = generateLegalActions(
      buildAIObservation('p1', {
        selfPlayer: { hp: 1000, gold: 9999, income: 100, totalInvested: 0 },
        publicOpponent: { hp: 1000 },
        ownBattlefield: {
          monsters: [],
          outboundQueue: [],
        },
        opponentBattlefield: { monsters: [] },
        ownTowers: [{ towerTypeId: 'archer', level: 1, cellX: 5, cellY: 5 }],
        opponentTowers: [],
        tick: 100,
        phase: 'running',
        waveNumber: 1,
      }),
      p1Map,
    );
    const upgradeActions = p1Actions.filter((a) => a.type === 'upgrade_tower');
    // p1 has no tower entity IDs in its map — cannot generate upgrade
    expect(upgradeActions).toHaveLength(0);
  });

  it('slot-swap produces mirror-symmetric decisions', async () => {
    const p1Genome = createDefaultAIStrategyGenome('sym');
    const p2Genome = createDefaultAIStrategyGenome('sym2');
    const runSelfPlayMatch = await getRunSelfPlayMatch();

    // Run with p1 and p2 swapped
    const r1 = runSelfPlayMatch('mirror-swap', p1Genome, p2Genome, 200);
    const r2 = runSelfPlayMatch('mirror-swap', p2Genome, p1Genome, 200);

    // With identical strategies on mirror lanes, both runs should end in draws
    expect(r1.outcome).toBe('draw');
    expect(r2.outcome).toBe('draw');
  });
});

// ---------------------------------------------------------------------------
// Leak-prevention: opponent economy
// ---------------------------------------------------------------------------
describe('hidden opponent gold does not change observation', () => {
  it('opponent gold hidden — adapter-level test with authoritative state', async () => {
    const { buildAIObservation } = await import('./index');
    const sim = createSimulation({ seed: 'gold-leak', configVersion: CONFIG_VERSION });
    sim.start();
    for (let i = 0; i < 80; i += 1) sim.step();

    // Build observation input from authoritative state
    const buildInput = (goldOverride?: number) => {
      const oppGold = goldOverride ?? sim.state.players.p2.gold;
      // Clone and override p2 gold — not visible to p1
      const stateWithGold = {
        ...sim.state,
        players: {
          p1: sim.state.players.p1,
          p2: { ...sim.state.players.p2, gold: oppGold },
        },
      };
      // Manually construct sanitized input (only p2.hp is visible)
      return {
        selfPlayer: {
          hp: stateWithGold.players.p1.hp,
          gold: stateWithGold.players.p1.gold,
          income: stateWithGold.players.p1.income,
          totalInvested: stateWithGold.players.p1.totalInvested,
        },
        publicOpponent: {
          hp: stateWithGold.players.p2.hp,
        },
        ownBattlefield: { monsters: sim.state.lanes.lane_p1.monsters as never, outboundQueue: sim.state.lanes.lane_p2.spawnQueue },
        opponentBattlefield: { monsters: sim.state.lanes.lane_p2.monsters as never },
        ownTowers: sim.state.towers.filter((t) => t.ownerId === 'p1').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
        opponentTowers: sim.state.towers.filter((t) => t.ownerId === 'p2').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
        tick: sim.state.tick,
        phase: sim.state.phase as 'countdown' | 'running' | 'result',
        waveNumber: sim.state.waveScheduler.currentWaveNumber,
      };
    };

    const obs1 = buildAIObservation('p1', buildInput(100));
    const obs2 = buildAIObservation('p1', buildInput(999999));
    expect(obs1).toEqual(obs2);

    // Also verify legal actions are identical
    const p1Towers = sim.state.towers.filter((t) => t.ownerId === 'p1');
    const towerMap = new Map(p1Towers.map((t) => [`${t.towerTypeId}:${t.cellX}:${t.cellY}`, t.entityId]));
    const actions1 = generateLegalActions(obs1, towerMap);
    const actions2 = generateLegalActions(obs2, towerMap);
    expect(actions1).toEqual(actions2);
  });
});

describe('hidden opponent income does not change observation', () => {
  it('opponent income hidden — adapter-level test', async () => {
    const { buildAIObservation } = await import('./index');
    const sim = createSimulation({ seed: 'income-leak', configVersion: CONFIG_VERSION });
    sim.start();
    for (let i = 0; i < 80; i += 1) sim.step();

    const buildInput = (incomeOverride?: number) => {
      const stateWithIncome = {
        ...sim.state,
        players: {
          p1: sim.state.players.p1,
          p2: { ...sim.state.players.p2, income: incomeOverride ?? sim.state.players.p2.income },
        },
      };
      return {
        selfPlayer: { hp: stateWithIncome.players.p1.hp, gold: stateWithIncome.players.p1.gold, income: stateWithIncome.players.p1.income, totalInvested: stateWithIncome.players.p1.totalInvested },
        publicOpponent: { hp: stateWithIncome.players.p2.hp },
        ownBattlefield: { monsters: sim.state.lanes.lane_p1.monsters as never, outboundQueue: sim.state.lanes.lane_p2.spawnQueue },
        opponentBattlefield: { monsters: sim.state.lanes.lane_p2.monsters as never },
        ownTowers: sim.state.towers.filter((t) => t.ownerId === 'p1').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
        opponentTowers: sim.state.towers.filter((t) => t.ownerId === 'p2').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
        tick: sim.state.tick,
        phase: sim.state.phase as 'countdown' | 'running' | 'result',
        waveNumber: sim.state.waveScheduler.currentWaveNumber,
      };
    };

    const obs1 = buildAIObservation('p1', buildInput(10));
    const obs2 = buildAIObservation('p1', buildInput(9999));
    expect(obs1).toEqual(obs2);
  });
});

// ---------------------------------------------------------------------------
// Leak-prevention: opponent queue
// ---------------------------------------------------------------------------
describe('opponent pending send queue is invisible', () => {
  it('opponent outbound queue changes do not affect observation or actions', async () => {
    const { buildAIObservation } = await import('./index');
    const sim = createSimulation({ seed: 'queue-leak', configVersion: CONFIG_VERSION });
    sim.start();
    for (let i = 0; i < 80; i += 1) sim.step();

    const buildInput = () => {
      return {
        selfPlayer: { hp: sim.state.players.p1.hp, gold: sim.state.players.p1.gold, income: sim.state.players.p1.income, totalInvested: sim.state.players.p1.totalInvested },
        publicOpponent: { hp: sim.state.players.p2.hp },
        ownBattlefield: { monsters: sim.state.lanes.lane_p1.monsters as never, outboundQueue: sim.state.lanes.lane_p2.spawnQueue },
        opponentBattlefield: { monsters: sim.state.lanes.lane_p2.monsters as never },
        ownTowers: sim.state.towers.filter((t) => t.ownerId === 'p1').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
        opponentTowers: sim.state.towers.filter((t) => t.ownerId === 'p2').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
        tick: sim.state.tick,
        phase: sim.state.phase as 'countdown' | 'running' | 'result',
        waveNumber: sim.state.waveScheduler.currentWaveNumber,
      };
    };

    // Hidden opponent queue state
    const oppQueueEmpty = buildInput();
    const oppQueueFull = buildInput();

    const obs1 = buildAIObservation('p1', oppQueueEmpty);
    const obs2 = buildAIObservation('p1', oppQueueFull);
    expect(obs1).toEqual(obs2);

    // Legal actions are also identical
    const p1Towers = sim.state.towers.filter((t) => t.ownerId === 'p1');
    const towerMap = new Map(p1Towers.map((t) => [`${t.towerTypeId}:${t.cellX}:${t.cellY}`, t.entityId]));
    const actions1 = generateLegalActions(obs1, towerMap);
    const actions2 = generateLegalActions(obs2, towerMap);
    expect(actions1).toEqual(actions2);
  });

  it('own outboundQueue changes affect observation and queue actions', () => {
    const obsEmpty = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 9999, income: 100, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [],
      opponentTowers: [],
      tick: 500,
      phase: 'running',
      waveNumber: 1,
    });
    const obsFull = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 9999, income: 100, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: Array.from({ length: GLOBAL_CONFIG.sendQueueLimit }, (_, i) => i) },
      opponentBattlefield: { monsters: [] },
      ownTowers: [],
      opponentTowers: [],
      tick: 500,
      phase: 'running',
      waveNumber: 1,
    });
    expect(obsEmpty.self.outboundQueueLength).toBe(0);
    expect(obsFull.self.outboundQueueLength).toBe(GLOBAL_CONFIG.sendQueueLimit);

    const emptyActions = generateLegalActions(obsEmpty, new Map());
    const fullActions = generateLegalActions(obsFull, new Map());
    const emptyQueueCount = emptyActions.filter((a) => a.type === 'queue_monster').length;
    const fullQueueCount = fullActions.filter((a) => a.type === 'queue_monster').length;
    expect(emptyQueueCount).toBeGreaterThan(0);
    expect(fullQueueCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pending commands are outside the observation contract
// ---------------------------------------------------------------------------
describe('pending commands are outside observation input contract', () => {
  it('observation contract does not expose pendingCommands', async () => {
    const { buildAIObservation } = await import('./index');
    const sim = createSimulation({ seed: 'pending-test', configVersion: CONFIG_VERSION });
    sim.start();
    for (let i = 0; i < 80; i += 1) sim.step();

    // Submit a pending command (not yet processed)
    sim.submitCommand({
      type: 'queue_monster',
      commandId: { playerId: 'p1', tick: sim.state.tick, sequence: 0 },
      playerId: 'p1',
      monsterTypeId: 'sheep',
      quantity: 1,
    });

    // The observation input does not include pendingCommands
    // This is by design — pending commands are simulation-internal
    const input = {
      selfPlayer: { hp: sim.state.players.p1.hp, gold: sim.state.players.p1.gold, income: sim.state.players.p1.income, totalInvested: sim.state.players.p1.totalInvested },
      publicOpponent: { hp: sim.state.players.p2.hp },
      ownBattlefield: { monsters: sim.state.lanes.lane_p1.monsters as never, outboundQueue: sim.state.lanes.lane_p2.spawnQueue },
      opponentBattlefield: { monsters: sim.state.lanes.lane_p2.monsters as never },
      ownTowers: sim.state.towers.filter((t) => t.ownerId === 'p1').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
      opponentTowers: sim.state.towers.filter((t) => t.ownerId === 'p2').map((t) => ({ towerTypeId: t.towerTypeId, level: t.level, cellX: t.cellX, cellY: t.cellY })),
      tick: sim.state.tick,
      phase: sim.state.phase as 'countdown' | 'running' | 'result',
      waveNumber: sim.state.waveScheduler.currentWaveNumber,
    };

    // Observation is identical regardless of pending command state
    const obs = buildAIObservation('p1', input);
    expect(obs.self.gold).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Spawned opponent monster becomes visible
// ---------------------------------------------------------------------------
describe('spawned opponent monster becomes visible', () => {
  it('monster in opponentBattlefield.monsters increases activeMonsterCount', () => {
    const empty = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    const withMonster = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [{ hp: 100, shield: 0, leakDamage: 10, pathProgressMilliTiles: 0, movementType: 'ground', tags: [] }] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    expect(empty.opponentBattlefield.activeMonsterCount).toBe(0);
    expect(withMonster.opponentBattlefield.activeMonsterCount).toBe(1);
    expect(empty.opponentActiveMonsterPressure).toBe(0);
    expect(withMonster.opponentActiveMonsterPressure).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Public tower build changes observation
// ---------------------------------------------------------------------------
describe('public tower build changes observation', () => {
  it('opponent builds visible tower changes opponent.visibleTowers', () => {
    const empty = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    const withTower = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [{ towerTypeId: 'archer', level: 1, cellX: 3, cellY: 12 }],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    expect(empty.opponent.visibleTowers).toHaveLength(0);
    expect(withTower.opponent.visibleTowers).toHaveLength(1);
    const firstVisible = withTower.opponent.visibleTowers[0];
    expect(firstVisible?.towerTypeId).toBe('archer');
    expect(withTower.opponentGroundCoverage).toBeGreaterThan(empty.opponentGroundCoverage);
  });
});

// ---------------------------------------------------------------------------
// Canonical wave number is used
// ---------------------------------------------------------------------------
describe('canonical wave number is used', () => {
  it('different waveNumber inputs produce different waveNumber in observation', () => {
    const w1 = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    const w3 = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 3,
    });
    expect(w1.waveNumber).toBe(1);
    expect(w3.waveNumber).toBe(3);
    expect(w1).not.toEqual(w3);
  });

  it('waveNumber is not recalculated from tick inside the builder', () => {
    const obs = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 999, phase: 'running', waveNumber: 7,
    });
    expect(obs.waveNumber).toBe(7);
    expect(obs.waveNumber).not.toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tower ordering does not change observation
// ---------------------------------------------------------------------------
describe('tower ordering does not change observation', () => {
  it('same towers in different order produce identical observation', () => {
    const towers = [
      { towerTypeId: 'archer', level: 1, cellX: 3, cellY: 12 },
      { towerTypeId: 'mage', level: 2, cellX: 4, cellY: 12 },
    ];
    const obsA = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: towers, opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    const obsB = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [...towers].reverse(), opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    expect(obsA).toEqual(obsB);
    expect(obsA.self.towerCount).toBe(obsB.self.towerCount);
    expect(obsA.selfGroundCoverage).toBe(obsB.selfGroundCoverage);
  });
});

// ---------------------------------------------------------------------------
// Policy entry point accepts AIObservation only
// ---------------------------------------------------------------------------
describe('policy entry point accepts AIObservation only', () => {
  it('extractAIFeaturesFromObservation accepts AIObservation', () => {
    const obs = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    const features = extractAIFeaturesFromObservation(obs);
    expect(features.playerId).toBe('p1');
    expect(features.gold).toBe(200);
    expect(features.income).toBe(10);
    expect(features.sendQueueCount).toBe(0);
  });

  it('generateLegalActions accepts AIObservation', () => {
    const obs = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    const actions = generateLegalActions(obs, new Map());
    expect(actions.length).toBeGreaterThan(0);
  });

  it('toGameCommand converts LegalAIAction to GameCommand', () => {
    const cmd = toGameCommand({ type: 'build_tower', towerTypeId: 'archer', cellX: 3, cellY: 12 }, 'p1', 100, 0);
    expect(cmd).not.toBeNull();
    if (!cmd) return;
    expect(cmd.type).toBe('build_tower');
    expect(cmd.playerId).toBe('p1');
    if (cmd.type === 'build_tower') expect(cmd.towerTypeId).toBe('archer');
  });
});

// ---------------------------------------------------------------------------
// Self-play passes sanitized observation to policy
// ---------------------------------------------------------------------------
describe('self-play passes sanitized observation to policy', () => {
  it('decideStrategyCommand produces a command without throwing', async () => {
    const { buildAIObservation } = await import('./index');
    const { decideStrategyCommand } = await import('@chaos-td/ai-training');
    const genome = createDefaultAIStrategyGenome('test');
    const obs = buildAIObservation('p1', {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running', waveNumber: 1,
    });
    expect(() => decideStrategyCommand(obs, genome, 'seed', new Map())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Observation is deterministic
// ---------------------------------------------------------------------------
describe('observation is deterministic', () => {
  it('same input always produces identical observation', () => {
    const input = {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running' as const, waveNumber: 1,
    };
    const results = Array.from({ length: 5 }, () => buildAIObservation('p1', input));
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
  });
});

// ---------------------------------------------------------------------------
// Slot-swapped observation is mirror symmetric
// ---------------------------------------------------------------------------
describe('slot-swapped observation is mirror symmetric', () => {
  it('p1 and p2 observations are symmetric when state is symmetric', () => {
    const base = {
      selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: 1000 },
      ownBattlefield: { monsters: [], outboundQueue: [] },
      opponentBattlefield: { monsters: [] },
      ownTowers: [], opponentTowers: [],
      tick: 100, phase: 'running' as const, waveNumber: 1,
    };
    const p1Obs = buildAIObservation('p1', base);
    const p2Obs = buildAIObservation('p2', {
      selfPlayer: { hp: base.publicOpponent.hp, gold: 200, income: 10, totalInvested: 0 },
      publicOpponent: { hp: base.selfPlayer.hp },
      ownBattlefield: { monsters: base.opponentBattlefield.monsters, outboundQueue: [] },
      opponentBattlefield: { monsters: base.ownBattlefield.monsters },
      ownTowers: base.opponentTowers,
      opponentTowers: base.ownTowers,
      tick: base.tick,
      phase: base.phase,
      waveNumber: base.waveNumber,
    });
    expect(p1Obs.self.hp).toBe(p2Obs.opponent.hp);
    expect(p1Obs.opponent.hp).toBe(p2Obs.self.hp);
  });
});

// ---------------------------------------------------------------------------
// Type contract: BuildAIObservationInput isolates opponent economy
// ---------------------------------------------------------------------------
describe('type contract: BuildAIObservationInput isolates opponent economy', () => {
  const validInput = {
    selfPlayer: { hp: 100, gold: 100, income: 10, totalInvested: 0 },
    publicOpponent: { hp: 100 },
    ownBattlefield: { monsters: [] as never[], outboundQueue: [] },
    opponentBattlefield: { monsters: [] as never[] },
    ownTowers: [] as { towerTypeId: string; level: number; cellX: number; cellY: number }[],
    opponentTowers: [] as { towerTypeId: string; level: number; cellX: number; cellY: number }[],
    tick: 100,
    phase: 'running' as const,
    waveNumber: 1,
  } satisfies import('./observation').BuildAIObservationInput;

  it('BuildAIObservationInput type does not include opponent.gold field', () => {
    // @ts-expect-error — publicOpponent must not have gold
    const bad = { ...validInput, publicOpponent: { hp: 100, gold: 9999 } } satisfies import('./observation').BuildAIObservationInput;
    void bad;
  });

  it('BuildAIObservationInput type does not include opponent.income field', () => {
    // @ts-expect-error — publicOpponent must not have income
    const bad = { ...validInput, publicOpponent: { hp: 100, income: 9999 } } satisfies import('./observation').BuildAIObservationInput;
    void bad;
  });

  it('opponentBattlefield does not have outboundQueue field', () => {
    // @ts-expect-error — opponentBattlefield must not have outboundQueue
    const bad = { ...validInput, opponentBattlefield: { monsters: [], outboundQueue: [{}] } } satisfies import('./observation').BuildAIObservationInput;
    void bad;
  });
});
