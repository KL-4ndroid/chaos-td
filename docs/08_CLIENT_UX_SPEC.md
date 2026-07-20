# 08｜Client and UX Specification

## 1. 畫面

```text
┌──────────────────────────────────────────────────────┐
│ 時間｜Phase｜對手 HP/Income｜玩家 HP/Gold/Income    │
├──────────────────────────────────────────────────────┤
│                  對手 Lane                           │
├──────────────────────────────────────────────────────┤
│                  玩家 Lane                           │
├──────────────────────────────────────────────────────┤
│ 4 塔｜4 怪｜Queue｜塔資訊／升級／出售               │
└──────────────────────────────────────────────────────┘
```

上下或左右 Lane 由首個 UX Prototype 決定，記錄於 Decision Log。

## 2. 永久資訊

- 雙方 HP。
- 玩家 Gold／Income／倒數。
- 對手公開 Income。
- 時間／Phase。
- Queue Count。
- Monster Unlock Countdown。

情境資訊：

- Range Preview。
- Cell 合法性。
- Tower Level／Stats／Cost／Refund。
- Reject Reason。
- 大額送怪提醒。
- Leak、Income Event。
- Result。

## 3. 建塔

1. 點塔按鈕或 1–4。
2. 顯示 Ghost Preview／Range。
3. 顯示合法性。
4. 點 Cell 送 Command。
5. Accepted／Rejected Event 後更新。
6. Client 不先自行扣 Gold。

## 4. 送怪

- 顯示 Cost、Income Gain、Unlock。
- 單擊送 1。
- Shift＋點擊送 5，仍為原子 Command。
- Queue 滿或資金不足禁用並說明。
- MVP 不要求長按連發。

## 5. 選塔

顯示 Level、下一級差異、Upgrade Cost、Sell Refund。出售使用短確認，避免誤觸。

## 6. Pause

單機 Esc／Button 暫停 Simulation；不寫 Replay；Hidden 自動暫停。未來 PvP 不允許單方 Pause。

## 7. 教學

四個 Contextual Tip，不遮按鈕、可略過、不阻斷，只保存 `tutorialSeen`。

## 8. 回饋

150ms 內提供 Button、Pending、Accepted／Rejected、Gold／Income、Upgrade、Spawn、Shield Break、Leak 回饋。動畫不得延遲規則。

## 9. Accessibility

- 不只靠紅綠。
- 標籤、方向、邊框、形狀區分。
- Icon 有文字／Tooltip。
- Reduced Motion。
- 避免高頻閃爍。
- Master／Music／SFX。
- 滑鼠可完成全部主要操作，另有快捷鍵。

## 10. Debug

Development 按 F3；顯示 Tick、Hash、Seed、Config 等，不進 Production 預設 UI。
