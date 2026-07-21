# M4-003｜AI Offense Decisions

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

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

- [ ] AI calculates offense budget correctly
- [ ] AI selects appropriate monster types
- [ ] AI respects monster availability timers
- [ ] AI only sends when lane is safe
- [ ] Deterministic spawn decisions

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
