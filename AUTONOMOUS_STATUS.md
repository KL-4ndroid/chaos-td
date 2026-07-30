# Autonomous Build Status

## Current

- **Branch**: `autonomous/ai-self-play-v2`
- **Milestone**: P1.6 v2: AI Observation Contract — Acceptance Cleanup
- **Task**: P1.6-010A IN PROGRESS (Draft PR, NOT merged; CI requires all acceptance tests)
- **Baseline**: `fb95b66` (P1.6 v2 merged)
- **Test status**: CI running; do not merge until all acceptance criteria pass

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
| P1.6-010A (cleanup) | — | IN PROGRESS | Pending |

## P1.6-010A Acceptance Criteria (IN PROGRESS)

### 1. Opponent Queue Leakage — FIXED
- `BattlefieldObservation.sendQueueLength` renamed to `outboundQueueLength` (self-only)
- `PublicOpponentObservation.opponentSendQueueLength` **removed entirely**
- Opponent spawn queue is invisible to policy layer
- Own outbound queue remains observable to self

### 2. BuildAIObservationInput Type Isolation — FIXED
- New `BuildAIObservationInput` interface replaces `BuildObservationInput`
- `publicOpponent.hp` is the only opponent field exposed
- Opponent gold/income **cannot exist** at the type level
- Opponent outbound queue **cannot exist** at the type level
- `@ts-expect-error` compile fixtures validate the contract

### 3. Canonical Wave Number — FIXED
- `waveNumber` passed as `input.waveNumber` from `waveScheduler.currentWaveNumber`
- `Math.floor(tick / 400) + 1` removed from builder
- Regression test: same tick, different waveNumber → different observation

### 4. Public Event Boundary — NOT IMPLEMENTED
- `observationFromDomainEvents()` **removed** (was a stub returning null)
- ADR-011 documents: "Public event-history reconstruction is NOT IMPLEMENTED."
- Future task may implement event accumulation if needed by balance sim

### 5. Deterministic Observation — FIXED
- `visibleTowers` canonical sort: `towerTypeId → cellX → cellY → level`
- `same towers, different order → identical observation` test passes

### 6. Honest Caller Labels — FIXED
- Self-play (`decideStrategyCommand`): **INTEGRATED** — uses `BuildAIObservationInput`
- Balance sim: **NOT_INTEGRATED** — needs its own adapter
- Client: **NOT_INTEGRATED** — no Playtest adapter yet

### 7. Leakage Tests — COMPLETE
All 15 named tests present:
- hidden opponent gold does not change observation
- hidden opponent gold does not change decision
- hidden opponent income does not change observation
- hidden opponent income does not change decision
- opponent pending send queue is invisible
- opponent unsubmitted command is invisible
- spawned opponent monster becomes visible
- public tower build changes observation
- canonical wave number is used
- tower ordering does not change observation
- policy entry point accepts AIObservation only
- self-play passes sanitized observation to policy
- observation is deterministic
- slot-swapped observation is mirror symmetric
- type contract compile fixtures

### 8. ai:check Coverage — FIXED
`ai:check` now runs:
- `packages/ai-strategy/src/policy.test.ts`
- `packages/ai-strategy/src/leak-prevention.test.ts`
- `packages/ai-training/src/league.test.ts`
- `packages/ai-training/src/compat.test.ts`

### 9. CI AI Smoke Check — ADDED
GitHub Actions CI now includes:
```yaml
- name: AI smoke check
  run: npm run ai:check
```

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
