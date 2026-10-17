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
const debuggingPort = 9312;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1680,1050',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-left-menus'
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  try {
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
    await sleep(2000);

    // Set auth credentials
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

    // Switch to Architecture tab
    await send('Runtime.evaluate', {
      expression: `
        const archBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim().startsWith('Architecture'));
        if (archBtn) archBtn.click();
      `
    });
    await sleep(1500);

    // Capture screenshot of the Architecture tab with left-positioned text
    const shotArch = await send('Page.captureScreenshot', { format: 'png' });
    const shotArchPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-left-menu-architecture.png';
    fs.writeFileSync(shotArchPath, Buffer.from(shotArch.data, 'base64'));
    console.log('Saved Architecture drawer screenshot to:', shotArchPath);

    // Insert a component by clicking on first card in library
    await send('Runtime.evaluate', {
      expression: `
        const firstCard = document.querySelector('.w-80.border-r .grid div[draggable="true"]');
        if (firstCard) firstCard.click();
      `
    });
    await sleep(1500);

    // Close the drawer to see the style panel on canvas clearly
    await send('Runtime.evaluate', {
      expression: `
        const closeBtn = document.querySelector('.w-80.border-r button svg.lucide-x')?.closest('button');
        if (closeBtn) closeBtn.click();
      `
    });
    await sleep(1500);

    // Click on node on canvas to select it and trigger ZCanvasStylePanel
    const nodeCoords = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('[data-node-id]'));
          const target = cards.find(c => c.textContent && c.textContent.includes('API Gateway')) || cards[0];
          if (!target) return null;
          const rect = target.getBoundingClientRect();
          return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + 20) };
        })()
      `
    });

    if (nodeCoords?.value) {
      const { x, y } = nodeCoords.value;
      console.log('Dispatching mouse click at:', x, y);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(100);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    await sleep(2000);

    // Capture screenshot of Canvas with Left Style Panel open
    const shotCanvas = await send('Page.captureScreenshot', { format: 'png' });
    const shotCanvasPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-left-style-panel.png';
    fs.writeFileSync(shotCanvasPath, Buffer.from(shotCanvas.data, 'base64'));
    console.log('Saved Style panel screenshot to:', shotCanvasPath);

    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    chrome.kill();
  }
}

run();
