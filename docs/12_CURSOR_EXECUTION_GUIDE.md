# 12｜Cursor Execution Guide

## 1. 一次提供的 Context

- 一個 Task。
- Task 的 Required Reading。
- 現有 Repo 相關檔案。
- `.cursor/rules/chaos-td.mdc`。

不要一次貼全部規格。

## 2. 標準流程

1. 閱讀 Goal、Scope、Non-goals、Acceptance Criteria。
2. 回覆理解。
3. 列出預計新增／修改檔案。
4. 列風險／阻塞。
5. 先建或更新測試。
6. 實作最小變更。
7. 執行 Lint、Typecheck、Test、Build。
8. 回報 Changed Files、Commands、Results、Risks、Blockers。
9. 更新 Task Checklist。
10. 架構決策更新 ADR／Decision。

## 3. 禁止

- 一次生成整個遊戲。
- Core 邏輯放 Scene。
- 規則使用 `Math.random()`、Frame Delta、Timer。
- UI 複製數值。
- 自行恢復 Deferred Feature。
- 小問題引新 Framework。
- 刪／弱化失敗測試。
- 大量 `any`、`unknown as`、空 Stub、TODO 假完成。
- 無說明修改 Task 外檔案。
- 同 Task 無關重構。
- 靜默更改 ADR。
- 不執行命令只聲稱可行。

## 4. 衝突

依 Source of Truth。仍不明：

- 停止受阻部分。
- 回報 `SPEC_BLOCKER`。
- 最多提出兩個最小方案及影響。
- 其餘不受阻工作仍完成。

## 5. Definition of Done

Acceptance 全過、新行為有測試、Lint、Typecheck、Tests、Build 全過、無 Console Error、文件同步、無未揭露 Workaround、無 Task 外 Side Effect。

## 6. Prompt

```text
請執行 tasks/TASK_ID.md。

先閱讀：
- Task Required Reading
- .cursor/rules/chaos-td.mdc

限制：
- 僅完成 Task Scope
- game-core 不依賴 Phaser／DOM
- 先更新測試
- 不實作 Deferred Features
- 完成後執行 lint、typecheck、test、build

先回覆：
1. 你理解的目標
2. 預計修改檔案
3. 風險或 SPEC_BLOCKER

然後直接完成。
```

## 7. Task 大小

理想：3–8 檔、一個行為、3–10 Acceptance、一次可 Review。

## 8. Commit

```text
chore(repo): bootstrap npm workspaces
feat(core): add fixed-step simulation clock
feat(data): validate definitions
feat(core): add waypoint movement
feat(client): render simulation monsters
test(core): add replay fixture
docs(adr): record combat decision
```

每 Commit 應可 Build。
