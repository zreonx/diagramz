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
const debuggingPort = 9238;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-drag'
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

  // Navigate to diagram
  await send('Page.navigate', { url: 'http://localhost:3000/diagram/f17276cc-07ee-430a-839c-06366a9631da' });
  await sleep(3500);

  // 1. Reposition floating toolbar via its grip handle
  // Get grip handle bounding rect
  const gripRectRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const grip = document.querySelector('[title="Drag to reposition toolbar anywhere"]');
        if (!grip) return null;
        const r = grip.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()
    `,
    returnByValue: true
  });
  console.log('Grip handle position:', gripRectRes.result?.value);

  if (gripRectRes.result?.value) {
    const { x, y } = gripRectRes.result.value;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x, y });
    await sleep(100);
    // Drag toolbar 150px to the left and 120px down
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', buttons: 1, x: x - 150, y: y + 120 });
    await sleep(100);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', x: x - 150, y: y + 120 });
    await sleep(500);
    console.log('Floating toolbar repositioned successfully.');
  }

  // 2. Select rectangle tool via hotkey 'R'
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR' });
  await sleep(300);

  // 3. Rubberband drag-to-draw on empty canvas region (e.g., from 420, 200 to 680, 360)
  const startX = 420;
  const startY = 200;
  const endX = 680;
  const endY = 360;

  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: startY });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: startX, y: startY });
  await sleep(150);
  // Intermediate moves to trigger rubberband preview
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', buttons: 1, x: 550, y: 280 });
  await sleep(100);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', buttons: 1, x: endX, y: endY });
  await sleep(200);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', x: endX, y: endY });
  await sleep(1000);
  console.log('Rubberband shape created successfully.');

  const shotDragDraw = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-drag-drop-and-toolbar.png';
  fs.writeFileSync(artifactPath, Buffer.from(shotDragDraw.data, 'base64'));
  console.log('Saved screenshot to:', artifactPath);

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
