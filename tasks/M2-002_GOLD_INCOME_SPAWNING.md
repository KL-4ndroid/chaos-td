# M2-002｜Gold, Income, and Monster Spawning

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

## Goal

實作黃金系統、怪物派遣、以及即時黃金/收入更新。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `docs/07_DATA_CONTRACTS.md`
- `packages/game-core/src/simulation.ts`
- `packages/game-data/src/index.ts`

## Dependencies

M2-001 Done

## In Scope

- Starting gold (50)
- Gold deduction on monster spawn
- Income per monster sent
- Base income per tick
- Gold accumulation
- Monster queue system
- Wave spawning from queue

## Out of Scope

- Economy balancing (M6)
- UI gold display
- Multiple monster types (M3)

## Acceptance Criteria

- [x] Player starts with 600 gold (corrected from 50 per balance doc)
- [x] Spawning monster deducts gold immediately (sendCost from MONSTER_BY_ID)
- [x] Income increases on each monster sent (incomeGain from MONSTER_BY_ID)
- [x] Base income ticks every 200 ticks
- [x] Gold cannot go negative
- [x] Monster queue processes correctly
- [x] Two lanes work independently

## Tests

- Gold flow integration tests
- Income calculation tests
- Monster spawn deduction tests

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
