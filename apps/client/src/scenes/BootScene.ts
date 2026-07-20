import Phaser from 'phaser';

export const BOOT_SCENE_KEY = 'BootScene';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: BOOT_SCENE_KEY });
  }

  create(): void {
    const { width, height } = this.scale;
    const versionText = this.add.text(width / 2, height / 2, 'Chaos TD v0.0.1', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    });
    versionText.setOrigin(0.5, 0.5);

    const infoText = this.add.text(width / 2, height / 2 + 50, 'Boot Scene Initialized', {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'Arial, sans-serif',
    });
    infoText.setOrigin(0.5, 0.5);
  }
}
