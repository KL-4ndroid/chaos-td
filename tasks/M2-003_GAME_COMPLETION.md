# M2-003｜Game Phase Completion and Result

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

## Goal

實作遊戲結算與勝利條件，包括 HP 歸零判斷與遊戲結束流程。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `docs/07_DATA_CONTRACTS.md`
- `packages/game-core/src/simulation.ts`

## Dependencies

M2-002 Done

## In Scope

- HP leak penalty (1 HP per leak)
- HP reaches 0 = loss
- Running phase to Resolving phase
- Result phase with winner
- Game completion events

## Out of Scope

- Rank calculation
- Post-game UI
- Replay export (M5)

## Acceptance Criteria

- [x] Monster reaching end deducts 1 HP (leak damage per monster)
- [x] HP = 0 triggers immediate transition to resolving
- [x] Resolving phase processes after running (400 ticks max)
- [x] Result phase shows correct winner (HP, income, net worth tiebreakers)
- [x] Game can complete to result phase (timeout after 12000 running ticks)
- [x] Events emit correctly for UI (match_ended event)

## Tests

- HP deduction tests
- Victory/defeat condition tests
- Phase transition tests

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
