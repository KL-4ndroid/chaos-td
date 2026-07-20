# 01｜Product Scope

## 1. 當前版本

- 版本目標：Offline MVP／單機對 AI。
- 內容：1 張固定鏡像地圖、4 塔、4 怪、1 種 AI。
- 目標局長：8–12 分鐘。
- RUNNING 上限：600 秒。
- RESOLVING 上限：20 秒。

## 2. MVP 必須包含

### 對局

- `p1`、`p2` 兩個 Player Slot。
- 每方防守一條鏡像 Lane。
- 玩家控制 p1，AI 控制 p2。
- 玩家送怪進入對手 Lane。
- 固定 Tick、HP、Gold、Income、Queue。
- 完整 Match State Machine。
- Replay Seed、Command Log、State Hash。

### 塔

- Archer：穩定單體。
- Mage：範圍清群。
- Frost：低傷減速。
- Sniper：高單發厚血處理。

每塔 L1、L2、L3，無分支。

### 怪物

- Sheep：低價基礎與 Eco。
- Wolf：高速壓力。
- Treant：高 HP＋Armor。
- Ghost：HP＋一次性 Shield。

### UI

- 雙方 HP。
- 玩家 Gold、Income、Income 倒數。
- 公開對手 Income。
- 時間與 Phase。
- 4 塔、4 怪按鈕。
- 玩家 Send Queue。
- 塔選取、升級、出售。
- 暫停、重開。
- 非阻斷教學。
- 結算、統計、Debug Overlay。

## 3. MVP 明確不包含

- 線上 PvP、Server、2v2、排位、賽季。
- 帳號、登入、雲端存檔。
- Roguelike 程序地圖。
- 永久天賦、局外成長。
- 放置、離線收益。
- 抽卡、商城、廣告、付費貨幣。
- Boss、飛行、隱形、治療、召喚。
- 怪物攻塔、堵路、傳送。
- 分支升級、玩家 Targeting 切換。
- 規則 Projectile、閃避、攔截。
- 未完成戰局存檔。

## 4. Phase 1.5 可選

Gate 通過後只能先選一項：

1. 每局兩次三選一 Tower Augment。
2. 第二張固定地圖。
3. 第二套 AI Personality。

## 5. Phase 2

只做線上 1v1 非排位，見 `15_MULTIPLAYER_PHASE_2.md`。

## 6. 進入 Phase 2 Gate

- 20 名以上測試者。
- 100 局以上有效對局。
- 中位局長 7–12 分鐘。
- 90% 對局正常結束。
- 70% 以上玩家首局主動送怪。
- 60% 以上願意再玩。
- 無單一開局同時超過 65% 使用率且具顯著勝率優勢。
- Replay 重現 100%。
- 已知 P0 規則 Bug 為 0。
- 30 分鐘 Headless Stress Test 無不變量錯誤。

## 7. 延後功能恢復規則

任何 Deferred Feature 必須先定義產品假設、玩家問題、最小實驗、成功指標、ADR／Decision 與公平性影響。舊文件出現過不代表已核准。
