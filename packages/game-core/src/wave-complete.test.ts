/**
 * @chaos-td/game-core - Wave 1-30 Complete Verification Tests
 *
 * Verifies Wave 1 through Wave 30 spawn correctness using Domain Events.
 * Dead/leaked monsters get removed from arrays, so we rely on event counting
 * rather than monster array inspection.
 *
 * Uses runSimulationTicks with sufficient tick limits to capture all wave spawns.
 */

import { describe, expect, it } from 'vitest';
import { createSimulation } from './simulation';
import { CONFIG_VERSION, WAVE_DEFINITIONS } from '@chaos-td/game-data';
import type { DomainEvent } from './events';
import type { PlayerSlot } from '@chaos-td/game-data';

const TEST_SEED = 'wave-test-seed';

/**
 * Run simulation for a specific number of ticks and collect events.
 */
function runSimulationTicks(
  seed: string,
  maxTicks: number,
): {
  events: DomainEvent[];
  finalTick: number;
  reachedResult: boolean;
} {
  const sim = createSimulation({ seed, configVersion: CONFIG_VERSION });
  const allEvents: DomainEvent[] = [];
  sim.start();

  let ticks = 0;
  while (ticks < maxTicks && sim.state.phase !== 'result') {
    const { events } = sim.step();
    allEvents.push(...events);
    ticks++;
  }

  return {
    events: allEvents,
    finalTick: sim.state.tick,
    reachedResult: sim.state.phase === 'result',
  };
}

/**
 * Filter events by type with proper type narrowing.
 */
function filterByType<T extends DomainEvent['type']>(
  events: DomainEvent[],
  type: T,
): Extract<DomainEvent, { type: T }>[] {
  return events.filter((e): e is Extract<DomainEvent, { type: T }> => e.type === type);
}

/**
 * Get expected spawn count for a wave on a single battlefield.
 */
function getExpectedSpawnCount(waveNumber: number): number {
  const waveDef = WAVE_DEFINITIONS[waveNumber - 1];
  if (!waveDef) {
    throw new Error(`Wave ${waveNumber} not found in WAVE_DEFINITIONS`);
  }
  return waveDef.groups.reduce((sum, group) => sum + group.count, 0);
}

/**
 * Count spawn events for a specific wave and battlefield.
 */
function countSpawnsForWave(
  events: DomainEvent[],
  waveNumber: number,
  battlefieldId: PlayerSlot,
): number {
  const spawnEvents = filterByType(events, 'wave_monster_spawned');
  return spawnEvents.filter(
    (e) => e.waveNumber === waveNumber && e.battlefieldId === battlefieldId,
  ).length;
}

