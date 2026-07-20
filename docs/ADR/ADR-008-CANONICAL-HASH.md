# ADR-008｜Canonical State Hash

- Status：Accepted
- Date：2026-07-20
- Supersedes：N/A

## Context

Chaos TD requires deterministic state hashing for:
- Replay verification
- Checkpoint snapshots
- Cross-client state comparison

The hash must be:
- Reproducible across all JS runtimes (Browser, Node.js)
- Stable across serialization rounds
- Fast enough for per-tick hashing

## Decision

Use **FNV-1a 64-bit** hash algorithm with explicit version handling.

## Hash Contract

| Field | Value |
|-------|-------|
| Algorithm | `fnv1a64` |
| Version | `1` |
| Bit Width | 64-bit unsigned |
| Output Format | Lowercase 16-character hex string |
| Encoding | UTF-8 bytes |

## Implementation

### FNV-1a Constants

```
Offset Basis: 14695981039346656037 (0xcbf29ce484222325)
Prime: 1099511628211 (0x100000001b3)
```

### UTF-8 Encoding

```ts
function utf8Encode(str: string): Uint8Array {
  // ASCII: 0xxxxxxx
  // 2-byte: 110xxxxx 10xxxxxx (c0-dfff)
  // 3-byte: 1110xxxx 10xxxxxx 10xxxxxx (e000-ffff)
  // 4-byte (surrogate pairs): 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
}
```

### String Canonicalization

```ts
// Strings are canonicalized via JSON.stringify (includes quotes)
canonicalize("test") → "\"test\""
```

### FNV-1a Process

```
hash = OFFSET_BASIS
for each byte b in utf8(input):
    hash = hash XOR b
    hash = hash * PRIME
    hash = hash & 0xFFFFFFFFFFFFFFFF  // clamp to 64-bit
return hash as 16-char hex
```

## Test Vectors

### Full State Test Vector

```
Input: MatchState with seed="test"
Canonical Text:
{"configVersion":"1.0.0","monsters":[],"phase":"ready","players":{"p1":{"playerId":"p1"},"p2":{"playerId":"p2"}},"result":null,"schemaVersion":1,"seed":"test","tick":0,"towers":[]}
FNV-1a 64: 8ef8adbc744cd21f
```

### Isolated String Test Vectors

These verify UTF-8 encoding correctness:

| JS Value | Canonical Text | UTF-8 Bytes | FNV-1a 64 |
|----------|----------------|-------------|------------|
| `"test"` | `"test"` | `[22,74,65,73,74,22]` | `3751450a2013b125` |
| `"混沌攻防"` | `"混沌攻防"` | `[22,e6,b7,b7,e6,b2,8c,e6,94,bb,e9,98,b2,22]` | `b8cc56c1773a0795` |
| `"測試-seed-中文"` | `"測試-seed-中文"` | `[22,e6,b8,ac,e8,a9,a6,2d,73,65,65,64,2d,e4,b8,ad,e6,96,87,22]` | `bba73f81087e2439` |
| `"🐑"` | `"🐑"` | `[22,f0,9f,90,91,22]` | `7568c856f13c6a73` |

### Full State Hashes with Various Seeds

| Seed | Full State Hash |
|------|-----------------|
| `"test"` | `8ef8adbc744cd21f` |
| `"混沌攻防"` | `eb7d3bf0ffb5cd63` |
| `"測試-seed-中文"` | `e64ef410a5fb0427` |
| `"🐑"` | `1dd57eab3a7efe29` |

## Type Restrictions

Canonical serializer accepts only:

- `null`
- `boolean`
- `finite number` (including `-0` → `"0"`)
- `string` (via JSON.stringify)
- `dense array` (no undefined, no sparse)
- `plain object` (Object.prototype or null prototype)

Rejected types (will throw):
- `undefined`
- `NaN`, `Infinity`, `-Infinity`
- `BigInt`
- `Symbol`
- `Function`
- `Date`
- `Map`, `Set`, `WeakMap`, `WeakSet`
- `ArrayBuffer`, `TypedArray`
- Class instances
- Circular references

## Consequences

- **Positive**: Zero dependencies, deterministic in all JS engines, fast
- **Risk**: None - collision-resistant enough for game checkpoints
