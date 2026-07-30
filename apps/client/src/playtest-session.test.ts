import { describe, expect, it } from 'vitest';
import { MVP_MIRROR_01 } from '@chaos-td/game-data';
import { PlaytestSession, PLAYTEST_CONTROLLERS, PLAYTEST_SEED, createNextPlaytestSeed } from './playtest-session';

function advanceUntil(session: PlaytestSession, predicate: () => boolean, maximumSteps = 2_000): void {
  for (let step = 0; step < maximumSteps; step += 1) {
    if (predicate()) return;
    session.step();
  }
  throw new Error('Playtest session did not reach the expected state');
}

describe('PlaytestSession', () => {
  it('starts the fixed human versus normal AI playtest match', () => {
    const session = new PlaytestSession();

    expect(session.getViewModel().seed).toBe(PLAYTEST_SEED);
    expect(session.getViewModel().controllers).toEqual(PLAYTEST_CONTROLLERS);
    expect(session.simulation.state.players.p1.hp).toBe(session.simulation.state.players.p2.hp);
  });

  it('routes a legal human build through the core command API', () => {
    const session = new PlaytestSession();
    const p1Lane = MVP_MIRROR_01.lanes.find((lane) => lane.id === 'lane_p1');
    if (!p1Lane) throw new Error('Missing p1 lane definition');
    const cell = p1Lane.aiBuildPriorityCells[0];
    if (!cell) throw new Error('Missing p1 build cell');
    advanceUntil(session, () => session.simulation.state.phase === 'running');

    session.buildHumanTower('archer', cell.col, cell.row);
    session.step();

    expect(session.simulation.state.towers.some((tower) => tower.ownerId === 'p1')).toBe(true);
    expect(session.getViewModel().lastCommandOutcomes.p1).toMatchObject({ type: 'command_accepted', playerId: 'p1' });
  });

  it('routes human sends into p2 battlefield and exposes command feedback', () => {
    const session = new PlaytestSession();
    advanceUntil(session, () => session.simulation.state.phase === 'running');

    session.queueHumanMonster('sheep');
    session.step();
    advanceUntil(session, () => session.simulation.state.lanes.lane_p2.monsters.some((monster) => monster.source.type === 'player'));

    expect(session.simulation.state.lanes.lane_p1.monsters.some((monster) => monster.source.type === 'player')).toBe(false);
    expect(session.getViewModel().lastCommandOutcomes.p1).toMatchObject({ type: 'command_accepted', playerId: 'p1' });
  });

  it('runs p2 commands solely through the formal normal AI adapter', () => {
    const session = new PlaytestSession();
    advanceUntil(session, () => session.getViewModel().lastCommand?.source === 'normal_ai', 300);

    const command = session.getViewModel().lastCommand;
    expect(command?.source).toBe('normal_ai');
    expect(command?.command.playerId).toBe('p2');
  });

  it('streams wave and rejection events to the observer view model', () => {
    const session = new PlaytestSession();
    advanceUntil(session, () => session.getViewModel().lastEvents.some((event) => event.type === 'wave_started'), 500);
    advanceUntil(session, () => session.getViewModel().lastEvents.some((event) => event.type === 'wave_monster_spawned'), 500);

    session.queueHumanMonster('not-a-monster');
    session.step();

    expect(session.getViewModel().lastCommandOutcomes.p1).toMatchObject({ type: 'command_rejected', playerId: 'p1' });
  });

  it('keeps observer reads from mutating the final state hash', () => {
    const left = new PlaytestSession('observer-hash-seed');
    const right = new PlaytestSession('observer-hash-seed');

    for (let tick = 0; tick < 180; tick += 1) {
      left.getViewModel();
      left.step();
      right.step();
    }

    expect(left.simulation.state.stateHash).toBe(right.simulation.state.stateHash);
  });

  it('reproduces an identical result for the same seed and human script', () => {
    const executeScript = (session: PlaytestSession): string => {
      const p1Lane = MVP_MIRROR_01.lanes.find((lane) => lane.id === 'lane_p1');
      if (!p1Lane) throw new Error('Missing p1 lane definition');
      const cell = p1Lane.aiBuildPriorityCells[0];
      if (!cell) throw new Error('Missing p1 build cell');
      advanceUntil(session, () => session.simulation.state.phase === 'running');
      session.buildHumanTower('archer', cell.col, cell.row);
      session.step();
      session.queueHumanMonster('sheep');
      for (let tick = 0; tick < 300; tick += 1) session.step();
      return session.simulation.state.stateHash;
    };

    expect(executeScript(new PlaytestSession('repeatable-human-script'))).toBe(executeScript(new PlaytestSession('repeatable-human-script')));
  });

  it('derives a visible deterministic replacement seed', () => {
    const next = createNextPlaytestSeed(PLAYTEST_SEED);
    expect(next).not.toBe(PLAYTEST_SEED);
    expect(createNextPlaytestSeed(PLAYTEST_SEED)).toBe(next);
  });
});
