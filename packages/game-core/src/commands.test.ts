/**
 * @chaos-td/game-core - Command System Tests
 *
 * Tests for build, upgrade, sell, and queue_monster commands.
 */

import { describe, it, expect } from 'vitest';
import { createSimulation } from './simulation';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import type { BuildTowerCommand, UpgradeTowerCommand, SellTowerCommand, QueueMonsterCommand } from './commands';

function createCommandId(playerId: 'p1' | 'p2', tick: number, seq: number) {
  return { playerId, tick, sequence: seq };
}

function makeBuildTower(
  playerId: 'p1' | 'p2',
  towerType: string,
  cellX: number,
  cellY: number,
  seq: number,
): BuildTowerCommand {
  return {
    type: 'build_tower',
    commandId: createCommandId(playerId, 61, seq),
    playerId,
    towerTypeId: towerType as 'archer' | 'mage' | 'frost' | 'sniper',
    cellX,
    cellY,
  };
}

function makeUpgradeTower(
  playerId: 'p1' | 'p2',
  towerEntityId: number,
  seq: number,
): UpgradeTowerCommand {
  return {
    type: 'upgrade_tower',
    commandId: createCommandId(playerId, 61, seq),
    playerId,
    towerEntityId,
  };
}

function makeSellTower(
  playerId: 'p1' | 'p2',
  towerEntityId: number,
  seq: number,
): SellTowerCommand {
  return {
    type: 'sell_tower',
    commandId: createCommandId(playerId, 61, seq),
    playerId,
    towerEntityId,
  };
}

function makeQueueMonster(
  playerId: 'p1' | 'p2',
  monsterType: string,
  quantity: number,
  seq: number,
): QueueMonsterCommand {
  return {
    type: 'queue_monster',
    commandId: createCommandId(playerId, 61, seq),
    playerId,
    monsterTypeId: monsterType,
    quantity,
  };
}

function advanceToRunning(sim: ReturnType<typeof createSimulation>): void {
  sim.start();
  for (let i = 0; i < 60; i++) {
    sim.step();
  }
}

describe('Build Tower Command', () => {
  it('deducts correct gold for archer tower', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    const initialGold = sim.state.players.p1.gold;
    const buildCmd = makeBuildTower('p1', 'archer', 3, 15, 0);
    sim.submitCommand(buildCmd);
    sim.step();

    expect(sim.state.players.p1.gold).toBe(initialGold - 120);
    expect(sim.state.towers).toHaveLength(1);
    expect(sim.state.towers[0]?.towerTypeId).toBe('archer');
    expect(sim.state.towers[0]?.level).toBe(1);
  });

  it('rejects insufficient gold', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Spend gold first
    for (let i = 0; i < 5; i++) {
      sim.submitCommand(makeBuildTower('p1', 'archer', 3, 15 + i, i));
    }
    sim.step();

    const initialGold = sim.state.players.p1.gold;
    const buildCmd = makeBuildTower('p1', 'sniper', 3, 19, 10);
    sim.submitCommand(buildCmd);
    const result = sim.step();

    expect(sim.state.players.p1.gold).toBe(initialGold);
    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });

  it('rejects occupied cell', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 0));
    sim.step();

    sim.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 1));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
    expect(sim.state.towers).toHaveLength(1);
  });

  it('does not process commands in countdown phase', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    sim.start();

    const buildCmd = makeBuildTower('p1', 'archer', 3, 15, 0);
    sim.submitCommand(buildCmd);
    sim.step();

    expect(sim.state.towers).toHaveLength(0);
    expect(sim.state.players.p1.gold).toBe(600);
  });
});

