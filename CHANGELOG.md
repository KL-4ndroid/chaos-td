# Changelog

## 2.0.0 — 2026-07-20

### 重建

- 將舊版願景、玩法、API、資產與路線圖重建成一致規格。
- 將單機 MVP 與未來線上、Live Ops、商業化分離。
- 新增 deterministic fixed-step simulation。
- 新增資料導向 Entity、Command／Event／Replay 契約。
- 新增 RUNNING → RESOLVING → RESULT 完整流程。
- 修正漏怪規則、時間結束、Queue 未清空、最後一秒送怪等矛盾。
- Tie-break 改為 HP → Income → Net Worth → Draw。
- Queue Quantity 改為原子操作。
- 規則攻擊採即時命中；投射物只作視覺。
- Player ID 改為 `p1`／`p2`。
- Pause／Resume 從 Gameplay Command 移除。
- 新增 Source of Truth、Decision Log、ADR、Risk Register。
- 新增 Cursor Rule、Task Template 與第一批 M0／M1 任務。

### 延後

- 線上 PvP、2v2、排位、賽季、社交、UGC。
- Roguelike 地圖、永久天賦、放置收益、抽卡、商城。
- Boss、飛行、隱形、治療、召喚、對塔攻擊。
