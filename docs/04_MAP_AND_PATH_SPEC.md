# 04｜Map and Path Specification

## 1. MVP 地圖原則

- 一張固定地圖。
- 兩條鏡像 Lane。
- Lane 互不交叉，怪物不互相碰撞。
- 玩家不可改變路徑。
- Buildable Cell 固定，不做堵路或動態 Pathfinding。
- 怪物沿 Waypoint Polyline 前進。
- 規則座標使用 milli-tile fixed-point。
- Render Adapter 再轉為 Pixel。

## 2. 邏輯尺寸

建議初始：

- Grid：16 × 9。
- Logical Tile：1 tile。
- Canvas：1280×720。
- 每 Lane 路徑長度：16–22 tiles。
- 每方 Buildable Cell：18–24 格，依首張地圖測試調整。

## 3. 資料契約

```ts
type MapId = 'mvp_mirror_01';

interface GridCell {
  col: number;
  row: number;
}

interface FixedPointPosition {
  xMilliTiles: number;
  yMilliTiles: number;
}

interface LaneDefinition {
  id: 'lane_p1' | 'lane_p2';
  defenderPlayerId: 'p1' | 'p2';
  attackerPlayerId: 'p2' | 'p1';
  waypoints: readonly FixedPointPosition[];
  spawnPosition: FixedPointPosition;
  endPosition: FixedPointPosition;
  buildableCells: readonly GridCell[];
  blockedCells: readonly GridCell[];
  aiBuildPriorityCells: readonly GridCell[];
}

interface MapDefinition {
  id: MapId;
  schemaVersion: 1;
  displayName: string;
  gridColumns: number;
  gridRows: number;
  lanes: readonly [LaneDefinition, LaneDefinition];
}
```

## 4. 驗證規則

拒絕：

- 重複 Cell。
- Buildable 與 Blocked 重疊。
- Spawn／End／Path Cell 被標成 Buildable。
- Waypoint 少於 2。
- 相鄰 Waypoint 相同。
- Defender／Attacker 錯配。
- 鏡像 Lane 路徑長度差超過 1 milli-tile。
- Waypoint 超出地圖範圍。
- AI Priority Cell 不是 Buildable。

## 5. 路徑進度

Monster State 儲存：

- `segmentIndex`
- `distanceOnSegmentMilliTiles`
- `pathProgressMilliTiles`

規則：

- Progress 只能增加。
- 到 Segment End 後進下一段。
- 最後 End Position 標記 `pendingLeak`。
- Movement 使用整數。
- 最後一 Tick 可截斷到終點。
- 不使用 Phaser Path 或 Physics 作權威狀態。

## 6. 塔範圍

- Tower Position 取 Cell 中心。
- Monster Position 取 fixed-point 路徑位置。
- 比較平方距離。
- 邊界採 `distanceSquared <= rangeSquared`。
- 同時進出邊界由整數座標決定。

## 7. 地圖驗收

- 兩 Lane 路徑長度一致。
- 同怪物、同 Tick 出生、無減速時到達 Tick 一致。
- 每種塔至少 3 個具差異的可用位置。
- 不存在單格覆蓋超過 80% 路徑且壓倒其他位置。
- Sniper 不得在單一 Cell 覆蓋整條 Lane。
- Buildable Cell 不遮 UI。
- AI 只使用 Map Definition 候選 Cell。
