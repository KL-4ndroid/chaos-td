import Phaser from 'phaser';
import {
  TICK_DURATION_MS,
  calculatePosition,
  createPathSegments,
  createSimulation,
  createTowerState,
  type DomainEvent,
  type LaneRuntimeState,
  type MonsterRuntimeState,
  type Simulation,
  type SimulationState,
} from '@chaos-td/game-core';
import { CONFIG_VERSION, MVP_MIRROR_01, type LaneDefinition, type LaneId } from '@chaos-td/game-data';
import { FixedStepLoop } from '../simulation-loop';

export const BATTLE_SCENE_KEY = 'BattleScene';
const TILE_PIXELS = 80;
const BOARD_OFFSET_X = 0;
const BOARD_OFFSET_Y = 0;

interface MonsterVisual {
  body: Phaser.GameObjects.Rectangle;
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
  const towers = [
    createTowerState(1, 'p1', 'archer', 3, 4),
    createTowerState(2, 'p2', 'archer', 12, 4),
  ];
  return createSimulation(
    { seed: 'm1-render-adapter', configVersion: CONFIG_VERSION },
    lanes,
    towers,
  );
}

function toPixels(xMilliTiles: number, yMilliTiles: number): { x: number; y: number } {
  return {
    x: BOARD_OFFSET_X + (xMilliTiles / 1000) * TILE_PIXELS,
    y: BOARD_OFFSET_Y + (yMilliTiles / 1000) * TILE_PIXELS,
  };
}

export class BattleScene extends Phaser.Scene {
  private readonly loop = new FixedStepLoop(TICK_DURATION_MS);
  private readonly simulation = createDemoSimulation();
  private readonly monsterVisuals = new Map<number, MonsterVisual>();
  private readonly towerVisuals = new Map<number, Phaser.GameObjects.Container>();
  private debugText?: Phaser.GameObjects.Text;
  private hpText?: Phaser.GameObjects.Text;
  private pausedText?: Phaser.GameObjects.Text;
  private demoQueued = false;

  constructor() {
    super({ key: BATTLE_SCENE_KEY });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#11151b');
    this.drawArena();
    this.createTowerVisuals(this.simulation.state);
    this.createOverlay();
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
    const result = this.simulation.step();
    if (result.state.phase === 'running' && !this.demoQueued) {
      this.simulation.submitCommand({
        type: 'queue_monster',
        commandId: this.simulation.getNextCommandId('p1'),
        playerId: 'p1',
        monsterTypeId: 'sheep',
        quantity: 5,
      });
      this.simulation.submitCommand({
        type: 'queue_monster',
        commandId: this.simulation.getNextCommandId('p2'),
        playerId: 'p2',
        monsterTypeId: 'sheep',
        quantity: 5,
      });
      this.demoQueued = true;
    }
    this.captureMonsterPositions(result.state);
    this.renderEvents(result.events);
    this.removeInactiveMonsterVisuals(result.state);
  }

  private drawArena(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x171d25, 1);
    graphics.fillRect(0, 0, 1280, 720);

    for (let row = 0; row < MVP_MIRROR_01.gridRows; row += 1) {
      for (let col = 0; col < MVP_MIRROR_01.gridColumns; col += 1) {
        const alternating = (row + col) % 2 === 0;
        graphics.fillStyle(alternating ? 0x1d252e : 0x202a34, 1);
        graphics.fillRect(col * TILE_PIXELS, row * TILE_PIXELS, TILE_PIXELS, TILE_PIXELS);
      }
    }

    for (const lane of MVP_MIRROR_01.lanes) {
      graphics.lineStyle(24, lane.id === 'lane_p1' ? 0x4e8391 : 0x9a665c, 0.4);
      graphics.beginPath();
      lane.waypoints.forEach((point, index) => {
        const pixel = toPixels(point.xMilliTiles, point.yMilliTiles);
        if (index === 0) graphics.moveTo(pixel.x, pixel.y);
        else graphics.lineTo(pixel.x, pixel.y);
      });
      graphics.strokePath();
    }

