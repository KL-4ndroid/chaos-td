# M3-003｜Advanced Combat Mechanics (Armor, Shield, Splash, Slow)

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

實作所有高級戰鬥機制：護甲、護盾、濺射、緩速。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `packages/game-core/src/simulation.ts`

## Dependencies

M3-002 Done

## In Scope

- Armor: damage reduction (armorMultiplierPermille)
- Shield: absorbs damage before HP
- Splash: AOE damage to nearby monsters
- Slow: movement speed reduction

## Out of Scope

- Slow stacking (only strongest applies)
- Shield regeneration

## Acceptance Criteria

- [ ] Armor reduces damage correctly
- [ ] Shield absorbs damage before HP
- [ ] Splash hits multiple monsters
- [ ] Slow reduces speed correctly

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
