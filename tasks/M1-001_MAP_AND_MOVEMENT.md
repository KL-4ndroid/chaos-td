# M1-001｜Map and Monster Movement

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

## Completion Report

- **Commit 1**: f1c3ddb - feat(core): add movement, lane, and monster state types
- **Commit 2**: f2bb265 - feat(core): integrate movement and lanes into simulation
- **Date**: 2026-07-20
- **Branch**: autonomous/phase1-mvp
- **Tests**: 111 passed
- **Verification**: lint, typecheck, build all passed

## Acceptance Criteria

- [x] Sheep 每 Tick 依 Speed 前進。
- [x] Progress 不減。
- [x] Segment Transition 正確。
- [x] 終點造成一次 Leak。
- [x] Leaked Monster 移除且不重複扣 HP。
- [x] 相同 State 到達 Tick 一致。
- [x] p1／p2 鏡像一致。
- [x] State 無浮點位置。

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
