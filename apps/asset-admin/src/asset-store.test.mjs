import { strict as assert } from 'node:assert';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AssetStore, parsePngDimensions, validateUpload } from './asset-store.mjs';

function createPng(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test('reads PNG dimensions and validates slot dimensions', () => {
  assert.deepEqual(parsePngDimensions(createPng(256, 256)), { width: 256, height: 256 });
  assert.deepEqual(validateUpload('tower.archer', createPng(256, 256)), { width: 256, height: 256 });
  assert.throws(() => validateUpload('tower.archer', createPng(192, 192)), /Expected 256x256/);
});

test('updates and removes versioned manifest entries', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'chaos-assets-'));
  const store = new AssetStore(root);
  await store.initialize();
  const uploaded = await store.upload('monster.sheep', createPng(192, 192));
  assert.equal(uploaded.version, 1);
  assert.match(uploaded.images['monster.sheep'], /^\/assets\/uploads\/monster-sheep-/);
  const removed = await store.remove('monster.sheep');
  assert.equal(removed.version, 2);
  assert.equal(removed.images['monster.sheep'], undefined);
  const persisted = JSON.parse(await readFile(path.join(root, 'assets/manifest.json'), 'utf8'));
  assert.equal(persisted.version, 2);
});
