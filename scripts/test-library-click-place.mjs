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
const debuggingPort = 9232;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-lib-place'
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
  await sleep(1000);

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'dark');
      document.cookie = 'diagramz_access_token=${token}; path=/';
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/diagram/e980370b-fede-4ad8-85cc-cb06c2f12b70' });
  await sleep(4000);

  // Open Library
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const trigger = document.querySelector('.sidebar-trigger, [data-testid="library-button"], button[aria-label*="Library"]');
        if (trigger) trigger.click();
      })()
    `
  });
  await sleep(1500);

  // Click on the first library item
  const clickItem = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const items = document.querySelectorAll('.library-unit, [data-testid="library-unit"], .library-menu-item__item');
        if (items.length > 0) {
          items[0].click();
          return { found: true, count: items.length, className: items[0].className };
        }
        // Try svg or button inside library
        const svg = document.querySelector('.sidebar-content svg, .library-menu-items svg');
        if (svg) {
          svg.parentElement.click();
          return { found: true, clickedSvgParent: true };
        }
        return { found: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Click library item result:', clickItem.result.value);
  await sleep(1000);

  // Click on the canvas center (x: 550, y: 400)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 550,
    y: 400,
    button: 'left',
    clickCount: 1
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 550,
    y: 400,
    button: 'left',
    clickCount: 1
  });

  await sleep(1500);

  // Check scene elements
  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const api = window.__EXCALIDRAW_API__;
        if (!api) return { error: 'no api' };
        const elements = api.getSceneElements();
        return {
          totalElements: elements.length,
          lastElements: elements.slice(-5).map(e => ({
            id: e.id,
            type: e.type,
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height,
            strokeColor: e.strokeColor,
            backgroundColor: e.backgroundColor
          }))
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Canvas elements after placing library item:', JSON.stringify(evalRes.result.value, null, 2));

  // Take screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/library-placed-screenshot.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved scripts/library-placed-screenshot.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
