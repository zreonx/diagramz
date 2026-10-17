import { spawn } from 'child_process';
import crypto from 'crypto';

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
  '--window-size=1600,950',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-tb'
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

  await send('Page.navigate', { url: 'http://localhost:3000/login' });
  await sleep(1000);

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'dark');
      document.cookie = 'diagramz_access_token=${token}; path=/';
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/diagram/d4ac03c7-47f4-4339-b8bb-10cc1a4483b5' });
  await sleep(3500);

  // Click .App-toolbar__extra-tools-trigger
  const moreTools = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.App-toolbar__extra-tools-trigger');
      if (btn) {
        btn.click();
        return 'Clicked more tools';
      }
      return 'Not found';
    })()`,
    returnByValue: true
  });
  console.log('More tools button:', moreTools.result.value);
  await sleep(1000);

  const popoverItems = await send('Runtime.evaluate', {
    expression: `(() => {
      const items = Array.from(document.querySelectorAll('.dropdown-menu-item, .popover label, .popover button'));
      return items.map(i => ({
        text: i.innerText,
        title: i.title,
        html: i.outerHTML.slice(0, 100)
      }));
    })()`,
    returnByValue: true
  });
  console.log('Popover items:', JSON.stringify(popoverItems.result.value, null, 2));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('fs');
  fs.writeFileSync('scripts/debug-more-tools.png', Buffer.from(screenshot.data, 'base64'));

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
