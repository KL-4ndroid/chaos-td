# M0-002｜Fixed-Step Simulation Clock

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [x] Done

## Completion Report

- **Commit**: 6484ba9
- **Date**: 2026-07-20
- **Branch**: autonomous/phase1-mvp
- **Tests**: Core simulation tests passed

## Goal

建立不依賴 Browser 的 Simulation Clock、Phase Skeleton、Seeded PRNG、Canonical State Hash。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `docs/07_DATA_CONTRACTS.md`
- `docs/10_TEST_STRATEGY.md`
- `docs/ADR/ADR-001-DETERMINISTIC-FIXED-STEP.md`
- `docs/14_DECISION_LOG.md`
- `.cursor/rules/chaos-td.mdc`

## Dependencies

M0-001 Done。

## In Scope

- `Simulation.create()`／`step()`。
- Phase Skeleton。
- 20 TPS。
- Seed Parsing、固定 PRNG。
- Canonical Serialize／Hash。
- Event Buffer。
- Determinism／Phase Tests。

## Out of Scope

Gold、Income、Map、Movement、Tower、Monster、Phaser Adapter、AI。

## Required Decision

完成 OPEN-002、OPEN-003。

## Acceptance Criteria

- [ ] Core 無 Browser API。
- [ ] 同 Seed 前 1000 PRNG 一致。
- [ ] 不同 Seed 序列不同。
- [ ] step 每次一 Tick。
- [ ] Countdown 60 Tick 進 Running。
- [ ] Running 上限進 Resolving。
- [ ] Resolving 上限進 Result Skeleton。
- [ ] Hash 不受 Object 建立順序影響。
- [ ] Metadata 不影響 Hash。
- [ ] Node 測試可跑。

## Tests

```bash
npm run test --workspace packages/game-core
npm run typecheck
npm run lint
npm run build
```
