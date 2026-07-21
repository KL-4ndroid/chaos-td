/**
 * @chaos-td/game-core - Replay System
 *
 * Deterministic replay capture and playback.
 * Enables exact reproduction of any game session.
 */

import type { DomainEvent } from './events';

/**
 * Replay data structure
 */
export interface Replay {
  /** Schema version for compatibility */
  schemaVersion: 1;
  /** Match configuration */
  seed: string;
  configVersion: string;
  /** Initial state snapshot (serialized) */
  initialState: string;
  /** State hashes at checkpoints (every 100 ticks) */
  checkpoints: readonly { tick: number; hash: string }[];
  /** All events in order */
  events: readonly DomainEvent[];
  /** Final state hash */
  finalHash: string;
  /** Replay duration in ticks */
  durationTicks: number;
}

/**
 * Replay checkpoint interval
 */
export const REPLAY_CHECKPOINT_INTERVAL = 100;

/**
 * Create empty replay data structure
 */
export function createReplayData(
  seed: string,
  configVersion: string,
  initialStateHash: string,
): Replay {
  return {
    schemaVersion: 1,
    seed,
    configVersion,
    initialState: initialStateHash,
    checkpoints: [],
    events: [],
    finalHash: initialStateHash,
    durationTicks: 0,
  };
}

/**
 * Add checkpoint to replay
 */
export function addCheckpoint(
  replay: Replay,
  tick: number,
  hash: string,
): Replay {
  if (tick % REPLAY_CHECKPOINT_INTERVAL !== 0) {
    return replay;
  }

  return {
    ...replay,
    checkpoints: [...replay.checkpoints, { tick, hash }],
  };
}

/**
 * Add event to replay
 */
export function addEvent(
  replay: Replay,
  event: DomainEvent,
): Replay {
  return {
    ...replay,
    events: [...replay.events, event],
  };
}

/**
 * Finalize replay with final hash
 */
export function finalizeReplay(
  replay: Replay,
  finalHash: string,
  durationTicks: number,
): Replay {
  return {
    ...replay,
    finalHash,
    durationTicks,
  };
}

/**
 * Serialize replay to JSON string
 */
export function serializeReplay(replay: Replay): string {
  return JSON.stringify(replay);
}

/**
 * Deserialize replay from JSON string
 */
export function deserializeReplay(json: string): Replay {
  const parsed = JSON.parse(json) as Replay;

  // Validate basic structure
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported replay schema version: ${parsed.schemaVersion}`);
  }

  if (!parsed.seed || typeof parsed.seed !== 'string') {
    throw new Error('Invalid replay: missing or invalid seed');
  }

  if (!Array.isArray(parsed.events)) {
    throw new Error('Invalid replay: missing or invalid events');
  }

  return parsed;
}

/**
 * Verify replay integrity by checking final hash
 */
export function verifyReplayIntegrity(
  replay: Replay,
  computedFinalHash: string,
): boolean {
  return replay.finalHash === computedFinalHash;
}

/**
 * Get replay metadata summary
 */
export function getReplaySummary(replay: Replay): {
  seed: string;
  duration: string;
  eventCount: number;
  checkpointCount: number;
} {
  const minutes = Math.floor(replay.durationTicks / 1200);
  const seconds = Math.floor((replay.durationTicks % 1200) / 20);

  return {
    seed: replay.seed,
    duration: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    eventCount: replay.events.length,
    checkpointCount: replay.checkpoints.length,
  };
}
