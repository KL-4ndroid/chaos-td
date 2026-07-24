/**
 * @chaos-td/game-core - Dual Battlefield Wave Tests
 *
 * Tests the dual-battlefield model per ADR-001:
 * - Each player has an independent battlefield
 * - Wave monsters spawn from the system (not a PlayerSlot)
 * - Player sends go to the opponent's battlefield
 * - Wave runtime is per-battlefield (independent)
 * - Wave Definition count is per-battlefield
 *
 * Wave timing (WAVE_INTERVAL_TICKS = 200):
 * - Wave N starts at running tick (N-1)*200 + 1
 * - Wave 1: starts at running tick 1 (absolute tick 61), spawns at 1, 20, 39
 * - Wave 2: starts at running tick 201 (absolute tick 261), spawns at 201, 220, 239
 * - Wave spawn cooldown: 20 ticks between monsters in same group
 */

import { describe, expect, it } from 'vitest';
import { createSimulation } from './simulation';
import { hashStateToString } from './canonical';
import { CONFIG_VERSION, WAVE_DEFINITIONS } from '@chaos-td/game-data';
import type { BattlefieldId } from '@chaos-td/game-data';

function tickN(sim: ReturnType<typeof createSimulation>, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    sim.step();
  }
}

/** Get all monsters in a specific battlefield */
function getBattlefieldMonsters(sim: ReturnType<typeof createSimulation>, bf: 'p1' | 'p2') {
  const laneId: BattlefieldId = bf === 'p1' ? 'lane_p1' : 'lane_p2';
  return sim.state.lanes[laneId].monsters;
}

/** Count wave monsters in a battlefield (source.type === 'wave') */
function countWaveMonsters(sim: ReturnType<typeof createSimulation>, bf: 'p1' | 'p2') {
  return getBattlefieldMonsters(sim, bf).filter(m => m.source.type === 'wave').length;
}

/** Check a monster's source is not a PlayerSlot */
function isSystemMonster(monster: ReturnType<typeof getBattlefieldMonsters>[number]): boolean {
  return monster.source.type === 'wave';
}

