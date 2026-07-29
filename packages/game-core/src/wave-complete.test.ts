import { beforeAll, describe, expect, it } from 'vitest';
import {
  CONFIG_VERSION,
  WAVE_DEFINITIONS,
  type BattlefieldId,
  type WaveDefinition,
} from '@chaos-td/game-data';
import type { DomainEvent } from './events';
import { createSimulation } from './simulation';

const TEST_SEED = 'wave-complete-seed';
const LAST_WAVE = 30;
const BATTLEFIELDS: readonly BattlefieldId[] = ['lane_p1', 'lane_p2'];

interface SimulationRun {
  readonly events: readonly DomainEvent[];
  readonly finalHash: string;
}

function requireWaveDefinition(waveNumber: number): WaveDefinition {
  const definition = WAVE_DEFINITIONS[waveNumber - 1];

  if (!definition) {
    throw new Error(`Missing WaveDefinition for wave ${waveNumber}`);
  }

  return definition;
}

function expectedSpawnCount(waveNumber: number): number {
  return requireWaveDefinition(waveNumber).groups.reduce(
    (total, group) => total + group.count,
    0,
  );
}

function eventsOfType<T extends DomainEvent['type']>(
  events: readonly DomainEvent[],
  type: T,
): Extract<DomainEvent, { type: T }>[] {
  return events.filter((event): event is Extract<DomainEvent, { type: T }> => event.type === type);
}

function requireSequentialEvent<T>(events: readonly T[], index: number): readonly [T, T] {
  const previous = events[index - 1];
  const current = events[index];

  if (!previous || !current) {
    throw new Error(`Missing sequential wave event at index ${index}`);
  }

  return [previous, current];
}

function runThroughWave30(seed: string): SimulationRun {
  const simulation = createSimulation({ seed, configVersion: CONFIG_VERSION });
  const events: DomainEvent[] = [];
  simulation.start();

  // This test isolates scheduler completion; towers and pathing are covered elsewhere.
  simulation.state.players.p1.hp = 1_000_000;
  simulation.state.players.p2.hp = 1_000_000;

  const maxTicks = 20_000;
  while (
    simulation.state.waveScheduler.currentWaveNumber < LAST_WAVE ||
    !simulation.state.waveScheduler.battlefields.p1.spawningCompleted ||
    !simulation.state.waveScheduler.battlefields.p2.spawningCompleted
  ) {
    if (simulation.state.tick >= maxTicks) {
      throw new Error(`Wave ${LAST_WAVE} did not finish spawning within ${maxTicks} ticks`);
    }

    events.push(...simulation.step().events);
  }

  return { events, finalHash: simulation.state.stateHash };
}

function spawnsFor(
  events: readonly DomainEvent[],
  waveNumber: number,
  battlefieldId: BattlefieldId,
) {
  return eventsOfType(events, 'wave_monster_spawned').filter(
    (event) => event.waveNumber === waveNumber && event.battlefieldId === battlefieldId,
  );
}

