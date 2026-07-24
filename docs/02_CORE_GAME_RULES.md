# 02｜Core Game Rules

## 1. 對局結構

- 兩個 Player Slot：`p1`、`p2`。
- 每方有獨立 Battlefield（戰場）、HP、Gold、Income、Tower 與 Send Queue。
- 每個 Battlefield 有一條路徑，防守方在該路徑上建塔。
- 玩家購買的怪物進入**對手**的 Battlefield（p1 派 → p2 戰場，p2 派 → p1 戰場）。
- 防守方擊殺怪物取得 Bounty。
- 怪物到終點造成 Leak Damage。
- 雙方規則、起始資源、地圖與內容完全相同。

> 內部實作：`battlefield_p1` 映射到 `lane_p1`；`battlefield_p2` 映射到 `lane_p2`。
> p2 目前由 AI Controller 控制作為對手，未來替換為真人玩家時不影響 Core 規則。

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

- 每方一個送往**對手 Battlefield** 的 Queue。
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

- 只能放自己 Lane 的 Buildable Cell。
- 每格最多一塔；塔佔據 Navigation Cell 並觸發固定順序尋路。
- Spawn、End、Blocked 不可建造。
- 建造不得完全封死 Spawn 到 End；否則回傳 `path_blocked` 且不扣款。
- 預覽顯示 Range、預計路徑與合法性。
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

### Movement Type and Targeting

塔攻擊前須確認怪物 `movementType` 是否在塔的 `attackTargets` 清單內。`attackTargets` 為空陣列時，塔無法攻擊任何怪物。

- `attackTargets: ['ground']`：只可攻擊地面怪（如 Sheep、Wolf、Treant）。
- `attackTargets: ['flying']`：只可攻擊飛行怪（如 Ghost）。
- `attackTargets: ['ground', 'flying']`：兩者皆可。

飛行怪（`movementType: 'flying'`）使用與地面怪獨立的 Elevated Path，兩種路徑起點終點相同，但中間座標不同；飛行怪無視地形障礙。

### 抗性與傷害計算

最終 HP 傷害計算順序（Shield → Armor → Resist → Bonus）：

```text
1. rawDamage = level.damage
2. 若 primary target 有 bonusDamageTag 且等於 level.bonusDamageTag：
      rawDamage = floor(rawDamage × (1000 + bonusDamagePermille) / 1000)
3. 根據 damageType 套用抗性：
      physical_resist  tag → damageType === 'physical' 時，armorMultiplierPermille 生效
      magic_resist     tag → damageType === 'magic'    時，armorMultiplierPermille 生效
      pure 伤害类型 → 忽略所有抗性
4. armorMultiplierPermille = 1000 - clamp(armorPermille, 0, 800)
5. finalHpDamage = max(1, floor(rawDamage × armorMultiplierPermille / 1000))
```

Shield 先扣，Armor 不影響 Shield，溢出 Damage 再套 Armor。

### Monster AI Behavior

當怪物在塔攻擊範圍內時：

- `targetPreference: 'base'`：忽略塔繼續前進。
- `targetPreference: 'tower'`：若場上有塔在範圍內，停下來攻擊塔（攻城怪行為）；否則繼續前進。
- `targetPreference: 'closest'`：普通怪物無視塔，繼續沿路徑前進。

MVP 不含「怪物主動攻擊塔造成塔損壞」的規則。

### Wave System

自動波次由 `MatchWaveState` 管理，讀取 `packages/game-data` 提供的 `WaveDefinition[]`。波次由系統（而非玩家）觸發，怪物來源記錄為 `source: { type: 'wave', waveNumber }`，不是任何 PlayerSlot。

#### 雙戰場模型（ADR-001）

每位玩家的 Battlefield 有獨立的 `BattlefieldWaveRuntime`：
- Wave Definition 為**共享唯讀資料**，雙方使用相同定義
- 每個 Battlefield 各自維護 `currentGroupIndex`、`currentGroupSpawned`、`ticksUntilNextSpawn`、`spawningCompleted`
- 某 Battlefield 的怪物死亡或漏怪**不影響**另一 Battlefield 的 wave runtime
- `wave_ended` 為**per-battlefield 事件**，雙方各自獨立觸發

#### 波次生成規則

- Wave Definition 的 `count` 為**每 Battlefield 的數量**（如 Wave 1 = basic × 3，表示 p1 和 p2 各自的戰場各 3 隻）
- 系統同時在兩個 Battlefield 生成怪物（共享 wave number，獨立 runtime）
- 第 1 波：僅 Basic 怪物。
- 每 5 波（第 5, 10, 15…波）：加入 Swift 怪物。
- 每 10 波（第 10, 20, 30…波）：加入 Siege + Boss 怪物。
- 第 6 波起每 6 波：加入 Flying 怪物。
- 難度倍率：每 5 波 +5%。

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
- BOSS：優先選擇攜帶 `boss` 標籤的怪物；次高優選取決於塔的次要 targeting 策略。

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