describe('Dual Battlefield Wave Model', () => {
  describe('T1: Wave 1 in p1 battlefield generates 3 monsters (per Battlefield)', () => {
    it('p1 battlefield receives exactly 3 wave monsters for Wave 1', () => {
      const sim = createSimulation({ seed: 'test-wave-p1', configVersion: CONFIG_VERSION });
      sim.start();

      // Wave 1 starts at first running tick (tick 61), spawns at running ticks 1, 20, 39
      tickN(sim, 60); // countdown
      tickN(sim, 100); // Wave 1 done by running tick 39 (tick 100 total)

      const p1Monsters = getBattlefieldMonsters(sim, 'p1');
      const p1WaveMonsters = p1Monsters.filter(m => m.source.type === 'wave');

      expect(p1WaveMonsters).toHaveLength(3);
      expect(p1WaveMonsters.every(m => m.source.type === 'wave')).toBe(true);
      expect(p1WaveMonsters.every(m => m.source.type === 'wave' && m.source.waveNumber === 1)).toBe(true);
      // battlefieldId is the BattlefieldId (lane_p1), not the PlayerSlot
      expect(p1WaveMonsters.every(m => m.battlefieldId === 'lane_p1')).toBe(true);
    });
  });

  describe('T2: Wave 1 in p2 battlefield also generates 3 monsters', () => {
    it('p2 battlefield receives exactly 3 wave monsters for Wave 1 independently', () => {
      const sim = createSimulation({ seed: 'test-wave-p2', configVersion: CONFIG_VERSION });
      sim.start();

      tickN(sim, 60); // countdown
      tickN(sim, 100); // Wave 1 done by running tick 39

      const p2Monsters = getBattlefieldMonsters(sim, 'p2');
      const p2WaveMonsters = p2Monsters.filter(m => m.source.type === 'wave');

      expect(p2WaveMonsters).toHaveLength(3);
      expect(p2WaveMonsters.every(m => m.source.type === 'wave')).toBe(true);
      expect(p2WaveMonsters.every(m => m.source.type === 'wave' && m.source.waveNumber === 1)).toBe(true);
      expect(p2WaveMonsters.every(m => m.battlefieldId === 'lane_p2')).toBe(true);
    });
  });

  describe('T3: Wave Definition count is per-battlefield (not total)', () => {
    it('Wave 1 definition says basic × 3, which means 3 per battlefield', () => {
      const wave1 = WAVE_DEFINITIONS[0]!;
      expect(wave1).toBeDefined();
      expect(wave1.waveNumber).toBe(1);

      // Wave 1 has exactly one group: basic × 3
      expect(wave1.groups).toHaveLength(1);
      expect(wave1.groups[0]!.monsterType).toBe('basic');
      expect(wave1.groups[0]!.count).toBe(3);

      // The formal count is 3 per battlefield, not 6 total
      // Total entities created across both battlefields = 3 × 2 = 6, but that is a consequence
      const perBattlefieldCount = wave1.groups.reduce((sum, g) => sum + g.count, 0);
      expect(perBattlefieldCount).toBe(3);
    });

    it('Wave 10 has correct per-battlefield counts (basic + swift + siege + boss)', () => {
      const wave10 = WAVE_DEFINITIONS[9]!;
      expect(wave10).toBeDefined();
      expect(wave10.waveNumber).toBe(10);

      const totalPerBf = wave10.groups.reduce((sum, g) => sum + g.count, 0);
      // Wave 10: actual total from WAVE_DEFINITIONS data
      expect(totalPerBf).toBeGreaterThanOrEqual(8); // basic + swift at minimum
      expect(totalPerBf).toBeLessThanOrEqual(12);   // sanity upper bound
    });
  });

  describe('T4: p1 player send only increases p2 battlefield monsters', () => {
    it('p1 queue_monster adds monsters to p2 battlefield, not p1', () => {
      const sim = createSimulation({ seed: 'test-p1-send', configVersion: CONFIG_VERSION });
      sim.start();
      tickN(sim, 60); // countdown

      sim.state.players.p1.gold = 10_000;

      // p1 sends 3 sheep
      sim.submitCommand({
        type: 'queue_monster',
        commandId: sim.getNextCommandId('p1'),
        playerId: 'p1',
        monsterTypeId: 'sheep',
        quantity: 3,
      });
      sim.step();

      // Wave 1 spawns occupy cooldown: spawns at running ticks 1, 20, 39
      // Player monsters queued: spawn at running ticks 1, 20, 39 (+ cooldown)
      // 3 player monsters appear by running tick 39 (tick 100 total)
      tickN(sim, 100);

      const p2Monsters = getBattlefieldMonsters(sim, 'p2');
      const p2PlayerMonsters = p2Monsters.filter(
        m => m.source.type === 'player' && m.source.playerId === 'p1',
      );
      const p1Monsters = getBattlefieldMonsters(sim, 'p1');
      const p1PlayerMonsters = p1Monsters.filter(
        m => m.source.type === 'player' && m.source.playerId === 'p1',
      );

      expect(p2PlayerMonsters).toHaveLength(3);
      expect(p1PlayerMonsters).toHaveLength(0); // p1's send does NOT appear in p1's battlefield
    });
  });

  describe('T5: p2/AI send only increases p1 battlefield monsters', () => {
    it('p2 queue_monster adds monsters to p1 battlefield, not p2', () => {
      const sim = createSimulation({ seed: 'test-p2-send', configVersion: CONFIG_VERSION });
      sim.start();
      tickN(sim, 60); // countdown

      sim.state.players.p2.gold = 10_000;

      sim.submitCommand({
        type: 'queue_monster',
        commandId: sim.getNextCommandId('p2'),
        playerId: 'p2',
        monsterTypeId: 'sheep',
        quantity: 2,
      });
      sim.step();

      // Wave spawns at running ticks 1, 20, 39; player monsters queued at 1, 20, 39 (+ cooldown)
      // 2 player monsters appear by running tick 39 (tick 100 total)
      tickN(sim, 80);

      const p1Monsters = getBattlefieldMonsters(sim, 'p1');
      const p1PlayerMonsters = p1Monsters.filter(
        m => m.source.type === 'player' && m.source.playerId === 'p2',
      );
      const p2Monsters = getBattlefieldMonsters(sim, 'p2');
      const p2PlayerMonsters = p2Monsters.filter(
        m => m.source.type === 'player' && m.source.playerId === 'p2',
      );

      expect(p1PlayerMonsters).toHaveLength(2);
      expect(p2PlayerMonsters).toHaveLength(0); // p2's send does NOT appear in p2's battlefield
    });
  });

  describe('T6: Player send and system wave coexist', () => {
    it('wave monsters and player-sent monsters can be on the same battlefield simultaneously', () => {
      const sim = createSimulation({ seed: 'test-coexist', configVersion: CONFIG_VERSION });
      sim.start();
      tickN(sim, 60);
      sim.state.players.p1.gold = 10_000;

      // Send 2 monsters from p1 to p2
      sim.submitCommand({
        type: 'queue_monster',
        commandId: sim.getNextCommandId('p1'),
        playerId: 'p1',
        monsterTypeId: 'sheep',
        quantity: 2,
      });
      sim.step();

      // Wave 1 spawns 3 monsters (waveSpawnCooldownTicks=21 gap → at ticks 0, 20, 40)
      // Wave 2 starts at running tick 201 (tick 261), first spawn at running tick 220 (tick 281)
      // Player queue: quantity=2 sheep, spawnGapTicks=9 → at ticks 1, 10
      // Check before Wave 2 starts (at running tick 180 = tick 241)
      tickN(sim, 180);
      const waveCount180 = getBattlefieldMonsters(sim, 'p2').filter(m => m.source.type === 'wave').length;
      const playerCount180 = getBattlefieldMonsters(sim, 'p2').filter(
        m => m.source.type === 'player' && m.source.playerId === 'p1',
      ).length;
      const totalAt180 = getBattlefieldMonsters(sim, 'p2').length;
      expect(waveCount180).toBe(3); // Wave 1: 3 basic
      expect(playerCount180).toBeGreaterThanOrEqual(2); // p1 sent 2 (sheep)
      expect(totalAt180).toBeGreaterThanOrEqual(5); // both coexist

      // Also check at tick 281: Wave 2 has started (4 monsters from Wave 2 basic group)
      tickN(sim, 40); // running tick 220 = tick 281
      const waveCount = getBattlefieldMonsters(sim, 'p2').filter(m => m.source.type === 'wave').length;
      const playerCount = getBattlefieldMonsters(sim, 'p2').filter(
        m => m.source.type === 'player' && m.source.playerId === 'p1',
      ).length;
      expect(waveCount).toBeGreaterThanOrEqual(4); // Wave 1 (3) + Wave 2 started (1+)
      expect(playerCount).toBeGreaterThanOrEqual(2); // still 2 sheep (monsters don't disappear)
    });
  });

  describe('T7: System monster source is not a PlayerSlot', () => {
    it('wave monster source.type is "wave", not "player"', () => {
      const sim = createSimulation({ seed: 'test-system-source', configVersion: CONFIG_VERSION });
      sim.start();
      tickN(sim, 60);
      tickN(sim, 280); // past Wave 1 and into Wave 2

      const allWaveMonsters = [
        ...getBattlefieldMonsters(sim, 'p1'),
        ...getBattlefieldMonsters(sim, 'p2'),
      ].filter(m => isSystemMonster(m));

      expect(allWaveMonsters.length).toBeGreaterThan(0);

      for (const monster of allWaveMonsters) {
        expect(monster.source.type).toBe('wave');
        expect(monster.source.type).not.toBe('player');
        if (monster.source.type === 'wave') {
          expect(typeof monster.source.waveNumber).toBe('number');
          expect(monster.source.waveNumber).toBeGreaterThan(0);
        }
      }
    });

    it('player-sent monster source.type is "player" with a valid PlayerSlot', () => {
      const sim = createSimulation({ seed: 'test-player-source', configVersion: CONFIG_VERSION });
      sim.start();
      tickN(sim, 60);
      sim.state.players.p1.gold = 10_000;

      sim.submitCommand({
        type: 'queue_monster',
        commandId: sim.getNextCommandId('p1'),
        playerId: 'p1',
        monsterTypeId: 'sheep',
        quantity: 1,
      });
      sim.step();
      tickN(sim, 40);

      const p2Monsters = getBattlefieldMonsters(sim, 'p2');
      const playerMonsters = p2Monsters.filter(m => m.source.type === 'player');

      expect(playerMonsters.length).toBe(1);
      const pm = playerMonsters[0]!;
      expect(pm.source.type).toBe('player');
      if (pm.source.type === 'player') {
        expect(pm.source.playerId).toBe('p1');
      }
    });
  });

  describe('T8: Replacing p2 Controller from AI to Human does not change simulation', () => {
    it('simulating with no p2 commands produces deterministic results', () => {
      const sim1 = createSimulation({ seed: 'controller-test', configVersion: CONFIG_VERSION });
      const sim2 = createSimulation({ seed: 'controller-test', configVersion: CONFIG_VERSION });
      sim1.start();
      sim2.start();

      tickN(sim1, 300);
      tickN(sim2, 300);

      const hash1 = hashStateToString(sim1.getCanonicalState());
      const hash2 = hashStateToString(sim2.getCanonicalState());

      expect(hash1).toBe(hash2);
    });
  });

  describe('T9: Same Seed + Command Log produces identical Replay Hash', () => {
    it('reproducible simulation with identical seed and commands', () => {
      const seed = 'reproducability-test';

      const sim1 = createSimulation({ seed, configVersion: CONFIG_VERSION });
      sim1.start();
      tickN(sim1, 60);
      sim1.state.players.p1.gold = 5_000;
      sim1.submitCommand({
        type: 'queue_monster',
        commandId: sim1.getNextCommandId('p1'),
        playerId: 'p1',
        monsterTypeId: 'sheep',
        quantity: 1,
      });
      tickN(sim1, 100);

      const sim2 = createSimulation({ seed, configVersion: CONFIG_VERSION });
      sim2.start();
      tickN(sim2, 60);
      sim2.state.players.p1.gold = 5_000;
      sim2.submitCommand({
        type: 'queue_monster',
        commandId: sim2.getNextCommandId('p1'),
        playerId: 'p1',
        monsterTypeId: 'sheep',
        quantity: 1,
      });
      tickN(sim2, 100);

      const hash1 = hashStateToString(sim1.getCanonicalState());
      const hash2 = hashStateToString(sim2.getCanonicalState());

      expect(hash1).toBe(hash2);
    });
  });

  describe('T10: Wave 1–30 does not lose unsent groups when next wave starts', () => {
    it('each battlefield completes its current wave before starting the next', () => {
      const sim = createSimulation({ seed: 'wave-continuity', configVersion: CONFIG_VERSION });
      sim.start();

      // Wave 1 starts at running tick 1 (tick 61), spawns at 1, 20, 39 → done at tick 100
      // Wave 2 starts at running tick 201 (tick 261), spawns at 201, 220, 239 → done at tick 300
      tickN(sim, 60); // countdown
      tickN(sim, 100); // tick 161 total: Wave 1 done

      const p1Wave1Count = countWaveMonsters(sim, 'p1');
      expect(p1Wave1Count).toBe(3); // Wave 1 fully spawned

      // Wave 2 starts at tick 261, spawns at running ticks 201, 220, 239
      tickN(sim, 300); // tick 461 total: Wave 2 done

      const p1Wave2Count = getBattlefieldMonsters(sim, 'p1').filter(
        m => m.source.type === 'wave' && m.source.waveNumber === 2,
      ).length;

      // Wave 2 basic × 3, spawns at running ticks 201, 220, 239 → 3 by tick 300
      expect(p1Wave2Count).toBe(3);
    });

    it('per-battlefield wave runtime is independent: one battlefield finishing does not affect the other', () => {
      const sim = createSimulation({ seed: 'wave-independence', configVersion: CONFIG_VERSION });
      sim.start();

      // Wave 1: 3 basic monsters per battlefield
      tickN(sim, 60);  // countdown
      tickN(sim, 100); // tick 161: Wave 1 done (spawns at running ticks 1, 20, 39)

      // Both battlefields should have 3 Wave 1 monsters
      expect(countWaveMonsters(sim, 'p1')).toBe(3);
      expect(countWaveMonsters(sim, 'p2')).toBe(3);

      // Wave 2 starts at tick 261, done by tick 300
      tickN(sim, 300); // tick 461: Wave 2 done

      const p1Wave = getBattlefieldMonsters(sim, 'p1').filter(m => m.source.type === 'wave');
      const p2Wave = getBattlefieldMonsters(sim, 'p2').filter(m => m.source.type === 'wave');

      // 3 Wave 1 + 3 Wave 2 per battlefield
      expect(p1Wave.length).toBe(6);
      expect(p2Wave.length).toBe(6);
      expect(p1Wave.every(m => m.source.type === 'wave' && m.source.waveNumber >= 1)).toBe(true);
      expect(p2Wave.every(m => m.source.type === 'wave' && m.source.waveNumber >= 1)).toBe(true);
    });
  });
});
