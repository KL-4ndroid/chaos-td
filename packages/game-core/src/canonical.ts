/**
 * @chaos-td/game-core - Canonical State Serialization and Hash
 *
 * Deterministic state hashing for replay verification and checkpoints.
 * Not cryptographically secure - use for deterministic checkpointing only.
 *
 * Hash Contract:
 * - Algorithm: FNV-1a
 * - Version: 1 (explicit)
 * - Bit Width: 64-bit unsigned
 * - Output Format: Lowercase 16-character hex string
 * - Encoding: UTF-8 bytes
 *
 * Reference: ADR-008-CANONICAL-HASH
 */

import type { BattlefieldId } from '@chaos-td/game-data';

export type PlayerSlot = 'p1' | 'p2';
export type Phase = 'ready' | 'countdown' | 'running' | 'resolving' | 'result';

/**
 * Who sent / spawned a monster — used in canonical state and hash.
 * Replaces the previous ownerId: PlayerSlot | 'system' pattern.
 */
export type MonsterSource =
  | { readonly type: 'player'; readonly playerId: PlayerSlot }
  | { readonly type: 'wave'; readonly waveNumber: number };

export interface PlayerSlotState {
  playerId: PlayerSlot;
}

export interface TowerState {
  id: number;
  ownerId: PlayerSlot;
  level: 1 | 2 | 3;
  cellX: number;
  cellY: number;
}

export interface MonsterState {
  id: number;
  /** Who sent this monster */
  source: MonsterSource;
  /** Which battlefield this monster occupies (LaneId = battlefieldId) */
  battlefieldId: BattlefieldId;
  hp: number;
  shield: number;
  pathProgressMilliTiles: number;
  routeWaypoints?: readonly { xMilliTiles: number; yMilliTiles: number }[];
  alive: boolean;
  movementType: 'ground' | 'flying';
  tags: readonly string[];
}

export interface MatchResult {
  winnerPlayerId: PlayerSlot | null;
  outcome: 'win' | 'draw';
  reason: string;
  endedAtTick: number;
  finalStateHash: string;
}

export interface CanonicalState {
  schemaVersion: number;
  configVersion: string;
  seed: string;
  phase: Phase;
  tick: number;
  players: Record<PlayerSlot, PlayerSlotState>;
  towers: TowerState[];
  monsters: MonsterState[];
  result: MatchResult | null;
  waveCurrentWaveNumber: number;
}

// Explicit hash contract
export const STATE_HASH_ALGORITHM = 'fnv1a64' as const;
export const STATE_HASH_VERSION = 1 as const;

export interface StateHash {
  algorithm: typeof STATE_HASH_ALGORITHM;
  version: typeof STATE_HASH_VERSION;
  value: string;
}

/**
 * Check if object is a plain object (has Object.prototype as its prototype,
 * or has null prototype).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Canonical JSON serializer.
 *
 * ALLOWED TYPES:
 * - null
 * - boolean
 * - finite number (including -0 which normalizes to 0)
 * - string
 * - dense array (no undefined, no sparse)
 * - plain object (Object.prototype or null prototype)
 *
 * REJECTED TYPES (will throw):
 * - undefined
 * - NaN, Infinity, -Infinity
 * - BigInt
 * - Symbol
 * - Function
 * - Date
 * - Map
 * - Set
 * - WeakMap
 * - WeakSet
 * - ArrayBuffer / TypedArray
 * - class instances
 * - circular references
 *
 * Rules:
 * - null → "null", undefined → throws
 * - boolean → "true"/"false"
 * - number: integer → String(n), finite float → String(n), NaN/Infinity → throws
 * - string → JSON.stringify (with quotes)
 * - Array: preserve order, map recursively, throw on undefined/sparse
 * - Object: sort keys alphabetically, map recursively, must be plain
 */
export function canonicalize(state: CanonicalState): string {
  return canonicalizeValue(state);
}

