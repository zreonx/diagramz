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
const debuggingPort = 9225;

console.log('[Test Light Mode] Launching Chrome on port', debuggingPort);
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-profile-light',
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
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('[Browser Console]', data.params.type, data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
    }
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('[Browser Exception]', data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text);
    }
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
  await sleep(1500);
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});`,
  });

  // Set theme to light
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('diagramz_theme', 'light');`,
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(3000);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/dashboard-light.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved scripts/dashboard-light.png');

  // Check computed styles
  const evalRes = await send('Runtime.evaluate', {
    expression: `({
      htmlClasses: document.documentElement.className,
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
      bodyColor: window.getComputedStyle(document.body).color,
      sidebarBg: window.getComputedStyle(document.querySelector('[data-sidebar="sidebar"]') || document.body).backgroundColor,
      headerBg: window.getComputedStyle(document.querySelector('header') || document.body).backgroundColor,
    })`,
    returnByValue: true
  });
  console.log('Computed styles in light mode:', evalRes.result.value);

  chrome.kill();
  process.exit(0);
}
run().catch(console.error);
