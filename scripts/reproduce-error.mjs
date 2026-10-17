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
const debuggingPort = 9241;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-reproduce-err'
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

  const exceptions = [];
  const consoleLogs = [];

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
    if (data.method === 'Runtime.exceptionThrown') {
      exceptions.push(data.params.exceptionDetails);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push({
        type: data.params.type,
        text: data.params.args.map(a => a.value || a.description).join(' ')
      });
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

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(2000);

  // Click on the first diagram row
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const rows = Array.from(document.querySelectorAll('div.grid.grid-cols-12.cursor-pointer'));
      if (rows.length > 0) {
        rows[0].click();
        return 'Clicked row: ' + rows[0].innerText.slice(0, 50);
      }
      return null;
    })()`,
    returnByValue: true
  });
  console.log('Clicked result:', clickRes.result.value);

  await sleep(4000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        hasErrorBanner: document.body.innerText.includes('Canvas Render Issue'),
        bodySnippet: document.body.innerText.slice(0, 300),
        hasExcalidraw: !!document.querySelector('.excalidraw')
      };
    })()`,
    returnByValue: true
  });
  console.log('Result:', evalRes.result.value);

  console.log('\n--- Exceptions (' + exceptions.length + ') ---');
  for (const ex of exceptions) {
    console.log(ex.text, ex.exception?.description || JSON.stringify(ex.exception));
  }

  console.log('\n--- Console Logs (' + consoleLogs.length + ') ---');
  for (const log of consoleLogs) {
    if (log.type === 'error' || log.type === 'warn' || log.text.includes('error') || log.text.includes('185')) {
      console.log(`[${log.type}] ${log.text}`);
    }
  }

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/debug-canvas-render.png', Buffer.from(screenshot.data, 'base64'));

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
