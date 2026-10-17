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
const debuggingPort = 9275;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-youri-tjang'
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await sleep(1500);

  const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
  const targets = await versionRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
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

  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1000);

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'light');
      document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
    `,
  });

  // Navigate to dashboard
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(3000);

  // Click first diagram row
  await send('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
      if (row) row.click();
    `,
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
    `,
  });
  await sleep(1200);

  // Capture screenshot of Component Library Drawer showing Youri Tjang Software Architecture & other collections
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(
    'C:/Users/Zorenl/.gemini/antigravity-cli/brain/768a6ff1-a73e-4925-b3c5-1a925c09fb1f/verified-excalidraw-libraries-drawer.png',
    Buffer.from(shot1.data, 'base64')
  );
  console.log('Saved verified-excalidraw-libraries-drawer.png');

  // Click Youri Tjang's "Database / Storage Node" to insert onto canvas
  await send('Runtime.evaluate', {
    expression: `
      const cards = Array.from(document.querySelectorAll('.group.cursor-grab'));
      const dbCard = cards.find(c => c.textContent && c.textContent.includes('Database'));
      if (dbCard) dbCard.click();
    `,
  });
  await sleep(1000);

  // Click Youri Tjang's "Web Browser / Client" to insert onto canvas
  await send('Runtime.evaluate', {
    expression: `
      const cards = Array.from(document.querySelectorAll('.group.cursor-grab'));
      const browserCard = cards.find(c => c.textContent && c.textContent.includes('Browser'));
      if (browserCard) browserCard.click();
    `,
  });
  await sleep(1000);

  // Click Anna Pastushko's "Server / Host Machine" to insert onto canvas
  await send('Runtime.evaluate', {
    expression: `
      const cards = Array.from(document.querySelectorAll('.group.cursor-grab'));
      const serverCard = cards.find(c => c.textContent && c.textContent.includes('Server / Host Machine'));
      if (serverCard) serverCard.click();
    `,
  });
  await sleep(1200);

  // Capture canvas with inserted Excalidraw vector library components
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(
    'C:/Users/Zorenl/.gemini/antigravity-cli/brain/768a6ff1-a73e-4925-b3c5-1a925c09fb1f/verified-excalidraw-components-on-canvas.png',
    Buffer.from(shot2.data, 'base64')
  );
  console.log('Saved verified-excalidraw-components-on-canvas.png');

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  chrome.kill();
  process.exit(1);
});
