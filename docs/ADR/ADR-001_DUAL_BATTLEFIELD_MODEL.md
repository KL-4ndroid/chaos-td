# ADR-001｜Dual Battlefield Match Model

## Status

Accepted

## Context

The game is a 1v1 tower defense where two players each defend an independent battlefield against incoming monsters. The previous implementation used a single `WaveSchedulerState` shared across both battlefields and used `ownerId: 'system' as PlayerSlot` for wave monsters, which conflates system spawn with player identity and breaks future PvP, replay, bounty, and AI threat semantics.

### Previous (incorrect) mental model

```
Lane_p1 ── Lane_p2  (viewed as two paths on the same map)
```

This led to:
- Wave monster `ownerId = 'system'` — invalid PlayerSlot
- A single scheduler spawning simultaneously into both "lanes" as a side-effect of a single loop
- No per-battlefield spawn runtime isolation
- Incorrect documentation describing wave count as "6 monsters for wave 1" when each player actually faces 3

### Correct model

```
Match
├── Player p1 Battlefield
│   ├── defender: p1
│   ├── attacker: p2
│   ├── one path (path_p1)
│   ├── system wave monsters (source: wave)
│   └── opponent-sent monsters (source: player, playerId: p2)
│
└── Player p2 Battlefield
    ├── defender: p2
    ├── attacker: p1
    ├── one path (path_p2)
    ├── system wave monsters (source: wave)
    └── opponent-sent monsters (source: player, playerId: p1)
```

## Decision

### 1. Battlefield over Lane

Rename the domain concept from "Lane" to "Battlefield". The internal identifier `LaneId` is retained as a type alias (`BattlefieldId`) to minimize churn. Each `BattlefieldId` maps to exactly one player's defending path.

### 2. Monster Source Model

Monster provenance is explicitly tracked via a discriminated union, replacing `ownerId: PlayerSlot | 'system'`.

```ts
/** Who sent / spawned this monster */
type MonsterSource =
  | { readonly type: 'player'; readonly playerId: PlayerSlot }
  | { readonly type: 'wave'; readonly waveNumber: number };

interface MonsterRuntimeState {
  readonly entityId: number;
  readonly source: MonsterSource;
  /** Which battlefield this monster currently occupies */
  readonly battlefieldId: PlayerSlot;
  // ... rest of runtime state
}
```

**Invariants:**
- `source.type === 'player'` → the monster is a player-initiated send; it occupies the *opponent's* battlefield
- `source.type === 'wave'` → the monster is a system wave; it occupies its respective player's battlefield
- `source` is never `'system'` as a raw string; `'system'` does not exist in `PlayerSlot`

### 3. Wave Scheduler Structure

The wave scheduler has two layers:

```
MatchWaveMeta           (shared, fair)
  ├── currentWaveNumber: number
  └── ticksSinceRunningStart: number

BattlefieldWaveRuntime  (per battlefield, independent)
  ├── currentWaveIndex: number
  ├── currentGroupIndex: number
  ├── currentGroupSpawned: number
  ├── ticksUntilNextSpawn: number
  └── spawningCompleted: boolean
```

The `WaveDefinition` (monster groups, counts, difficulty multiplier) is a **shared, immutable, read-only** data structure. Both battlefields reference the same `WAVE_DEFINITIONS` array. Each battlefield advances its own `BattlefieldWaveRuntime` independently; a monster dying or leaking on one battlefield does not affect the other.

### 4. Player Send Direction

- `p1` sends → enters `battlefield_p2` (p2's battlefield)
- `p2` sends → enters `battlefield_p1` (p1's battlefield)
- This is enforced by `attackerId` / `defenderId` on each battlefield state

### 5. Wave Count Convention

Wave definitions describe the count **per battlefield**. "Wave 1 = basic × 3" means:
- p1's battlefield receives 3 basic monsters
- p2's battlefield receives 3 basic monsters
- Total entities created by the system = 6 (technical side-effect)

Formal documentation always describes wave count as "per battlefield".

### 6. Semantic fixes

- **Bounty / Kill Credit**: attributed to the defender; `source.playerId` for player-sent, `source.waveNumber` for system
- **Replay**: stores `source` discriminant, not a pseudo-player slot
- **AI Threat**: can distinguish wave pressure (system) from aggression pressure (opponent sends)
- **Future PvP**: replacing AI controller with a human controller changes only who issues commands; the wave model is unchanged

## Consequences

### Breaking changes

- `MonsterRuntimeState.ownerId` removed; replaced by `source` + `battlefieldId`
- `MonsterState.ownerId` in canonical/replay replaced by `source`
- `DomainEvent` fields referencing `ownerId` for wave monsters updated
- All code that read `ownerId === 'system'` must be updated
- State hash will change for any replay that includes wave monsters (expected; these were previously incorrect hashes)

### Migration path

1. Add `source` field to `MonsterRuntimeState` (non-breaking intermediate step)
2. Migrate `WaveMonsterSpawnedEvent`, `MonsterLeakedEvent`, `MonsterDiedEvent` fields
3. Update canonical serialization
4. Remove `ownerId: 'system' as PlayerSlot` from all spawn paths
5. Update tests to assert `source.type === 'wave'` instead of `ownerId === 'system'`

## References

- Core Game Rules: `docs/02_CORE_GAME_RULES.md`
- Data Contracts: `docs/07_DATA_CONTRACTS.md`
- Source of Truth: `docs/13_SOURCE_OF_TRUTH.md`
- Implementation: `packages/game-core/src/simulation.ts` (`processWaveScheduler`)
