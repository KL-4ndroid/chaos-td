/**
 * @chaos-td/game-core - Replay Tests
 */

import { describe, expect, it } from 'vitest';
import {
  createReplayData,
  addCheckpoint,
  addEvent,
  finalizeReplay,
  serializeReplay,
  deserializeReplay,
  verifyReplayIntegrity,
  getReplaySummary,
  REPLAY_CHECKPOINT_INTERVAL,
} from './replay';
import type { DomainEvent } from './events';

describe('Replay System', () => {
  const mockEvent: DomainEvent = {
    type: 'tower_built',
    tick: 100,
    playerId: 'p1',
    towerEntityId: 1,
    towerTypeId: 'archer',
    cellX: 3,
    cellY: 4,
    cost: 120,
  } as const;

  describe('createReplayData', () => {
    it('creates empty replay structure', () => {
      const replay = createReplayData('test-seed', '1.0.0', 'abc123');

      expect(replay.schemaVersion).toBe(1);
      expect(replay.seed).toBe('test-seed');
      expect(replay.configVersion).toBe('1.0.0');
      expect(replay.initialState).toBe('abc123');
      expect(replay.checkpoints).toEqual([]);
      expect(replay.events).toEqual([]);
      expect(replay.finalHash).toBe('abc123');
      expect(replay.durationTicks).toBe(0);
    });
  });

  describe('addCheckpoint', () => {
    it('adds checkpoint at correct interval', () => {
      const replay = createReplayData('test', '1.0.0', 'init');
      const withCheckpoint = addCheckpoint(replay, 100, 'hash100');

      expect(withCheckpoint.checkpoints).toHaveLength(1);
      expect(withCheckpoint.checkpoints[0]).toEqual({ tick: 100, hash: 'hash100' });
    });

    it('does not add checkpoint at non-interval ticks', () => {
      const replay = createReplayData('test', '1.0.0', 'init');
      const withoutCheckpoint = addCheckpoint(replay, 50, 'hash50');

      expect(withoutCheckpoint.checkpoints).toHaveLength(0);
    });

    it('adds multiple checkpoints', () => {
      let replay = createReplayData('test', '1.0.0', 'init');
      replay = addCheckpoint(replay, 100, 'hash100');
      replay = addCheckpoint(replay, 200, 'hash200');
      replay = addCheckpoint(replay, 300, 'hash300');

      expect(replay.checkpoints).toHaveLength(3);
    });
  });

  describe('addEvent', () => {
    it('adds event to replay', () => {
      const replay = createReplayData('test', '1.0.0', 'init');
      const withEvent = addEvent(replay, mockEvent);

      expect(withEvent.events).toHaveLength(1);
      expect(withEvent.events[0]).toEqual(mockEvent);
    });

    it('accumulates events', () => {
      let replay = createReplayData('test', '1.0.0', 'init');
      replay = addEvent(replay, mockEvent);
      replay = addEvent(replay, { ...mockEvent, tick: 200 });

      expect(replay.events).toHaveLength(2);
    });
  });

  describe('finalizeReplay', () => {
    it('sets final hash and duration', () => {
      const replay = createReplayData('test', '1.0.0', 'init');
      const finalized = finalizeReplay(replay, 'final-hash', 12000);

      expect(finalized.finalHash).toBe('final-hash');
      expect(finalized.durationTicks).toBe(12000);
    });
  });

  describe('serializeReplay / deserializeReplay', () => {
    it('serializes and deserializes correctly', () => {
      let replay = createReplayData('test-seed', '1.0.0', 'init-hash');
      replay = addCheckpoint(replay, 100, 'check100');
      replay = addEvent(replay, mockEvent);
      replay = finalizeReplay(replay, 'final-hash', 500);

      const json = serializeReplay(replay);
      const parsed = deserializeReplay(json);

      expect(parsed.seed).toBe('test-seed');
      expect(parsed.configVersion).toBe('1.0.0');
      expect(parsed.checkpoints).toHaveLength(1);
      expect(parsed.events).toHaveLength(1);
      expect(parsed.finalHash).toBe('final-hash');
      expect(parsed.durationTicks).toBe(500);
    });

    it('throws on invalid schema version', () => {
      const invalidJson = JSON.stringify({ schemaVersion: 99, seed: 'test', events: [] });

      expect(() => deserializeReplay(invalidJson)).toThrow('Unsupported replay schema version');
    });

    it('throws on missing seed', () => {
      const invalidJson = JSON.stringify({ schemaVersion: 1, events: [] });

      expect(() => deserializeReplay(invalidJson)).toThrow('Invalid replay');
    });
  });

  describe('verifyReplayIntegrity', () => {
    it('returns true for matching hashes', () => {
      const replay = createReplayData('test', '1.0.0', 'init');
      const finalized = finalizeReplay(replay, 'final-hash', 100);

      expect(verifyReplayIntegrity(finalized, 'final-hash')).toBe(true);
    });

    it('returns false for mismatched hashes', () => {
      const replay = createReplayData('test', '1.0.0', 'init');
      const finalized = finalizeReplay(replay, 'final-hash', 100);

      expect(verifyReplayIntegrity(finalized, 'wrong-hash')).toBe(false);
    });
  });

  describe('getReplaySummary', () => {
    it('returns summary with formatted duration', () => {
      const replay = createReplayData('my-seed', '1.0.0', 'init');
      const finalized = finalizeReplay(replay, 'final', 5000); // 5000 ticks = 4 min 10 sec

      const summary = getReplaySummary(finalized);

      expect(summary.seed).toBe('my-seed');
      expect(summary.duration).toBe('4:10');
      expect(summary.eventCount).toBe(0);
      expect(summary.checkpointCount).toBe(0);
    });

    it('counts events and checkpoints', () => {
      let replay = createReplayData('test', '1.0.0', 'init');
      replay = addCheckpoint(replay, 100, 'h1');
      replay = addCheckpoint(replay, 200, 'h2');
      replay = addEvent(replay, mockEvent);
      replay = addEvent(replay, mockEvent);
      replay = finalizeReplay(replay, 'final', 300);

      const summary = getReplaySummary(replay);

      expect(summary.eventCount).toBe(2);
      expect(summary.checkpointCount).toBe(2);
    });
  });

  describe('REPLAY_CHECKPOINT_INTERVAL', () => {
    it('is set to 100 ticks', () => {
      expect(REPLAY_CHECKPOINT_INTERVAL).toBe(100);
    });
  });
});
