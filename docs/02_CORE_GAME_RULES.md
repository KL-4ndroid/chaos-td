# 02｜Core Game Rules

## 1. 對局結構

- 兩個 Player Slot：`p1`、`p2`。
- 每方有獨立 Lane、HP、Gold、Income、Tower 與 Send Queue。
- 玩家在自己的 Lane 建塔。
- 玩家購買的怪物進入對手 Lane。
- 防守方擊殺怪物取得 Bounty。
- 怪物到終點造成 Leak Damage。
- 雙方規則、起始資源、地圖與內容完全相同。

## 2. Match State Machine

```text
READY
  ↓
COUNTDOWN（60 ticks／3 秒）
  ↓
RUNNING（最多 12,000 ticks／600 秒）
  ↓
RESOLVING（最多 400 ticks／20 秒）
  ↓
RESULT
```

### READY

不接受 Gameplay Command；載入資料與建立 Match。

### COUNTDOWN

Tick 前進，但不發 Income、不 Spawn、不攻擊、不接受 Gameplay Command。

### RUNNING

接受合法 Gameplay Command；Income、Queue、Movement、Combat、AI 正常運作。HP 歸零或時間到時，本 Tick 結算完後進入 RESOLVING。

### RESOLVING

- 不接受建塔、升級、出售、送怪。
- 既有 Queue 繼續生成。
- 場上怪物繼續移動、戰鬥、死亡或 Leak。
- 不再發週期 Income。
- Bounty 正常。
- Queue 與戰場清空即 RESULT。
- 最長 400 ticks，超時 Tie-break。

### RESULT

不再接受 Gameplay Command；可輸出結算、Replay 或重開新 Match。

## 3. 固定時間步進

- 20 TPS，`tickDurationMs = 50`。
- 規則只使用整數 Tick。
- Phaser Frame 只負責累積時間、執行 Tick、插值與視覺。
- 每 Frame 最多執行 5 Tick。
- Backlog 必須保留，禁止靜默丟棄 Tick。
- Backlog 超過 40 Tick：單機暫停並顯示效能警告。
- Browser 背景自動暫停。
- `Math.random()`、`Date.now()`、Timer 不作規則輸入。

## 4. 每 Tick 固定順序

1. 讀取本 Tick Gameplay Commands。
2. 驗證並套用 Command。
3. RUNNING 中處理 Income。
4. AI 評估，產生未來 Tick Command。
5. Queue 與 Spawn Cooldown。
6. 怪物移動。
7. 立即處理到終點的 Leak。
8. 塔取得目標。
9. Hitscan 攻擊與 Damage。
10. Shield、Armor、Splash、Slow。
11. Death 與 Bounty。
12. Status Duration。
13. Phase／Result。
14. Domain Events。
15. 可選 State Hash。

同類 Entity 依 Entity ID 小到大處理。

## 5. 起始狀態

| Key | Value |
|---|---:|
| HP | 20 |
| Gold | 600 |
| Income | 100 |
| Income Interval | 200 ticks |
| Queue Limit | 30 |
| Sell Refund | 70% |

塔全數可用；怪物依時間解鎖。

## 6. Gold 與 Income

- Gold 用於建塔、升級與送怪。
- Gold 不得小於 0。
- 扣款前驗證全部條件。
- Command 失敗不得部分扣款。
- RUNNING 每 200 ticks 發放當前 Income。
- 合法送怪 Command 接受時立即永久增加 Income。
- RESOLVING 不發 Income。
- 對手 Income 公開。
- Bounty 只補貼防守，不應反向創造壓倒性經濟。

## 7. Send Queue

- 每方一個送往對手的 Queue。
- `quantity` 允許 1–5。
- 採原子操作：資金不足、未解鎖、數量非法或容量不足時整筆拒絕。
- 合法 Command 立即扣 `sendCost × quantity`、加 `incomeGain × quantity`，再加入 Queue。
- Queue 空且 Cooldown 為 0 時，下一 Spawn Phase 生成首隻。
- 每次生成後，Cooldown 設為剛生成怪物的 `spawnGapTicks`。
- UI 顯示前 8 項與總數。

## 8. 怪物與 Leak

MVP：Sheep、Wolf、Treant、Ghost。

不包含隱形、飛行、治療、召喚、攻塔、傳送、完全免疫，以及 Leak 後附加 Debuff／召喚。

到終點：

- 扣防守方 `leakDamage`。
- 移除怪物。
- 不給 Bounty。
- 攻擊方累積 Leak 統計。
- HP 可短暫低於 0；UI Clamp 顯示 0。

## 9. 塔

### 建造

- 只能放 Buildable Cell。
- 每格最多一塔。
- Path、Spawn、End、Blocked 不可建造。
- 預覽顯示 Range 與合法性。
- 失敗不扣款。

### 升級

- L1 建造、L2 第一次、L3 第二次。
- 無分支。
- 立即生效。
- 不重設 Cooldown。
- L3 再升回傳 `tower_max_level`。

### 出售

- `floor(totalInvestedCost × 0.70)`。
- Cell 立即可建造。
- 規則攻擊採 Hitscan，沒有規則 Projectile。
- Client 視覺 Projectile 可完成或淡出，但不改變 State。

## 10. Damage

### Hitscan

攻擊 Tick 選定目標並立即結算。Client 動畫不影響規則。

### Armor

```text
armorMultiplierPermille = 1000 - clamp(armorPermille, 0, 800)
finalHpDamage = max(1, floor(rawDamage × armorMultiplierPermille / 1000))
```

### Shield

先扣 Shield；Armor 不影響 Shield。溢出 Damage 再套 Armor 扣 HP。Shield 不恢復。

### Splash

主目標 100%；半徑內其他目標乘 `splashFactorPermille`。不做距離衰減，依 Entity ID 結算。

### Slow

不疊乘，保留最強；相同或較弱可刷新 Duration；上限 50%。

## 11. Targeting

- FIRST：Progress 最高。
- LAST：Progress 最低。
- STRONG：`HP + Shield` 最高。
- WEAK：`HP + Shield` 最低。

MVP：

- Archer／Mage／Frost：FIRST。
- Sniper：STRONG → FIRST → Entity ID。

玩家不能切換。

## 12. 結束與 Tie-break

HP 歸零或 600 秒到達後進 RESOLVING。既有 Queue／Monster 清理完或 20 秒到達後，依序比較：

1. HP。
2. Income。
3. Net Worth。
4. Draw。

```text
netWorth = gold + Σ floor(eachTowerTotalInvestedCost × sellRefundRate)
```

Result 時 Queue 已清理，不計 Pending Queue Value。

## 13. 局後統計

- Winner／Draw、Reason。
- Tick／秒數。
- 雙方 HP、Leak Damage、最高 Income。
- Tower Spend、Monster Spend、Bounty。
- 各塔 Damage／Kill。
- 各怪物 Sent／Leaked／Leak Damage。
- Replay Seed、Command Count、Config Version、Final Hash。

## 14. 教學

四個非阻斷提示：

1. 建 Archer。
2. 說明 10 秒 Income。
3. 送 Sheep 並顯示 Income 增加。
4. 說明只守不攻會落後。
