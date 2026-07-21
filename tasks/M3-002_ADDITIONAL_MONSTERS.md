# M3-002｜Additional Monster Types (Wolf, Treant, Ghost)

## Status

- [x] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

## Goal

實作 Wolf、Treant、Ghost 怪物類型並整合到戰鬥系統。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/03_BALANCE_BASELINE.md`
- `packages/game-data/src/monsters.ts`
- `packages/game-core/src/simulation.ts`

## Dependencies

M3-001 Done

## In Scope

- Wolf: faster, more HP
- Treant: armored, tanky
- Ghost: shielded, fast
- Monster stats from game-data

## Out of Scope

- Monster unlock system
- Monster selection UI

## Acceptance Criteria

- [x] Wolf has correct speed and HP
- [x] Treant has armor damage reduction
- [x] Ghost has shield
- [x] Monster spawn and combat correct

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```

## Completion Report

- **Commit**: `feat(core): enforce monster availability timers and add M3-002 tests`
- **Date**: 2026-07-22
- **Branch**: `autonomous/phase1-mvp`
- **Test Results**: 162 tests passed
- **Changes**:
  - All monster types (sheep, wolf, treant, ghost) defined in game-data
  - Added `availableAtRunningTick` enforcement in `queue_monster` command processing
  - Added `monster_locked` rejection reason for unavailable monsters
  - Added comprehensive tests for monster availability timers
  - Tests verify correct gold cost and income values for wolf, treant, ghost
