# M1-001｜Map and Monster Movement

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

在 Headless Core 建立一條 Lane 的 Sheep Spawn、Waypoint Movement、Path Progress、Leak。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/04_MAP_AND_PATH_SPEC.md`
- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `docs/07_DATA_CONTRACTS.md`
- `.cursor/rules/chaos-td.mdc`

## Dependencies

M0-002、M0-003 Done。

## In Scope

Monster State、Entity ID、Lane State、Fixture Spawn、Integer Movement、Pending Leak、HP Damage、Events、Fixtures。

## Out of Scope

Queue、Gold、Income、Tower、AI、Phaser。

## Acceptance Criteria

- [ ] Sheep 每 Tick 依 Speed 前進。
- [ ] Progress 不減。
- [ ] Segment Transition 正確。
- [ ] 終點造成一次 Leak。
- [ ] Leaked Monster 移除且不重複扣 HP。
- [ ] 相同 State 到達 Tick 一致。
- [ ] p1／p2 鏡像一致。
- [ ] State 無浮點位置。