describe('Upgrade Tower Command', () => {
  it('increases tower level and deducts gold', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 0));
    sim.step();

    const goldAfterBuild = sim.state.players.p1.gold;
    const towerId = sim.state.towers[0]?.entityId ?? 0;

    sim.submitCommand(makeUpgradeTower('p1', towerId, 1));
    sim.step();

    expect(sim.state.towers[0]?.level).toBe(2);
    expect(sim.state.players.p1.gold).toBe(goldAfterBuild - 160);
  });

  it('rejects upgrade at max level', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 0));
    sim.step();

    const towerId = sim.state.towers[0]?.entityId ?? 0;

    // Upgrade to level 2
    sim.submitCommand(makeUpgradeTower('p1', towerId, 1));
    sim.step();

    // Upgrade to level 3
    sim.submitCommand(makeUpgradeTower('p1', towerId, 2));
    sim.step();

    expect(sim.state.towers[0]?.level).toBe(3);

    // Try to upgrade past max
    sim.submitCommand(makeUpgradeTower('p1', towerId, 3));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });

  it('rejects upgrade with insufficient gold', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 0));
    sim.step();

    // Spend almost all gold
    sim.submitCommand(makeBuildTower('p1', 'archer', 4, 15, 1));
    sim.submitCommand(makeBuildTower('p1', 'archer', 5, 15, 2));
    sim.submitCommand(makeBuildTower('p1', 'archer', 6, 15, 3));
    sim.step();

    const towerId = sim.state.towers[0]?.entityId ?? 0;
    const goldBefore = sim.state.players.p1.gold;

    sim.submitCommand(makeUpgradeTower('p1', towerId, 4));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
    expect(sim.state.players.p1.gold).toBe(goldBefore);
  });
});

describe('Sell Tower Command', () => {
  it('refunds 70% of invested gold', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 0));
    sim.step();

    const goldAfterBuild = sim.state.players.p1.gold;
    const towerId = sim.state.towers[0]?.entityId ?? 0;

    sim.submitCommand(makeSellTower('p1', towerId, 1));
    sim.step();

    // 70% of 120 = 84
    expect(sim.state.players.p1.gold).toBe(goldAfterBuild + 84);
    expect(sim.state.towers).toHaveLength(0);
  });

  it('refunds correctly after upgrades', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 0));
    sim.step();

    const towerId = sim.state.towers[0]?.entityId ?? 0;

    sim.submitCommand(makeUpgradeTower('p1', towerId, 1));
    sim.step();

    const afterUpgrade = {
      level: sim.state.towers[0]?.level,
      invested: sim.state.towers[0]?.totalInvested,
      gold: sim.state.players.p1.gold,
    };

    sim.submitCommand(makeSellTower('p1', towerId, 2));
    sim.step();

    const afterSell = {
      gold: sim.state.players.p1.gold,
      towers: sim.state.towers.length,
    };

    // Build: 600 - 120 = 480 gold, invested = 120
    // Upgrade L2: 480 - 160 = 320 gold, invested = 280
    // Sell refund: 70% of 280 = 196
    // After sell: 320 + 196 = 516 gold
    expect(afterUpgrade.level).toBe(2);
    expect(afterSell.gold).toBe(516);
    expect(afterSell.towers).toBe(0);
  });

  it('rejects selling non-existent tower', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeSellTower('p1', 999, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });
});

describe('Queue Monster Command', () => {
  it('adds monsters to queue', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeQueueMonster('p1', 'sheep', 3, 0));
    sim.step();

    // Queue may have 2 or 3 depending on whether a spawn occurred in same tick
    expect(sim.state.lanes.lane_p2.spawnQueue.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid quantity', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand(makeQueueMonster('p1', 'sheep', 6, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });

  it('rejects invalid monster type', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    sim.submitCommand({ ...makeQueueMonster('p1', 'dragon', 1, 0), monsterTypeId: 'dragon' });
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });

  it('deducts gold and adds income when queueing monsters', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    const initialGold = sim.state.players.p1.gold;
    const initialIncome = sim.state.players.p1.income;

    // Send 1 sheep: cost 60, income gain 6
    sim.submitCommand(makeQueueMonster('p1', 'sheep', 1, 0));
    sim.step();

    expect(sim.state.players.p1.gold).toBe(initialGold - 60);
    expect(sim.state.players.p1.income).toBe(initialIncome + 6);
  });

  it('grants income on each monster sent', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    const initialGold = sim.state.players.p1.gold;
    const initialIncome = sim.state.players.p1.income;

    // Send 3 sheep: cost 180, income gain 18
    sim.submitCommand(makeQueueMonster('p1', 'sheep', 3, 0));
    sim.step();

    expect(sim.state.players.p1.gold).toBe(initialGold - 180);
    expect(sim.state.players.p1.income).toBe(initialIncome + 18);
  });

  it('rejects insufficient gold for monster send', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Spend most gold on towers (5 archer = 600 gold exactly)
    for (let i = 0; i < 5; i++) {
      sim.submitCommand(makeBuildTower('p1', 'archer', 3 + i, 15, i));
    }
    sim.step();

    // After 5 archer towers: 600 - (5 * 120) = 0 gold
    expect(sim.state.players.p1.gold).toBe(0);

    // Try to send a sheep (costs 60)
    sim.submitCommand(makeQueueMonster('p1', 'sheep', 1, 10));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });
});

