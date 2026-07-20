# 14｜Decision Log

大型決策用 ADR，小型跨文件決策記此。

## DEC-001｜MVP 單機 AI

- Date：2026-07-20
- Status：Accepted
- Decision：先完成 Offline Player vs Deterministic AI，不建 Server。

## DEC-002｜Roguelike／Idle 延後

- Date：2026-07-20
- Status：Accepted
- Reason：會改變核心經濟、內容量與公平性。

## DEC-003｜Match 時間

- Status：Accepted
- Decision：RUNNING 600 秒，RESOLVING 最多 20 秒。

## DEC-004｜Tie-break

- Status：Accepted
- Decision：HP → Income → Net Worth → Draw。
- Reason：Leak Damage 與 HP 在相同起始 HP、無治療時高度重複。

## DEC-005｜Queue 原子性

- Status：Accepted
- Decision：Quantity 1–5 整筆成功或失敗。

## DEC-006｜Pause 是本機行為

- Status：Accepted
- Decision：Pause／Resume 不屬 Gameplay Command，不寫 Replay。

## DEC-007｜HP 可低於零

- Status：Accepted
- Decision：Core 同 Tick 可低於 0；UI 顯示 Clamp 0。

## DEC-008｜game-data 權威

- Status：Accepted
- Decision：建立後為正式數值唯一來源。

## Open

### OPEN-001｜上下或左右 Lane

- Owner：UX Prototype
- Deadline：M1 Render Adapter
- Options：上下／左右。
- Constraint：1280×720 不遮路與控制。

### OPEN-002｜PRNG

- Owner：M0-002
- Requirement：小、跨 JS Runtime 穩定、版本化。

### OPEN-003｜State Hash

- Owner：M0-002
- Requirement：穩定、簡單，不需密碼安全。
