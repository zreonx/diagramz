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
const debuggingPort = 9242;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-zoom-precision'
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

  await send('Page.navigate', { url: 'http://localhost:3000/diagram/f17276cc-07ee-430a-839c-06366a9631da' });
  await sleep(3500);

  // 1. Test Ctrl + Wheel Zoom at cursor (500, 400)
  console.log('Testing Ctrl + Wheel zoom at (500, 400)...');
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 500,
    y: 400,
    deltaX: 0,
    deltaY: -120,
    modifiers: 2 // Ctrl key
  });
  await sleep(300);

  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 500,
    y: 400,
    deltaX: 0,
    deltaY: -120,
    modifiers: 2
  });
  await sleep(500);

  // 2. Test precise placement: select rectangle tool (R) and click-to-draw exactly at (520, 360)
  console.log('Placing rectangle with rubberband drag at (520, 360)...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR' });
  await sleep(300);

  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 520, y: 360 });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: 520, y: 360 });
  await sleep(150);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', buttons: 1, x: 740, y: 490 });
  await sleep(200);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', x: 740, y: 490 });
  await sleep(800);

  const shotPrecision = await send('Page.captureScreenshot', { format: 'png' });
  const precisionArtifactPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-precision-zoom.png';
  fs.writeFileSync(precisionArtifactPath, Buffer.from(shotPrecision.data, 'base64'));
  console.log('Saved zoom & precision screenshot to:', precisionArtifactPath);

  // 3. Test modern Shortcuts Modal layout (? key)
  console.log('Opening modern shortcuts dialog (?)...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', text: '?', unmodifiedText: '?', key: '?' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '?' });
  await sleep(800);

  const shotModal = await send('Page.captureScreenshot', { format: 'png' });
  const modalArtifactPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-modern-shortcuts-modal.png';
  fs.writeFileSync(modalArtifactPath, Buffer.from(shotModal.data, 'base64'));
  console.log('Saved modern shortcuts modal screenshot to:', modalArtifactPath);

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