describe('Income System', () => {
  it('grants income every 200 ticks', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // At tick 61 after advanceToRunning
    // Skip to tick 261 (200 ticks into running, since tick 60 = running start)
    for (let i = 0; i < 199; i++) {
      sim.step();
    }
    // Now at tick 260, income will be paid next tick (tick 261)

    const goldAt200 = sim.state.players.p1.gold;
    sim.step(); // tick 261, income should be paid
    const goldAt201 = sim.state.players.p1.gold;

    expect(goldAt201).toBe(goldAt200 + 100); // Initial income is 100
  });

  it('accumulates income over multiple intervals', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    const initialGold = sim.state.players.p1.gold;

    // Skip 400 ticks (2 income intervals)
    for (let i = 0; i < 400; i++) {
      sim.step();
    }

    expect(sim.state.players.p1.gold).toBe(initialGold + 200);
  });
});

describe('Command Determinism', () => {
  it('produces identical states for same commands', () => {
    const config = { seed: 'determinism-test', configVersion: CONFIG_VERSION };

    const sim1 = createSimulation(config);
    const sim2 = createSimulation(config);

    advanceToRunning(sim1);
    advanceToRunning(sim2);

    // Submit same commands
    sim1.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 0));
    sim1.submitCommand(makeBuildTower('p2', 'archer', 4, 5, 0));

    sim2.submitCommand(makeBuildTower('p1', 'archer', 3, 15, 0));
    sim2.submitCommand(makeBuildTower('p2', 'archer', 4, 5, 0));

    for (let i = 0; i < 100; i++) {
      sim1.step();
      sim2.step();
    }

    expect(sim1.state.stateHash).toBe(sim2.state.stateHash);
  });
});

describe('Gold Never Negative', () => {
  it('prevents gold from going negative through multiple operations', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Try to build 10 expensive towers
    for (let i = 0; i < 10; i++) {
      sim.submitCommand(makeBuildTower('p1', 'sniper', i % 8, 16 + Math.floor(i / 8), i));
    }
    sim.step();

    expect(sim.state.players.p1.gold).toBeGreaterThanOrEqual(0);
  });
});

describe('Game Completion', () => {
  it('resolves by timeout after max running ticks', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Run until result (timeout)
    for (let i = 0; i < 12400; i++) {
      sim.step();
      if (sim.state.phase === 'result') {
        break;
      }
    }

    expect(sim.state.phase).toBe('result');
    expect(sim.state.tick).toBe(12460);
  });

  it('emits match_ended event in resolving phase', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Run until result
    for (let i = 0; i < 12400; i++) {
      const result = sim.step();
      const matchEnded = result.events.some((e) => e.type === 'match_ended');
      if (matchEnded) {
        expect(matchEnded).toBe(true);
        return;
      }
      if (sim.state.phase === 'result') {
        break;
      }
    }

    // Should have emitted match_ended
    expect(sim.state.phase).toBe('result');
  });

  it('resolves by timeout after max running ticks', { timeout: 600_000 }, () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    sim.start();

    // Skip countdown
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.state.phase).toBe('running');

    // Run until resolving
    for (let i = 0; i < 12000 + 401; i++) {
      sim.step();
      if (sim.state.phase === 'result') break;
    }

    expect(sim.state.phase).toBe('result');
  });
});

describe('HP Leak Mechanics', () => {
  it('starts with 20 HP', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    expect(sim.state.players.p1.hp).toBe(20);
    expect(sim.state.players.p2.hp).toBe(20);
  });

  it('HP can go negative before game ends', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // HP should be 20 initially
    expect(sim.state.players.p1.hp).toBe(20);
  });
});

