# 11｜Implementation Roadmap

## 原則

- 每個 Milestone 結束都是可執行版本。
- 同時最多兩個尚未整合 Workstream。
- 先 Headless，再畫面。
- 先 Placeholder，再正式資產。
- 未通過 Gate 不進下一階段。
- 不用週數假裝確定性；以可驗收產出判定。

## M0｜Repository and Simulation Foundation

交付：

- npm Workspaces。
- client、game-core、game-data、shared、test-fixtures。
- TypeScript、ESLint Flat Config、Prettier、Vitest。
- Phaser 空白 Scene。
- `Simulation.step()`。
- Seeded PRNG、State Hash、CI。

Gate：

- `npm ci`、Lint、Typecheck、Test、Build 全過。
- game-core 無 DOM／Phaser。
- 相同 Seed PRNG Fixture 一致。

Tasks：

- M0-001 Repository Bootstrap。
- M0-002 Fixed-Step Simulation Clock。
- M0-003 Data Schema and Validation。

## M1｜Minimal Vertical Slice

範圍：

- 一條 Lane。
- 固定 Path。
- Archer L1。
- Sheep。
- Movement、Targeting、Hitscan、Death、Leak。
- Render Adapter。

Gate：

- Headless 與畫面結果一致。
- Sheep 完整走路。
- Archer 可鎖定／擊殺。
- Leak 扣 HP。
- 連續 10 分鐘無 Crash。
- Replay Fixture 重現。

Tasks：

- M1-001 Map and Movement。
- M1-002 Archer Sheep Combat。
- M1-003 Phaser Render Adapter。

## M2｜Economy and Player Commands

範圍：

- 雙 Lane。
- Build／Upgrade／Sell。
- Gold／Income。
- Queue Atomicity。
- UI Error。
- Local Pause／Restart。

Gate：

- 送怪立即扣款／加 Income。
- 錯誤 Command 不改 State。
- Duplicate Idempotent。
- Gold 不負。
- Resolving 可測。
- 可手動完成一局。

## M3｜Full MVP Content

範圍：

- 4 塔、4 怪。
- Armor、Shield、Splash、Slow。
- 解鎖、統計、Placeholder Audio。

Gate：

- 每塔每怪至少 3 個行為測試。
- 用途可辨識。
- 無未定義隱形／飛行。
- 30 分鐘 Stress。
- Balance Sim 初版。

## M4｜Deterministic AI

範圍：

- Normal AI。
- 防守、升級、出怪。
- Tie-break。
- 對手 UI。

Gate：

- 同 Seed＋Commands 完全一致。
- AI 無負 Gold／非法 Command。
- Reject < 2%。
- 可完成 8–12 分鐘局。
- AI vs AI 100 Seeds 報告。

## M5｜Tutorial, Replay and Quality

範圍：

- 四步教學。
- Replay Export／Import。
- Hash Checkpoint。
- Playwright。
- Debug Overlay。
- Reduced Motion。

Gate：

- Replay 100% 一致。
- E2E 過。
- 無 Console Error／Unhandled Rejection。
- Render FPS 不改 Simulation。

## M6｜Balance Playtest Build

只調數值與可讀性；收集本地 Telemetry；不新增大型 System。

Gate 使用 Product Scope 的 Phase 2 Gate。未達標回到玩法／平衡，不建 Server。

## Phase 1.5

只選一項：

- Tower Augment。
- 第二固定 Map。
- 第二 AI Personality。

## Phase 2

見 `15_MULTIPLAYER_PHASE_2.md`。

## 延後直到新決策核准

2v2、Rank、Season、Mobile Full UX、Shop、Social、UGC、Boss、Roguelike、Idle、Gacha。
