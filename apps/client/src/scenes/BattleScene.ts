import Phaser from 'phaser';
import {
  SELL_REFUND_PERMILLE,
  TICK_DURATION_MS,
  addCheckpoint,
  addEvent,
  calculateMonsterPosition,
  createPathSegments,
  createReplayData,
  createSimulation,
  finalizeReplay,
  type DomainEvent,
  type LaneRuntimeState,
  type MonsterRuntimeState,
  type Replay,
  type Simulation,
  type SimulationState,
} from '@chaos-td/game-core';
import {
  CONFIG_VERSION,
  MONSTER_BY_ID,
  MVP_MIRROR_01,
  TOWER_BY_ID,
  type LaneDefinition,
  type LaneId,
  type TowerId,
} from '@chaos-td/game-data';
import { FixedStepLoop } from '../simulation-loop';
import { phaserAssetKey } from '../assets';
import { getTicksUntilNextWave, isDemoWaveTick } from '../wave-schedule';
import { containsPoint, type ScreenRect } from '../ui-hit-test';

export const BATTLE_SCENE_KEY = 'BattleScene';
const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 960;
const TILE_PIXELS = 32;
const BOARD_X = 112;
const BOARD_WIDTH = MVP_MIRROR_01.gridColumns * TILE_PIXELS;
const BOARD_HEIGHT = 10 * TILE_PIXELS;
const TOP_BOARD_Y = 100;
const BOTTOM_BOARD_Y = 462;
const LANE_ROWS = 10;
const LOCAL_LANE_MIN_ROW = 11;
const LOCAL_LANE = MVP_MIRROR_01.lanes.find((lane) => lane.id === 'lane_p1');
const OPPONENT_LANE = MVP_MIRROR_01.lanes.find((lane) => lane.id === 'lane_p2');

interface MonsterVisual {
  body: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Text;
  previousX: number;
  previousY: number;
  currentX: number;
  currentY: number;
}

function createLaneRuntime(definition: LaneDefinition): LaneRuntimeState {
  const segments = createPathSegments(definition.waypoints);
  return {
    laneId: definition.id,
    battlefieldId: definition.id,
    defenderId: definition.defenderPlayerId,
    attackerId: definition.attackerPlayerId,
    waypoints: definition.waypoints,
    spawnPosition: definition.spawnPosition,
    endPosition: definition.endPosition,
    segments,
    totalPathLength: segments.reduce((total, segment) => total + segment.lengthMilliTiles, 0),
    spawnQueue: [],
    monsters: [],
    pendingLeaks: [],
    spawnCooldownTicks: 0,
  };
}

function createDemoSimulation(): Simulation {
  const lanes = Object.fromEntries(
    MVP_MIRROR_01.lanes.map((lane) => [lane.id, createLaneRuntime(lane)]),
  ) as Record<LaneId, LaneRuntimeState>;
  return createSimulation({ seed: 'portrait-maze-demo', configVersion: CONFIG_VERSION }, lanes);
}

function toPixels(laneId: LaneId, xMilliTiles: number, yMilliTiles: number): { x: number; y: number } {
  const isLocal = laneId === 'lane_p1';
  return {
    x: BOARD_X + (xMilliTiles / 1000) * TILE_PIXELS,
    y: (isLocal ? BOTTOM_BOARD_Y : TOP_BOARD_Y) +
      (yMilliTiles / 1000 - (isLocal ? LOCAL_LANE_MIN_ROW : 0)) * TILE_PIXELS,
  };
}

export class BattleScene extends Phaser.Scene {
  private readonly loop = new FixedStepLoop(TICK_DURATION_MS);
  private readonly simulation = createDemoSimulation();
  private readonly monsterVisuals = new Map<number, MonsterVisual>();
  private readonly towerVisuals = new Map<number, Phaser.GameObjects.Container>();
  private readonly pathGraphics = new Map<LaneId, Phaser.GameObjects.Graphics>();
  private hpText?: Phaser.GameObjects.Text;
  private economyText?: Phaser.GameObjects.Text;
  private phaseText?: Phaser.GameObjects.Text;
  private waveText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private pausedText?: Phaser.GameObjects.Text;
  private actionMenu?: Phaser.GameObjects.Container;
  private actionMenuBounds?: ScreenRect;
  private selectedCell?: { cellX: number; cellY: number };
  private opponentDefenseSubmitted = false;
  private selectedTowerEntityId?: number;
  private replay: Replay = createReplayData('portrait-maze-demo', CONFIG_VERSION, this.simulation.state.stateHash);