describe('Wave 1-30 completion', { timeout: 120_000 }, () => {
  let firstRun: SimulationRun;

  beforeAll(() => {
    firstRun = runThroughWave30(TEST_SEED);
  }, 120_000);

  it('spawns every configured monster on p1', () => {
    for (let waveNumber = 1; waveNumber <= LAST_WAVE; waveNumber += 1) {
      expect(spawnsFor(firstRun.events, waveNumber, 'lane_p1')).toHaveLength(expectedSpawnCount(waveNumber));
    }
  });

  it('spawns every configured monster on p2', () => {
    for (let waveNumber = 1; waveNumber <= LAST_WAVE; waveNumber += 1) {
      expect(spawnsFor(firstRun.events, waveNumber, 'lane_p2')).toHaveLength(expectedSpawnCount(waveNumber));
    }
  });

  it('uses the same per-battlefield count without treating a wave as a six-monster total', () => {
    expect(expectedSpawnCount(1)).toBe(3);
    expect(spawnsFor(firstRun.events, 1, 'lane_p1')).toHaveLength(3);
    expect(spawnsFor(firstRun.events, 1, 'lane_p2')).toHaveLength(3);
  });

  it('retains Wave 1 composition', () => {
    const wave1 = requireWaveDefinition(1);
    expect(wave1.groups).toHaveLength(1);
    expect(wave1.groups[0]?.monsterType).toBe('basic');
    expect(wave1.groups[0]?.count).toBe(3);
  });

  it('retains Wave 10 composition', () => {
    const types = new Set(requireWaveDefinition(10).groups.map((group) => group.monsterType));
    expect(types).toEqual(new Set(['basic', 'swift', 'siege', 'boss']));
  });

  it('retains Wave 20 composition', () => {
    const types = new Set(requireWaveDefinition(20).groups.map((group) => group.monsterType));
    expect(types).toEqual(new Set(['basic', 'swift', 'siege', 'boss']));
  });

  it('retains Wave 30 composition', () => {
    const types = new Set(requireWaveDefinition(30).groups.map((group) => group.monsterType));
    expect(types).toEqual(new Set(['basic', 'swift', 'flying', 'siege', 'boss']));
  });

  it('emits exactly 30 spawning-completed events per battlefield', () => {
    const ended = eventsOfType(firstRun.events, 'wave_ended');
    for (const battlefieldId of BATTLEFIELDS) {
      const battlefieldEnds = ended.filter((event) => event.battlefieldId === battlefieldId);
      expect(battlefieldEnds).toHaveLength(LAST_WAVE);
      expect(battlefieldEnds.every((event) => event.spawningCompleted)).toBe(true);
    }
  });

  it('emits 60 spawning-completed events across both battlefields', () => {
    expect(eventsOfType(firstRun.events, 'wave_ended')).toHaveLength(LAST_WAVE * BATTLEFIELDS.length);
  });

  it('never overwrites an unfinished wave on p1', () => {
    const events = eventsOfType(firstRun.events, 'wave_ended')
      .filter((event) => event.battlefieldId === 'lane_p1')
      .sort((left, right) => left.waveNumber - right.waveNumber);
    for (let index = 1; index < events.length; index += 1) {
      const [previous, current] = requireSequentialEvent(events, index);
      expect(current.waveNumber).toBe(previous.waveNumber + 1);
      expect(current.tick).toBeGreaterThanOrEqual(previous.tick);
    }
  });

  it('never overwrites an unfinished wave on p2', () => {
    const events = eventsOfType(firstRun.events, 'wave_ended')
      .filter((event) => event.battlefieldId === 'lane_p2')
      .sort((left, right) => left.waveNumber - right.waveNumber);
    for (let index = 1; index < events.length; index += 1) {
      const [previous, current] = requireSequentialEvent(events, index);
      expect(current.waveNumber).toBe(previous.waveNumber + 1);
      expect(current.tick).toBeGreaterThanOrEqual(previous.tick);
    }
  });

  it('keeps each wave-ended event after its battlefield spawn events', () => {
    const ended = eventsOfType(firstRun.events, 'wave_ended');
    for (const event of ended) {
      const spawns = spawnsFor(firstRun.events, event.waveNumber, event.battlefieldId);
      const lastSpawn = spawns.at(-1);
      if (!lastSpawn) {
        throw new Error(`Wave ${event.waveNumber} has no spawn for ${event.battlefieldId}`);
      }
      expect(event.tick).toBeGreaterThanOrEqual(lastSpawn.tick);
    }
  });

  it('keeps basic monster counts on the configured curve', () => {
    for (let waveNumber = 1; waveNumber <= LAST_WAVE; waveNumber += 1) {
      const basicGroup = requireWaveDefinition(waveNumber).groups.find(
        (group) => group.monsterType === 'basic',
      );
      if (!basicGroup) {
        throw new Error(`Wave ${waveNumber} is missing its basic group`);
      }
      expect(basicGroup.count).toBe(Math.min(3 + Math.floor((waveNumber - 1) / 3), 8));
    }
  });

  it('introduces swift monsters on every fifth wave', () => {
    for (let waveNumber = 1; waveNumber <= LAST_WAVE; waveNumber += 1) {
      const hasSwift = requireWaveDefinition(waveNumber).groups.some(
        (group) => group.monsterType === 'swift',
      );
      expect(hasSwift).toBe(waveNumber % 5 === 0);
    }
  });

  it('introduces flying monsters on every sixth wave from Wave 6', () => {
    for (let waveNumber = 1; waveNumber <= LAST_WAVE; waveNumber += 1) {
      const hasFlying = requireWaveDefinition(waveNumber).groups.some(
        (group) => group.monsterType === 'flying',
      );
      expect(hasFlying).toBe(waveNumber >= 6 && waveNumber % 6 === 0);
    }
  });

  it('introduces siege monsters on every tenth wave', () => {
    for (let waveNumber = 1; waveNumber <= LAST_WAVE; waveNumber += 1) {
      const hasSiege = requireWaveDefinition(waveNumber).groups.some(
        (group) => group.monsterType === 'siege',
      );
      expect(hasSiege).toBe(waveNumber % 10 === 0);
    }
  });

  it('introduces bosses on every tenth wave', () => {
    for (let waveNumber = 1; waveNumber <= LAST_WAVE; waveNumber += 1) {
      const hasBoss = requireWaveDefinition(waveNumber).groups.some(
        (group) => group.monsterType === 'boss',
      );
      expect(hasBoss).toBe(waveNumber % 10 === 0);
    }
  });

  it('emits one wave_started event for every wave through Wave 30', () => {
    const starts = eventsOfType(firstRun.events, 'wave_started');
    expect(starts).toHaveLength(LAST_WAVE);
    expect(starts.map((event) => event.waveNumber)).toEqual(
      Array.from({ length: LAST_WAVE }, (_, index) => index + 1),
    );
  });

  it('gives p1 and p2 the same monster type composition for every wave', () => {
    for (let waveNumber = 1; waveNumber <= LAST_WAVE; waveNumber += 1) {
      const p1Types = spawnsFor(firstRun.events, waveNumber, 'lane_p1').map(
        (event) => event.monsterType,
      );
      const p2Types = spawnsFor(firstRun.events, waveNumber, 'lane_p2').map(
        (event) => event.monsterType,
      );
      expect(p1Types).toEqual(p2Types);
    }
  });

  it('spawns Wave 1 on p1 with an exact 20-tick gap', () => {
    const spawns = spawnsFor(firstRun.events, 1, 'lane_p1');
    expect(spawns).toHaveLength(3);
    const [first, second] = requireSequentialEvent(spawns, 1);
    const [middle, last] = requireSequentialEvent(spawns, 2);
    expect(second.tick - first.tick).toBe(21);
    expect(last.tick - middle.tick).toBe(21);
  });

  it('spawns Wave 1 on p2 with an exact 20-tick gap', () => {
    const spawns = spawnsFor(firstRun.events, 1, 'lane_p2');
    expect(spawns).toHaveLength(3);
    const [first, second] = requireSequentialEvent(spawns, 1);
    const [middle, last] = requireSequentialEvent(spawns, 2);
    expect(second.tick - first.tick).toBe(21);
    expect(last.tick - middle.tick).toBe(21);
  });

  it('records Wave 1 spawning completion at the final Wave 1 spawn tick', () => {
    for (const battlefieldId of BATTLEFIELDS) {
      const finalSpawn = spawnsFor(firstRun.events, 1, battlefieldId).at(-1);
      const end = eventsOfType(firstRun.events, 'wave_ended').find(
        (event) => event.waveNumber === 1 && event.battlefieldId === battlefieldId,
      );
      if (!finalSpawn || !end) {
        throw new Error(`Missing Wave 1 completion events for ${battlefieldId}`);
      }
      expect(end.tick).toBe(finalSpawn.tick);
      expect(end.spawningCompleted).toBe(true);
    }
  });

  it('produces the same canonical hash and event counts for the same seed', () => {
    const secondRun = runThroughWave30(TEST_SEED);
    expect(secondRun.finalHash).toBe(firstRun.finalHash);
    expect(secondRun.events).toHaveLength(firstRun.events.length);
    expect(eventsOfType(secondRun.events, 'wave_monster_spawned')).toHaveLength(
      eventsOfType(firstRun.events, 'wave_monster_spawned').length,
    );
    expect(eventsOfType(secondRun.events, 'wave_ended')).toHaveLength(
      eventsOfType(firstRun.events, 'wave_ended').length,
    );
  });
});
