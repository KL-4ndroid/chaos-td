import Phaser from 'phaser';

export interface AssetManifest {
  schemaVersion: 1;
  version: number;
  updatedAt: string | null;
  images: Record<string, string>;
  atlases: Record<string, { image: string; data: string }>;
  audio: Record<string, string[]>;
}

export const ASSET_MANIFEST_CACHE_KEY = 'chaos-td-asset-manifest';
export const phaserAssetKey = (slotId: string): string => `art:${slotId}`;

export function getAssetManifest(game: Phaser.Game): AssetManifest | null {
  const value: unknown = game.registry.get(ASSET_MANIFEST_CACHE_KEY);
  if (!value || typeof value !== 'object') return null;
  const manifest = value as Partial<AssetManifest>;
  return manifest.schemaVersion === 1 && typeof manifest.images === 'object' ? manifest as AssetManifest : null;
}