  constructor() {
    super({ key: BATTLE_SCENE_KEY });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101418');
    this.drawArena();
    this.createOverlay();
    this.createSendControls();
    this.createInputBindings();
    this.syncTowerVisuals(this.simulation.state);
    this.simulation.start();

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.handleVisible, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleHidden, this);
      this.game.events.off(Phaser.Core.Events.VISIBLE, this.handleVisible, this);
    });
  }

  update(_time: number, delta: number): void {
    this.loop.advance(delta, () => this.stepSimulation());
    this.renderMonsters(this.simulation.state, this.loop.interpolationAlpha);
    this.updateOverlay();
  }

  private stepSimulation(): void {
    const state = this.simulation.state;
    if (state.phase === 'running' && !this.opponentDefenseSubmitted) {
      const cells = [{ cellX: 4, cellY: 6 }, { cellX: 3, cellY: 4 }, { cellX: 4, cellY: 2 }];
      cells.forEach((cell, index) => {
        this.simulation.submitCommand({
          type: 'build_tower',
          commandId: this.simulation.getNextCommandId('p2'),
          playerId: 'p2',
          towerTypeId: index === 1 ? 'frost' : 'archer',
          ...cell,
        });
      });
      this.opponentDefenseSubmitted = true;
    }
    if (isDemoWaveTick(state.phase, state.tick + 1, state.runningStartedAtTick)) {
      this.simulation.submitCommand({
        type: 'queue_monster',
        commandId: this.simulation.getNextCommandId('p2'),
        playerId: 'p2',
        monsterTypeId: 'sheep',
        quantity: 1,
      });
    }
    const result = this.simulation.step();
    this.replay = result.events.reduce((replay, event) => addEvent(replay, event), this.replay);
    this.replay = addCheckpoint(this.replay, result.state.tick, result.state.stateHash);
    if (result.state.phase === 'result') {
      this.replay = finalizeReplay(this.replay, result.state.stateHash, result.state.tick);
    }
    this.captureMonsterPositions(result.state);
    this.renderEvents(result.events);
    this.removeInactiveMonsterVisuals(result.state);
    this.syncTowerVisuals(result.state);
  }

  private drawArena(): void {
    this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x101418);
    this.drawBoard('lane_p2', OPPONENT_LANE, TOP_BOARD_Y, 0, 0x453337);
    this.drawBoard('lane_p1', LOCAL_LANE, BOTTOM_BOARD_Y, LOCAL_LANE_MIN_ROW, 0x27362f);
  }

  private drawBoard(
    laneId: LaneId,
    definition: LaneDefinition | undefined,
    boardY: number,
    minRow: number,
    baseColor: number,
  ): void {
    const board = this.add.graphics();
    const buildable = new Set(definition?.buildableCells.map((cell) => `${cell.col},${cell.row}`) ?? []);
    for (let localRow = 0; localRow < LANE_ROWS; localRow += 1) {
      const row = localRow + minRow;
      for (let col = 0; col < MVP_MIRROR_01.gridColumns; col += 1) {
        const x = BOARD_X + col * TILE_PIXELS;
        const y = boardY + localRow * TILE_PIXELS;
        const canBuild = buildable.has(`${col},${row}`);
        const alternating = (row + col) % 2 === 0;
        board.fillStyle(canBuild ? baseColor + (alternating ? 0x020202 : 0) : 0x253039, 1);
        board.fillRect(x, y, TILE_PIXELS, TILE_PIXELS);
        board.lineStyle(1, 0xc4cec8, 0.11);
        board.strokeRect(x, y, TILE_PIXELS, TILE_PIXELS);
      }
    }
    board.lineStyle(2, laneId === 'lane_p1' ? 0x8eb6a0 : 0xb58c91, 0.55);
    board.strokeRect(BOARD_X, boardY, BOARD_WIDTH, BOARD_HEIGHT);
    const path = this.add.graphics().setDepth(2);
    this.pathGraphics.set(laneId, path);
    this.drawPath(laneId);
  }

  private drawPath(laneId?: LaneId): void {
    const laneIds: readonly LaneId[] = laneId ? [laneId] : ['lane_p1', 'lane_p2'];
    for (const currentLaneId of laneIds) {
      const lane = this.simulation.state.lanes[currentLaneId];
      const graphics = this.pathGraphics.get(currentLaneId);
      if (!graphics) continue;
      graphics.clear();
      graphics.lineStyle(11, currentLaneId === 'lane_p1' ? 0xd4ba72 : 0xb9898b, 0.48);
      graphics.beginPath();
      lane.waypoints.forEach((point, index) => {
        const pixel = toPixels(currentLaneId, point.xMilliTiles, point.yMilliTiles);
        if (index === 0) graphics.moveTo(pixel.x, pixel.y);
        else graphics.lineTo(pixel.x, pixel.y);
      });
      graphics.strokePath();
    }
  }

  private syncTowerVisuals(state: SimulationState): void {
    const active = new Set<number>();
    for (const tower of state.towers) {
      active.add(tower.entityId);
      let visual = this.towerVisuals.get(tower.entityId);
      if (!visual) {
        const laneId: LaneId = tower.ownerId === 'p1' ? 'lane_p1' : 'lane_p2';
        const pixel = toPixels(laneId, tower.cellX * 1000 + 500, tower.cellY * 1000 + 500);
        const x = pixel.x;
        const y = pixel.y;
        const textureKey = phaserAssetKey(`tower.${tower.towerTypeId}`);
        const children: Phaser.GameObjects.GameObject[] = [];
        if (this.textures.exists(textureKey)) {
          children.push(this.add.image(0, 0, textureKey).setDisplaySize(29, 29).setOrigin(0.5, 0.82));
        } else {
          children.push(
            this.add.circle(0, 0, 12, tower.ownerId === 'p1' ? 0x6ca6a0 : 0xb47c83).setStrokeStyle(1, 0xe7eee9, 0.9),
            this.add.text(0, 0, tower.towerTypeId.slice(0, 1).toUpperCase(), {
              color: '#10201d', fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
            }).setOrigin(0.5),
          );
        }
        visual = this.add.container(x, y, children).setDepth(10).setSize(32, 32);
        if (tower.ownerId === 'p1') {
          visual.setInteractive();
          visual.on(Phaser.Input.Events.POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.openTowerMenu(tower.entityId, x, y);
          });
        }
        this.towerVisuals.set(tower.entityId, visual);
      }
      visual.setScale(this.selectedTowerEntityId === tower.entityId ? 1.12 : 1);
    }
    for (const [entityId, visual] of this.towerVisuals) {
      if (active.has(entityId)) continue;
      visual.destroy(true);
      this.towerVisuals.delete(entityId);
    }
  }

  private captureMonsterPositions(state: SimulationState): void {
    for (const lane of Object.values(state.lanes)) {
      for (const monster of lane.monsters) {
        if (monster.hp <= 0) continue;
        const position = calculateMonsterPosition(lane, monster);
        const pixel = toPixels(lane.laneId, position.x, position.y);
        const visual = this.monsterVisuals.get(monster.entityId);
        if (visual) {
          visual.previousX = visual.currentX;
          visual.previousY = visual.currentY;
          visual.currentX = pixel.x;
          visual.currentY = pixel.y;
        } else {
          this.monsterVisuals.set(monster.entityId, this.createMonsterVisual(monster, pixel.x, pixel.y));
        }
      }
    }
  }

  private snapMonsterVisualsToLane(laneId: LaneId): void {
    const lane = this.simulation.state.lanes[laneId];
    for (const monster of lane.monsters) {
      if (monster.hp <= 0) continue;
      const visual = this.monsterVisuals.get(monster.entityId);
      if (!visual) continue;
      const position = calculateMonsterPosition(lane, monster);
      const pixel = toPixels(laneId, position.x, position.y);
      visual.previousX = pixel.x;
      visual.previousY = pixel.y;
      visual.currentX = pixel.x;
      visual.currentY = pixel.y;
    }
  }

  private createMonsterVisual(monster: MonsterRuntimeState, x: number, y: number): MonsterVisual {
    const textureKey = phaserAssetKey(`monster.${monster.monsterTypeId}`);
    const body = this.textures.exists(textureKey)
      ? this.add.image(x, y, textureKey).setDisplaySize(25, 25).setOrigin(0.5, 0.72)
      : this.add.rectangle(x, y, 18, 15, 0xd99578).setStrokeStyle(1, 0xffeadb, 0.9);
    body.setDepth(20);
    const marker = this.add.text(x, y, this.textures.exists(textureKey) ? '' : 'S', {
      color: '#241611', fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    return { body, marker, previousX: x, previousY: y, currentX: x, currentY: y };
  }

  private renderMonsters(state: SimulationState, alpha: number): void {
    const active = new Set(Object.values(state.lanes).flatMap(
      (lane) => lane.monsters.filter((monster) => monster.hp > 0).map((monster) => monster.entityId),
    ));
    for (const [entityId, visual] of this.monsterVisuals) {
      if (!active.has(entityId)) continue;
      const x = Phaser.Math.Linear(visual.previousX, visual.currentX, alpha);
      const y = Phaser.Math.Linear(visual.previousY, visual.currentY, alpha);
      visual.body.setPosition(x, y);
      visual.marker.setPosition(x, y);
    }
  }

  private renderEvents(events: readonly DomainEvent[]): void {
    for (const event of events) {
      if (event.type === 'attack_fired') {
        const tower = this.towerVisuals.get(event.towerEntityId);
        const target = this.monsterVisuals.get(event.targetMonsterId);
        if (tower && target) {
          const projectile = this.add.circle(tower.x, tower.y, 3, 0xffe29a).setDepth(30);
          this.tweens.add({
            targets: projectile, x: target.currentX, y: target.currentY, duration: 120,
            onComplete: () => projectile.destroy(),
          });
        }
      }
      if (event.type === 'tower_built' || event.type === 'tower_sold') {
        const laneId: LaneId = event.playerId === 'p1' ? 'lane_p1' : 'lane_p2';
        this.drawPath(laneId);
        this.snapMonsterVisualsToLane(laneId);
        this.closeActionMenu();
      }
      if (event.type === 'command_rejected' && event.playerId === 'p1') {
        const messages: Record<string, string> = {
          path_blocked: 'Must leave a path open',
          invalid_cell: 'Build inside your arena',
          insufficient_gold: 'Not enough gold',
          cell_occupied: 'Cell occupied',
        };
        this.feedbackText?.setText(messages[event.reason] ?? event.reason).setColor('#f1a38f');
      }
      if (event.type === 'command_accepted' && event.playerId === 'p1') {
        this.feedbackText?.setText('Command accepted').setColor('#9ed8b5');
      }
    }
  }

  private removeInactiveMonsterVisuals(state: SimulationState): void {
    const active = new Set(Object.values(state.lanes).flatMap(
      (lane) => lane.monsters.filter((monster) => monster.hp > 0).map((monster) => monster.entityId),
    ));
    for (const [entityId, visual] of this.monsterVisuals) {
      if (active.has(entityId)) continue;
      visual.body.destroy();
      visual.marker.destroy();
      this.monsterVisuals.delete(entityId);
    }
  }

  private createOverlay(): void {
    this.add.rectangle(VIEW_WIDTH / 2, 43, VIEW_WIDTH, 86, 0x0b0f12, 0.98).setDepth(50);
    this.add.text(18, 13, 'CHAOS TD', {
      color: '#f0cf83', fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold',
    }).setDepth(51);
    this.phaseText = this.add.text(462, 15, '', {
      color: '#9eb1aa', fontFamily: 'Arial, sans-serif', fontSize: '12px', align: 'right',
    }).setOrigin(1, 0).setDepth(51);
    this.hpText = this.add.text(18, 49, '', {
      color: '#e8eeeb', fontFamily: 'Arial, sans-serif', fontSize: '14px',
    }).setDepth(51);
    this.economyText = this.add.text(462, 49, '', {
      color: '#d8c98f', fontFamily: 'Arial, sans-serif', fontSize: '14px', align: 'right',
    }).setOrigin(1, 0).setDepth(51);
    this.add.text(BOARD_X, 82, 'RIVAL DEFENSE', {
      color: '#c7a4a8', fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
    }).setDepth(51);
    this.add.text(BOARD_X, 448, 'YOUR DEFENSE', {
      color: '#9fc4ae', fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
    }).setDepth(51);
    this.waveText = this.add.text(462, 82, '', {
      color: '#f0cf83', fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', align: 'right',
    }).setOrigin(1, 0).setDepth(51);
    this.feedbackText = this.add.text(18, 902, '', {
      color: '#9ed8b5', fontFamily: 'Arial, sans-serif', fontSize: '12px',
    }).setOrigin(0, 0.5).setDepth(51);
    this.pausedText = this.add.text(VIEW_WIDTH / 2, 430, 'PAUSED', {
      color: '#f0cf83', fontFamily: 'Arial, sans-serif', fontSize: '36px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100).setVisible(false);
  }

  private createSendControls(): void {
    this.add.rectangle(VIEW_WIDTH / 2, 849, VIEW_WIDTH, 190, 0x171d22, 1).setDepth(40);
    this.add.text(18, 780, 'SEND TO RIVAL', {
      color: '#91a49c', fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
    }).setDepth(51);
    const monsterIds = ['sheep', 'wolf', 'treant', 'ghost'] as const;
    monsterIds.forEach((monsterId, index) => {
      const definition = MONSTER_BY_ID.get(monsterId);
      this.createButton(18 + index * 112, 838, 102, 58, `${definition?.displayName ?? monsterId}\n${definition?.sendCost ?? 0}G`, () => {
        this.submitMonster(monsterId);
      });
    });
    this.createButton(414, 928, 46, 42, 'II', () => {
      if (this.loop.isPaused) this.handleVisible();
      else this.handleHidden();
    });
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    action: () => void,
  ): void {
    const background = this.add.rectangle(x, y, width, height, 0x273139, 1)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0xb6c3bc, 0.3)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x + width / 2, y, label, {
      color: '#edf1ee', fontFamily: 'Arial, sans-serif', fontSize: '13px', align: 'center',
    }).setOrigin(0.5).setDepth(51);
    background.on(Phaser.Input.Events.POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      background.setFillStyle(0x3b4a50);
      action();
    });
    background.on(Phaser.Input.Events.POINTER_UP, () => background.setFillStyle(0x273139));
    background.on(Phaser.Input.Events.POINTER_OUT, () => background.setFillStyle(0x273139));
    text.setInteractive({ useHandCursor: true }).on(Phaser.Input.Events.POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      action();
    });
  }

  private createInputBindings(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.actionMenuBounds && containsPoint(this.actionMenuBounds, pointer.x, pointer.y)) return;
      const insideLocalBoard = pointer.x >= BOARD_X && pointer.x < BOARD_X + BOARD_WIDTH &&
        pointer.y >= BOTTOM_BOARD_Y && pointer.y < BOTTOM_BOARD_Y + BOARD_HEIGHT;
      if (!insideLocalBoard || this.simulation.state.phase !== 'running') {
        this.closeActionMenu();
        return;
      }
      const cellX = Math.floor((pointer.x - BOARD_X) / TILE_PIXELS);
      const cellY = Math.floor((pointer.y - BOTTOM_BOARD_Y) / TILE_PIXELS) + LOCAL_LANE_MIN_ROW;
      const existingTower = this.simulation.state.towers.find(
        (tower) => tower.ownerId === 'p1' && tower.cellX === cellX && tower.cellY === cellY,
      );
      if (existingTower) {
        this.openTowerMenu(existingTower.entityId, pointer.x, pointer.y);
        return;
      }
      this.openBuildMenu(cellX, cellY, pointer.x, pointer.y);
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.loop.isPaused) this.handleVisible();
      else this.handleHidden();
    });
    this.input.keyboard?.on('keydown-ONE', () => this.submitBuild('archer'));
    this.input.keyboard?.on('keydown-TWO', () => this.submitBuild('mage'));
    this.input.keyboard?.on('keydown-THREE', () => this.submitBuild('frost'));
    this.input.keyboard?.on('keydown-FOUR', () => this.submitBuild('sniper'));
    this.input.keyboard?.on('keydown-S', () => this.submitMonster('sheep'));
    this.input.keyboard?.on('keydown-U', () => this.submitUpgrade());
    this.input.keyboard?.on('keydown-X', () => this.submitSell());
  }

  private openBuildMenu(cellX: number, cellY: number, pointerX: number, pointerY: number): void {
    this.closeActionMenu();
    this.selectedCell = { cellX, cellY };
    const towerIds: readonly TowerId[] = ['archer', 'mage', 'frost', 'sniper'];
    const panelWidth = 228;
    const panelHeight = 132;
    const panelX = Phaser.Math.Clamp(pointerX - panelWidth / 2, 8, VIEW_WIDTH - panelWidth - 8);
    const preferredY = pointerY > BOTTOM_BOARD_Y + BOARD_HEIGHT / 2 ? pointerY - panelHeight - 10 : pointerY + 10;
    const panelY = Phaser.Math.Clamp(preferredY, 318, 772 - panelHeight);
    const panelBackground = this.createMenuBackground(panelWidth, panelHeight, 0xd2bb7c);
    const children: Phaser.GameObjects.GameObject[] = [
      panelBackground,
      this.add.text(12, 9, `BUILD  ${cellX + 1},${cellY - LOCAL_LANE_MIN_ROW + 1}`, {
        color: '#f0cf83', fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold',
      }),
    ];
    towerIds.forEach((towerId, index) => {
      const definition = TOWER_BY_ID.get(towerId);
      const button = this.createMenuButton(
        8 + (index % 2) * 108,
        34 + Math.floor(index / 2) * 44,
        100,
        36,
        `${definition?.displayName ?? towerId}  ${definition?.levels[0]?.cost ?? 0}G`,
        () => this.submitBuild(towerId),
      );
      children.push(button);
    });
    this.actionMenuBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
    this.actionMenu = this.add.container(panelX, panelY, children).setDepth(80);
  }

  private openTowerMenu(towerEntityId: number, pointerX: number, pointerY: number): void {
    const tower = this.simulation.state.towers.find((candidate) => candidate.entityId === towerEntityId && candidate.ownerId === 'p1');
    if (!tower) return;
    this.closeActionMenu();
    this.selectedTowerEntityId = towerEntityId;
    const definition = TOWER_BY_ID.get(tower.towerTypeId);
    const nextLevel = definition?.levels[tower.level];
    const refund = Math.floor(tower.totalInvested * SELL_REFUND_PERMILLE / 1000);
    const panelWidth = 246;
    const panelHeight = 112;
    const panelX = Phaser.Math.Clamp(pointerX - panelWidth / 2, 8, VIEW_WIDTH - panelWidth - 8);
    const preferredY = pointerY > BOTTOM_BOARD_Y + BOARD_HEIGHT / 2 ? pointerY - panelHeight - 10 : pointerY + 10;
    const panelY = Phaser.Math.Clamp(preferredY, 318, 772 - panelHeight);
    const panelBackground = this.createMenuBackground(panelWidth, panelHeight, 0x8eb6a0);
    const children: Phaser.GameObjects.GameObject[] = [
      panelBackground,
      this.add.text(12, 10, `${definition?.displayName ?? tower.towerTypeId}  LV.${tower.level}`, {
        color: '#dce9e0', fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold',
      }),
    ];
    children.push(this.createMenuButton(10, 48, 108, 44, nextLevel ? `UPGRADE  ${nextLevel.cost}G` : 'MAX LEVEL', () => this.submitUpgrade(), nextLevel !== undefined));
    children.push(this.createMenuButton(128, 48, 108, 44, `SELL  ${refund}G`, () => this.submitSell()));
    this.actionMenuBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
    this.actionMenu = this.add.container(panelX, panelY, children).setDepth(80);
  }

  private createMenuBackground(width: number, height: number, borderColor: number): Phaser.GameObjects.Rectangle {
    const background = this.add.rectangle(0, 0, width, height, 0x11171c, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, borderColor, 0.8)
      .setInteractive({ useHandCursor: false });
    background.on(Phaser.Input.Events.POINTER_DOWN, (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => event.stopPropagation());
    return background;
  }

  private createMenuButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    action: () => void,
    enabled = true,
  ): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, width, height, enabled ? 0x2c3a40 : 0x20272b, 1)
      .setOrigin(0)
      .setStrokeStyle(1, 0xc4cec8, enabled ? 0.35 : 0.12);
    const text = this.add.text(width / 2, height / 2, label, {
      color: enabled ? '#edf1ee' : '#66726d', fontFamily: 'Arial, sans-serif', fontSize: '10px', align: 'center',
    }).setOrigin(0.5);
    const container = this.add.container(x, y, [background, text]).setSize(width, height);
    if (enabled) {
      background.setInteractive({ useHandCursor: true });
      background.on(Phaser.Input.Events.POINTER_DOWN, (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        action();
      });
    }
    return container;
  }

  private closeActionMenu(): void {
    this.actionMenu?.destroy(true);
    delete this.actionMenu;
    delete this.actionMenuBounds;
    delete this.selectedCell;
    delete this.selectedTowerEntityId;
  }

  private submitBuild(towerTypeId: TowerId): void {
    if (!this.selectedCell) return;
    const { cellX, cellY } = this.selectedCell;
    this.simulation.submitCommand({
      type: 'build_tower',
      commandId: this.simulation.getNextCommandId('p1'),
      playerId: 'p1',
      towerTypeId,
      cellX,
      cellY,
    });
  }

  private submitMonster(monsterTypeId: string): void {
    this.simulation.submitCommand({
      type: 'queue_monster',
      commandId: this.simulation.getNextCommandId('p1'),
      playerId: 'p1',
      monsterTypeId,
      quantity: 1,
    });
  }

  private submitUpgrade(): void {
    if (this.selectedTowerEntityId === undefined) {
      this.feedbackText?.setText('Select a tower first').setColor('#f1a38f');
      return;
    }
    this.simulation.submitCommand({
      type: 'upgrade_tower',
      commandId: this.simulation.getNextCommandId('p1'),
      playerId: 'p1',
      towerEntityId: this.selectedTowerEntityId,
    });
  }

  private submitSell(): void {
    if (this.selectedTowerEntityId === undefined) {
      this.feedbackText?.setText('Select a tower first').setColor('#f1a38f');
      return;
    }
    this.simulation.submitCommand({
      type: 'sell_tower',
      commandId: this.simulation.getNextCommandId('p1'),
      playerId: 'p1',
      towerEntityId: this.selectedTowerEntityId,
    });
    delete this.selectedTowerEntityId;
  }

  private updateOverlay(): void {
    const state = this.simulation.state;
    this.hpText?.setText(`YOU ${Math.max(0, state.players.p1.hp)} HP   RIVAL ${Math.max(0, state.players.p2.hp)} HP`);
    this.economyText?.setText(`${state.players.p1.gold}G   +${state.players.p1.income}`);
    this.phaseText?.setText(`${state.phase.toUpperCase()}  ${Math.floor(state.tick / 20)}s`);
    const ticksUntilWave = getTicksUntilNextWave(state.phase, state.tick, state.runningStartedAtTick);
    const secondsUntilWave = Math.ceil(ticksUntilWave / 20);
    this.waveText?.setText(state.phase === 'running' ? `NEXT WAVE  ${secondsUntilWave}s` : 'NEXT WAVE  --');
  }

  private handleHidden(): void {
    this.loop.pause();
    this.pausedText?.setVisible(true);
  }

  private handleVisible(): void {
    this.loop.resume();
    this.pausedText?.setVisible(false);
  }
}
