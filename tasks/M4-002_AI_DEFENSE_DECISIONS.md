# M4-002｜AI Defense Decisions

## Status

- [x] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

## Goal

實作 AI 防守決策邏輯，包括建塔、升級、預算管理。

## Required Reading

- `docs/05_AI_BEHAVIOR_SPEC.md`
- `packages/game-data/src/ai.config.ts`
- `packages/game-data/src/towers.ts`

## Dependencies

M4-001 Done

## In Scope

- Defense Reserve management
- Tower build priority cells
- Tower upgrade decisions
- Action scoring system
- Coverage gain calculation

## Out of Scope

- AI vs AI gameplay
- UI opponent display
- Multiple AI personalities

## Acceptance Criteria

- [x] AI maintains defense reserve
- [x] AI builds affordable towers
- [x] AI upgrades when cost-effective
- [x] Action scoring is deterministic
- [x] AI never goes negative gold

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```

## Completion Report

- **Commit**: `feat(core): add AI defense decision logic with scoring`
- **Date**: 2026-07-22
- **Branch**: `autonomous/phase1-mvp`
- **Test Results**: 196 tests passed
- **Changes**:
  - Added `decideDefense` function for defense action decisions
  - Added `calculateBuildScore` for tower evaluation
  - Added `AI_BUILD_PRIORITY_CELLS` for tower placement
  - Added comprehensive tests for defense decisions
