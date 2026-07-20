# 15｜Phase 2 Online 1v1

> 不是 MVP 工作；Gate 通過後才啟用。

## 1. 原則

- Server Authoritative。
- Client 只傳 Command。
- Server 執行同一 game-core。
- Prediction 只改善操作感。
- Seed＋Config＋Commands 可重播。
- 只做 1v1 非排位。
- 不做 2v2、觀戰、聊天、賽季。

## 2. 建議

- Node.js LTS。
- Colyseus Authoritative Room，或 Gate 時以 ADR 評估單一同類方案。
- 不同時用 Socket.IO 與 Colyseus 做同職責。
- PostgreSQL 只存 Identity、Match Metadata、Result、Replay Reference。
- 初期不需 Redis。
- REST 只做非即時。

## 3. Server State

Phase、Tick、公開 Player State、Towers、Monsters、Queues、Result、Commands、Hash。Client 不 Mutate。

## 4. Messages

Client → Server：ready、gameplay_command、ping、surrender。

Server → Client：state_patch、accepted／rejected、events、result、reconnect_snapshot。

## 5. Input Delay

- Command 有 Client Sequence。
- Server 指派 Target Tick。
- 初始 2–4 ticks 實測。
- 低頻操作不先做 Rollback。
- Pending UI 不等於正式 State。

## 6. Reconnect

保留席位約 20 秒；Snapshot＋後續 Event；超時 Surrender 或新 Decision；不接受 Client 舊 State。

## 7. 防作弊

Server 算 Cost、Income、Damage、Cooldown、Result；驗證 Ownership、Tick、Rate Limit、Idempotency；Client 不回報結果；Server 指定 Config。

## 8. 身份

Online Alpha 可用 Guest Identity；Token 安全儲存；不讓 Client 傳自行 Hash Password；正式帳號後續接 Identity Provider。

## 9. Persistence

只在結算寫 Match ID、Players、Config、Seed、時間、Result、Replay Key、Disconnect／Surrender。不要每 Tick 寫 DB。

## 10. Gate

- 兩 Browser 完成 20 場。
- 100–250ms RTT 可玩。
- Reconnect 達標。
- Server Replay 與線上 Result 一致。
- Client 改 Gold／State 無效。
- Room 資源釋放。
- 建立／銷毀 Room 壓測通過。
