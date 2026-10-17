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
const debuggingPort = 9388;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-badges-final'
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
      localStorage.setItem('diagramz_theme', 'dark');
      document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
    `,
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(2500);

  await send('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
      if (row) row.click();
    `,
  });
  await sleep(3500);

  // Switch to Canvas view
  await send('Runtime.evaluate', {
    expression: `
      const canvasBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Canvas');
      if (canvasBtn) canvasBtn.click();
    `
  });
  await sleep(1000);

  // Inject a complete scene into DiagramCanvas
  // By finding the fiber or state
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Find React fiber for canvas
        const dom = document.querySelector('.zcanvas-container') || document.querySelector('svg');
        const key = Object.keys(dom).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        // Alternatively, use useDiagramStore
        const store = window.useDiagramStore?.getState?.();
        if (store) {
          const doc = {
            version: 1,
            nodes: [
              {
                id: 'c-vpc-demo',
                type: 'container',
                x: 140,
                y: 100,
                width: 700,
                height: 400,
                title: 'Production Multi-Region Cloud VPC',
                description: '10.0.0.0/16 · Primary Secure Isolation Perimeter',
                color: '#6366F1'
              },
              {
                id: 'flow-ingress-srv',
                type: 'card',
                x: 200,
                y: 200,
                width: 260,
                height: 80,
                title: 'Ingress API Gateway Service',
                description: 'Handles JWT Auth, TLS Termination & Routing',
                icon: 'server',
                color: '#3B82F6'
              },
              {
                id: 'flow-order-srv',
                type: 'card',
                x: 520,
                y: 200,
                width: 260,
                height: 80,
                title: 'Order Processing Microservice',
                description: 'Kafka Stream Consumer & Checkout Logic',
                badge: 'Microservice',
                icon: 'server',
                color: '#10B981'
              }
            ],
            edges: [
              {
                id: 'edge-ingress-order',
                source: 'flow-ingress-srv',
                target: 'flow-order-srv',
                label: 'gRPC event stream',
                style: 'bezier',
                color: '#8B5CF6'
              }
            ]
          };
          // Try updating canvas data
          store.setCanvasData(doc);
        }
      })()
    `
  });
  await sleep(1500);

  // Click on the container to select it and trigger Style Panel
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const vpcTitle = Array.from(document.querySelectorAll('span, div')).find(el => el.textContent && el.textContent.includes('VIRTUAL PRIVATE CLOUD') || el.textContent.includes('Production Multi-Region'));
        if (vpcTitle) {
          vpcTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          vpcTitle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      })()
    `
  });
  await sleep(1500);

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-optional-badges-complete.png';
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${outPath}`);

  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
