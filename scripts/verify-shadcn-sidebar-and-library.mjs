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
const debuggingPort = 9245;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-shadcn-verify'
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

  // 1. Capture Dashboard view (default shadcn sidebar)
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(3000);
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/default-shadcn-sidebar.png', Buffer.from(shot1.data, 'base64'));
  console.log('Saved scripts/default-shadcn-sidebar.png');

  // 2. Capture Diagram Canvas with Library opened
  await send('Page.navigate', { url: 'http://localhost:3000/diagram/e980370b-fede-4ad8-85cc-cb06c2f12b70' });
  await sleep(4000);

  // Click library trigger
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.sidebar-trigger, [data-testid="library-button"], button[aria-label*="Library"]');
        if (btn) btn.click();
      })()
    `
  });
  await sleep(1500);

  const inspectRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.library-menu-browse-button');
        const title = Array.from(document.querySelectorAll('*')).find(el => el.textContent === 'Library' && el.children.length === 0);
        return {
          btnTag: btn?.tagName,
          btnClasses: btn?.className,
          btnBg: btn ? window.getComputedStyle(btn).backgroundColor : null,
          btnColor: btn ? window.getComputedStyle(btn).color : null,
          titleTag: title?.tagName,
          titleClass: title?.className,
          titleParentClass: title?.parentElement?.className,
          titleColor: title ? window.getComputedStyle(title).color : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Browse button & title info:', JSON.stringify(inspectRes.result.value, null, 2));

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/modern-library-drawer.png', Buffer.from(shot2.data, 'base64'));
  console.log('Saved scripts/modern-library-drawer.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
