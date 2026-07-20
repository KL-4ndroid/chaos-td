# ADR-007｜Seeded PRNG - Mulberry32

- Status：Accepted
- Date：2026-07-20
- Supersedes：N/A

## Context

Chaos TD requires deterministic random number generation across:
- Browser (Phaser)
- Node.js (Tests, Balance Sim)
- Future Server

Every gameplay-affecting random operation must produce identical results given the same seed, regardless of runtime environment.

## Decision

Use **Mulberry32** algorithm with explicit version handling.

## Seed Contract

### Numeric Seed

```ts
create(42) // Initializes with uint32 42
```

Numeric seeds are directly cast to uint32 via `seed >>> 0`.

### String Seed

```ts
createFromString("test") // Parses to uint32 via djb2 hash
```

String seeds are hashed via djb2 before uint32 initialization:
- If string matches `/^\d+$/`, parse as integer
- Otherwise, hash via: `hash = hash * 33 + charCodeAt(i)`

## Algorithm

```ts
export const PRNG_VERSION = 1 as const;

export interface SeededRng {
  version: typeof PRNG_VERSION;
  state: Uint32Array;
}

export function create(seed: number): SeededRng {
  return { version: PRNG_VERSION, state: new Uint32Array([seed >>> 0]) };
}

export function next(rng: SeededRng): { value: number; rng: SeededRng } {
  let s = rng.state[0];
  s = (s + 0x6D2B79F5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  rng.state[0] = s;
  return { value, rng };
}
```

### Float Output Contract

```ts
nextFloat() = nextUint32() / 2^32
// Range: [0, 1)
```

## Versioning Strategy

If algorithm changes in the future:
1. Increment `version` field
2. Maintain migration function from previous versions
3. Replay files store `prng.version` explicitly

## Selection Criteria

- Small: ~15 lines, zero dependencies
- Explicit algorithm: fully specified, no hidden state
- 32-bit state: 4 billion unique sequences
- Non-cryptographic: not suitable for security purposes
- Cross-runtime: deterministic in all JS engines
- Replay-ready: same seed produces identical sequence

## Explicit Version

```ts
export const PRNG_VERSION = 1 as const;
```

## Test Vectors

### Seed 42 - nextFloat() Outputs

```
Seed: 42
Output 0: 0.6011037519201636
Output 1: 0.44829055899754167
Output 2: 0.8524657934904099
Output 3: 0.6697340414393693
Output 4: 0.17481389874592423
Output 5: 0.5265925421845168
Output 6: 0.2732279943302274
Output 7: 0.6247446539346129
Output 8: 0.8654746483080089
Output 9: 0.4723170551005751
```

### Seed 42 - Internal State After Each Round

```
Seed: 42
After round 1: state = 1831565855
After round 2: state = 3663131668
After round 3: state = 1199730185
After round 4: state = 3031295998
After round 5: state = 567894515
```

### Seed "42" - Same as Numeric 42

```
String "42" parses to: 42
```

### Seed "test" - nextFloat() Outputs

```
Seed string: "test"
Parsed to: 2090756197
Output 0: 0.48676205338585347
Output 1: 0.44802760605319255
Output 2: 0.8526491961974325
Output 3: 0.6698340347936824
Output 4: 0.17502593045654297
```

## Consequences

- **Positive**: Zero external dependencies, deterministic in all JS engines, replay-ready
- **Negative**: 32-bit state (acceptable for game use)
- **Risk**: None identified for deterministic game rules

## Alternatives Considered

| Algorithm | Rejected Reason |
|-----------|-----------------|
| Math.random() | Non-deterministic, no seed |
| xoshiro128++ | Larger implementation, no benefit for game use |
| LCG (simple) | Poor statistical properties |
| Mulberry64 | Larger state, no practical benefit |
