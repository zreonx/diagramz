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
const debuggingPort = 9231;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-scroll'
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

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        if (!window.__EXCALIDRAW_API__) return { error: 'no api' };
        const api = window.__EXCALIDRAW_API__;
        const elements = api.getSceneElements();
        const appState = api.getAppState();
        const files = api.getFiles();
        return {
          elementCount: elements.length,
          elements: elements.map(e => ({ id: e.id, type: e.type, x: e.x, y: e.y, width: e.width, height: e.height, strokeColor: e.strokeColor, backgroundColor: e.backgroundColor })),
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom,
          filesCount: Object.keys(files || {}).length
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Excalidraw state:', JSON.stringify(evalRes.result.value, null, 2));

  // Now click 'Scroll back to content' or call scrollToContent
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const scrollBtn = buttons.find(b => b.textContent && b.textContent.includes('Scroll back to content'));
        if (scrollBtn) {
          scrollBtn.click();
          return 'clicked scrollBtn';
        }
        if (window.__EXCALIDRAW_API__) {
          window.__EXCALIDRAW_API__.scrollToContent(undefined, { fitToViewport: true, animate: false });
          return 'called scrollToContent';
        }
        return 'no button or api';
      })()
    `,
    returnByValue: true
  });
  console.log('Scroll action:', clickRes.result.value);

  await sleep(1500);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/canvas-scrolled-to-content.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved scripts/canvas-scrolled-to-content.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
