# 10｜Test Strategy

## 1. Core Unit

- Fixed Clock、PRNG。
- Command Validation。
- Gold／Income、Queue Atomicity。
- Movement／Leak。
- Targeting／Cooldown。
- Armor／Shield／Splash／Slow。
- Upgrade／Sell。
- Match Phase／Tie-break。
- AI Determinism。
- Replay／Hash。

## 2. Integration

- Archer vs Sheep。
- Income＋Queue＋Spawn＋Bounty。
- 同 Tick 雙方 Leak。
- Upgrade 不重設 Cooldown。
- Sell 無規則 Projectile。
- 600 秒進 Resolving。
- Resolving 清 Queue／超時。
- Tie-break。
- 10 分鐘 Replay。
- AI Normal Opening。

## 3. Client

State → UI、Button 狀態、Range Preview、Selection、Event → Render、Create／Destroy、Pause、Reduced Motion。不測 Phaser 內部。

## 4. E2E

Playwright：

1. 開啟。
2. 進 Match。
3. 建 Archer。
4. 送 Sheep。
5. Income 增加。
6. Pause／Resume。
7. Restart。
8. 進 Result。

## 5. Fixtures

- `basic_archer_vs_sheep`
- `queue_atomicity`
- `queue_and_income`
- `armor_and_sniper`
- `ghost_shield`
- `simultaneous_leak`
- `timeout_resolving`
- `timeout_tiebreak`
- `ai_normal_opening`

含 Config Version、Map、Seed、Commands、Expected Result、Hash Checkpoints。

## 6. 不變量

- Gold >= 0。
- Queue <= 30。
- Tower Cell 唯一。
- Level 1..3。
- Cooldown >= 0。
- Entity ID 唯一。
- Dead／Leaked 不可被 Target。
- Progress 不減。
- Result 後不接受 Command。
- Income 只在 RUNNING 指定 Tick。
- RESOLVING 不發 Income。
- Duplicate 不重複。
- 無 NaN／Infinity。
- p1／p2 規則對稱。

## 7. Fuzz

Seeded 合法／非法 Command：不 Crash、不負資源、Serialize Hash 一致、Replay 一致、Quantity 原子。

## 8. Coverage

- game-core Statements／Branches >= 90%。
- game-data Validation >= 90%。
- client >= 60%。
- Core 不得只有 Snapshot。

## 9. Performance

Headless 20 TPS 跑 30 分鐘；每 Lane 200 Monsters；Log 不無限增長；無 Invariant Failure。

Browser 目標 60 FPS；20 TPS 不變；Slow Frame 不改規則；Reduced Motion 可停 Tween。

## 10. CI

PR：

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Nightly：

```bash
npm run test:e2e
npm run test:stress
npm run test:replay
```

## 11. Regression

先加失敗測試、確認失敗、修正、保留測試、記 Root Cause；規格未定義先更新 Decision。