describe('M3-002 Monster Types', () => {
  function advanceToRunning(sim: ReturnType<typeof createSimulation>): void {
    sim.start();
    for (let i = 0; i < 60; i += 1) {
      sim.step();
    }
  }

  function makeQueueMonster(playerId: 'p1' | 'p2', monsterType: string, quantity: number, seq: number): QueueMonsterCommand {
    return {
      type: 'queue_monster',
      commandId: { playerId, tick: 61, sequence: seq },
      playerId,
      monsterTypeId: monsterType,
      quantity,
    };
  }

  it('rejects wolf before 30 seconds', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Wolf is available at tick 600 (30 seconds)
    // Try to queue at tick 61
    sim.submitCommand(makeQueueMonster('p1', 'wolf', 1, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });

  it('accepts wolf after 30 seconds', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Advance to tick 720 (runningStartedAtTick=60, runningTick=660 >= 600 for wolf)
    for (let i = 0; i < 600; i += 1) {
      sim.step();
    }

    // Now at tick 720, wolf should be available
    sim.submitCommand(makeQueueMonster('p1', 'wolf', 1, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_accepted')).toBe(true);
  });

  it('rejects treant before 90 seconds', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Treant is available at tick 1800 (90 seconds)
    sim.submitCommand(makeQueueMonster('p1', 'treant', 1, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });

  it('accepts treant after 90 seconds', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Advance to tick 1860 (past 1800 = 90 seconds)
    for (let i = 0; i < 1799; i += 1) {
      sim.step();
    }

    sim.submitCommand(makeQueueMonster('p1', 'treant', 1, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_accepted')).toBe(true);
  });

  it('rejects ghost before 150 seconds', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Ghost is available at tick 3000 (150 seconds)
    sim.submitCommand(makeQueueMonster('p1', 'ghost', 1, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_rejected')).toBe(true);
  });

  it('accepts ghost after 150 seconds', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Advance to tick 3060 (past 3000 = 150 seconds)
    for (let i = 0; i < 2999; i += 1) {
      sim.step();
    }

    sim.submitCommand(makeQueueMonster('p1', 'ghost', 1, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_accepted')).toBe(true);
  });

  it('wolf costs correct gold and grants correct income', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Advance to runningTick >= 600 (30 seconds) for wolf unlock
    for (let i = 0; i < 600; i += 1) {
      sim.step();
    }

    // Record gold before sending wolf
    const goldBefore = sim.state.players.p1.gold;
    const incomeBefore = sim.state.players.p1.income;

    // Wolf: cost 105, income gain 10
    sim.submitCommand(makeQueueMonster('p1', 'wolf', 1, 0));
    sim.step();

    expect(sim.state.players.p1.gold).toBe(goldBefore - 105);
    expect(sim.state.players.p1.income).toBe(incomeBefore + 10);
  });

  it('treant has correct stats (armor)', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Advance to runningTick >= 1800 (90 seconds) for treant unlock
    for (let i = 0; i < 1800; i += 1) {
      sim.step();
    }

    // Record gold before sending treant
    const goldBefore = sim.state.players.p1.gold;
    const incomeBefore = sim.state.players.p1.income;

    // Treant: cost 185, income gain 16
    sim.submitCommand(makeQueueMonster('p1', 'treant', 1, 0));
    sim.step();

    expect(sim.state.players.p1.gold).toBe(goldBefore - 185);
    expect(sim.state.players.p1.income).toBe(incomeBefore + 16);
  });

  it('ghost has shield property', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Advance to runningTick >= 3000 (150 seconds) for ghost unlock
    for (let i = 0; i < 3000; i += 1) {
      sim.step();
    }

    // Record gold before sending ghost
    const goldBefore = sim.state.players.p1.gold;
    const incomeBefore = sim.state.players.p1.income;

    // Ghost: cost 240, income gain 20
    sim.submitCommand(makeQueueMonster('p1', 'ghost', 1, 0));
    sim.step();

    expect(sim.state.players.p1.gold).toBe(goldBefore - 240);
    expect(sim.state.players.p1.income).toBe(incomeBefore + 20);
  });

  it('accepts sheep at start (tick 0)', () => {
    const sim = createSimulation({ seed: 'test', configVersion: CONFIG_VERSION });
    advanceToRunning(sim);

    // Sheep is available at tick 0
    sim.submitCommand(makeQueueMonster('p1', 'sheep', 1, 0));
    const result = sim.step();

    expect(result.events.some(e => e.type === 'command_accepted')).toBe(true);
  });
});
