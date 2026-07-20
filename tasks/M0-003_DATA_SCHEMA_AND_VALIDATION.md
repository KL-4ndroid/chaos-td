# M0-003｜Data Schema and Validation

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

建立 Global、Tower、Monster、Map Definition 型別、Runtime Validation、Config Version 與初始資料。

## Required Reading

- `docs/03_BALANCE_BASELINE.md`
- `docs/04_MAP_AND_PATH_SPEC.md`
- `docs/07_DATA_CONTRACTS.md`
- `docs/13_SOURCE_OF_TRUTH.md`
- `.cursor/rules/chaos-td.mdc`

## Dependencies

M0-001 Done；可與 M0-002 平行但不改同檔。

## In Scope

ID、Definition、Boundary Validation、Global Config、4 塔、4 怪、MVP Map 初稿、Cross-reference、Config Version、Invalid Fixtures、Balance Doc Check／Generate 初版。

## Out of Scope

Simulation、AI、UI、正式地圖美術。

## Acceptance Criteria

- [ ] 重複 ID 拒絕。
- [ ] 負 Cost／Damage／Cooldown 拒絕。
- [ ] Range／Slow／Armor 超界拒絕。
- [ ] Tower 恰好 3 Levels。
- [ ] Map Cell 重疊拒絕。
- [ ] Lane 對稱檢查。
- [ ] AI Priority 必須 Buildable。
- [ ] Replay 可引用 Config Version。
- [ ] 文件一致性 Script 可由 CI 執行。
- [ ] Client 無散落數值。

## Tests

```bash
npm run test --workspace packages/game-data
npm run docs:check-balance
npm run typecheck
npm run lint
npm run build
```
