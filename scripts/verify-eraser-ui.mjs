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
  { sub: 'e261efef-44d3-4b3d-bd8f-f224e01c94ff', email: 'test@diagramz.io', name: 'Test User' },
  'generate-a-minimum-64-char-secret-string-for-diagramz-development-mode'
);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debuggingPort = 9248;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-eraser-ui'
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  await sleep(1500);

  const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
  const targets = await versionRes.json();
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(800);

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'light');
      document.cookie = 'diagramz_access_token=${token}; path=/';
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(3500);

  // 1. Capture light mode dashboard
  const shotLight = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/eraser-dashboard-light.png', Buffer.from(shotLight.data, 'base64'));
  console.log('Saved scripts/eraser-dashboard-light.png');

  // 2. Click "Create a Blank File" or "Generate an AI Diagram" to open modal
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const createBtn = btns.find(b => b.textContent.includes('Create a Blank File') || b.textContent.includes('Generate an AI Diagram'));
        if (createBtn) createBtn.click();
      })()
    `
  });
  await sleep(1000);

  const shotModal = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/eraser-create-dialog.png', Buffer.from(shotModal.data, 'base64'));
  console.log('Saved scripts/eraser-create-dialog.png');

  // 3. Close dialog & toggle dark mode
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `
  });
  await sleep(500);

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const themeBtn = document.querySelector('button[title="Toggle theme"]');
        if (themeBtn) themeBtn.click();
      })()
    `
  });
  await sleep(800);

  const shotDark = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/eraser-dashboard-dark.png', Buffer.from(shotDark.data, 'base64'));
  console.log('Saved scripts/eraser-dashboard-dark.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