function canonicalizeValue(obj: unknown): string {
  // null
  if (obj === null) {
    return 'null';
  }

  // undefined
  if (obj === undefined) {
    throw new Error('canonicalize: undefined is not allowed');
  }

  // boolean
  if (typeof obj === 'boolean') {
    return obj ? 'true' : 'false';
  }

  // number
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) {
      throw new Error(`canonicalize: non-finite number not allowed: ${obj}`);
    }
    if (Object.is(obj, -0)) {
      // Normalize -0 to 0
      return '0';
    }
    return String(obj);
  }

  // string
  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }

  // Array (must be dense, no undefined)
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';
    }
    const elements: string[] = [];
    for (let i = 0; i < obj.length; i++) {
      if (i in obj === false) {
        throw new Error(`canonicalize: sparse array not allowed at index ${i}`);
      }
      const value = obj[i];
      if (value === undefined) {
        throw new Error(`canonicalize: array element undefined at index ${i}`);
      }
      elements.push(canonicalizeValue(value));
    }
    return '[' + elements.join(',') + ']';
  }

  // Object (must be plain object)
  if (typeof obj === 'object') {
    if (!isPlainObject(obj)) {
      throw new Error(`canonicalize: non-plain object not allowed: ${Object.prototype.toString.call(obj)}`);
    }
    const keys = Object.keys(obj).sort();
    if (keys.length === 0) {
      return '{}';
    }
    const pairs: string[] = [];
    for (const k of keys) {
      const value = obj[k];
      if (value === undefined) {
        throw new Error(`canonicalize: object property undefined for key "${k}"`);
      }
      pairs.push(JSON.stringify(k) + ':' + canonicalizeValue(value));
    }
    return '{' + pairs.join(',') + '}';
  }

  // BigInt
  if (typeof obj === 'bigint') {
    throw new Error('canonicalize: BigInt not supported');
  }

  // Symbol, Function, and any other unsupported types
  throw new Error(`canonicalize: unsupported type: ${typeof obj}`);
}

/**
 * FNV-1a 64-bit hash.
 * Zero dependencies, cross-JS-runtime stable, collision-resistant enough for game checkpoints.
 *
 * Input: UTF-16 string → UTF-8 bytes → FNV-1a 64-bit hash
 * Output: Lowercase 16-character hex string (unsigned 64-bit)
 */
export function hashState(state: CanonicalState): StateHash {
  const json = canonicalize(state);
  return {
    algorithm: STATE_HASH_ALGORITHM,
    version: STATE_HASH_VERSION,
    value: fnv1a64HashUtf8(json),
  };
}

/**
 * Returns raw hex string for backward compatibility.
 */
export function hashStateToString(state: CanonicalState): string {
  return hashState(state).value;
}

/**
 * Encode UTF-16 string to UTF-8 bytes (pure JS, no DOM dependency).
 * Correctly handles:
 * - ASCII (1 byte)
 * - Latin Extended (2 bytes)
 * - CJK Unified Ideographs (3 bytes)
 * - Emoji / Surrogate Pairs (4 bytes)
 */
function utf8Encode(str: string): Uint8Array {
  const result: number[] = [];

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    // Check for high surrogate first (must be combined with low surrogate)
    if (code >= 0xD800 && code <= 0xDBFF) {
      const high = code;
      const low = str.charCodeAt(++i);
      const codepoint = 0x10000 + ((high - 0xD800) << 10) + (low - 0xDC00);
      // 4-byte: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
      result.push(0xF0 | (codepoint >> 18));
      result.push(0x80 | ((codepoint >> 12) & 0x3F));
      result.push(0x80 | ((codepoint >> 6) & 0x3F));
      result.push(0x80 | (codepoint & 0x3F));
    } else if (code < 0x80) {
      // ASCII: 0xxxxxxx
      result.push(code);
    } else if (code < 0x800) {
      // 2-byte: 110xxxxx 10xxxxxx
      result.push(0xC0 | (code >> 6));
      result.push(0x80 | (code & 0x3F));
    } else {
      // 3-byte: 1110xxxx 10xxxxxx 10xxxxxx
      result.push(0xE0 | (code >> 12));
      result.push(0x80 | ((code >> 6) & 0x3F));
      result.push(0x80 | (code & 0x3F));
    }
  }

  return new Uint8Array(result);
}

/**
 * FNV-1a 64-bit hash implementation.
 * Processes string as UTF-8 bytes.
 */
function fnv1a64HashUtf8(str: string): string {
  const FNV_OFFSET_LOW = 0x84222325;
  const FNV_OFFSET_HIGH = 0xcbf29ce4;
  const FNV_PRIME_LOW = 0x1b3;
  const FNV_PRIME_HIGH = 0x100;

  const bytes = utf8Encode(str);
  let low = FNV_OFFSET_LOW;
  let high = FNV_OFFSET_HIGH;

  for (let i = 0; i < bytes.length; i++) {
    low = (low ^ (bytes[i] ?? 0)) >>> 0;
    const lowProduct = low * FNV_PRIME_LOW;
    const carry = Math.floor(lowProduct / 0x100000000);
    const nextLow = lowProduct >>> 0;
    const nextHigh = high * FNV_PRIME_LOW + low * FNV_PRIME_HIGH + carry;
    low = nextLow;
    high = nextHigh >>> 0;
  }

  return (high >>> 0).toString(16).padStart(8, '0') + (low >>> 0).toString(16).padStart(8, '0');
}