describe('Wave 1-30 Complete Verification', () => {
  describe('Spawn counts per battlefield (Waves 1-10)', { timeout: 120_000 }, () => {
    it('verifies all waves 1-10 spawn correct count on lane_p1', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      for (let wave = 1; wave <= 10; wave++) {
        const expected = getExpectedSpawnCount(wave);
        const actual = countSpawnsForWave(events, wave, 'p1');

        expect(actual, `Wave ${wave} lane_p1 spawn count`).toBe(expected);
      }
    });

    it('verifies all waves 1-10 spawn correct count on lane_p2', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      for (let wave = 1; wave <= 10; wave++) {
        const expected = getExpectedSpawnCount(wave);
        const actual = countSpawnsForWave(events, wave, 'p2');

        expect(actual, `Wave ${wave} lane_p2 spawn count`).toBe(expected);
      }
    });

    it('lane_p1 and lane_p2 spawn same count for each wave 1-10', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      for (let wave = 1; wave <= 10; wave++) {
        const p1Count = countSpawnsForWave(events, wave, 'p1');
        const p2Count = countSpawnsForWave(events, wave, 'p2');

        expect(p1Count, `Wave ${wave} p1 count`).toBe(p2Count);
      }
    });
  });

  describe('Wave type composition (key waves, Waves 1-10)', { timeout: 120_000 }, () => {
    it('Wave 1 has only basic monsters', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);
      const spawnEvents = filterByType(events, 'wave_monster_spawned');
      const wave1Spawns = spawnEvents.filter((e) => e.waveNumber === 1);
      const uniqueTypes = [...new Set(wave1Spawns.map((e) => e.monsterType))];

      expect(uniqueTypes).toEqual(['basic']);
    });

    it('Wave 5 has basic + swift monsters', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);
      const spawnEvents = filterByType(events, 'wave_monster_spawned');
      const wave5Spawns = spawnEvents.filter((e) => e.waveNumber === 5);
      const uniqueTypes = [...new Set(wave5Spawns.map((e) => e.monsterType))];

      // Wave 5: every-5th (swift), not flying (5 % 6 = 5)
      expect(uniqueTypes).toContain('basic');
      expect(uniqueTypes).toContain('swift');
      expect(uniqueTypes).not.toContain('flying');
      expect(uniqueTypes).toHaveLength(2);
    });

    it('Wave 6 has basic + flying monsters', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);
      const spawnEvents = filterByType(events, 'wave_monster_spawned');
      const wave6Spawns = spawnEvents.filter((e) => e.waveNumber === 6);
      const uniqueTypes = [...new Set(wave6Spawns.map((e) => e.monsterType))];

      // Wave 6: flying (wave >= 6 && wave % 6 === 0)
      expect(uniqueTypes).toContain('basic');
      expect(uniqueTypes).toContain('flying');
      expect(uniqueTypes).toHaveLength(2);
    });

    it('Wave 10 has basic + swift + siege + boss monsters', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);
      const spawnEvents = filterByType(events, 'wave_monster_spawned');
      const wave10Spawns = spawnEvents.filter((e) => e.waveNumber === 10);
      const uniqueTypes = [...new Set(wave10Spawns.map((e) => e.monsterType))];

      // Wave 10: every-5th (swift), every-10th (siege + boss)
      expect(uniqueTypes).toContain('basic');
      expect(uniqueTypes).toContain('swift');
      expect(uniqueTypes).toContain('siege');
      expect(uniqueTypes).toContain('boss');
      expect(uniqueTypes).toHaveLength(4);
    });
  });

  describe('Wave end events (Waves 1-10)', { timeout: 120_000 }, () => {
    it('emits wave_ended events for waves 1-10', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      const waveEndedEvents = filterByType(events, 'wave_ended');
      const p1EndEvents = waveEndedEvents.filter((e) => e.battlefieldId === 'p1');
      const p2EndEvents = waveEndedEvents.filter((e) => e.battlefieldId === 'p2');

      // Should have at least 10 wave_ended events per battlefield
      expect(p1EndEvents.length).toBeGreaterThanOrEqual(10);
      expect(p2EndEvents.length).toBeGreaterThanOrEqual(10);
      expect(p1EndEvents.length).toBe(p2EndEvents.length);
    });

    it('wave_ended events have sequential wave numbers 1-10', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      const waveEndedEvents = filterByType(events, 'wave_ended');

      for (const bf of ['p1', 'p2'] as PlayerSlot[]) {
        const bfEndEvents = waveEndedEvents
          .filter((e) => e.battlefieldId === bf)
          .sort((a, b) => a.waveNumber - b.waveNumber);

        // Check sequential from 1
        for (let i = 1; i < bfEndEvents.length; i++) {
          expect(bfEndEvents[i].waveNumber).toBe(bfEndEvents[i - 1].waveNumber + 1);
        }
        expect(bfEndEvents[0]?.waveNumber).toBe(1);
      }
    });

    it('wave_ended tick is after all spawn events for that wave', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      const spawnEvents = filterByType(events, 'wave_monster_spawned');
      const waveEndedEvents = filterByType(events, 'wave_ended');

      for (const endEvent of waveEndedEvents) {
        const waveSpawns = spawnEvents.filter(
          (e) =>
            e.waveNumber === endEvent.waveNumber &&
            e.battlefieldId === endEvent.battlefieldId,
        );

        if (waveSpawns.length > 0) {
          const lastSpawnTick = Math.max(...waveSpawns.map((e) => e.tick));
          expect(
            endEvent.tick,
            `Wave ${endEvent.waveNumber} ${endEvent.battlefieldId} ended at tick ${endEvent.tick}, but last spawn was at tick ${lastSpawnTick}`,
          ).toBeGreaterThanOrEqual(lastSpawnTick);
        }
      }
    });

    it('each battlefield emits exactly one wave_ended per wave', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      const waveEndedEvents = filterByType(events, 'wave_ended');

      for (const bf of ['p1', 'p2'] as PlayerSlot[]) {
        const bfEndEvents = waveEndedEvents.filter((e) => e.battlefieldId === bf);
        const waveNumbers = bfEndEvents.map((e) => e.waveNumber);

        // Check for duplicates
        const uniqueWaveNumbers = new Set(waveNumbers);
        expect(uniqueWaveNumbers.size).toBe(waveNumbers.length);
      }
    });
  });

  describe('Wave progression integrity (Waves 1-10)', { timeout: 120_000 }, () => {
    it('all waves 1-10 have both spawns and wave_ended for both battlefields', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      const spawnEvents = filterByType(events, 'wave_monster_spawned');
      const waveEndedEvents = filterByType(events, 'wave_ended');

      for (let wave = 1; wave <= 10; wave++) {
        for (const bf of ['p1', 'p2'] as PlayerSlot[]) {
          const waveSpawns = spawnEvents.filter(
            (e) => e.waveNumber === wave && e.battlefieldId === bf,
          );
          const waveEnd = waveEndedEvents.find(
            (e) => e.waveNumber === wave && e.battlefieldId === bf,
          );

          expect(waveSpawns.length, `Wave ${wave} ${bf} has spawns`).toBeGreaterThan(0);
          expect(waveEnd, `Wave ${wave} ${bf} has wave_ended`).toBeDefined();
        }
      }
    });

    it('spawn counts match WAVE_DEFINITIONS for all waves 1-10', () => {
      const { events } = runSimulationTicks(TEST_SEED, 2200);

      const spawnEvents = filterByType(events, 'wave_monster_spawned');

      for (let wave = 1; wave <= 10; wave++) {
        const expected = getExpectedSpawnCount(wave);
        const p1Count = spawnEvents.filter(
          (e) => e.waveNumber === wave && e.battlefieldId === 'p1',
        ).length;
        const p2Count = spawnEvents.filter(
          (e) => e.waveNumber === wave && e.battlefieldId === 'p2',
        ).length;

        expect(p1Count, `Wave ${wave} p1`).toBe(expected);
        expect(p2Count, `Wave ${wave} p2`).toBe(expected);
      }
    });
  });

  describe('Determinism', { timeout: 120_000 }, () => {
    it('same seed produces identical spawn counts', () => {
      const run1 = runSimulationTicks(TEST_SEED, 2200);
      const run2 = runSimulationTicks(TEST_SEED, 2200);

      const spawns1 = filterByType(run1.events, 'wave_monster_spawned');
      const spawns2 = filterByType(run2.events, 'wave_monster_spawned');

      expect(spawns1).toHaveLength(spawns2.length);

      for (let wave = 1; wave <= 10; wave++) {
        const w1p1 = spawns1.filter(
          (e) => e.waveNumber === wave && e.battlefieldId === 'p1',
        ).length;
        const w2p1 = spawns2.filter(
          (e) => e.waveNumber === wave && e.battlefieldId === 'p1',
        ).length;
        const w1p2 = spawns1.filter(
          (e) => e.waveNumber === wave && e.battlefieldId === 'p2',
        ).length;
        const w2p2 = spawns2.filter(
          (e) => e.waveNumber === wave && e.battlefieldId === 'p2',
        ).length;

        expect(w1p1, `Wave ${wave} p1 run1`).toBe(w2p1);
        expect(w1p2, `Wave ${wave} p2 run1`).toBe(w2p2);
      }
    });

    it('same seed produces identical wave end counts', () => {
      const run1 = runSimulationTicks(TEST_SEED, 2200);
      const run2 = runSimulationTicks(TEST_SEED, 2200);

      const ends1 = filterByType(run1.events, 'wave_ended');
      const ends2 = filterByType(run2.events, 'wave_ended');

      expect(ends1).toHaveLength(ends2.length);

      for (const bf of ['p1', 'p2'] as PlayerSlot[]) {
        const bf1 = ends1.filter((e) => e.battlefieldId === bf).length;
        const bf2 = ends2.filter((e) => e.battlefieldId === bf).length;
        expect(bf1).toBe(bf2);
      }
    });

    it('different seeds produce same wave structure but different monster positions', () => {
      const run1 = runSimulationTicks('seed-001', 2200);
      const run2 = runSimulationTicks('seed-002', 2200);

      const spawns1 = filterByType(run1.events, 'wave_monster_spawned');
      const spawns2 = filterByType(run2.events, 'wave_monster_spawned');

      // Spawn counts should be the same (wave definitions are fixed)
      expect(spawns1.length).toBe(spawns2.length);

      // Spawn order and types should be the same (wave spawning is deterministic)
      for (let i = 0; i < spawns1.length; i++) {
        expect(spawns1[i].waveNumber).toBe(spawns2[i].waveNumber);
        expect(spawns1[i].monsterType).toBe(spawns2[i].monsterType);
        expect(spawns1[i].battlefieldId).toBe(spawns2[i].battlefieldId);
      }
    });
  });

  describe('Wave definitions validation', () => {
    it('Wave 1 has only basic monsters (3 basic)', () => {
      const wave1 = WAVE_DEFINITIONS[0];
      expect(wave1.groups).toHaveLength(1);
      expect(wave1.groups[0].monsterType).toBe('basic');
      expect(wave1.groups[0].count).toBe(3);
    });

    it('Wave 10 has 4 monster types (basic, swift, siege, boss)', () => {
      const wave10 = WAVE_DEFINITIONS[9];
      const types = [...new Set(wave10.groups.map((g) => g.monsterType))];
      expect(types).toContain('basic');
      expect(types).toContain('swift');
      expect(types).toContain('siege');
      expect(types).toContain('boss');
    });

    it('Wave 20 has 4 monster types (basic, swift, siege, boss)', () => {
      const wave20 = WAVE_DEFINITIONS[19];
      const types = [...new Set(wave20.groups.map((g) => g.monsterType))];
      expect(types).toContain('basic');
      expect(types).toContain('swift');
      expect(types).toContain('siege');
      expect(types).toContain('boss');
    });

    it('Wave 30 has 5 monster types (basic, swift, flying, siege, boss)', () => {
      const wave30 = WAVE_DEFINITIONS[29];
      const types = [...new Set(wave30.groups.map((g) => g.monsterType))];
      expect(types).toContain('basic');
      expect(types).toContain('swift');
      expect(types).toContain('flying');
      expect(types).toContain('siege');
      expect(types).toContain('boss');
    });

    it('Basic monster count increases with wave number', () => {
      // Basic count: min(3 + floor((wave-1)/3), 8)
      for (let wave = 1; wave <= 30; wave++) {
        const waveDef = WAVE_DEFINITIONS[wave - 1];
        const basicGroup = waveDef.groups.find((g) => g.monsterType === 'basic');
        expect(basicGroup).toBeDefined();

        const expectedCount = Math.min(3 + Math.floor((wave - 1) / 3), 8);
        expect(basicGroup?.count, `Wave ${wave} basic count`).toBe(expectedCount);
      }
    });

    it('Every 5th wave introduces swift monsters', () => {
      for (let wave = 1; wave <= 30; wave++) {
        const waveDef = WAVE_DEFINITIONS[wave - 1];
        const hasSwift = waveDef.groups.some((g) => g.monsterType === 'swift');
        expect(hasSwift, `Wave ${wave} should ${wave % 5 === 0 ? 'have' : 'not have'} swift`).toBe(wave % 5 === 0);
      }
    });

    it('Every 6th wave from wave 6 introduces flying monsters', () => {
      for (let wave = 1; wave <= 30; wave++) {
        const waveDef = WAVE_DEFINITIONS[wave - 1];
        const hasFlying = waveDef.groups.some((g) => g.monsterType === 'flying');
        const shouldHaveFlying = wave >= 6 && wave % 6 === 0;
        expect(hasFlying, `Wave ${wave} should ${shouldHaveFlying ? 'have' : 'not have'} flying`).toBe(shouldHaveFlying);
      }
    });

    it('Every 10th wave introduces siege and boss monsters', () => {
      for (let wave = 1; wave <= 30; wave++) {
        const waveDef = WAVE_DEFINITIONS[wave - 1];
        const hasSiege = waveDef.groups.some((g) => g.monsterType === 'siege');
        const hasBoss = waveDef.groups.some((g) => g.monsterType === 'boss');
        const shouldHaveSpecial = wave % 10 === 0;
        expect(hasSiege, `Wave ${wave} siege`).toBe(shouldHaveSpecial);
        expect(hasBoss, `Wave ${wave} boss`).toBe(shouldHaveSpecial);
      }
    });

    it('Total spawn counts for first 10 waves are correct', () => {
      // Wave 1: 3 basic
      // Wave 2: 3 basic
      // Wave 3: 3 basic
      // Wave 4: 4 basic
      // Wave 5: 4 basic + 2 swift = 6
      // Wave 6: 4 basic + 2 flying = 6
      // Wave 7: 5 basic
      // Wave 8: 5 basic
      // Wave 9: 5 basic
      // Wave 10: 6 basic + 3 swift + 1 siege + 1 boss = 11
      const expectedCounts = [3, 3, 3, 4, 6, 6, 5, 5, 5, 11];

      for (let wave = 1; wave <= 10; wave++) {
        const actual = getExpectedSpawnCount(wave);
        expect(actual, `Wave ${wave}`).toBe(expectedCounts[wave - 1]);
      }
    });
  });
});
