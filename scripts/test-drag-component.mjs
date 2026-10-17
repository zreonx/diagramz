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
const debuggingPort = 9228;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-canvas-drag'
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

  // Get a diagram ID from the API
  const apiRes = await fetch('http://localhost:4000/api/v1/workspaces', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const wsList = await apiRes.json();
  const wsId = wsList[0]?.id;
  const projRes = await fetch(`http://localhost:4000/api/v1/workspaces/${wsId}/projects`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const projs = await projRes.json();
  const diagRes = await fetch(`http://localhost:4000/api/v1/projects/${projs[0].id}/diagrams`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const diags = await diagRes.json();
  const diagId = diags[0].id;

  console.log('Navigating to diagram:', diagId);
  await send('Page.navigate', { url: `http://localhost:3000/diagram/${diagId}` });
  await sleep(4000);

  // Inspect the Excalidraw instance
  const evalExcal = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const canvasInfos = canvases.map(c => ({
          className: c.className,
          width: c.width,
          height: c.height,
          style: c.getAttribute('style'),
          computedFilter: window.getComputedStyle(c).filter,
          computedBg: window.getComputedStyle(c).backgroundColor
        }));

        // Check Excalidraw elements if available
        let elements = [];
        try {
          const api = window.__EXCALIDRAW_API__;
          if (api) elements = api.getSceneElements();
        } catch(e) {}

        // Check for library button
        const libraryBtn = document.querySelector('[aria-label*="Library"], .library-button, [data-testid="library-button"]');

        return {
          canvases: canvasInfos,
          hasLibraryBtn: !!libraryBtn,
          bodyClass: document.body.className,
          htmlClass: document.documentElement.className,
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Eval Excalidraw:', evalExcal.result.value);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/canvas-state.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved scripts/canvas-state.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
