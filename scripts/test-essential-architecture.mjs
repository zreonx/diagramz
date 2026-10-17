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
const debuggingPort = 9292;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-essential-arch'
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
  await sleep(1500);

  // Screenshot 1: Library drawer top (Compute & Containers, Cloud & Infrastructure, Databases)
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Zorenl/.gemini/antigravity-cli/brain/768a6ff1-a73e-4925-b3c5-1a925c09fb1f/verified-essential-arch-drawer.png', Buffer.from(shot1.data, 'base64'));
  console.log('Saved verified-essential-arch-drawer.png');

  // Scroll drawer to view Compute & Containers with new Server Rack Tower, Microchip CPU, Nginx
  await send('Runtime.evaluate', {
    expression: `
      const scrollable = document.querySelector('.w-80.border-r .overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 0;
    `,
  });
  await sleep(1000);

  // Insert items from clean Architecture collection (Server Rack, Microchip, Nginx, Storage Archive, Reverse Proxy, RabbitMQ, JSON Payload)
  await send('Runtime.evaluate', {
    expression: `
      function clickItemByText(txt) {
        const spans = Array.from(document.querySelectorAll('span'));
        const target = spans.find(el => el.textContent === txt || (el.textContent && el.textContent.includes(txt)));
        if (target && target.closest('.cursor-grab')) {
          target.closest('.cursor-grab').click();
          return true;
        }
        return false;
      }

      clickItemByText('Server Rack Tower');
      clickItemByText('Microchip / CPU Core');
      clickItemByText('Nginx Web Server');
      clickItemByText('Cold Storage Archive');
      clickItemByText('Reverse Proxy / Ingress');
      clickItemByText('Service Mesh / Link');
      clickItemByText('RabbitMQ Message Broker');
      clickItemByText('JSON API / Payload');
    `,
  });
  await sleep(1500);

  // Close library drawer to view full canvas
  await send('Runtime.evaluate', {
    expression: `
      const closeBtn = document.querySelector('.w-80.border-r button svg.lucide-x');
      if (closeBtn && closeBtn.closest('button')) closeBtn.closest('button').click();
    `,
  });
  await sleep(1500);

  // Screenshot 2: Clean vector essential architecture components & software logos on canvas
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/Zorenl/.gemini/antigravity-cli/brain/768a6ff1-a73e-4925-b3c5-1a925c09fb1f/verified-essential-arch-canvas.png', Buffer.from(shot2.data, 'base64'));
  console.log('Saved verified-essential-arch-canvas.png');

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
