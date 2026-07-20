# 13｜Source of Truth

## 1. 權威對照

| 主題 | 權威來源 |
|---|---|
| 產品目的／非目標 | `00_PROJECT_CHARTER.md` |
| MVP 範圍 | `01_PRODUCT_SCOPE.md` |
| 對局規則 | `02_CORE_GAME_RULES.md` |
| 正式平衡數值 | 未來 `packages/game-data` |
| 地圖 | `04_MAP_AND_PATH_SPEC.md`＋Map Definition |
| AI | `05_AI_BEHAVIOR_SPEC.md` |
| Package Boundary | `06_TECHNICAL_ARCHITECTURE.md` |
| Type／Command／Event | 建置前 `07_DATA_CONTRACTS.md`；建置後 Source Code |
| UX | `08_CLIENT_UX_SPEC.md` |
| Asset | `09_ASSET_PIPELINE.md` |
| Test | `10_TEST_STRATEGY.md` |
| 開發順序 | `11_IMPLEMENTATION_ROADMAP.md` |
| Cursor 限制 | `.cursor/rules/chaos-td.mdc` |
| 架構決策 | `ADR/` |
| 小型決策 | `14_DECISION_LOG.md` |
| Task 狀態 | `tasks/` |
| Dependency Version | `package-lock.json` |
| 技術建議 | `18_TECH_BASELINE.md` |

## 2. 衝突優先順序

1. Accepted ADR。
2. 較新的 Accepted Decision。
3. Core Rules。
4. Data Contracts。
5. 合法 game-data。
6. 當前 Task。
7. 其他文件。
8. Legacy。

## 3. 程式與文件不同步

不可直接假設程式正確。查 ADR／Decision；若程式是已核准新行為，Task 必須同步文件；若權威文件明確，先加 Regression Test 再修程式。

## 4. 數值

- game-data 建立後為唯一來源。
- Balance Markdown 不長期手工同步。
- 建立 `docs:generate-balance` 或 `docs:check-balance`。
- CI 偵測漂移。

## 5. Legacy

只作遷移記錄，Cursor 不得從 Legacy 自動恢復功能／API。
