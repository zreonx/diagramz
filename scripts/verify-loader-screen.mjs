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

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9252',
  '--window-size=1400,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\c0b7ee16-657e-4376-960c-a732db124f7d\\scratch\\chrome-test-loader'
]);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  await sleep(2000);
  const targetsRes = await fetch('http://127.0.0.1:9252/json/list');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const resolve = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/diagrams/*', requestStage: 'Request' }]
  });

  // Keep the request paused while we capture the loader screen
  ws.addEventListener('message', async (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Fetch.requestPaused') {
      // Do not fulfill immediately so we can inspect and capture the loading state
      // Fulfill after 10s if needed
      setTimeout(() => {
        send('Fetch.continueRequest', { requestId: data.params.requestId }).catch(() => {});
      }, 10000);
    }
  });

  await send('Page.navigate', { url: 'http://localhost:3000/login' });
  await sleep(1000);

  // Set dark theme and auth token
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', '${token}');
      localStorage.setItem('diagramz_theme', 'dark');
      document.documentElement.classList.add('dark');
      document.cookie = 'diagramz_access_token=${token}; path=/';
    `
  });

  // Navigate to diagram
  await send('Page.navigate', { url: 'http://localhost:3000/diagram/test-loader-preview' });
  await sleep(1500);

  // Verify loader elements exist
  const res = await send('Runtime.evaluate', {
    expression: `
      ({
        hasSvg: !!document.querySelector('svg'),
        hasPaths: document.querySelectorAll('path').length,
        hasRects: document.querySelectorAll('rect').length,
        hasProgressBar: !!document.querySelector('.animate-eraser-progress'),
        hasFlowAnimation: !!document.querySelector('.animate-eraser-flow'),
        text: document.body.innerText
      })
    `,
    returnByValue: true
  });

  console.log('Loader elements inspection (Dark):', res.result?.value);

  const darkShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/eraser-loader-dark.png', Buffer.from(darkShot.data, 'base64'));
  console.log('Saved scripts/eraser-loader-dark.png');

  // Now switch to light theme and capture
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.classList.remove('dark');
      localStorage.setItem('diagramz_theme', 'light');
    `
  });
  await sleep(800);

  const lightShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/eraser-loader-light.png', Buffer.from(lightShot.data, 'base64'));
  console.log('Saved scripts/eraser-loader-light.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
