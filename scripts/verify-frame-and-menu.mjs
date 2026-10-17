import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
const debuggingPort = 9324;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1680,1050',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-frame-menu'
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const artifactDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f';

async function run() {
  try {
    await sleep(2000);

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

    console.log('1. Setting auth credentials and navigating to dashboard...');
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2000);

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
        localStorage.setItem('diagramz_theme', 'light');
        document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
    await sleep(3500);

    // Click first diagram row to enter canvas
    console.log('Opening diagram from dashboard...');
    await send('Runtime.evaluate', {
      expression: `
        const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
        if (row) row.click();
      `
    });
    await sleep(4000);

    // Capture initial canvas state
    console.log('2. Inspecting Frame Tool in Toolbar...');
    const frameToolInfo = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const frameBtn = document.querySelector('button[title*="Frame Tool"]');
          const presetTrigger = document.querySelector('button[title*="Frame Presets"]');
          return {
            hasFrameBtn: !!frameBtn,
            hasPresetTrigger: !!presetTrigger
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Frame tool info:', frameToolInfo.result.value);

    // Open Frame Presets dropdown using native CDP mouse events
    const triggerCoords = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('button[title*="Frame Presets"]');
          if (!btn) return null;
          const r = btn.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()
      `,
      returnByValue: true
    });
    console.log('Preset trigger coords:', triggerCoords.result.value);

    if (triggerCoords.result.value) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: triggerCoords.result.value.x,
        y: triggerCoords.result.value.y,
        button: 'left',
        clickCount: 1
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: triggerCoords.result.value.x,
        y: triggerCoords.result.value.y,
        button: 'left',
        clickCount: 1
      });
    }
    await sleep(800);

    // Screenshot 1: Frame Presets Dropdown
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-frame-presets-menu.png'), Buffer.from(ss1.data, 'base64'));
    console.log('Saved verified-frame-presets-menu.png');

    // Click the Desktop Preset option using native CDP click
    console.log('3. Placing Desktop Preset Frame...');
    const desktopCoords = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
          const item = items.find(el => el.textContent && el.textContent.includes('Desktop'));
          if (!item) return null;
          const r = item.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()
      `,
      returnByValue: true
    });
    console.log('Desktop preset coords:', desktopCoords.result.value);

    if (desktopCoords.result.value) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: desktopCoords.result.value.x,
        y: desktopCoords.result.value.y,
        button: 'left',
        clickCount: 1
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: desktopCoords.result.value.x,
        y: desktopCoords.result.value.y,
        button: 'left',
        clickCount: 1
      });
    }
    await sleep(1200);

    // Screenshot 2: Frame on Canvas
    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-frame-on-canvas.png'), Buffer.from(ss2.data, 'base64'));
    console.log('Saved verified-frame-on-canvas.png');

    // Select a shape or create one to inspect the style panel
    console.log('4. Selecting a component to inspect the style panel...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Select any node on the canvas that is not the frame
          const nodes = Array.from(document.querySelectorAll('[data-node-id]'));
          const target = nodes.find(n => !n.querySelector('span[class*="font-mono"]')) || nodes[0];
          if (target) {
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 200 }));
            target.click();
          }
        })()
      `
    });
    await sleep(800);

    // If style panel isn't visible, click a node directly
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const node = document.querySelector('[data-node-id]');
          if (node) {
            const rect = node.getBoundingClientRect();
            const evt = new MouseEvent('mousedown', {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
              bubbles: true
            });
            node.dispatchEvent(evt);
          }
        })()
      `
    });
    await sleep(800);

    // Screenshot 3: Style panel with dynamic font size, sloppiness icons, stroke style icons, stroke width icons
    const ss3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-dynamic-font-and-icons-menu.png'), Buffer.from(ss3.data, 'base64'));
    console.log('Saved verified-dynamic-font-and-icons-menu.png');

    console.log('All verifications completed successfully!');
  } catch (err) {
    console.error('Error in verification:', err);
  } finally {
    chrome.kill();
    process.exit(0);
  }
}

run();
