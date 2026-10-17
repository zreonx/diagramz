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
const debuggingPort = 9345;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-label-drag'
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

  // Navigate to dashboard
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(2500);

  // Click first diagram row
  await send('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
      if (row) row.click();
    `,
  });
  await sleep(3500);

  // Setup test nodes and a connector with a label
  const setupResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.__diagramStore || window.useDiagramStore?.getState?.();
        // Look for zustand devtools or react fiber to find state
        const canvas = document.querySelector('.zcanvas-container') || document.querySelector('svg');
        return { hasCanvas: !!canvas };
      })()
    `,
    returnByValue: true
  });
  console.log('Canvas check:', setupResult.result.value);

  // Inject two nodes and an edge with a label if not present, via diagram store
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Try finding store on window or via fiber
        const rootEl = document.getElementById('__next') || document.body;
        // Check document scene
        const store = window.useDiagramStore?.getState ? window.useDiagramStore.getState() : null;
        if (store && store.currentDiagram) {
          const doc = store.currentDiagram.document || { nodes: [], edges: [] };
          doc.nodes = [
            {
              id: 'node-label-src',
              type: 'rectangle',
              x: 180,
              y: 220,
              width: 160,
              height: 80,
              title: 'API Gateway',
              color: '#3B82F6'
            },
            {
              id: 'node-label-tgt',
              type: 'rectangle',
              x: 580,
              y: 220,
              width: 160,
              height: 80,
              title: 'Order Service',
              color: '#10B981'
            }
          ];
          doc.edges = [
            {
              id: 'edge-label-test',
              source: 'node-label-src',
              target: 'node-label-tgt',
              label: 'HTTPS /checkout',
              style: 'bezier',
              color: '#6366F1',
              strokeWidth: 2
            }
          ];
          store.setDocument?.(doc) || store.updateDocument?.(doc);
          if (store.saveDiagram) store.saveDiagram();
          return { injected: true };
        }
        return { injected: false };
      })()
    `,
    returnByValue: true
  });

  await sleep(1500);

  // Find the label element
  const labelLoc = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const labelPill = document.querySelector('[data-testid="edge-label-pill"]') ||
          Array.from(document.querySelectorAll('text')).find(t => t.textContent.includes('checkout') || t.textContent.includes('HTTPS'))?.closest('g') ||
          document.querySelector('text[text-anchor="middle"]')?.closest('g');
        if (!labelPill) return null;
        const rect = labelPill.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          width: rect.width,
          height: rect.height,
          outerHTML: labelPill.outerHTML.slice(0, 200)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Label location:', labelLoc.result.value);

  if (labelLoc.result.value) {
    const { x, y } = labelLoc.result.value;

    // 1. Mouse down on label pill
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
      clickCount: 1
    });
    await sleep(200);

    // 2. Drag label +80px to the right along the horizontal connector
    for (let step = 1; step <= 8; step++) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: x + step * 10,
        y: y,
        button: 'left',
        buttons: 1
      });
      await sleep(30);
    }

    // 3. Mouse up to commit label position
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: x + 80,
      y: y,
      button: 'left',
      buttons: 0
    });
    await sleep(600);

    // Verify label updated position
    const afterDragLoc = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const labelPill = document.querySelector('[data-testid="edge-label-pill"]') ||
            Array.from(document.querySelectorAll('text')).find(t => t.textContent.includes('checkout') || t.textContent.includes('HTTPS'))?.closest('g') ||
            document.querySelector('text[text-anchor="middle"]')?.closest('g');
          if (!labelPill) return null;
          const rect = labelPill.getBoundingClientRect();
          return {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            transform: labelPill.getAttribute('transform')
          };
        })()
      `,
      returnByValue: true
    });
    console.log('After drag location:', afterDragLoc.result.value);
  }

  // Screenshot canvas showing moved label and style panel
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-edge-label-drag-repositioned.png';
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
