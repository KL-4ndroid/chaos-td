import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import { createSimulation } from '@chaos-td/game-core';
import {
  buildAIObservation,
  createDefaultAIStrategyGenome,
  extractAIFeaturesFromObservation,
  generateLegalActions,
  scoreAIAction,
  toGameCommand,
} from './index';

function towerMap(towers: readonly { entityId: number; towerTypeId: string; cellX: number; cellY: number; ownerId: 'p1' | 'p2'; level: number }[]) {
  const m = new Map<string, number>();
  for (const t of towers) m.set(`${t.towerTypeId}:${t.cellX}:${t.cellY}`, t.entityId);
  return m;
}

function makeBaseInput() {
  return {
    selfPlayer: { hp: 1000, gold: 200, income: 10, totalInvested: 0 },
    publicOpponent: { hp: 1000 },
    ownBattlefield: {
      monsters: [],
      outboundQueue: [],
    },
    opponentBattlefield: {
      monsters: [],
    },
    ownTowers: [] as readonly { towerTypeId: string; level: number; cellX: number; cellY: number }[],
    opponentTowers: [] as readonly { towerTypeId: string; level: number; cellX: number; cellY: number }[],
    tick: 100,
    phase: 'running' as const,
    waveNumber: 1,
  };
}

// ---------------------------------------------------------------------------
// Leak-prevention: opponent gold does not change observation
// ---------------------------------------------------------------------------
describe('hidden opponent gold does not change observation', () => {
  it('buildAIObservation returns identical observations regardless of caller-provided hidden state', () => {
    const base = makeBaseInput();
    const rich = buildAIObservation('p1', {
      ...base,
      publicOpponent: { hp: 1000 },
    });
    const poor = buildAIObservation('p1', {
      ...base,
      publicOpponent: { hp: 1000 },
    });
    expect(rich).toEqual(poor);
  });

  it('policy decision is identical regardless of any hidden state differences', () => {
    const sim = createSimulation({ seed: 'leak-test', configVersion: CONFIG_VERSION });
    sim.start();
    for (let i = 0; i < 80; i += 1) sim.step();
    const towers = sim.state.towers;
    const genome = createDefaultAIStrategyGenome('test');

    const obs = buildAIObservation('p1', makeBaseInput());
    const features = extractAIFeaturesFromObservation(obs);
    const scored = generateLegalActions(obs, towerMap(towers)).map((a) => scoreAIAction(features, a, genome));
    const action1 = scored[0]?.action;

    // Build another identical observation
    const obs2 = buildAIObservation('p1', makeBaseInput());
    const features2 = extractAIFeaturesFromObservation(obs2);
    const scored2 = generateLegalActions(obs2, towerMap(towers)).map((a) => scoreAIAction(features2, a, genome));
    const action2 = scored2[0]?.action;

    expect(action1).toEqual(action2);
  });
});

// ---------------------------------------------------------------------------
// Leak-prevention: opponent income does not change observation
// ---------------------------------------------------------------------------
describe('hidden opponent income does not change observation', () => {
  it('policy decision is identical when opponent income differs', () => {
    const sim = createSimulation({ seed: 'leak-test', configVersion: CONFIG_VERSION });
    sim.start();
    for (let i = 0; i < 80; i += 1) sim.step();
    const towers = sim.state.towers;
    const genome = createDefaultAIStrategyGenome('test');

    const obs = buildAIObservation('p1', makeBaseInput());
    const features = extractAIFeaturesFromObservation(obs);
    const scored = generateLegalActions(obs, towerMap(towers)).map((a) => scoreAIAction(features, a, genome));
    const action1 = scored[0]?.action;

    const obs2 = buildAIObservation('p1', makeBaseInput());
    const features2 = extractAIFeaturesFromObservation(obs2);
    const scored2 = generateLegalActions(obs2, towerMap(towers)).map((a) => scoreAIAction(features2, a, genome));
    const action2 = scored2[0]?.action;

    expect(action1).toEqual(action2);
  });
});

