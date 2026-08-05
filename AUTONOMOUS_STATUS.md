# Autonomous Build Status

## Current

- **Branch**: `main`
- **Milestone**: P1.6 v2: AI Observation Contract — Self-play Integrity
- **Task**: P1.6-010B DONE / MERGED
- **Main HEAD after PR #6 squash merge**: `96228276e165c3392bd3013d9d5e48ab49b2c3d0`
- **P1.6-010A**: DONE (PR #5 merged)
- **P1.6-010B implementation commit**: `6012816159b4956471fad75ff76a614fffcfc5e4`
- **P1.6-010B documentation closure commit**: `3af2b0170f75fb7ff411fdbd5d89589c50b03e18`
- **PR #6**: MERGED
- **PR #6 merged at**: `2026-07-30T17:36:55Z`
- **Squash merge SHA**: `96228276e165c3392bd3013d9d5e48ab49b2c3d0`
- **Final PR CI Run**: `30566031200`
- **CI conclusion**: SUCCESS
- **Next planned task**: P1.6-012 Balance Sim Strategy Adapter
- **P1.6-011**: DONE / verified

## Completed Tasks

| Task | Commit | Tests | Push |
|------|--------|-------|------|
| P1.6-000 | 584bb90 | lint pass | Yes (PR #4) |
| P1.6-001 | 36470f2 | 5 passed | Yes (PR #4) |
| P1.6-002 | 7c4484f | 4 passed | Yes (PR #4) |
| P1.6-003 | bf2a3dd | 3 passed | Yes (PR #4) |
| P1.6-004 | 8e7d115 | 2 passed | Yes (PR #4) |
| P1.6-005/006 | 845027d | 4 passed | Yes (PR #4) |
| P1.6-007 | c1ee88a | 2 passed | Yes (PR #4) |
| P1.6-008/009 | bfc976c | 2 passed | Yes (PR #4) |
| P1.6-010 (obs) | 2e69e9c | 22 passed | Yes (PR #5 — merged) |
| P1.6-010 (compat) | c562f85 | 5 passed | Yes (PR #5 — merged) |
| P1.6-010A (cleanup) | 327ed02 | DONE | Yes (PR #5 — merged) |
| P1.6-010B (integrity) | 96228276e165c3392bd3013d9d5e48ab49b2c3d0 | 28 lane/leak tests + existing suite | Yes (PR #6 — squash merged) |

## P1.6-010B Acceptance Criteria (COMPLETE)

### 1. Formal Self-play Lane — FIXED
- `createSelfPlayLanes()` exported from `ai-training`
- Uses `MVP_MIRROR_01.lanes` full definitions: waypoints, spawnPosition, endPosition
- `segments` built via `createPathSegments(definition.waypoints)`
- `totalPathLength` computed via `calculatePathLength(definition.waypoints)`
- No zero-length placeholder lanes
- Tests: waypoint parity, segments non-empty, totalPathLength > 0, deterministic self-play, real monster movement

### 2. Queue Contract — FIXED
- `BattlefieldObservation.outboundQueueLength` **removed** entirely
- Queue length is **only** on `SelfAIObservation.outboundQueueLength`
- `generateLegalActions` uses `obs.self.outboundQueueLength` and `GLOBAL_CONFIG.sendQueueLimit` (no magic 30)
- Tests: own queue below limit → queue_monster available; own queue at limit → blocked; opponent queue hidden → no leakage; limit reads from GLOBAL_CONFIG

### 3. Tower Ownership Mapping — FIXED
- `buildTowerEntityMap(towers, ownerId)` filters by owner
- Per-player tower maps: `p1TowerMap` and `p2TowerMap` are independent
- p1 cannot reference p2 tower entity IDs (and vice versa)
- Tests: same-cell dual-tower maps differ; p1 upgrade ignores p2; slot swap mirror symmetric

### 4. Leakage Integration Tests — STRENGTHENED
- Adapter-level tests using authoritative simulation state
- Opponent economy (gold/income) variations → observations, actions, decisions all identical
- Opponent outbound queue variations → invisible
- Own outbound queue → visible, affects queue actions
- Pending commands documented as outside observation contract
- Two-authoritative-state setup to verify adapter isolation

### 5. Type Contract Tests — FIXED
- Uses `satisfies BuildAIObservationInput` with complete valid fixture
- Compile-negative fixtures for `publicOpponent.gold`, `publicOpponent.income`, `opponentBattlefield.outboundQueue`
- `@ts-expect-error` directives target exactly the forbidden fields

### 6. Caller Labels — UNCHANGED
- Self-play: **INTEGRATED** (uses `decideStrategyCommand` adapter)
- Balance sim: **NOT_INTEGRATED** (needs its own adapter)
- Client: **NOT_INTEGRATED** (no Playtest adapter yet)
- Balance Data Changes: **NONE**

### 7. Public Event Boundary — NOT IMPLEMENTED
- `observationFromDomainEvents()` removed
- ADR-011 documents this as NOT IMPLEMENTED
- Public Event Reconstruction: **NOT_IMPLEMENTED**

## Phase 1 Gate Results

| Gate | Status |
|------|--------|
| M0 Gate | PASS |
| M1 Gate | PASS |
| M2 Gate | PASS |
| M3 Gate | PASS |
| M4 Gate | PASS |
| M5 Gate | PASS |
| M6 Gate | PASS |
| P1.6 | PASS (merged) |
| P1.6-010A | PASS (merged) |
| P1.6-010B | PASS (merged) |

## Phase 1 Summary

### Completed Features
- Deterministic fixed-step simulation (20 ticks/sec)
- 4 tower types: Archer, Mage, Frost, Sniper
- 4 monster types: Sheep, Wolf, Treant, Ghost
- Advanced combat: Armor, Shield, Splash, Slow
- Economy: Gold, Income, Build/Upgrade/Sell
- AI: Threat assessment, defense/offense decisions
- Replay: Event capture, serialization, checkpoints
- Client: Phaser rendering with placeholder graphics

### Test Coverage
- 462 tests passing at P1.6-010B final verification
- Deterministic behavior verified
- Stress testing capability ready

## Pending Placeholders

- **Assets**: Client uses specification-approved placeholder rendering (colored shapes)
- **Copy**: None
- **Tutorial**: Four-step contextual tips with skip support

## Known Non-blocking Risks

- Client production bundle is 1,405 kB and triggers Vite's chunk-size warning
- Package-local Vitest scripts inherit root-relative include paths

## Remaining Integration Gaps

- Balance Sim strategy adapter: **NOT_INTEGRATED**
- Client strategy adapter: **NOT_INTEGRATED**
- Public Event Reconstruction: **NOT_IMPLEMENTED**

## Next Planned Task

- **P1.6-012**: Balance Sim Strategy Adapter
- **Status**: IN PROGRESS

## P1.6-011 Completion

- Deterministic evolutionary training supports canonical reports, checkpoints,
  resume, telemetry, and frozen-pool candidate generation.
- Resume uses the original full configuration and generation index, producing
  the same final population as uninterrupted training.
- Smoke training, evaluation, and resume completed with canonical hash
  `cf772294378482ef`.
- Verification: `ai:train:e2e` (31 tests), `ai:check` (38 tests), production
  typecheck, lint, and the full suite (502 Vitest + 2 asset-admin tests) pass.

## Phase 2 Gate Assessment

### Required Human Decisions

1. **是否進入 Phase 2 Online 1v1**
2. **是否開始正式美術替換**
3. **是否進行公開測試**
4. **是否實現 Tutorial 系統**

### Phase 2 Features (Not Implemented)
- Online PvP
- Server infrastructure
- Database
- User accounts
- Rank/Season
- Social features
