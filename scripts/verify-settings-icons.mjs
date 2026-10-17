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
const debuggingPort = 9330;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1680,1050',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-settings-dialog'
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

    await send('Runtime.evaluate', {
      expression: `
        const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
        if (row) row.click();
      `
    });
    await sleep(4000);

    // Open Settings dialog by pressing ',' or clicking settings button
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ',', code: 'Comma', windowsVirtualKeyCode: 188 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ',', code: 'Comma', windowsVirtualKeyCode: 188 });
    await sleep(1000);

    // Click 'Style & Fonts' tab
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const styleTab = btns.find(b => b.textContent && b.textContent.includes('Style & Fonts'));
          if (styleTab) styleTab.click();
        })()
      `
    });
    await sleep(800);

    // Scroll down the dialog body to show Sloppiness, Stroke Style, Stroke Width
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const body = document.querySelector('div[role="dialog"] div.overflow-y-auto');
          if (body) body.scrollTop = 380;
        })()
      `
    });
    await sleep(600);

    // Screenshot Scrolled Settings Dialog
    const ssSettingsScrolled = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-canvas-settings-icons-scrolled.png'), Buffer.from(ssSettingsScrolled.data, 'base64'));
    console.log('Saved verified-canvas-settings-icons-scrolled.png');

    ws.close();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    chrome.kill();
    process.exit(0);
  }
}

run();
