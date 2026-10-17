import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
const debuggingPort = 9259;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\81d162a7-f5a4-459c-9d18-4ccaaa398035\\scratch\\chrome-test-move-and-newline'
]);

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
  await send('Network.enable');

  // Set auth cookies
  await send('Network.setCookie', {
    name: 'diagramz_access_token',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
  });
  await send('Network.setCookie', {
    name: 'diagramz_session',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
  });

  console.log('1. Fetching workspace & project to set up test diagram...');
  const wsRes = await fetch('http://localhost:4000/api/v1/workspaces', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const workspaces = await wsRes.json();
  const workspace = workspaces[0];

  const pRes = await fetch(`http://localhost:4000/api/v1/workspaces/${workspace.id}/projects`, {
    headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': workspace.id }
  });
  const projects = await pRes.json();
  const project = projects[0];

  console.log('Creating a dedicated test diagram...');
  const createRes = await fetch(`http://localhost:4000/api/v1/projects/${project.id}/diagrams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspace.id
    },
    body: JSON.stringify({
      title: 'Move & Enter Newline Test',
      viewMode: 'canvas',
      canvasData: {
        version: 1,
        nodes: [
          { id: 'rect-1', type: 'rectangle', x: 250, y: 180, width: 220, height: 120, title: 'Shape Title' },
          { id: 'text-1', type: 'text', x: 550, y: 200, width: 160, height: 50, title: 'Text Note' }
        ],
        edges: [],
        strokes: [],
        viewport: { zoom: 1, panX: 0, panY: 0 }
      }
    })
  });
  const testDiagram = await createRes.json();
  console.log('Test diagram created:', testDiagram.id);

  // Ensure diagram is shared with viewer role
  console.log('2. Configuring diagram share settings to public viewer...');
  const shareRes = await fetch(`http://localhost:4000/api/v1/diagrams/${testDiagram.id}/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspace.id
    },
    body: JSON.stringify({
      isPublic: true,
      shareRole: 'viewer'
    })
  });
  const shareData = await shareRes.json();
  console.log('Share data:', shareData);

  // Navigate to shared page
  console.log(`3. Navigating to public share page: http://localhost:3000/share/${shareData.shareToken}`);
  await send('Page.navigate', { url: `http://localhost:3000/share/${shareData.shareToken}` });
  await sleep(3500);

  // Verify shared document has View Mode and Viewport Dock
  const viewModeCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      const hasViewOnly = text.includes('View Only') || text.includes('View Mode');
      const canvasEl = document.querySelector('#zcanvas-grid');
      const containerEl = canvasEl ? canvasEl.parentElement : null;
      const cursorClass = containerEl ? containerEl.className : '';
      const transformBefore = canvasEl ? canvasEl.getAttribute('style') : '';
      return { hasViewOnly, cursorClass, transformBefore };
    })()`,
    returnByValue: true
  });
  console.log('Shared Page Check:', viewModeCheck.result.value);

  // Test Moving Around (Panning) on the shared document
  console.log('4. Testing mouse drag panning on shared document...');
  // Dispatch mouse drag from (500, 300) to (300, 200)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 500,
    y: 300,
    button: 'left',
    buttons: 1
  });
  await sleep(100);

  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 400,
    y: 250,
    buttons: 1
  });
  await sleep(100);

  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 300,
    y: 200,
    buttons: 1
  });
  await sleep(100);

  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 300,
    y: 200,
    button: 'left'
  });
  await sleep(300);

  const afterPanCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvasEl = document.querySelector('#zcanvas-grid');
      return canvasEl ? canvasEl.getAttribute('style') : '';
    })()`,
    returnByValue: true
  });
  console.log('Transform after pan:', afterPanCheck.result.value);

  const pannedSuccessfully = afterPanCheck.result.value !== viewModeCheck.result.value.transformBefore;
  console.log('Did viewport move around when dragging?:', pannedSuccessfully);

  // Take screenshot of shared page
  const screenshot = await send('Page.captureScreenshot');
  fs.writeFileSync('scripts/verified-shared-panning.png', Buffer.from(screenshot.data, 'base64'));

  // Ensure auth token in localStorage for editor access
  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'dark');
      document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
    })()`
  });

  // Now test Shape Text & Text Component Newline on Enter
  console.log(`5. Navigating to editor: http://localhost:3000/diagram/${testDiagram.id}`);
  await send('Page.navigate', { url: `http://localhost:3000/diagram/${testDiagram.id}` });
  await sleep(4000);

  // Switch to canvas view if in both or doc mode
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const canvasBtn = btns.find(b => b.innerText && b.innerText.trim() === 'Canvas');
      if (canvasBtn) canvasBtn.click();
    })()`
  });
  await sleep(1500);

  // Double click shape node to edit text
  console.log('6. Testing Enter on shape text to add new line...');
  const shapeTest = await send('Runtime.evaluate', {
    expression: `(() => {
      const node = document.querySelector('[data-node-id="rect-1"]');
      if (!node) return { error: 'node not found' };
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`,
    returnByValue: true
  });
  console.log('Shape node coords:', shapeTest.result.value);

  if (shapeTest.result.value.x) {
    const { x, y } = shapeTest.result.value;
    // Double click on shape center
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 2 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2 });
    await sleep(600);

    // Check if textarea is active
    const textareaCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const textarea = document.querySelector('textarea');
        return { isTextarea: !!textarea, val: textarea ? textarea.value : null };
      })()`,
      returnByValue: true
    });
    console.log('Textarea active after double-click:', textareaCheck.result.value);

    // Type "Line 1" then Enter then "Line 2"
    if (textareaCheck.result.value.isTextarea) {
      // Type 'First Line'
      for (const char of 'First Line') {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await send('Input.dispatchKeyEvent', { type: 'keyUp' });
      }
      // Press Enter to add newline
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter' });
      await send('Input.dispatchKeyEvent', { type: 'char', text: '\r' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });

      // Type 'Second Line'
      for (const char of 'Second Line') {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await send('Input.dispatchKeyEvent', { type: 'keyUp' });
      }

      await sleep(300);

      const valAfterEnter = await send('Runtime.evaluate', {
        expression: `(() => {
          const textarea = document.querySelector('textarea');
          return textarea ? textarea.value : null;
        })()`,
        returnByValue: true
      });
      console.log('Textarea value after hitting Enter:', JSON.stringify(valAfterEnter.result.value));
      const hasNewline = valAfterEnter.result.value && valAfterEnter.result.value.includes('\n');
      console.log('Did Enter insert a newline in shape text?:', hasNewline);

      // Save via Ctrl+Enter
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', modifiers: 2 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
      await sleep(500);

      // Check rendered text in the shape
      const renderedShapeText = await send('Runtime.evaluate', {
        expression: `(() => {
          const node = document.querySelector('[data-node-id="rect-1"]');
          return node ? node.innerText : '';
        })()`,
        returnByValue: true
      });
      console.log('Rendered shape text after save:', JSON.stringify(renderedShapeText.result.value));
    }
  }

  // Capture final screenshot
  const finalScreenshot = await send('Page.captureScreenshot');
  fs.writeFileSync('scripts/verified-shape-newline.png', Buffer.from(finalScreenshot.data, 'base64'));
  console.log('Done! Screenshots saved to scripts/verified-shared-panning.png and scripts/verified-shape-newline.png');

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