    graphics.lineStyle(1, 0xffffff, 0.04);
    for (let col = 1; col < MVP_MIRROR_01.gridColumns; col += 1) {
      graphics.lineBetween(col * TILE_PIXELS, 0, col * TILE_PIXELS, 720);
    }
    for (let row = 1; row < MVP_MIRROR_01.gridRows; row += 1) {
      graphics.lineBetween(0, row * TILE_PIXELS, 1280, row * TILE_PIXELS);
    }
  }

  private createTowerVisuals(state: SimulationState): void {
    for (const tower of state.towers) {
      const x = tower.cellX * TILE_PIXELS + TILE_PIXELS / 2;
      const y = tower.cellY * TILE_PIXELS + TILE_PIXELS / 2;
      const base = this.add.circle(0, 0, 25, tower.ownerId === 'p1' ? 0x63b3c1 : 0xd18a78);
      base.setStrokeStyle(3, 0xe9f2f2, 0.85);
      const marker = this.add.text(0, 0, 'A', {
        color: '#0d1418',
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const arrow = this.add.triangle(19, -18, 0, 12, 7, 0, 0, -12, 0xf1d38a);
      const container = this.add.container(x, y, [base, marker, arrow]);
      container.setDepth(10);
      this.towerVisuals.set(tower.entityId, container);
    }
  }

  private captureMonsterPositions(state: SimulationState): void {
    for (const lane of Object.values(state.lanes)) {
      for (const monster of lane.monsters) {
        if (monster.hp <= 0) continue;
        const position = calculatePosition(lane.waypoints, lane.segments, monster.pathProgressMilliTiles);
        const pixel = toPixels(position.x, position.y);
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

  private createMonsterVisual(monster: MonsterRuntimeState, x: number, y: number): MonsterVisual {
    const body = this.add.rectangle(x, y, 30, 26, monster.ownerId === 'p1' ? 0x83c5cc : 0xe0a08f);
    body.setStrokeStyle(2, 0xf5f0df, 0.9).setDepth(20);
    const marker = this.add.text(x, y, '1', {
      color: '#152027',
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    return { body, marker, previousX: x, previousY: y, currentX: x, currentY: y };
  }

  private renderMonsters(state: SimulationState, alpha: number): void {
    const active = new Set<number>();
    for (const lane of Object.values(state.lanes)) {
      for (const monster of lane.monsters) {
        if (monster.hp > 0) active.add(monster.entityId);
      }
    }
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
      if (event.type !== 'attack_fired') continue;
      const tower = this.towerVisuals.get(event.towerEntityId);
      const target = this.monsterVisuals.get(event.targetMonsterId);
      if (!tower || !target) continue;
      const projectile = this.add.circle(tower.x, tower.y, 4, 0xffe8a3).setDepth(30);
      this.tweens.add({
        targets: projectile,
        x: target.currentX,
        y: target.currentY,
        duration: 120,
        ease: 'Sine.easeOut',
        onComplete: () => projectile.destroy(),
      });
    }
  }

  private removeInactiveMonsterVisuals(state: SimulationState): void {
    const activeIds = new Set(
      Object.values(state.lanes).flatMap((lane) => lane.monsters.filter((monster) => monster.hp > 0).map((monster) => monster.entityId)),
    );
    for (const [entityId, visual] of this.monsterVisuals) {
      if (activeIds.has(entityId)) continue;
      this.tweens.add({
        targets: [visual.body, visual.marker],
        alpha: 0,
        scale: 0.35,
        duration: 140,
        onComplete: () => {
          visual.body.destroy();
          visual.marker.destroy();
        },
      });
      this.monsterVisuals.delete(entityId);
    }
  }

  private createOverlay(): void {
    this.add.rectangle(640, 34, 1280, 68, 0x0b0f14, 0.92).setDepth(50);
    this.add.text(24, 16, 'CHAOS TD', {
      color: '#f1d38a',
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setDepth(51);
    this.hpText = this.add.text(232, 19, '', {
      color: '#e8edf0',
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
    }).setDepth(51);
    this.debugText = this.add.text(1260, 14, '', {
      color: '#9fb0bc',
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      align: 'right',
    }).setOrigin(1, 0).setDepth(51);
    this.pausedText = this.add.text(640, 360, 'PAUSED', {
      color: '#f1d38a',
      fontFamily: 'Arial, sans-serif',
      fontSize: '42px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100).setVisible(false);
  }

  private updateOverlay(): void {
    const state = this.simulation.state;
    this.hpText?.setText(`P1  ${Math.max(0, state.players.p1.hp)} HP     P2  ${Math.max(0, state.players.p2.hp)} HP`);
    this.debugText?.setText([
      `${state.phase.toUpperCase()}  TICK ${state.tick}`,
      `HASH ${state.stateHash}`,
      `ENTITIES ${this.monsterVisuals.size + this.towerVisuals.size}  BACKLOG ${this.loop.backlogTicks}`,
    ]);
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
