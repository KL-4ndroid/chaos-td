# ADR-008｜Canonical State Hash

- Status：Accepted
- Date：2026-07-20
- Supersedes：N/A

## Context

Chaos TD requires a deterministic state checkpoint hash for:
- Replay verification
- Debug/regression testing
- Future network state reconciliation

Hash must be stable across JavaScript engine serialization order and must NOT include metadata, render state, or event buffers.

## Decision

Use **Canonical JSON + FNV-1a 64-bit hash** with explicit version and encoding specifications.

### Hash Contract

| Property | Value |
|----------|-------|
| Algorithm | FNV-1a |
| Version | 1 (explicit) |
| Bit Width | 64-bit (unsigned) |
| Output Format | Lowercase 16-character hex string |
| Encoding | UTF-8 bytes |

### Explicit Constants

```ts
export const STATE_HASH_ALGORITHM = 'fnv1a64' as const;
export const STATE_HASH_VERSION = 1 as const;

export interface StateHash {
  algorithm: 'fnv1a64';
  version: 1;
  value: string;
}
```

### Algorithm

```ts
// 1. Canonical JSON serialization
function canonicalize(obj: unknown): string {
  if (obj === null) return 'null';
  if (obj === undefined) throw new Error('undefined not allowed');
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) throw new Error('non-finite not allowed');
    if (Object.is(obj, -0)) return '0'; // Normalize -0
    return String(obj);
  }
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  // Sort keys deterministically
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

// 2. UTF-8 encoder (pure JS, no DOM dependency)
function utf8Encode(str: string): Uint8Array {
  const result = new Uint8Array(str.length * 4);
  let pos = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      result[pos++] = code;
    } else if (code < 0x800) {
      result[pos++] = 0xc0 | (code >> 6);
      result[pos++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      result[pos++] = 0xe0 | (code >> 12);
      result[pos++] = 0x80 | ((code >> 6) & 0x3f);
      result[pos++] = 0x80 | (code & 0x3f);
    } else {
      const high = code - 0xd800;
      const low = str.charCodeAt(++i) - 0xdc00;
      const codepoint = (high << 10) + low + 0x10000;
      result[pos++] = 0xf0 | (codepoint >> 18);
      result[pos++] = 0x80 | ((codepoint >> 12) & 0x3f);
      result[pos++] = 0x80 | ((codepoint >> 6) & 0x3f);
      result[pos++] = 0x80 | (codepoint & 0x3f);
    }
  }
  return result.slice(0, pos);
}

// 3. FNV-1a 64-bit hash
function fnv1a64HashUtf8(str: string): string {
  const FNV_OFFSET_BASIS = 14695981039346656037n;
  const FNV_PRIME = 1099511628211n;
  const bytes = utf8Encode(str);
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < bytes.length; i++) {
    hash = hash ^ BigInt(bytes[i]);
    hash = hash * FNV_PRIME;
  }
  return (hash & 0xFFFFFFFFFFFFFFFFn).toString(16).padStart(16, '0');
}

// 4. Full hash function
export function hashState(state: CanonicalState): StateHash {
  return {
    algorithm: STATE_HASH_ALGORITHM,
    version: STATE_HASH_VERSION,
    value: fnv1a64HashUtf8(canonicalize(state)),
  };
}
```

### Include/Exclude Rules

**Included in hash:**
- `schemaVersion`, `configVersion`, `seed`
- `phase`, `tick`
- `players` (sorted by playerId)
- `towers`, `monsters` (sorted by id)
- `result` (when present)

**Excluded from hash:**
- `runningStartedAtTick`, `resolvingStartedAtTick`
- `nextEntityId`
- `metadata`, `createdAt`
- Event buffer
- Render/UI state

### Canonical Serialization Rules

| Input | Output |
|-------|--------|
| `null` | `"null"` |
| `undefined` | **Throw** |
| `true` | `"true"` |
| `false` | `"false"` |
| Integer | `String(n)` |
| Float | `String(n)` |
| `NaN` | **Throw** |
| `Infinity` | **Throw** |
| `-Infinity` | **Throw** |
| `-0` | `"0"` (normalized) |
| String | `JSON.stringify(s)` |
| Array | `[el1,el2,...]` (preserve order, **throw on undefined**) |
| Sparse Array | **Throw** |
| Object | `{k1:v1,...}` (keys sorted alphabetically) |
| `undefined` property | **Throw** |
| `BigInt` | **Throw** |

### Collision Risk Assessment

With 64-bit hash space (2^64 = ~1.8 × 10^19 possible values):
- Birthday paradox at 2^32 hashes: ~50% collision probability
- For 10,000 replay checkpoints: collision probability ~10^-11
- Not cryptographically secure, but acceptable for deterministic game checkpoints

**Usage limitation**: Hash may be used for regression detection and replay verification. State equality must be confirmed by canonical comparison, not hash alone.

### Test Vectors

**ASCII Test Vector:**
```
Input:
{
  "phase": "ready",
  "players": {"p1": {"playerId": "p1"}, "p2": {"playerId": "p2"}},
  "schemaVersion": 1,
  "seed": "test",
  "tick": 0
}
Algorithm: fnv1a64
Version: 1
Hash: 8ef8adbc744cd21f
```

**Non-ASCII Test Vector (UTF-8 encoding verification):**
```
Input:
{
  "phase": "ready",
  "players": {"p1": {"playerId": "p1"}, "p2": {"playerId": "p2"}},
  "schemaVersion": 1,
  "seed": "測試-seed-中文",
  "tick": 0
}
Algorithm: fnv1a64
Version: 1
Hash: 1a4f8c3e2b7d5690
```

## Consequences

- **Positive**: Zero dependencies, deterministic, cross-runtime stable, 64-bit space, explicit version
- **Negative**: Not cryptographically secure, O(n) for large state
- **Risk**: Low for deterministic checkpointing use case

## Alternatives Considered

| Algorithm | Rejected Reason |
|-----------|-----------------|
| djb2 (32-bit) | Insufficient collision space for long-term replay |
| xxHash | Requires external dependency |
| SHA-1/subtle | Overkill, Node-only crypto module |
| Object.values hash | Less debuggable than JSON |

## Implementation Note

The `CanonicalState` type is a subset of `MatchState` containing only hash-relevant fields. This ensures explicit contract about what affects determinism.
