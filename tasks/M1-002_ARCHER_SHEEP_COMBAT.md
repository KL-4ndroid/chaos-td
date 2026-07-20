# M1-002｜Archer vs Sheep Combat

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

Archer L1 依 FIRST 鎖定 Sheep，按 Cooldown Hitscan 攻擊、擊殺並發 Event。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/03_BALANCE_BASELINE.md`
- `docs/04_MAP_AND_PATH_SPEC.md`
- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `docs/ADR/ADR-003-HITSCAN-MVP-COMBAT.md`
- `.cursor/rules/chaos-td.mdc`

## Dependencies

M1-001 Done。

## In Scope

Tower State、測試建塔 Helper、Range、FIRST、Cooldown、Hitscan、Death、Events、Fixture。

## Out of Scope

玩家 Build Command、Gold、Upgrade／Sell、Splash／Slow／Armor／Shield、視覺 Projectile。

## Acceptance Criteria

- [ ] Range 外不攻擊。
- [ ] FIRST 選 Progress 最大。
- [ ] Tie 依 Entity ID。
- [ ] 攻擊 Tick 立即扣 HP。
- [ ] Cooldown 不負。
- [ ] Dead 不再 Target。
- [ ] 被擊殺 Sheep 不 Leak。
- [ ] Fixture 有 Expected Hash。
