const http = require('node:http');
const fs = require('node:fs');

class WsClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.pending = new Map();
    this.idRef = { value: 0 };
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        this.pending.get(message.id)(message);
        this.pending.delete(message.id);
      }
    });
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(), { once: true });
      this.ws.addEventListener('error', (event) => reject(event), { once: true });
    });
  }
  send(method, params = {}) {
    const id = ++this.idRef.value;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function fetchJson() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9333/json', (r) => {
      let data = '';
      r.on('data', (chunk) => (data += chunk));
      r.on('end', () => resolve(JSON.parse(data)));
      r.on('error', reject);
    });
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function click(client, x, y) {
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', clickCount: 1,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
  });
  await sleep(250);
}

async function snap(client, name) {
  const shot = await client.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`C:/Users/user/chaos-td/${name}.png`, Buffer.from(shot.result.data, 'base64'));
}

async function main() {
  const json = await fetchJson();
  const page = json.find((target) => target.type === 'page');
  if (!page) throw new Error('no debuggable page found');
  const client = new WsClient(page.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await sleep(2500);
  await click(client, 160, 560);
  await sleep(300);
  await snap(client, 'fix-menu-open');
  await click(client, 160, 580);
  await sleep(300);
  await snap(client, 'fix-menu-still-open');
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