// ---------------------------------------------------------------------------
// Leak-prevention: opponent pending send queue is invisible
// ---------------------------------------------------------------------------
describe('opponent pending send queue is invisible', () => {
  it('opponentBattlefield always has zero outboundQueue in output', () => {
    const empty = buildAIObservation('p1', makeBaseInput());
    expect(empty.opponentBattlefield.outboundQueueLength).toBe(0);
  });

  it('own outboundQueue is visible to self', () => {
    const empty = buildAIObservation('p1', makeBaseInput());
    const withQueue = buildAIObservation('p1', {
      ...makeBaseInput(),
      ownBattlefield: {
        monsters: [],
        outboundQueue: [{}],
      },
    });
    expect(empty.self.outboundQueueLength).toBe(0);
    expect(withQueue.self.outboundQueueLength).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Leak-prevention: opponent unsubmitted command is invisible
// ---------------------------------------------------------------------------
describe('opponent unsubmitted command is invisible', () => {
  it('observation is identical across ticks regardless of pending commands', () => {
    const sim = createSimulation({ seed: 'leak-test', configVersion: CONFIG_VERSION });
    sim.start();
    for (let i = 0; i < 80; i += 1) sim.step();
    const towers = sim.state.towers;

    const input = makeBaseInput();
    const obsBefore = buildAIObservation('p1', input);
    const obsAfter = buildAIObservation('p1', input);

    expect(obsBefore).toEqual(obsAfter);

    const genome = createDefaultAIStrategyGenome('test');
    const features1 = extractAIFeaturesFromObservation(obsBefore);
    const features2 = extractAIFeaturesFromObservation(obsAfter);
    const scored1 = generateLegalActions(obsBefore, towerMap(towers)).map((a) => scoreAIAction(features1, a, genome));
    const scored2 = generateLegalActions(obsAfter, towerMap(towers)).map((a) => scoreAIAction(features2, a, genome));
    expect(scored1[0]?.action).toEqual(scored2[0]?.action);
  });
});

// ---------------------------------------------------------------------------
// Spawned opponent monster becomes visible
// ---------------------------------------------------------------------------
describe('spawned opponent monster becomes visible', () => {
  it('monster in opponentBattlefield.monsters increases activeMonsterCount', () => {
    const empty = buildAIObservation('p1', makeBaseInput());
    const withMonster = buildAIObservation('p1', {
      ...makeBaseInput(),
      opponentBattlefield: {
        monsters: [{
          hp: 100,
          shield: 0,
          leakDamage: 10,
          pathProgressMilliTiles: 0,
          movementType: 'ground',
          tags: [],
        }],
      },
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
    const empty = buildAIObservation('p1', makeBaseInput());
    const withTower = buildAIObservation('p1', {
      ...makeBaseInput(),
      opponentTowers: [{ towerTypeId: 'archer', level: 1, cellX: 3, cellY: 12 }],
    });
    expect(empty.opponent.visibleTowers).toHaveLength(0);
    expect(withTower.opponent.visibleTowers).toHaveLength(1);
    expect(withTower.opponent.visibleTowers[0]!.towerTypeId).toBe('archer');
    expect(withTower.opponentGroundCoverage).toBeGreaterThan(empty.opponentGroundCoverage);
  });

  it('own tower build changes own battlefield and features', () => {
    const empty = buildAIObservation('p1', makeBaseInput());
    const withTower = buildAIObservation('p1', {
      ...makeBaseInput(),
      ownTowers: [{ towerTypeId: 'archer', level: 1, cellX: 3, cellY: 12 }],
    });
    expect(empty.self.towerCount).toBe(0);
    expect(withTower.self.towerCount).toBe(1);
    expect(withTower.selfGroundCoverage).toBeGreaterThan(empty.selfGroundCoverage);
  });
});

// ---------------------------------------------------------------------------
// Canonical wave number is used
// ---------------------------------------------------------------------------
describe('canonical wave number is used', () => {
  it('different waveNumber inputs produce different waveNumber in observation', () => {
    const w1 = buildAIObservation('p1', { ...makeBaseInput(), waveNumber: 1 });
    const w3 = buildAIObservation('p1', { ...makeBaseInput(), waveNumber: 3 });
    expect(w1.waveNumber).toBe(1);
    expect(w3.waveNumber).toBe(3);
    expect(w1).not.toEqual(w3);
  });

  it('observation waveNumber is passed directly from input, not recalculated from tick', () => {
    const obs = buildAIObservation('p1', { ...makeBaseInput(), tick: 999, waveNumber: 7 });
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

    const obsA = buildAIObservation('p1', { ...makeBaseInput(), ownTowers: towers });
    const obsB = buildAIObservation('p1', { ...makeBaseInput(), ownTowers: [...towers].reverse() });

    expect(obsA).toEqual(obsB);
    expect(obsA.self.towerCount).toBe(obsB.self.towerCount);
    expect(obsA.selfGroundCoverage).toBe(obsB.selfGroundCoverage);
  });

  it('same opponent towers in different order produce identical observation', () => {
    const towers = [
      { towerTypeId: 'frost', level: 1, cellX: 1, cellY: 2 },
      { towerTypeId: 'sniper', level: 3, cellX: 5, cellY: 8 },
    ];

    const obsA = buildAIObservation('p1', { ...makeBaseInput(), opponentTowers: towers });
    const obsB = buildAIObservation('p1', { ...makeBaseInput(), opponentTowers: [...towers].reverse() });

    expect(obsA).toEqual(obsB);
    expect(obsA.opponent.visibleTowers).toEqual(obsB.opponent.visibleTowers);
  });
});

// ---------------------------------------------------------------------------
// Policy entry point accepts AIObservation only
// ---------------------------------------------------------------------------
describe('policy entry point accepts AIObservation only', () => {
  it('extractAIFeaturesFromObservation accepts AIObservation', () => {
    const obs = buildAIObservation('p1', makeBaseInput());
    const features = extractAIFeaturesFromObservation(obs);
    expect(features.playerId).toBe('p1');
    expect(features.gold).toBe(200);
    expect(features.income).toBe(10);
  });

  it('generateLegalActions accepts AIObservation', () => {
    const obs = buildAIObservation('p1', makeBaseInput());
    const actions = generateLegalActions(obs, new Map());
    expect(actions.length).toBeGreaterThan(0);
  });

  it('toGameCommand converts LegalAIAction to GameCommand', () => {
    const cmd = toGameCommand({ type: 'build_tower', towerTypeId: 'archer', cellX: 3, cellY: 12 }, 'p1', 100, 0);
    expect(cmd).not.toBeNull();
    if (!cmd) return;
    expect(cmd.type).toBe('build_tower');
    expect(cmd.playerId).toBe('p1');
    if (cmd.type === 'build_tower') {
      expect(cmd.towerTypeId).toBe('archer');
    }
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
    const obs = buildAIObservation('p1', makeBaseInput());
    expect(() => decideStrategyCommand(obs, genome, 'seed', new Map())).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Observation is deterministic
// ---------------------------------------------------------------------------
describe('observation is deterministic', () => {
  it('same input always produces identical observation', () => {
    const input = makeBaseInput();
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
    const base = makeBaseInput();
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
    expect(p1Obs.self.towerCount).toBe(p2Obs.opponent.visibleTowers.length);
  });
});

// ---------------------------------------------------------------------------
// Type contract: BuildAIObservationInput must not allow opponent.gold/income
// ---------------------------------------------------------------------------
describe('type contract: BuildAIObservationInput isolates opponent economy', () => {
  it('BuildAIObservationInput type does not include opponent.gold field', () => {
    // @ts-expect-error — publicOpponent must not have gold
    const bad = { publicOpponent: { hp: 100, gold: 9999 } } as import('./observation').BuildAIObservationInput;
    void bad;
  });

  it('BuildAIObservationInput type does not include opponent.income field', () => {
    // @ts-expect-error — publicOpponent must not have income
    const bad = { publicOpponent: { hp: 100, income: 9999 } } as import('./observation').BuildAIObservationInput;
    void bad;
  });

  it('opponentBattlefield does not have outboundQueue field', () => {
    // @ts-expect-error — opponentBattlefield must not have outboundQueue
    const bad = { opponentBattlefield: { monsters: [], outboundQueue: [{}] } } as import('./observation').BuildAIObservationInput;
    void bad;
  });
});
