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
const debuggingPort = 9229;

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-profile-diag-state',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await sleep(2000);
  const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
  const targets = await versionRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
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
      return;
    }
  };
  await new Promise((res) => { ws.onopen = res; });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1000);
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});`,
  });

  await send('Page.navigate', { url: 'http://localhost:3000/diagram/e980370b-fede-4ad8-85cc-cb06c2f12b70' });
  await sleep(4000);

  // Get Excalidraw appState and canvas element styles
  const debugInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const excal = document.querySelector('.excalidraw');
      const canvas = document.querySelector('canvas.excalidraw__canvas');
      // Look for Excalidraw's React internal fiber or state
      const fiberKey = Object.keys(excal || {}).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
      return {
        excalClasses: excal?.className,
        excalStyle: excal?.getAttribute('style'),
        canvasWidth: canvas?.width,
        canvasHeight: canvas?.height,
        parentBg: excal?.parentElement ? window.getComputedStyle(excal.parentElement).backgroundColor : null,
      };
    })()`,
    returnByValue: true
  });
  console.log('Debug info:', debugInfo.result.value);

  // Check Excalidraw CSS variables in DOM
  const cssVars = await send('Runtime.evaluate', {
    expression: `(() => {
      const excal = document.querySelector('.excalidraw');
      if (!excal) return null;
      const s = window.getComputedStyle(excal);
      return {
        defaultBg: s.getPropertyValue('--default-bg-color'),
        theme: s.getPropertyValue('--theme'),
        colorScheme: s.colorScheme,
      };
    })()`,
    returnByValue: true
  });
  console.log('CSS vars:', cssVars.result.value);

  chrome.kill();
  process.exit(0);
}
run().catch(console.error);
