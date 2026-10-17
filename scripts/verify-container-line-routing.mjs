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
const debuggingPort = 9396;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-vpc-line-ui'
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

  // Click the Arrow tool in toolbar: look for button with arrow icon or title
  const selectToolResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Toolbar tools
        const buttons = Array.from(document.querySelectorAll('button'));
        // Find arrow tool button
        const arrowBtn = buttons.find(b => b.getAttribute('title')?.toLowerCase().includes('arrow') || b.getAttribute('data-tool') === 'arrow' || b.querySelector('svg.lucide-arrow-right'));
        if (arrowBtn) {
          arrowBtn.click();
          return { clicked: true, title: arrowBtn.getAttribute('title') };
        }
        return { clicked: false, buttons: buttons.map(b => b.getAttribute('title') || b.textContent).filter(Boolean) };
      })()
    `,
    returnByValue: true
  });
  console.log('Select Arrow tool result:', selectToolResult.result?.value);
  await sleep(500);

  // Dispatch genuine mouse drag using Chrome DevTools Protocol Input events
  const startX = 450;
  const startY = 520;
  const endX = 720;
  const endY = 520;

  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: startX,
    y: startY,
    button: 'left',
    buttons: 1,
    clickCount: 1
  });
  await sleep(100);

  // Move in steps
  for (let x = startX + 50; x <= endX; x += 50) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: x,
      y: startY,
      button: 'left',
      buttons: 1
    });
    await sleep(40);
  }

  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: endX,
    y: endY,
    button: 'left',
    buttons: 0
  });
  await sleep(1500);

  // Inspect the store and edges to see the newly created edge!
  const edgesCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const store = window.useDiagramStore?.getState ? window.useDiagramStore.getState() : null;
        const canvasData = store?.canvasData;
        const edges = canvasData?.edges || [];
        const nodes = canvasData?.nodes || [];
        const vpcNode = nodes.find(n => n.type === 'container' || n.title?.toLowerCase().includes('vpc'));

        const latestEdge = edges[edges.length - 1];

        return {
          totalEdges: edges.length,
          vpcId: vpcNode?.id,
          latestEdge: latestEdge ? {
            id: latestEdge.id,
            source: latestEdge.source,
            target: latestEdge.target,
            sourcePoint: latestEdge.sourcePoint,
            targetPoint: latestEdge.targetPoint,
            isAttachedToVpc: latestEdge.source === vpcNode?.id || latestEdge.target === vpcNode?.id
          } : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Edges check result:', edgesCheck.result?.value);

  // Take screenshot showing the line inside the VPC container
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  const screenshotPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-line-inside-vpc-container.png';
  fs.writeFileSync(screenshotPath, buffer);
  console.log('Saved screenshot to:', screenshotPath);

  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
