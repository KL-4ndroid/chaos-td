# 16｜Risk Register

| ID | Risk | P | Impact | Mitigation | Trigger |
|---|---|---|---|---|---|
| R-001 | MVP 再膨脹 | H | H | Deferred、Task Scope、Cursor Rule | M4 前加入大型系統 |
| R-002 | 文件數值漂移 | H | H | game-data、生成文件、CI | 同數值兩處手改 |
| R-003 | Phaser/Core 耦合 | M | H | Boundary、Dependency Test | Core import Phaser／DOM |
| R-004 | Determinism 破壞 | M | H | Fixed-point、Stable Order、Hash | 同 Replay 不同 Hash |
| R-005 | 無腦全送 | M | H | Balance Sim、Gate | 全送高勝率 |
| R-006 | 防守飽和超時 | M | H | Map 格、後期數值、超時 Gate | Timeout > 20% |
| R-007 | AI 作弊感 | M | H | 公開資訊、同 API、無 Bonus | 測試者感知作弊 |
| R-008 | AI 太笨 | H | M | AI Report、Utility Rules | 不送怪／持續漏 |
| R-009 | Cursor 空殼爆量 | H | H | 小 Task、禁止預建 | 大量未引用檔／TODO |
| R-010 | 追新不穩 | M | M | Pin、ADR、CI | 無理由升 Major |
| R-011 | 美術過早 | M | H | Asset Gate | M4 前做完整 Sprite |
| R-012 | 名稱素材侵權 | M | H | 原創、License Registry | 公開用第三方元素 |
| R-013 | 背景 Tick 爆量 | H | M | Auto Pause、Clamp | 回前景大量補 Tick |
| R-014 | 時限 Queue 濫用 | M | H | Resolving、Atomic、Boundary Test | 599 秒大量送怪 |
| R-015 | Replay 無限增長 | L | M | Accepted Only、Size Limit | 檔案異常 |
| R-016 | UI／Core 不同步 | M | M | Adapter、禁止 Mutation | Gold 顯示不一致 |

每 Milestone 更新；P0 Bug 立即新增；風險成真時建 Task＋Regression Test。
