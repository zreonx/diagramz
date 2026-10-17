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
  '--remote-debugging-port=9229',
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-profile-toggle',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await sleep(2000);
  const versionRes = await fetch('http://127.0.0.1:9229/json/list');
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
      localStorage.setItem('diagramz_theme', 'light');
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

    // Now in the diagram page, toggle to dark mode!
    console.log('Toggling theme to dark mode in browser...');
    await send('Runtime.evaluate', {
      expression: `
        // Dispatch storage or toggle theme via useThemeStore
        const store = window.__themeStore;
        // Let's toggle class and localStorage
        document.documentElement.classList.add('dark');
        localStorage.setItem('diagramz_theme', 'dark');
        window.dispatchEvent(new Event('storage'));
      `
    });
    await sleep(2000);

    const checkDark = await send('Runtime.evaluate', {
      expression: `(() => {
        const c = document.querySelector('canvas.excalidraw__canvas.static');
        const ctx = c ? c.getContext('2d') : null;
        const pixel = ctx ? Array.from(ctx.getImageData(50, 50, 1, 1).data) : null;
        return {
          pixel,
          computedBg: c ? window.getComputedStyle(c).backgroundColor : null
        };
      })()`,
      returnByValue: true
    });
    console.log('After toggle to dark:', checkDark.result.value);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/after-toggle-dark.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved scripts/after-toggle-dark.png');
  }

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
