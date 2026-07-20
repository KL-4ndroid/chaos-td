# M1-003｜Phaser Render Adapter

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

把 Headless Simulation 的 Map、Sheep、Archer、Events 顯示在 Phaser，證明畫面不控制規則。

## Required Reading

- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `docs/08_CLIENT_UX_SPEC.md`
- `docs/09_ASSET_PIPELINE.md`
- `docs/ADR/ADR-003-HITSCAN-MVP-COMBAT.md`
- `.cursor/rules/chaos-td.mdc`

## Dependencies

M1-001、M1-002 Done。

## In Scope

Fixed-Step Adapter、Placeholder、Entity→GameObject、Interpolation、Attack Visual、Death／Leak、Debug Tick／Hash、Visibility Pause。

## Out of Scope

正式 UI、Build Interaction、Gold／Income、正式 Sprite／Audio、Client Mutation。

## Acceptance Criteria

- [ ] Client 只呼叫 Core API。
- [ ] Render 數量與 Core 同步。
- [ ] 視覺 Projectile 不影響 Damage。
- [ ] 30／60 FPS 同 Replay Hash 相同。
- [ ] Hidden 自動 Pause。
- [ ] Backlog 不丟。
- [ ] Placeholder 可辨識。
- [ ] 無 Console Error。
