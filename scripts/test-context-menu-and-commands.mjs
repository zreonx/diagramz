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
const debuggingPort = 9246;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-context-menu'
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

  // Close any modal
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });
  await sleep(500);

  // 1. Right click on empty canvas area (x: 200, y: 250)
  console.log('Right-clicking on empty canvas at (200, 250)...');
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 200,
    y: 250,
    button: 'right',
    clickCount: 1
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 200,
    y: 250,
    button: 'right',
    clickCount: 1
  });
  await sleep(800);

  // Check if context menu appeared
  const checkEmptyMenu = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `
      (() => {
        const menu = document.querySelector('div[style*="position: fixed"], div.fixed.z-50');
        return {
          hasMenu: !!menu,
          text: menu ? menu.innerText.slice(0, 150) : null
        };
      })()
    `
  });
  console.log('Empty Canvas Context Menu:', checkEmptyMenu.value);

  // Capture screenshot of empty canvas context menu
  let scr = await send('Page.captureScreenshot', { format: 'png' });
  let buf = Buffer.from(scr.data, 'base64');
  let outPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-context-menu-empty.png';
  fs.writeFileSync(outPath, buf);
  console.log(`Saved screenshot to ${outPath}`);

  // Dismiss menu with Escape
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });
  await sleep(500);

  // 2. Right click on the Decision diamond shape (around x: 380, y: 640)
  console.log('Right-clicking on shape...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const nodes = Array.from(document.querySelectorAll('div.absolute.rounded-xl'));
        const diamondNode = nodes.find(n => n.innerText.includes('Decision'));
        if (diamondNode) {
          const rect = diamondNode.getBoundingClientRect();
          const evt = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            button: 2
          });
          diamondNode.dispatchEvent(evt);
        }
      })()
    `
  });
  await sleep(800);

  // Capture screenshot of single shape context menu
  scr = await send('Page.captureScreenshot', { format: 'png' });
  buf = Buffer.from(scr.data, 'base64');
  outPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-context-menu-shape.png';
  fs.writeFileSync(outPath, buf);
  console.log(`Saved screenshot to ${outPath}`);

  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
