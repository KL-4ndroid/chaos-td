# M3-001｜Additional Tower Types (Mage, Frost, Sniper)

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

實作 Mage、Frost、Sniper 塔的戰鬥系統，並與現有 Archer 塔整合。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/03_BALANCE_BASELINE.md`
- `packages/game-data/src/towers.ts`
- `packages/game-core/src/simulation.ts`

## Dependencies

M2 Gate Passed

## In Scope

- Mage tower: splash damage
- Frost tower: slow effect
- Sniper tower: heavy single-target damage, STRONG targeting
- Combat integration with existing archer

## Out of Scope

- UI tower selection
- Tower preview
- Tower unlock system

## Acceptance Criteria

- [ ] Mage deals splash damage in radius
- [ ] Frost applies slow effect
- [ ] Sniper uses STRONG targeting
- [ ] All towers combat correctly

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
