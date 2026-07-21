# M2-001｜Build, Upgrade, and Sell Commands

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

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

- [x] Build command deducts correct gold amount
- [x] Upgrade command increases tower level (max 3)
- [x] Sell command refunds 70% of invested gold
- [x] Invalid cell position rejected
- [x] Insufficient gold rejected
- [x] Duplicate command idempotent (no double processing)
- [x] Error commands do not mutate state
- [x] Gold never goes negative

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
