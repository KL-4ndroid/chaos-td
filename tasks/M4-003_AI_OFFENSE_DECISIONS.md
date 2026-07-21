# M4-003｜AI Offense Decisions

## Status

- [x] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

## Goal

實作 AI 進攻決策邏輯，包括出怪選擇、預算管理。

## Required Reading

- `docs/05_AI_BEHAVIOR_SPEC.md`
- `packages/game-data/src/monsters.ts`
- `packages/game-data/src/ai.config.ts`

## Dependencies

M4-002 Done

## In Scope

- Offense budget calculation
- Monster type selection (sheep, wolf, treant, ghost)
- Lane pressure assessment
- Spawn timing based on lane safety

## Out of Scope

- AI vs AI full gameplay
- Opponent prediction
- Advanced send strategies

## Acceptance Criteria

- [x] AI calculates offense budget correctly
- [x] AI selects appropriate monster types
- [x] AI respects monster availability timers
- [x] AI only sends when lane is safe
- [x] Deterministic spawn decisions

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```

## Completion Report

- **Commit**: `feat(core): add AI offense decision logic with monster selection`
- **Date**: 2026-07-22
- **Branch**: `autonomous/phase1-mvp`
- **Test Results**: 202 tests passed
- **Changes**:
  - Added `decideOffense` function for offense action decisions
  - Added `calculateOffenseBudget` for offense budget calculation
  - Added `selectMonsterType` for monster selection
  - Added `MONSTER_PREFERENCES` for monster type weights
  - Added comprehensive tests for offense decisions
