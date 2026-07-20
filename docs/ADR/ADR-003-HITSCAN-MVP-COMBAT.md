# ADR-003｜Hitscan Combat for MVP

- Status：Accepted
- Date：2026-07-20

## Context

規則 Projectile 會引入飛行時間、目標死亡、追蹤、碰撞；舊文件也未定義完整 State。

## Decision

- 攻擊 Tick 立即結算。
- Client 可播放視覺 Projectile。
- 動畫不回寫 Core。

## Consequences

Combat／Sell／Replay 簡單；視覺命中可能晚於規則。未來需要閃避／攔截時另建 ADR。
