import Phaser from 'phaser';

export const BOOT_SCENE_KEY = 'BootScene';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: BOOT_SCENE_KEY });
  }

  create(): void {
    this.scene.start('BattleScene');
  }
}
