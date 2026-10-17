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
const debuggingPort = 9257;
const userDataDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-new-template';

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1600,1000',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${userDataDir}`
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  await sleep(1500);

  const targetsRes = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data.result);
      callbacks.delete(data.id);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = idCounter++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('1. Setting up session on dashboard...');
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(1000);

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', '${token}');
      localStorage.setItem('diagramz_active_workspace', 'e261efef-44d3-4b3d-bd8f-f224e01c94ff');
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(2500);

  // Click on the first starter template card "Global Payment System" or "New Diagram"
  console.log('2. Opening Create Diagram dialog and choosing Global Payment System...');
  await send('Runtime.evaluate', {
    expression: `
      const cards = Array.from(document.querySelectorAll('div, button'));
      const templateCard = cards.find(el => el.innerText && el.innerText.includes('Payment System') && el.innerText.includes('Architecture'));
      if (templateCard) {
        templateCard.click();
      } else {
        // Fallback: click New Diagram button
        const newBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('New'));
        if (newBtn) newBtn.click();
      }
    `
  });
  await sleep(1500);

  // Click "Create Diagram & Spec" button in dialog
  console.log('3. Submitting dialog...');
  await send('Runtime.evaluate', {
    expression: `
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Create Diagram & Spec'));
      if (submitBtn) submitBtn.click();
    `
  });
  await sleep(4000);

  const currentUrl = await send('Runtime.evaluate', {
    expression: 'window.location.href',
    returnByValue: true
  });
  console.log('Navigated to diagram:', currentUrl.result?.value);

  // Switch to canvas-only view to capture full canvas
  await send('Runtime.evaluate', {
    expression: `
      const canvasBtn = document.querySelector('button[title*=\"Canvas only\"], button[title*=\"Canvas\"]');
      if (canvasBtn) canvasBtn.click();
    `
  });
  await sleep(1500);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/verified-new-minimal-arrows.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved scripts/verified-new-minimal-arrows.png');

  ws.close();
  chrome.kill();
  console.log('Finished testing new minimal arrows and typography!');
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
});
