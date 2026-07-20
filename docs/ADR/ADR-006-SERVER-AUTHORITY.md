# ADR-006｜Future Server Authority

- Status：Accepted for Phase 2
- Date：2026-07-20

## Context

競技遊戲不能信任 Client 回報 Gold、Damage、Reward 或 Result。

## Decision

Phase 2 Server 執行同一 game-core；Client 只送 Command；Server 決定 Target Tick、State、Result；不同時使用兩套 Room Framework。

## Consequences

Phase 1 Core 必須無 Browser Dependency；Phase 2 前不需 DB／Redis／Auth。
