# M4-001｜AI Core Architecture

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

建立 AI 核心架構，包括 AI State、決策循環、PRNG 整合。

## Required Reading

- `docs/05_AI_BEHAVIOR_SPEC.md`
- `packages/game-core/src/simulation.ts`
- `packages/game-core/src/prng.ts`

## Dependencies

M3 Gate Passed

## In Scope

- AI State interface (AIState)
- AI decision loop (every 10 ticks)
- AI PRNG stream derivation from match seed
- Threat assessment system (safe/strained/critical)
- Decision frequency and command timing

## Out of Scope

- Specific defense/offense algorithms
- UI opponent integration
- Multiple AI personalities

## Acceptance Criteria

- [ ] AIState interface defined
- [ ] AI evaluates decisions every 10 ticks
- [ ] AI uses deterministic PRNG stream
- [ ] Threat levels correctly determined
- [ ] AI commands have correct target tick (current + 2)

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
