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
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9228',
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-profile-diag',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await sleep(2000);
  const versionRes = await fetch('http://127.0.0.1:9228/json/list');
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
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'dark');
    `,
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(3000);

  const diagHref = await send('Runtime.evaluate', {
    expression: `document.querySelector('a[href^="/diagram/"]')?.getAttribute('href')`,
    returnByValue: true
  });
  console.log('Diagram href:', diagHref.result.value);

  if (diagHref.result.value) {
    await send('Page.navigate', { url: 'http://localhost:3000' + diagHref.result.value });
    await sleep(4000);

    const debugInfo = await send('Runtime.evaluate', {
      expression: `(() => {
        const excal = document.querySelector('.excalidraw');
        const canvases = Array.from(document.querySelectorAll('canvas'));
        
        const details = {
          htmlClass: document.documentElement.className,
          bodyClass: document.body.className,
          excalClass: excal ? excal.className : null,
          excalComputedBg: excal ? window.getComputedStyle(excal).backgroundColor : null,
          canvases: canvases.map(c => {
            const ctx = c.getContext('2d');
            const pixel = ctx ? Array.from(ctx.getImageData(50, 50, 1, 1).data) : null;
            return {
              className: c.className,
              computedBg: window.getComputedStyle(c).backgroundColor,
              pixelAt50_50: pixel,
              width: c.width,
              height: c.height
            };
          }),
          // Check layers / containers
          containers: Array.from(document.querySelectorAll('.excalidraw *')).filter(el => {
            const bg = window.getComputedStyle(el).backgroundColor;
            return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
          }).map(el => ({
            tag: el.tagName,
            className: el.className,
            bg: window.getComputedStyle(el).backgroundColor
          }))
        };
        return details;
      })()`,
      returnByValue: true
    });

    console.log('Debug info:\n', JSON.stringify(debugInfo.result.value, null, 2));
  }

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
