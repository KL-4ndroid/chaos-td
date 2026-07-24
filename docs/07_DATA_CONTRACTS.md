# 07｜Data Contracts

## 1. IDs

```ts
export type PlayerSlot = 'p1' | 'p2';
export type LaneId = 'lane_p1' | 'lane_p2';
export type TowerId = 'archer' | 'mage' | 'frost' | 'sniper';
export type MonsterId = 'sheep' | 'wolf' | 'treant' | 'ghost';
export type MapId = 'mvp_mirror_01';
export type EntityId = number;
```

Display Name 不作 ID。

```ts
interface LocalPerspective {
  localPlayerId: PlayerSlot;
}
```

## 2. Gameplay Command

```ts
type GameplayCommand =
  | BuildTowerCommand
  | UpgradeTowerCommand
  | SellTowerCommand
  | QueueMonsterCommand;

interface CommandBase {
  commandId: string;
  playerId: PlayerSlot;
  targetTick: number;
}

interface BuildTowerCommand extends CommandBase {
  type: 'build_tower';
  towerId: TowerId;
  cell: GridCell;
}

interface UpgradeTowerCommand extends CommandBase {
  type: 'upgrade_tower';
  towerEntityId: EntityId;
}

interface SellTowerCommand extends CommandBase {
  type: 'sell_tower';
  towerEntityId: EntityId;
}

interface QueueMonsterCommand extends CommandBase {
  type: 'queue_monster';
  monsterId: MonsterId;
  quantity: 1 | 2 | 3 | 4 | 5;
}
```

- Command ID 唯一。
- Duplicate 不重複生效。
- 不攜帶 Cost、Damage、GoldAfter、Result。
- 本機預設 Target Tick = Current＋1。
- AI 最早 Current＋2。
- Server 未來可重派 Target Tick。

## 3. Local Action

不寫 Replay：

```ts
type LocalClientAction =
  | { type: 'pause_local_session' }
  | { type: 'resume_local_session' }
  | { type: 'restart_match' }
  | { type: 'toggle_settings' }
  | { type: 'toggle_debug_overlay' };
```

## 4. Match State

```ts
interface MatchState {
  schemaVersion: 1;
  configVersion: string;
  seed: string;
  mapId: MapId;
  phase: 'ready' | 'countdown' | 'running' | 'resolving' | 'result';
  tick: number;
  runningStartedAtTick: number | null;
  resolvingStartedAtTick: number | null;
  players: Record<PlayerSlot, PlayerBattleState>;
  lanes: Record<LaneId, LaneState>;
  towers: TowerState[];
  monsters: MonsterState[];
  result: MatchResult | null;
  nextEntityId: number;
}
```

## 5. Player State

```ts
interface PlayerBattleState {
  playerId: PlayerSlot;
  hp: number;
  gold: number;
  income: number;
  nextIncomeTick: number;
  leakDamageDealt: number;
  towerSpend: number;
  monsterSpend: number;
  bountyEarned: number;
  highestIncome: number;
  sendQueue: SendQueueItem[];
  queueCooldownTicks: number;
}
```

## 6. Definitions

### ID Literal Types

```ts
type MovementType = 'ground' | 'flying';
type MonsterTag   = 'boss' | 'siege' | 'swift' | 'magic_resist' | 'physical_resist';
type DamageType   = 'physical' | 'magic' | 'pure';
type AttackTarget = 'ground' | 'flying';
type TowerTargeting = 'first' | 'strong' | 'boss';
```

### Tower Definition

```ts
interface TowerDefinition {
  id: TowerId;
  displayName: string;
  role: 'single_target' | 'splash' | 'slow' | 'heavy_hit';
  targeting: TowerTargeting;
  /** Which MovementTypes this tower can attack. Empty = cannot attack anything. */
  attackTargets: readonly AttackTarget[];
  /** Damage type used for resist checks. Pure ignores all resist tags. */
  damageType: DamageType;
  levels: readonly [TowerLevelDefinition, TowerLevelDefinition, TowerLevelDefinition];
}

interface TowerLevelDefinition {
  cost: number;
  damage: number;
  cooldownTicks: number;
  rangeMilliTiles: number;
  splashRadiusMilliTiles?: number;
  splashFactorPermille?: number;
  slowRadiusMilliTiles?: number;
  slowPermille?: number;
  slowDurationTicks?: number;
  /** Bonus damage multiplier (permille) when primary target has matching tag. */
  bonusDamagePermille?: number;
  /** Tag that triggers bonusDamage (e.g. 'boss'). */
  bonusDamageTag?: MonsterTag;
}
```

### Monster Definition

```ts
interface MonsterDefinition {
  id: MonsterId;
  displayName: string;
  sendCost: number;
  incomeGain: number;
  bounty: number;
  hp: number;
  shield: number;
  armorPermille: number;
  speedMilliTilesPerTick: number;
  leakDamage: number;
  availableAtRunningTick: number;
  spawnGapTicks: number;
  /** Ground follows grid path; flying uses a separate elevated path. */
  movementType: MovementType;
  /** AI behavior when this monster enters tower range. */
  targetPreference: 'base' | 'tower' | 'closest';
  /** Tactical tags that determine tower counter bonuses and UI icons. */
  tags: readonly MonsterTag[];
}
```

### Wave System

```ts
type WaveMonsterType = 'basic' | 'swift' | 'flying' | 'siege' | 'boss';

interface WaveGroup {
  monsterType: WaveMonsterType;
  count: number;
  /** Scale factor applied to monster HP and damage. */
  difficultyMultiplier: number;
}

interface WaveDefinition {
  waveNumber: number;
  groups: readonly WaveGroup[];
  totalDurationTicks: number;
}
```

## 7. Domain Events

至少包含：

- Command Accepted／Rejected。
- Tower Built／Upgraded／Sold。
- Monster Queued／Spawned。
- Attack Fired。
- Damage Applied。
- Shield Broken。
- Slow Applied。
- Monster Died／Leaked。
- Income Paid。
- Phase Changed。
- Match Ended。

Event 只含序列化資料，不含 Phaser Object 或函式。

## 8. Replay

```ts
interface ReplayFile {
  replayVersion: 1;
  schemaVersion: 1;
  configVersion: string;
  mapId: MapId;
  seed: string;
  acceptedCommands: GameplayCommand[];
  expectedResult?: MatchResult;
  checkpoints?: Array<{ tick: number; stateHash: string }>;
  metadata?: {
    createdAt: string;
    clientVersion?: string;
  };
}
```

Metadata 不參與 Simulation。

## 9. Result

```ts
interface MatchResult {
  winnerPlayerId: PlayerSlot | null;
  outcome: 'win' | 'draw';
  reason:
    | 'hp'
    | 'timeout_hp'
    | 'timeout_income'
    | 'timeout_net_worth'
    | 'exact_draw';
  endedAtTick: number;
  p1: MatchPlayerStats;
  p2: MatchPlayerStats;
  finalStateHash: string;
}
```

Client 依 Local Perspective 顯示勝敗。

## 10. Runtime Validation

外部邊界驗證 Config、Map、Replay、Settings、未來 Network Command／Snapshot。Hot Path 不重複昂貴 Parsing。

## 11. Canonical Hash

- 排除 Metadata、Render State、Event Buffer。
- Object Key 固定排序。
- Entity 依 ID。
- 不含 CreatedAt、FPS、Local Perspective。
- 包含 Config Version、Seed、Phase、Tick、Players、Entities、Result。
