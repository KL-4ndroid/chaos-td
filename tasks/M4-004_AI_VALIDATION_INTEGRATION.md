# M4-004｜AI Validation and Integration

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

驗證 AI 系統完整性，確保 AI vs AI 可完成完整對局。

## Required Reading

- `docs/05_AI_BEHAVIOR_SPEC.md`
- `docs/11_IMPLEMENTATION_ROADMAP.md`
- `packages/game-core/src/simulation.ts`

## Dependencies

M4-003 Done

## In Scope

- AI vs AI simulation capability
- Deterministic behavior verification
- Rejection rate validation (<2%)
- Multi-seed testing
- 8-12 minute game completion

## Out of Scope

- UI opponent display
- Playwright E2E tests
- Multiple AI personalities

## Acceptance Criteria

- [ ] AI vs AI simulation runs without errors
- [ ] Same seed produces identical commands
- [ ] Rejection rate < 2%
- [ ] Games complete within timeout
- [ ] No negative gold scenarios

## Verification

```bash
npm run test
npm run typecheck
npm run lint
npm run stress
```
