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
const debuggingPort = 9245;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-settings'
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
      localStorage.setItem('diagramz_theme', 'light');
      document.cookie = 'diagramz_access_token=${token}; path=/';
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/diagram/f17276cc-07ee-430a-839c-06366a9631da' });
  await sleep(3500);

  // Close any open modals
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });
  await sleep(500);

  // 1. Open Canvas Settings via shortcut ','
  console.log('Pressing comma key to open Canvas Settings & Utilities dialog...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ',' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ',' });
  await sleep(800);

  // Check if dialog is visible
  const checkDialog = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const dialogTitle = document.querySelector('[role="dialog"]');
        return {
          hasDialog: !!dialogTitle,
          text: dialogTitle ? dialogTitle.innerText.slice(0, 150) : null
        };
      })()
    `
  });
  console.log('Dialog check:', checkDialog.value);

  // Screenshot of Canvas Settings Dialog
  let scr = await send('Page.captureScreenshot', { format: 'png' });
  let buf = Buffer.from(scr.data, 'base64');
  let outPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-canvas-settings-modal.png';
  fs.writeFileSync(outPath, buf);
  console.log(`Saved screenshot to ${outPath}`);

  // 2. Click "Mesh" grid style
  console.log('Switching to Mesh grid style...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const meshBtn = buttons.find(b => b.innerText.includes('Mesh'));
        if (meshBtn) meshBtn.click();
      })()
    `
  });
  await sleep(500);

  // Close modal
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });
  await sleep(600);

  // Screenshot of Canvas with Mesh Grid
  scr = await send('Page.captureScreenshot', { format: 'png' });
  buf = Buffer.from(scr.data, 'base64');
  outPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-mesh-infinite-grid.png';
  fs.writeFileSync(outPath, buf);
  console.log(`Saved screenshot to ${outPath}`);

  // 3. Re-open and switch to Crosses grid style
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ',' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ',' });
  await sleep(500);

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const crossBtn = buttons.find(b => b.innerText.includes('Crosses'));
        if (crossBtn) crossBtn.click();
      })()
    `
  });
  await sleep(500);

  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });
  await sleep(600);

  scr = await send('Page.captureScreenshot', { format: 'png' });
  buf = Buffer.from(scr.data, 'base64');
  outPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-cross-infinite-grid.png';
  fs.writeFileSync(outPath, buf);
  console.log(`Saved screenshot to ${outPath}`);

  // Switch back to Dots standard
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ',' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ',' });
  await sleep(500);

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const dotsBtn = buttons.find(b => b.innerText.includes('Dots'));
        if (dotsBtn) dotsBtn.click();
      })()
    `
  });
  await sleep(500);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });

  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
