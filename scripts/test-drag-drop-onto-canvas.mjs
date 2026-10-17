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
const debuggingPort = 9295;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-drag-drop-live'
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
      document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
    `
  });

  // Navigate to dashboard
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(3000);

  // Click first diagram row
  await send('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
      if (row) row.click();
    `
  });
  await sleep(4000);

  // Open Component Library Drawer if not open
  await send('Runtime.evaluate', {
    expression: `
      const drawer = document.querySelector('.w-80.border-r');
      if (!drawer) {
        const libBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Component') || b.querySelector('svg.lucide-boxes'));
        if (libBtn) libBtn.click();
      }
    `
  });
  await sleep(1500);

  // Simulate drag and drop from Component Library item onto Canvas surface
  const result = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Find Server / Host Machine stencil card
        const card = Array.from(document.querySelectorAll('[draggable="true"]')).find(el => el.textContent && el.textContent.includes('Server / Host Machine'));
        const canvasContainer = document.querySelector('.relative.overflow-hidden.bg-background');
        
        if (!card) return { success: false, error: 'Draggable card not found' };
        if (!canvasContainer) return { success: false, error: 'Canvas container not found' };

        // Create mock DataTransfer
        const dataStore = {};
        const types = [];
        const dataTransfer = {
          types,
          setData: (type, val) => {
            dataStore[type] = val;
            if (!types.includes(type)) types.push(type);
          },
          getData: (type) => dataStore[type] || '',
          effectAllowed: 'copy',
          dropEffect: 'copy',
        };

        // 1. Dispatch dragstart
        const dragStartEvent = new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        });
        card.dispatchEvent(dragStartEvent);

        // 2. Dispatch dragover on canvas
        const canvasRect = canvasContainer.getBoundingClientRect();
        const dropClientX = canvasRect.left + 350;
        const dropClientY = canvasRect.top + 250;

        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          clientX: dropClientX,
          clientY: dropClientY,
          dataTransfer,
        });
        canvasContainer.dispatchEvent(dragOverEvent);

        // 3. Dispatch drop on canvas
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          clientX: dropClientX,
          clientY: dropClientY,
          dataTransfer,
        });
        canvasContainer.dispatchEvent(dropEvent);

        return {
          success: true,
          types: [...types],
          dataKeys: Object.keys(dataStore),
          dropTarget: canvasContainer.tagName,
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Drag and Drop execution result:', result.result?.value);
  await sleep(2000);

  // Capture canvas screenshot showing dropped component
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const shotPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-drag-drop-placed.png';
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot to:', shotPath);

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
