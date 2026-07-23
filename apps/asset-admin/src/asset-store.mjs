import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ASSET_SLOTS, MANIFEST_SCHEMA_VERSION, MAX_UPLOAD_BYTES } from './asset-config.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function parsePngDimensions(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Only valid PNG files are accepted');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function validateUpload(slotId, buffer) {
  const slot = ASSET_SLOTS[slotId];
  if (!slot) throw new Error('Unknown asset slot');
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`);
  }
  const dimensions = parsePngDimensions(buffer);
  if (dimensions.width !== slot.width || dimensions.height !== slot.height) {
    throw new Error(`Expected ${slot.width}x${slot.height}px PNG`);
  }
  return dimensions;
}

function emptyManifest() {
  return { schemaVersion: MANIFEST_SCHEMA_VERSION, version: 0, updatedAt: null, images: {}, atlases: {}, audio: {} };
}

export class AssetStore {
  constructor(publicRoot) {
    this.publicRoot = publicRoot;
    this.assetRoot = path.join(publicRoot, 'assets');
    this.uploadRoot = path.join(this.assetRoot, 'uploads');
    this.manifestPath = path.join(this.assetRoot, 'manifest.json');
  }

  async initialize() {
    await mkdir(this.uploadRoot, { recursive: true });
    try {
      await readFile(this.manifestPath, 'utf8');
    } catch {
      await this.writeManifest(emptyManifest());
    }
  }

  async readManifest() {
    const value = JSON.parse(await readFile(this.manifestPath, 'utf8'));
    if (value.schemaVersion !== MANIFEST_SCHEMA_VERSION || typeof value.images !== 'object') {
      throw new Error('Asset manifest is invalid');
    }
    return value;
  }

  async list() {
    const manifest = await this.readManifest();
    return Object.entries(ASSET_SLOTS).map(([id, slot]) => ({ id, ...slot, url: manifest.images[id] ?? null }));
  }

  async upload(slotId, buffer) {
    validateUpload(slotId, buffer);
    const digest = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    const fileName = `${slotId.replace('.', '-')}-${digest}.png`;
    const relativeUrl = `/assets/uploads/${fileName}`;
    await writeFile(path.join(this.uploadRoot, fileName), buffer, { flag: 'wx' }).catch(async (error) => {
      if (error.code !== 'EEXIST') throw error;
    });
    const manifest = await this.readManifest();
    const previousUrl = manifest.images[slotId];
    const next = {
      ...manifest,
      version: manifest.version + 1,
      updatedAt: new Date().toISOString(),
      images: { ...manifest.images, [slotId]: relativeUrl },
    };
    await this.writeManifest(next);
    await this.removeUnreferenced(previousUrl, next);
    return next;
  }

  async remove(slotId) {
    if (!ASSET_SLOTS[slotId]) throw new Error('Unknown asset slot');
    const manifest = await this.readManifest();
    const previousUrl = manifest.images[slotId];
    const images = { ...manifest.images };
    delete images[slotId];
    const next = { ...manifest, version: manifest.version + 1, updatedAt: new Date().toISOString(), images };
    await this.writeManifest(next);
    await this.removeUnreferenced(previousUrl, next);
    return next;
  }

  async writeManifest(manifest) {
    const temporaryPath = `${this.manifestPath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.manifestPath);
  }

  async removeUnreferenced(url, manifest) {
    if (!url || Object.values(manifest.images).includes(url)) return;
    const fileName = path.basename(url);
    await unlink(path.join(this.uploadRoot, fileName)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
