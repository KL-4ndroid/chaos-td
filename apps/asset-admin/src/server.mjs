import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AssetStore } from './asset-store.mjs';
import { MAX_UPLOAD_BYTES } from './asset-config.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, '../../..');
const store = new AssetStore(path.join(repositoryRoot, 'apps/client/public'));
const port = Number(process.env.ASSET_ADMIN_PORT ?? 4174);

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES * 2) throw new Error('Request is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

await store.initialize();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/') {
      const html = await readFile(path.join(directory, '../public/index.html'));
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/assets') {
      sendJson(response, 200, { slots: await store.list(), manifest: await store.readManifest() });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/assets/upload') {
      const body = await readJson(request);
      if (typeof body.slotId !== 'string' || typeof body.dataUrl !== 'string') throw new Error('slotId and dataUrl are required');
      const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(body.dataUrl);
      if (!match) throw new Error('Upload must be a base64 PNG data URL');
      const manifest = await store.upload(body.slotId, Buffer.from(match[1], 'base64'));
      sendJson(response, 200, { ok: true, manifest });
      return;
    }
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/assets/')) {
      const slotId = decodeURIComponent(url.pathname.slice('/api/assets/'.length));
      const manifest = await store.remove(slotId);
      sendJson(response, 200, { ok: true, manifest });
      return;
    }
    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.warn(`Chaos TD asset admin: http://127.0.0.1:${port}`);
});
