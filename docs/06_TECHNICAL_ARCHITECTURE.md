# 06｜Technical Architecture

## 1. 目標

- 無後端可完整玩 MVP。
- 未來 PvP 不重寫規則。
- Core 可在 Browser、Node Test、Server 執行。
- 同 Seed＋Commands 得到相同 State。
- Phaser 不進 Domain。
- Cursor 每次只讀少量文件。

## 2. Monorepo

```text
chaos-td/
├─ apps/
│  ├─ client/
│  └─ server/                  # Phase 2
├─ packages/
│  ├─ game-core/
│  ├─ game-data/
│  ├─ shared/
│  ├─ test-fixtures/
│  └─ balance-sim/             # M6
├─ docs/
├─ tasks/
├─ .cursor/rules/
├─ package.json
├─ package-lock.json
├─ tsconfig.base.json
├─ eslint.config.mjs
└─ vitest.config.ts
```

使用 npm Workspaces；MVP 不先引入 Nx／Turborepo。

## 3. Boundaries

### game-core

允許：TypeScript、immutable definitions、Seeded PRNG、State、Commands、Systems、Snapshot、Replay、Hash。

禁止：Phaser、DOM、Canvas、WebSocket、LocalStorage、Audio、`Date.now()`、`Math.random()`、Timer、Tween。

### game-data

- Global、Tower、Monster、Map、AI Config。
- Runtime Validation。
- Config Version。
- ID 唯一、引用有效、數值不散落 UI。
- 文件由 Script 產生或 CI 對照。

### shared

只放真正跨邊界且穩定的 ID、Result、Version、Envelope 基礎；不成為所有 Domain Type 的雜物箱。

### client

Phaser Scene、Render Adapter、Input、HUD、Audio、Interpolation、Settings、Replay Viewer、Local Perspective。只能提交 Command，不直接改 Core State。

### server

Phase 2：Authoritative Room、Command 驗證、執行 game-core、State Patch、Event、Replay。不得信任 Client 結果。

## 4. Systems

```text
Simulation
├─ MatchPhaseSystem
├─ CommandSystem
├─ EconomySystem
├─ AISystem
├─ SpawnQueueSystem
├─ MovementSystem
├─ LeakSystem
├─ TargetingSystem
├─ CombatSystem
├─ StatusSystem
├─ DeathAndBountySystem
├─ ResultSystem
└─ EventSystem
```

順序由 Core Rules 定義。

## 5. Entity Model

不建立每內容一個繼承子類。

```ts
interface TowerState {
  id: EntityId;
  ownerId: PlayerSlot;
  laneId: LaneId;
  towerId: TowerId;
  level: 1 | 2 | 3;
  cell: GridCell;
  cooldownTicksRemaining: number;
  totalInvestedCost: number;
}

interface MonsterState {
  id: EntityId;
  ownerId: PlayerSlot;
  laneId: LaneId;
  monsterId: MonsterId;
  hp: number;
  shield: number;
  segmentIndex: number;
  distanceOnSegmentMilliTiles: number;
  pathProgressMilliTiles: number;
  routeWaypoints: readonly FixedPointPosition[];
  slow: SlowState | null;
  alive: boolean;
}
```

差異由 Definition 與 System 處理。

## 6. Determinism

- 金額、HP、Damage、Tick 整數。
- Armor／Slow／Splash 用 Permille。
- Position／Range 用 milli-tile。
- 版本化 Seeded PRNG。
- Entity ID 單調增加、不重用。
- Collection 順序穩定。
- Replay 存 Seed、Config Version、Accepted Commands。
- 每 N ticks 可 Hash。
- 不比較浮點相等。

## 7. Hitscan／Render Adapter

Core 攻擊 Tick 立即 Damage，不建立 Projectile Entity。

Client：

- Entity ID → Phaser GameObject。
- Simulation Position → 插值位置。
- Domain Event → Animation／Audio。
- 動畫不得回寫 Core。

## 8. Client Loop

```ts
accumulator += frameDeltaMs;

while (accumulator >= tickDurationMs && ticksThisFrame < 5) {
  simulation.step();
  accumulator -= tickDurationMs;
  ticksThisFrame += 1;
}
```

- Backlog 不丟棄。
- Hidden 自動暫停。
- Frame Delta Clamp。
- Pause 是 Client Session，不是 Gameplay Command。

## 9. 儲存

只存 Volume、Reduced Motion、Tutorial Seen、Difficulty、Debug Preference。使用 Versioned Settings Adapter。

不存未完成 Match、競技 Gold／Income／塔／怪物。

## 10. Error

```ts
type Result<T, E extends string> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

錯誤碼：

- `insufficient_gold`
- `invalid_quantity`
- `invalid_cell`
- `cell_occupied`
- `path_blocked`
- `tower_max_level`
- `queue_full`
- `monster_locked`
- `match_not_running`
- `not_owner`
- `duplicate_command`
- `invalid_target_tick`

## 11. Debug Overlay

FPS、Tick、Phase、Accumulator、Backlog、Entity Count、Command、Hash、Seed、Config Version、Slow Frame、Invariant Failure。

## 12. 依賴政策

- Lockfile 權威。
- Major Upgrade 需 ADR。
- 不用 `latest` 作可重現版本。
- 不在無關 Task 升級依賴。
