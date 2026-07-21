# M3-002｜Additional Monster Types (Wolf, Treant, Ghost)

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

實作 Wolf、Treant、Ghost 怪物類型並整合到戰鬥系統。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/03_BALANCE_BASELINE.md`
- `packages/game-data/src/monsters.ts`
- `packages/game-core/src/simulation.ts`

## Dependencies

M3-001 Done

## In Scope

- Wolf: faster, more HP
- Treant: armored, tanky
- Ghost: shielded, fast
- Monster stats from game-data

## Out of Scope

- Monster unlock system
- Monster selection UI

## Acceptance Criteria

- [ ] Wolf has correct speed and HP
- [ ] Treant has armor damage reduction
- [ ] Ghost has shield
- [ ] Monster spawn and combat correct

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
