# Autonomous Build Status

## Current

- **Branch**: `autonomous/ai-self-play-v2`
- **Milestone**: P1.6 v2: AI Observation Contract
- **Task**: P1.6-010 COMPLETE; Draft PR #5 awaiting merge
- **Baseline**: `c562f85` (observation contract, leak tests, compat checks)
- **Test status**: 442 tests pass; CI green on PR #5

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
| P1.6-010 (obs) | 2e69e9c | 22 passed | Yes (PR #5) |
| P1.6-010 (compat) | c562f85 | 5 passed | Yes (PR #5) |

## P1.6 v2 Key Changes

### Observation Contract
- `AIObservation` interface: `self` (HP, Gold, Income, towers, role coverage) + `opponent` (HP, visible towers, coverage, pressure) — no exact opponent Gold/Income
- `OpponentEconomyEstimate`: all fields zero / `hasEstimate: false` (reserved for future)
- `buildAIObservation(playerId, BuildObservationInput)`: single shared builder for all consumers
- Policy functions (`scoreAIAction`, `selectAIAction`, `generateLegalActions`) accept `AIObservation`, never `SimulationState`

### Leak-Prevention Tests
- Opponent Gold changes do not affect observation or decision
- Opponent Income changes do not affect observation or decision
- Economy fields always zero/absent regardless of actual values
- `toGameCommand` is the only command output path

### Content Compatibility
- `checkStrategyCompatibility(genome)`: detects new tower roles, damage types, movement types, tags
- `checkPoolCompatibility(pool)`: batch check for frozen strategy pools
- Result levels: `compatible`, `requires_reevaluation`, `requires_retraining`, `unsupported`

### Smoke Baseline
- `data/ai/frozen/strategy-pool-smoke-v1.json`: 1 initial frozen strategy
- `reports/ai/latest/match-summary.jsonl`: smoke match record
- `npm run ai:check`: runs league + compat tests

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
- 228 unit tests
- All tests passing
- Deterministic behavior verified
- Stress testing capability ready

## Pending Placeholders

- **Assets**: Client uses specification-approved placeholder rendering (colored shapes)
- **Copy**: None
- **Tutorial**: Four-step contextual tips with skip support

## Known Non-blocking Risks

- Client production bundle is 1,405 kB and triggers Vite's chunk-size warning
- Package-local Vitest scripts inherit root-relative include paths

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
