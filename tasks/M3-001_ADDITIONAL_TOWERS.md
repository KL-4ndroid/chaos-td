# M3-001｜Additional Tower Types (Mage, Frost, Sniper)

## Status

- [x] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

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

- [x] Mage deals splash damage in radius
- [x] Frost applies slow effect
- [x] Sniper uses STRONG targeting
- [x] All towers combat correctly

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```

## Completion Report

- **Commit**: `fix(core): correct M3-001 splash/slow syntax and exactOptionalPropertyTypes`
- **Date**: 2026-07-22
- **Branch**: `autonomous/phase1-mvp`
- **Test Results**: 152 tests passed
- **Changes**:
  - Fixed syntax error in splash damage calculation (missing parentheses)
  - Fixed `other` → `target` bug in frost slow refresh logic
  - Fixed `exactOptionalPropertyTypes` error by using `delete` instead of `= undefined`
  - Added `armorPermille` to test monster factory in `combat.test.ts`
  - Added `slowPermille` and `slowDurationTicks` to `MonsterRuntimeState` and `MonsterSpawnParams`
  - Implemented splash damage for mage towers (armor/shield calculation)
  - Implemented slow effect for frost towers (refresh on stronger, reset duration on same)
  - Integrated all tower types into `processCombat`

