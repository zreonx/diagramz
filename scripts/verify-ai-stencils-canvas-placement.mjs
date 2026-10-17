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
const debuggingPort = 9328;
const userDataDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-ai-sessions';

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1680,1050',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${userDataDir}`
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const artifactDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f';

async function run() {
  try {
    await sleep(2500);

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
    await send('DOM.enable');

    console.log('1. Setting auth credentials and navigating...');
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2000);

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
        localStorage.setItem('diagramz_theme', 'dark');
        document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
    await sleep(3500);

    console.log('Opening diagram from dashboard...');
    await send('Runtime.evaluate', {
      expression: `
        const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
        if (row) row.click();
      `
    });
    await sleep(4000);

    console.log('Opening AI Assistant drawer...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const aiBtn = btns.find(b => b.textContent && b.textContent.includes('AI') || b.querySelector('svg.lucide-sparkles'));
          if (aiBtn) aiBtn.click();
        })()
      `
    });
    await sleep(2000);

    // Open History Drawer
    console.log('Opening History drawer...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const histBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('History'));
          if (histBtn) histBtn.click();
        })()
      `
    });
    await sleep(1500);

    // Click specifically the session containing "Kafka"
    console.log('Selecting Kafka session from history...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const items = Array.from(document.querySelectorAll('.eraser-doc-scroll > div'));
          const kafkaItem = items.find(el => el.textContent && el.textContent.includes('Kafka'));
          if (kafkaItem) kafkaItem.click();
        })()
      `
    });
    await sleep(1500);

    const ssKafkaLoaded = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-kafka-session-loaded.png'), Buffer.from(ssKafkaLoaded.data, 'base64'));
    console.log('Saved verified-ai-kafka-session-loaded.png');

    // Click "Insert Architecture to Canvas"
    console.log('Clicking "Insert Architecture to Canvas"...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const insertBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Insert Architecture to Canvas'));
          if (insertBtn) insertBtn.click();
        })()
      `
    });
    await sleep(2500);

    // Close AI drawer to view the canvas
    console.log('Closing AI drawer to inspect canvas elements...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const closeBtn = document.querySelector('button[title*="Close AI Assistant"]');
          if (closeBtn) closeBtn.click();
        })()
      `
    });
    await sleep(1500);

    const ssCanvasStencils = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-canvas-stencils-placed.png'), Buffer.from(ssCanvasStencils.data, 'base64'));
    console.log('Saved verified-ai-canvas-stencils-placed.png');

    console.log('Verification completed!');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try {
      chrome.kill();
    } catch {}
  }
}

run();
