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
const debuggingPort = 9249;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-inspect-ws-menu-light'
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  let targets = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(1000);
    try {
      const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      if (versionRes.ok) {
        targets = await versionRes.json();
        break;
      }
    } catch {}
  }
  if (!targets) throw new Error('Chrome failed to start on port ' + debuggingPort);
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
  await sleep(600);

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', '${token}');
      localStorage.setItem('diagramz_theme', 'light');
      document.cookie = 'diagramz_access_token=${token}; path=/';
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(2500);

  // Click the workspace switcher button in sidebar
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('[data-sidebar="header"] button') || document.querySelector('header button') || document.querySelector('[data-sidebar="menu-button"]');
        if (btn) {
          btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          btn.click();
        }
      })()
    `
  });
  await sleep(1000);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/workspace-menu-open-light.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved scripts/workspace-menu-open-light.png');

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
