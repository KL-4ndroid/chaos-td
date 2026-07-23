import Phaser from 'phaser';
import { ASSET_MANIFEST_CACHE_KEY, phaserAssetKey, type AssetManifest } from '../assets';

export const BOOT_SCENE_KEY = 'BootScene';
const MANIFEST_KEY = 'asset-manifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: BOOT_SCENE_KEY });
  }

  preload(): void {
    this.load.json(MANIFEST_KEY, '/assets/manifest.json');
  }

  create(): void {
    const manifest = this.cache.json.get(MANIFEST_KEY) as AssetManifest | undefined;
    if (!manifest || manifest.schemaVersion !== 1 || typeof manifest.images !== 'object') {
      this.scene.start('BattleScene');
      return;
    }
    this.game.registry.set(ASSET_MANIFEST_CACHE_KEY, manifest);
    for (const [slotId, url] of Object.entries(manifest.images)) {
      if (typeof url === 'string' && url.startsWith('/assets/')) this.load.image(phaserAssetKey(slotId), url);
    }
    if (Object.keys(manifest.images).length === 0) {
      this.scene.start('BattleScene');
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('BattleScene'));
    this.load.start();
  }
}
