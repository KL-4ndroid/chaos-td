# M4-002｜AI Defense Decisions

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

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

- [ ] AI maintains defense reserve
- [ ] AI builds affordable towers
- [ ] AI upgrades when cost-effective
- [ ] Action scoring is deterministic
- [ ] AI never goes negative gold

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
