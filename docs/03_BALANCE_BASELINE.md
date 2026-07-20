# 03｜Balance Baseline

> 初始可執行假設，不是最終平衡。Repo 建立後，`packages/game-data` 是數值唯一來源。

## 1. 全局

| Key | Value |
|---|---:|
| tickRate | 20/s |
| countdownTicks | 60 |
| maxRunningTicks | 12,000 |
| maxResolvingTicks | 400 |
| startingHp | 20 |
| startingGold | 600 |
| startingIncome | 100 |
| incomeIntervalTicks | 200 |
| sellRefundPermille | 700 |
| sendQueueLimit | 30 |
| slowCapPermille | 500 |

## 2. 塔

Cost 定義：L1 是建造成本；L2／L3 是該次升級額外成本。

### Archer

| Level | Cost | Damage | Cooldown | Range |
|---|---:|---:|---:|---:|
| 1 | 120 | 18 | 13 ticks | 3200 |
| 2 | 160 | 29 | 12 ticks | 3400 |
| 3 | 240 | 46 | 10 ticks | 3600 |

FIRST；穩定單體；無暴擊。

### Mage

| Level | Cost | Damage | Cooldown | Range | Splash Radius | Factor |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 180 | 26 | 28 | 2800 | 750 | 650‰ |
| 2 | 230 | 43 | 26 | 3000 | 850 | 700‰ |
| 3 | 340 | 72 | 23 | 3200 | 950 | 750‰ |

FIRST；群體處理。

### Frost

| Level | Cost | Damage | Cooldown | Range | Slow | Duration |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 150 | 7 | 20 | 2700 | 250‰ | 30 |
| 2 | 190 | 11 | 18 | 2900 | 320‰ | 34 |
| 3 | 280 | 17 | 16 | 3100 | 400‰ | 40 |

FIRST；命中主目標與 550 milli-tiles 半徑；支援而非主輸出。

### Sniper

| Level | Cost | Damage | Cooldown | Range |
|---|---:|---:|---:|---:|
| 1 | 260 | 95 | 48 | 5500 |
| 2 | 330 | 165 | 44 | 5800 |
| 3 | 500 | 285 | 40 | 6200 |

STRONG → FIRST；處理厚血與 Armor；無暴擊。

## 3. 怪物

| ID | Cost | Income | Bounty | HP | Shield | Armor | Speed/tick | Leak | Gap | Unlock |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sheep | 60 | 6 | 10 | 85 | 0 | 0‰ | 39 | 1 | 9 | 0 |
| wolf | 105 | 10 | 16 | 125 | 0 | 0‰ | 59 | 1 | 10 | 600 |
| treant | 185 | 16 | 26 | 390 | 0 | 220‰ | 28 | 2 | 14 | 1800 |
| ghost | 240 | 20 | 32 | 215 | 95 | 0‰ | 44 | 2 | 13 | 3000 |

Speed 單位為 milli-tiles/tick；Unlock 為 RUNNING ticks。

## 4. 平衡不變量

1. 合理位置 L1 Archer 可處理單隻 Sheep。
2. 純 Archer 對密集 Sheep 低於加入 Mage。
3. 純 Mage 對 Treant 低於加入 Sniper。
4. Frost 單獨不能主輸出。
5. Ghost 不需要偵測。
6. 連續送怪不能成為無腦最優解。
7. 完全不送怪在 4–6 分鐘後有明顯 Income 劣勢。
8. Bounty 長期價值不得高於 Sender Income 投資。
9. 高階怪不是全面上位替代。
10. 600 Gold 不應只有唯一正確開局。
11. 地圖格數避免 10 分鐘前完全飽和。
12. 超時率不應長期高於 20%。

## 5. 第一批模擬

- 600 Gold 開局分布。
- Archer vs 1／3／5 Sheep。
- Archer vs Wolf。
- Archer＋Frost vs 5 Wolf。
- Mage vs 6 Sheep。
- Sniper vs Treant。
- Archer vs Ghost。
- 純防守 vs 穩定送怪。
- Sheep Eco vs Wolf Pressure。
- 3／5／8／10 分鐘經濟。
- Timeout Tie-break。
- 200 Active Monsters。

## 6. Balance Sim 輸出

- DPS、DPS per Gold。
- Tower／Monster TTK Matrix。
- Income 回本時間。
- 經濟曲線。
- 開局使用率／勝率。
- P50／P90 局長。
- 超時率、漏怪率。
- AI vs AI 多 Seed 報告。

## 7. 調整紀錄

```markdown
### BAL-YYYY-MM-DD-001
- Hypothesis:
- Changed:
- Before:
- After:
- Test scenarios:
- Seeds:
- Result:
- Keep / Revert:
- Follow-up:
```
