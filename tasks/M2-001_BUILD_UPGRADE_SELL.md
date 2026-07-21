# M2-001｜Build, Upgrade, and Sell Commands

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

實作建造、升級、販賣指令系統，包括有效性格式驗證、黃金消耗、命令佇列、以及不可變動規則。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `docs/07_DATA_CONTRACTS.md`
- `packages/game-core/src/simulation.ts`
- `packages/game-data/src/index.ts`

## Dependencies

M1 Gate Passed

## In Scope

- Build Tower Command (build_tower)
- Upgrade Tower Command (upgrade_tower)
- Sell Tower Command (sell_tower)
- Gold consumption and refund
- Cell occupancy validation
- Tower level limits (max level 3)
- Command queue in simulation
- Idempotent duplicate rejection

## Out of Scope

- UI rendering of gold/income
- Network commands
- Economy balancing (M6)
- Multiple tower types (M3)

## Acceptance Criteria

- [ ] Build command deducts correct gold amount
- [ ] Upgrade command increases tower level (max 3)
- [ ] Sell command refunds 60% of invested gold
- [ ] Invalid cell position rejected
- [ ] Insufficient gold rejected
- [ ] Duplicate command idempotent (no double processing)
- [ ] Error commands do not mutate state
- [ ] Gold never goes negative

## Tests

- Unit tests for each command type
- Integration test for gold flow
- Determinism test with same commands

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
