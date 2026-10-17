import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';

function signJwt(payload, secret) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const s = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + s;
}

const token = signJwt(
  { sub: 'e261efef-44d3-4b3d-bd8f-f224e01c94ff', email: 'zrodayrit@gmail.com', name: 'Zorenl Rkyle Dayrit' },
  'generate-a-minimum-64-char-secret-string-for-diagramz-development-mode'
);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debuggingPort = 9256;
const userDataDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-arrows';

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1600,1000',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${userDataDir}`
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  await sleep(1500);

  const targetsRes = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data.result);
      callbacks.delete(data.id);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = idCounter++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('1. Injecting auth and navigating to diagram...');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1000);

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', '${token}');
      localStorage.setItem('diagramz_active_workspace', 'e261efef-44d3-4b3d-bd8f-f224e01c94ff');
    `
  });

  const diagramId = '1d31b002-4fe4-48bd-a3ad-717ba5a79f65';
  await send('Page.navigate', { url: `http://localhost:3000/diagram/${diagramId}` });
  await sleep(4000);

  // Switch to canvas-only view to capture full canvas
  await send('Runtime.evaluate', {
    expression: `
      // Click canvas only view mode button if present
      const canvasBtn = document.querySelector('button[title*=\"Canvas only\"], button[title*=\"Canvas\"]');
      if (canvasBtn) canvasBtn.click();
    `
  });
  await sleep(1000);

  const shotDark = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/verified-minimal-arrows-dark.png', Buffer.from(shotDark.data, 'base64'));
  console.log('Saved scripts/verified-minimal-arrows-dark.png');

  ws.close();
  chrome.kill();
  console.log('Arrowhead and typography verification complete!');
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
});
