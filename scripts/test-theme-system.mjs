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
const debuggingPort = 9240;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-theme-system'
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

  // 1. Test Warm-Neutral Light Mode first
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'light');
      document.cookie = 'diagramz_access_token=${token}; path=/';
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/diagram/f17276cc-07ee-430a-839c-06366a9631da' });
  await sleep(3500);

  // Capture Light Theme Screenshot
  const lightShot = await send('Page.captureScreenshot', { format: 'png' });
  const lightArtifactPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-design-system-light.png';
  fs.writeFileSync(lightArtifactPath, Buffer.from(lightShot.data, 'base64'));
  console.log('Saved light mode screenshot to:', lightArtifactPath);

  // 2. Switch to Graphite Dark Mode
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_theme', 'dark');
      document.documentElement.classList.add('dark');
    `
  });
  await sleep(1000);

  // Capture Dark Theme Screenshot
  const darkShot = await send('Page.captureScreenshot', { format: 'png' });
  const darkArtifactPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-design-system-dark.png';
  fs.writeFileSync(darkArtifactPath, Buffer.from(darkShot.data, 'base64'));
  console.log('Saved dark mode screenshot to:', darkArtifactPath);

  // 3. Open Shortcuts Dialog in Dark Mode
  await send('Input.dispatchKeyEvent', { type: 'keyDown', text: '?', unmodifiedText: '?', key: '?' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '?' });
  await sleep(1000);

  const shortcutsShot = await send('Page.captureScreenshot', { format: 'png' });
  const shortcutsArtifactPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-design-system-shortcuts.png';
  fs.writeFileSync(shortcutsArtifactPath, Buffer.from(shortcutsShot.data, 'base64'));
  console.log('Saved shortcuts modal screenshot to:', shortcutsArtifactPath);

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
