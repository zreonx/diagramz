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
const debuggingPort = 9390;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-line-pos-3'
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

  // Click first diagram row
  await send('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
      if (row) row.click();
    `,
  });
  await sleep(3500);

  // Switch to Canvas view if present
  await send('Runtime.evaluate', {
    expression: `
      const canvasBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Canvas');
      if (canvasBtn) canvasBtn.click();
    `
  });
  await sleep(1000);

  // Inject test scene with step connector
  const setupResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.useDiagramStore?.getState?.();
        if (store) {
          const doc = {
            version: 1,
            nodes: [
              {
                id: 'node-client',
                type: 'card',
                x: 180,
                y: 180,
                width: 220,
                height: 90,
                title: 'Client Web Application',
                description: 'Next.js 15 Frontend Dashboard',
                color: '#3B82F6'
              },
              {
                id: 'node-api',
                type: 'card',
                x: 620,
                y: 340,
                width: 220,
                height: 90,
                title: 'Core API Gateway',
                description: 'GraphQL & REST Services',
                color: '#10B981'
              }
            ],
            edges: [
              {
                id: 'edge-main',
                source: 'node-client',
                target: 'node-api',
                sourceHandle: 'right',
                sourceOffset: 0,
                targetHandle: 'left',
                targetOffset: 0,
                label: 'REST HTTPS',
                style: 'step',
                color: '#3B82F6',
                strokeWidth: 2
              }
            ]
          };
          store.setCanvasData(doc);
          return { injected: true };
        }
        return { injected: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Setup result:', setupResult.result.value);
  await sleep(1500);

  // Take screenshot of initial state with connector
  const initialShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-line-initial.png', Buffer.from(initialShot.data, 'base64'));
  console.log('Saved verified-line-initial.png');

  // Select the edge by clicking on its label or path
  const edgeClickPtRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const label = document.querySelector('[data-testid="edge-label-edge-main"]') ||
                    Array.from(document.querySelectorAll('text')).find(t => t.textContent.includes('REST HTTPS'))?.closest('g') ||
                    document.querySelector('path[stroke="#3B82F6"]');
      if (label) {
        const rect = label.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      return { x: 500, y: 260 };
    })()`,
    returnByValue: true
  });

  const edgeClickPt = edgeClickPtRes.result.value;
  console.log('Clicking edge at:', edgeClickPt);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: edgeClickPt.x, y: edgeClickPt.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: edgeClickPt.x, y: edgeClickPt.y, button: 'left' });
  await sleep(600);

  // Check handles on selected edge
  const handlesRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const posHandle = document.querySelector('[data-testid="edge-handle-position"]');
      const srcHandle = document.querySelector('[data-testid="edge-handle-source"]');
      const tgtHandle = document.querySelector('[data-testid="edge-handle-target"]');
      return {
        hasPositionHandle: Boolean(posHandle),
        hasSourceHandle: Boolean(srcHandle),
        hasTargetHandle: Boolean(tgtHandle),
        posHandleBox: posHandle ? posHandle.getBoundingClientRect() : null,
        srcHandleBox: srcHandle ? srcHandle.getBoundingClientRect() : null,
      };
    })()`,
    returnByValue: true
  });
  console.log('Selected edge handles check:', handlesRes.result.value);

  // Take screenshot of selected edge showing endpoint handles and midpoint position handle
  const selectedShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-line-selected-handles.png', Buffer.from(selectedShot.data, 'base64'));
  console.log('Saved verified-line-selected-handles.png');

  // Drag the line position handle horizontally to the left by 60px
  if (handlesRes.result.value.posHandleBox) {
    const box = handlesRes.result.value.posHandleBox;
    const startX = box.left + box.width / 2;
    const startY = box.top + box.height / 2;

    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 });
    await sleep(80);

    for (let i = 1; i <= 10; i++) {
      const curX = startX - (65 * i) / 10;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: curX, y: startY });
      await sleep(20);
    }

    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX - 65, y: startY, button: 'left' });
    await sleep(600);

    const draggedPosShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-line-position-dragged.png', Buffer.from(draggedPosShot.data, 'base64'));
    console.log('Saved verified-line-position-dragged.png');
  }

  // Hover over the client node to see the magnetic anchor points (center + 25%/75% quartiles)
  const clientNodeBoxRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('[data-node-id="node-client"]');
      if (el) return el.getBoundingClientRect();
      return null;
    })()`,
    returnByValue: true
  });

  if (clientNodeBoxRes.result.value) {
    const nBox = clientNodeBoxRes.result.value;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: nBox.left + nBox.width / 2, y: nBox.top + nBox.height / 2 });
    await sleep(400);

    const anchorCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const anchors = document.querySelectorAll('[data-anchor-handle]');
        return Array.from(anchors).map(a => ({
          handle: a.getAttribute('data-anchor-handle'),
          ratio: a.getAttribute('data-anchor-ratio'),
          title: a.getAttribute('title')
        }));
      })()`,
      returnByValue: true
    });
    console.log('Anchors count on shape:', anchorCheck.result.value?.length);

    const anchorsShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-shape-multi-anchors.png', Buffer.from(anchorsShot.data, 'base64'));
    console.log('Saved verified-shape-multi-anchors.png');
  }

  // Re-select edge and drag source endpoint along the right side of client node to adjust position on the shape
  const reSelectSrcHandleRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const srcHandle = document.querySelector('[data-testid="edge-handle-source"]');
      if (srcHandle) return srcHandle.getBoundingClientRect();
      return null;
    })()`,
    returnByValue: true
  });

  if (reSelectSrcHandleRes.result.value) {
    const sBox = reSelectSrcHandleRes.result.value;
    const startX = sBox.left + sBox.width / 2;
    const startY = sBox.top + sBox.height / 2;

    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 });
    await sleep(100);

    // Slide down along the right side of the shape
    for (let i = 1; i <= 8; i++) {
      const curY = startY + (28 * i) / 8;
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: curY });
      await sleep(20);
    }

    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startX, y: startY + 28, button: 'left' });
    await sleep(500);

    const endpointAdjustedShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-endpoint-adjusted-along-side.png', Buffer.from(endpointAdjustedShot.data, 'base64'));
    console.log('Saved verified-endpoint-adjusted-along-side.png');
  }

  // Check Style Panel buttons for Reset Line to Center and Reset Anchors to Center
  const stylePanelCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const textContent = document.body.innerText;
      return {
        hasResetLine: textContent.includes('Reset Line to Center'),
        hasResetAnchors: textContent.includes('Reset Anchors to Center'),
      };
    })()`,
    returnByValue: true
  });
  console.log('Style Panel reset buttons check:', stylePanelCheck.result.value);

  // Take final verification screenshot
  const finalShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-final-line-and-shape-anchors.png', Buffer.from(finalShot.data, 'base64'));
  console.log('Saved verified-final-line-and-shape-anchors.png');

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error in verification:', err);
  chrome.kill();
  process.exit(1);
});
