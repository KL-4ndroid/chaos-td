# 08｜Client and UX Specification

## 1. 畫面

手機優先採 `480×960` 豎屏邏輯畫布。第一視圖由上到下為：雙方狀態列、對手 8×10 Lane、本方 8×10 Lane、送怪觸控列。兩張棋盤都即時呈現塔、怪物與路徑，讓玩家根據對手防線選擇送怪策略。

建塔、升級與出售不使用固定工具列：點本方空格展開建塔選單，點本方既有塔展開升級／出售選單，點其他區域收合。未選取時不得占用棋盤或固定畫面空間。

桌面以 `FIT` 等比例顯示同一豎屏介面；滑鼠與鍵盤只作額外輸入方式。

## 2. 永久資訊

- 雙方 HP。
- 玩家 Gold／Income／倒數。
- 對手公開 Income。
- 時間／Phase。
- 下一波怪物倒數；必須與權威 Tick 波次排程一致。
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

1. 點本方空格展開塔種與建造費用；桌面可在空格選單開啟時使用 1–4。
2. 顯示 Ghost Preview／Range。
3. 顯示合法性與建造後的預計繞行路徑。
4. 點塔種送 Command；若會完全封路則顯示 `path_blocked`。
5. Accepted／Rejected Event 後更新。
6. Client 不先自行扣 Gold。

## 4. 送怪

- 顯示 Cost、Income Gain、Unlock。
- 單擊送 1。
- Shift＋點擊送 5，仍為原子 Command。
- Queue 滿或資金不足禁用並說明。
- MVP 不要求長按連發。

## 5. 選塔

點本方既有塔後，以鄰近浮動選單顯示 Level、下一級差異、Upgrade Cost、Sell Refund。選單必須避開畫面邊界；出售使用短確認，避免誤觸。

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
