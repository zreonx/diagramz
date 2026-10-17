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
const debuggingPort = 9397;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1600,1000',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-ai-lines'
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  let targets = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      targets = await versionRes.json();
      if (targets && targets.length > 0) break;
    } catch (e) {
      // retry
    }
  }
  if (!targets) throw new Error('Could not connect to Chrome CDP');
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

  // Set auth cookie and localStorage
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
  await sleep(4000);

  // Switch to Canvas view if present
  await send('Runtime.evaluate', {
    expression: `
      const canvasBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Canvas');
      if (canvasBtn) canvasBtn.click();
    `
  });
  await sleep(1500);

  // Insert AI architecture diagram document
  const insertResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const testDoc = {
          nodes: [
            { id: 'vpc-main', type: 'container', title: 'Production Cloud VPC', x: 40, y: 40, width: 900, height: 600, badge: 'AWS' },
            { id: 'api-gw', type: 'svg', title: 'API Gateway', parentId: 'vpc-main', x: 80, y: 220, width: 90, height: 90, data: { archId: 'arch-api-gateway' } },
            { id: 'auth-svc', type: 'svg', title: 'Auth Service', parentId: 'vpc-main', x: 380, y: 120, width: 90, height: 90, data: { archId: 'arch-auth' } },
            { id: 'order-svc', type: 'svg', title: 'Order Service', parentId: 'vpc-main', x: 380, y: 260, width: 90, height: 90, data: { archId: 'arch-microservice' } },
            { id: 'pay-svc', type: 'svg', title: 'Payment Service', parentId: 'vpc-main', x: 380, y: 400, width: 90, height: 90, data: { archId: 'arch-payment-gateway' } },
            { id: 'redis-auth', type: 'svg', title: 'Redis Sessions', parentId: 'vpc-main', x: 680, y: 120, width: 90, height: 90, data: { archId: 'arch-cache' } },
            { id: 'db-orders', type: 'table', title: 'Orders Database', parentId: 'vpc-main', x: 680, y: 260, width: 220, height: 160, fields: [{ name: 'id', type: 'uuid', pk: true }, { name: 'user_id', type: 'uuid' }, { name: 'total', type: 'numeric' }] },
          ],
          edges: [
            // Fan-out from API Gateway to 3 services
            { id: 'e-gw-auth', source: 'api-gw', target: 'auth-svc', label: 'HTTP / Login', color: '#3b82f6' },
            { id: 'e-gw-order', source: 'api-gw', target: 'order-svc', label: 'HTTP / Orders', color: '#10b981' },
            { id: 'e-gw-pay', source: 'api-gw', target: 'pay-svc', label: 'HTTP / Checkout', color: '#f59e0b' },
            // Bidirectional communication between Order Service and Payment Service
            { id: 'e-order-pay-req', source: 'order-svc', target: 'pay-svc', label: 'Create Charge', color: '#8b5cf6' },
            { id: 'e-order-pay-res', source: 'pay-svc', target: 'order-svc', label: 'Charge Confirmed', color: '#ec4899' },
            // Service to datastores
            { id: 'e-auth-redis', source: 'auth-svc', target: 'redis-auth', label: 'Session Cache', color: '#ef4444' },
            { id: 'e-order-db', source: 'order-svc', target: 'db-orders', label: 'SQL Transactions', color: '#06b6d4' },
          ]
        };

        if (typeof window.diagramzSetDoc === 'function' && typeof window.diagramzBeautify === 'function') {
          const beautified = window.diagramzBeautify(testDoc.nodes, testDoc.edges, {
            minHorizontalGap: 160,
            minVerticalGap: 170,
            containerPadding: 55,
            containerHeaderHeight: 65,
            baseOffsetX: 60,
            baseOffsetY: 60,
          });
          window.diagramzSetDoc({
            version: 1,
            nodes: beautified.nodes,
            edges: beautified.edges,
            strokes: [],
            viewport: { zoom: 1, panX: 20, panY: 20 },
          });
          return { success: true, nodeCount: beautified.nodes.length, edgeCount: beautified.edges.length };
        }
        return { success: false, reason: 'window.diagramzSetDoc not found' };
      })()
    `,
    returnByValue: true
  });

  console.log('Set clean AI diagram result:', insertResult.result?.value);
  await sleep(1500);

  // Inspect the rendered edges and edge labels
  const edgeAnalysis = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const edgeLabels = Array.from(document.querySelectorAll('[data-testid^="edge-label-"]'));
        const labelRects = edgeLabels.map(el => {
          const rect = el.getBoundingClientRect();
          const title = el.querySelector('text')?.textContent || el.textContent;
          return {
            id: el.getAttribute('data-edge-id'),
            text: title.trim(),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
          };
        });

        // Check for any label-to-label overlapping collisions
        const collisions = [];
        for (let i = 0; i < labelRects.length; i++) {
          for (let j = i + 1; j < labelRects.length; j++) {
            const r1 = labelRects[i].rect;
            const r2 = labelRects[j].rect;
            const overlapX = Math.max(0, Math.min(r1.x + r1.width, r2.x + r2.width) - Math.max(r1.x, r2.x));
            const overlapY = Math.max(0, Math.min(r1.y + r1.height, r2.y + r2.height) - Math.max(r1.y, r2.y));
            if (overlapX > 0 && overlapY > 0) {
              collisions.push({
                label1: labelRects[i].text,
                label2: labelRects[j].text,
                overlapX,
                overlapY
              });
            }
          }
        }

        // Check edge paths for bidirectional edges
        const paths = Array.from(document.querySelectorAll('svg path.pointer-events-none')).map(p => p.getAttribute('d')).filter(Boolean);

        return {
          totalLabelsRendered: labelRects.length,
          labels: labelRects,
          labelCollisionsCount: collisions.length,
          collisions,
          totalPathsRendered: paths.length
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Edge & Label Analysis:', JSON.stringify(edgeAnalysis.result?.value, null, 2));

  // Capture screenshot
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-ai-diagram-clean-lines-and-labels.png';
  fs.writeFileSync(artifactPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${artifactPath}`);

  ws.close();
  chrome.kill();
}

run().catch((err) => {
  console.error('Test error:', err);
  chrome.kill();
  process.exit(1);
});
