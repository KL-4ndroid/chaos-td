# Chaos TD Specification v2.0

**專案名稱**：害人守塔 2.0：混沌攻防（Chaos TD）  
**文件版本**：2.0.0  
**規格日期**：2026-07-20  
**狀態**：MVP 開發基線  
**主要用途**：提供 Cursor／其他程式代理逐任務建置遊戲

## 一句話定位

一款玩家同時負責「守住自己的路線」與「投資出怪攻擊對手」的競技塔防遊戲；核心決策是把有限金幣分配在即時防守、長期收入與進攻壓力之間。

## v2.0 核心改變

- MVP 只驗證單機對 deterministic AI，不先建立正式後端。
- Roguelike、放置、抽卡、天賦、賽季、2v2 與 UGC 全部延後。
- 遊戲規則從 Phaser 抽離，放入純 TypeScript `game-core`。
- 使用固定 20 TPS、seeded PRNG、Command Log、Replay 與 State Hash。
- 塔與怪物採資料導向，不建立大量繼承類別。
- 每個 Cursor 任務都有範圍、禁止事項、驗收條件與測試命令。
- 數值唯一來源是未來的 `packages/game-data`。
- 只有通過產品 Gate，才進入線上 1v1。

## 閱讀順序

1. [Project Charter](docs/00_PROJECT_CHARTER.md)
2. [Product Scope](docs/01_PRODUCT_SCOPE.md)
3. [Core Game Rules](docs/02_CORE_GAME_RULES.md)
4. [Balance Baseline](docs/03_BALANCE_BASELINE.md)
5. [Map and Path](docs/04_MAP_AND_PATH_SPEC.md)
6. [AI Behavior](docs/05_AI_BEHAVIOR_SPEC.md)
7. [Technical Architecture](docs/06_TECHNICAL_ARCHITECTURE.md)
8. [Data Contracts](docs/07_DATA_CONTRACTS.md)
9. [Client UX](docs/08_CLIENT_UX_SPEC.md)
10. [Asset Pipeline](docs/09_ASSET_PIPELINE.md)
11. [Test Strategy](docs/10_TEST_STRATEGY.md)
12. [Implementation Roadmap](docs/11_IMPLEMENTATION_ROADMAP.md)
13. [Cursor Execution Guide](docs/12_CURSOR_EXECUTION_GUIDE.md)
14. [Source of Truth](docs/13_SOURCE_OF_TRUTH.md)
15. [Decision Log](docs/14_DECISION_LOG.md)
16. [Multiplayer Phase 2](docs/15_MULTIPLAYER_PHASE_2.md)
17. [Risk Register](docs/16_RISK_REGISTER.md)
18. [Glossary](docs/17_GLOSSARY.md)
19. [Technology Baseline](docs/18_TECH_BASELINE.md)

## 直接開始

第一個 Cursor 任務：

- [`tasks/M0-001_REPOSITORY_BOOTSTRAP.md`](tasks/M0-001_REPOSITORY_BOOTSTRAP.md)

建議 Prompt：

```text
請執行 tasks/M0-001_REPOSITORY_BOOTSTRAP.md。

先閱讀該任務列出的 Required Reading 與 .cursor/rules/chaos-td.mdc。
嚴格限制在任務範圍內，先列出理解、預計修改檔案與風險，然後直接完成。
完成後實際執行 lint、typecheck、test、build，回報結果。
```

## 權威順序

1. 已接受的 ADR
2. `14_DECISION_LOG.md`
3. `02_CORE_GAME_RULES.md`
4. `07_DATA_CONTRACTS.md`
5. `packages/game-data`
6. 目前 Task
7. 其他文件

詳細見 [Source of Truth](docs/13_SOURCE_OF_TRUTH.md)。

## 原創與授權

正式公開前必須完成名稱、角色、地圖、美術、音效與商標檢查。玩法靈感可延續，但不得直接使用未授權第三方資產或品牌識別。
