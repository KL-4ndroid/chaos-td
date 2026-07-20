# 05｜AI Behavior Specification

## 1. 目的

MVP AI 提供公平、可重現、能完成完整對局的 Normal 對手，不追求模擬高手。

## 2. 公平原則

AI：

- 使用相同起始 Gold、Income、塔與怪物。
- 不讀取玩家未公開資訊。
- 不知道未來 Command。
- 不取得額外傷害、金幣、射程或反應速度。
- 使用同一 Gameplay Command API。
- 所有隨機選擇使用 Match Seed 派生的 AI PRNG Stream。

## 3. 決策頻率

- 每 10 ticks（0.5 秒）評估。
- AI Command 最早 Target Tick = Current Tick＋2。
- 同 Seed＋同玩家 Commands 必須產生同一 AI Command Log。

## 4. AI State

```ts
interface AIState {
  lastDecisionTick: number;
  defenseReserve: number;
  offenseBudgetRatioPermille: number;
  preferredCells: GridCell[];
  recentRejectedCommands: number;
}
```

- Offense Budget Ratio 在開局由 Seed 固定為 350–550‰。
- 不使用 Hidden Difficulty Scaling。

## 5. Threat

不使用不同單位直接相加的單一魔法公式。分別計算：

### Imminent Leak Risk

預估未來 80 ticks：

- 場上怪物到終點時間。
- 現有塔依固定 Targeting／Cooldown 的保守傷害。
- 使用 deterministic lightweight forecast。

輸出：`safe`、`strained`、`critical`。

### Lane Pressure

```text
pressurePoints =
  Σ effectiveHp × urgencyPermille / 1000
```

- `effectiveHp` 為 HP、Shield、Armor 的整數近似。
- 剩餘路徑前 50%：500‰。
- 50–75%：800‰。
- 75–100%：1200‰。

### Defense Capacity

估算未來 4 秒各塔的有效攻擊次數；Range 外怪物不視為可立即處理。

## 6. 防守決策

優先：

1. `critical`：選擇可負擔且預估減少 Leak 最多的合法 Action。
2. `strained`：維持 Reserve，必要時建塔或升級。
3. `safe`：避免過度防守，保留進攻預算。

候選：

- 在 `aiBuildPriorityCells` 建塔。
- 升級現有塔。
- MVP 預設不出售。

Action Score：

```text
score =
  expectedDamageNext80Ticks
  + expectedControlValue
  + coverageGain
  - costPenalty
```

相同 Score：較低 Cost → Map Priority → Tower ID → Cell Row／Column。

## 7. 進攻決策

只有 Lane `safe`、Gold 大於 Reserve、Queue 未滿時進攻。

```text
offenseBudget =
  floor((gold - defenseReserve) × offenseBudgetRatioPermille / 1000)
```

選擇：

- Sheep：預設 Eco。
- Wolf：對低射速或 Coverage 空檔。
- Treant：對大量低單發。
- Ghost：對少量高單發或持續火力不足。

相同 Score 可在前兩名中用 Seeded PRNG 選擇。

## 8. Defense Reserve

初始建議：

- 0–120 秒：120–220。
- 120–300 秒：180–320。
- 300 秒後：250–450。
- `strained` 提高。
- `critical` 可動用。

正式值放入 `game-data/ai.config.ts`。

## 9. 驗收

- 100 Seeds 不出現負 Gold。
- 不送未解鎖怪物、不用非法 Cell。
- Rejected Command < 2%。
- 同 Seed＋玩家 Commands 完全一致。
- 不讀 Local Perspective 私有資訊。
- 可完成 AI vs AI。
- 可輸出 100 Seeds Draw／Timeout 報告。
- 無隱藏加成。
