import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { deserializeReplay } from '@chaos-td/game-core';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,
  height: 960,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, BattleScene],
};

const game = new Phaser.Game(config);

const fileInput = document.querySelector<HTMLInputElement>('#replay-file');
fileInput?.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  game.registry.set('trainingReplay', deserializeReplay(await file.text()));
  game.scene.stop('BattleScene');
  game.scene.start('BattleScene');
});
document.querySelector<HTMLButtonElement>('#replay-pause')?.addEventListener('click', () => game.events.emit('replay-toggle'));
document.querySelector<HTMLSelectElement>('#replay-speed')?.addEventListener('change', (event) => game.events.emit('replay-speed', Number((event.target as HTMLSelectElement).value)));

export { game };
