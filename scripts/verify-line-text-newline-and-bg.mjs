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
const debuggingPort = 9263;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\5257b8c2-d24e-4f86-be03-03dfe056b6f5\\scratch\\chrome-test-line-text'
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

  console.log('1. Setting up test diagram with a line connector and label...');
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

  const createRes = await fetch(`http://localhost:4000/api/v1/projects/${project.id}/diagrams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspace.id
    },
    body: JSON.stringify({
      title: 'Line Text Newline & Background Test',
      viewMode: 'canvas',
      canvasData: {
        version: 1,
        nodes: [
          { id: 'node-a', type: 'rectangle', x: 200, y: 250, width: 140, height: 80, title: 'Service A' },
          { id: 'node-b', type: 'rectangle', x: 600, y: 250, width: 140, height: 80, title: 'Service B' },
          { id: 'text-c', type: 'text', x: 400, y: 450, width: 180, height: 60, title: 'Standalone Text' }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-a',
            target: 'node-b',
            sourceHandle: 'right',
            targetHandle: 'left',
            label: 'Initial Label',
            style: 'bezier'
          }
        ],
        strokes: [],
        viewport: { zoom: 1, panX: 0, panY: 0 }
      }
    })
  });
  const diagram = await createRes.json();
  console.log('Created diagram ID:', diagram.id);

  console.log('2. Setting auth token in localStorage...');
  await send('Page.navigate', { url: 'http://localhost:3000/login' });
  await sleep(1500);

  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'dark');
      document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
      document.cookie = 'diagramz_session=${token}; path=/; max-age=86400';
    })()`
  });
  await sleep(500);

  console.log(`3. Navigating to editor: http://localhost:3000/diagram/${diagram.id}`);
  await send('Page.navigate', { url: `http://localhost:3000/diagram/${diagram.id}` });
  await sleep(4000);

  // Switch to canvas view if needed
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const canvasBtn = btns.find(b => b.innerText && b.innerText.trim() === 'Canvas');
      if (canvasBtn) canvasBtn.click();
    })()`
  });
  await sleep(1500);

  // Find the edge label position
  console.log('3. Finding edge label element on canvas...');
  const labelLoc = await send('Runtime.evaluate', {
    expression: `(() => {
      const labelGroup = document.querySelector('[data-testid="edge-label-edge-1"]');
      if (!labelGroup) return { error: 'labelGroup not found' };
      const rect = labelGroup.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
    })()`,
    returnByValue: true
  });
  console.log('Label location:', labelLoc.result.value);

  const { x, y } = labelLoc.result.value;

  // Double click label to open textarea editor
  console.log('4. Double clicking line label to edit text...');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 2 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2 });
  await sleep(500);

  // Check if textarea is active, or trigger dblclick if synthetic CDP clicks were swallowed
  const textareaCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      let ta = document.querySelector('foreignObject textarea');
      if (!ta) {
        const rect = document.querySelector('[data-testid="edge-label-edge-1"] rect');
        if (rect) {
          rect.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        }
        ta = document.querySelector('foreignObject textarea');
      }
      if (ta) {
        ta.focus();
        ta.select();
      }
      return { exists: !!ta, placeholder: ta?.placeholder, val: ta?.value };
    })()`,
    returnByValue: true
  });
  console.log('Line textarea state:', textareaCheck.result.value);

  // Clear and type multiline text: "First Line" + Enter + "Second Line"
  console.log('5. Typing multiple lines with plain Enter key...');
  // Clear textarea via input event so it starts empty
  await send('Runtime.evaluate', {
    expression: `(() => {
      const ta = document.querySelector('foreignObject textarea');
      if (ta) {
        ta.value = '';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`
  });
  await sleep(100);

  for (const ch of 'First Line') {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
    await send('Input.dispatchKeyEvent', { type: 'keyUp' });
  }

  // Press Enter (newline)
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter' });
  await send('Input.dispatchKeyEvent', { type: 'char', text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });

  for (const ch of 'Second Line') {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
    await send('Input.dispatchKeyEvent', { type: 'keyUp' });
  }

  await sleep(300);

  // Check textarea value after Enter
  const valCheck = await send('Runtime.evaluate', {
    expression: `document.querySelector('foreignObject textarea')?.value`,
    returnByValue: true
  });
  console.log('Textarea value after hitting Enter:', JSON.stringify(valCheck.result.value));
  const hasNewline = valCheck.result.value && valCheck.result.value.includes('\n');
  console.log('Did Enter insert a newline in line text?:', hasNewline);

  // Save via Ctrl+Enter
  console.log('6. Saving multiline text via Ctrl+Enter...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', modifiers: 2 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
  await sleep(600);

  // Inspect rendered SVG text
  const renderedLabel = await send('Runtime.evaluate', {
    expression: `(() => {
      const group = document.querySelector('[data-testid="edge-label-edge-1"]');
      if (!group) return { error: 'label not found' };
      const tspans = Array.from(group.querySelectorAll('tspan')).map(t => t.textContent);
      const rect = group.querySelector('rect');
      return {
        tspans,
        rectWidth: rect?.getAttribute('width'),
        rectHeight: rect?.getAttribute('height'),
        rectFill: rect?.getAttribute('fill')
      };
    })()`,
    returnByValue: true
  });
  console.log('Rendered multiline label on canvas:', renderedLabel.result.value);

  // Now test selecting line and editing Text background from the style panel menu
  console.log('7. Clicking on the line label to select it and open the style panel...');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left' });
  await sleep(600);

  // Check if style panel opened with "Text background" row
  const stylePanelCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const panel = document.querySelector('aside') || document.querySelector('[role="complementary"]') || document.body;
      const text = panel.innerText;
      const hasTextBg = text.includes('Text background');
      const hasTextColour = text.includes('Text colour');
      const hasStroke = text.includes('Stroke');
      return { hasTextBg, hasTextColour, hasStroke };
    })()`,
    returnByValue: true
  });
  console.log('Style panel controls for edge:', stylePanelCheck.result.value);

  // Click on a background palette swatch in the Text background row
  console.log('8. Selecting a custom text background color from the style panel...');
  const clickedBg = await send('Runtime.evaluate', {
    expression: `(() => {
      const panel = document.querySelector('[data-testid="style-panel"]');
      if (!panel) return { error: 'style panel not found' };
      const row = panel.querySelector('[data-testid="row-text-background"]');
      if (!row) return { error: 'Text background row not found' };
      const buttons = Array.from(row.querySelectorAll('button'));
      // Pick swatch #FEE2E2 or #FEF3C7
      const targetBtn = buttons[2] || buttons[1];
      if (targetBtn) {
        targetBtn.click();
        return { success: true, clickedColor: targetBtn.title || targetBtn.getAttribute('aria-label') };
      }
      return { error: 'no buttons in row' };
    })()`,
    returnByValue: true
  });
  console.log('Clicked text background swatch:', clickedBg.result.value);
  await sleep(600);

  // Check if the canvas edge label rect fill updated
  const updatedFill = await send('Runtime.evaluate', {
    expression: `(() => {
      const group = document.querySelector('[data-testid="edge-label-edge-1"]');
      const rect = group ? group.querySelector('rect') : null;
      return { fill: rect ? rect.getAttribute('fill') : null };
    })()`,
    returnByValue: true
  });
  console.log('Updated canvas label rect fill:', updatedFill.result.value);

  // Now test text component background
  console.log('9. Clicking standalone text component to test text background...');
  const textCompLoc = await send('Runtime.evaluate', {
    expression: `(() => {
      const node = document.querySelector('[data-node-id="text-c"]');
      if (!node) return { error: 'text node not found' };
      const r = node.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`,
    returnByValue: true
  });
  if (textCompLoc.result.value.x) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: textCompLoc.result.value.x, y: textCompLoc.result.value.y, button: 'left' });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: textCompLoc.result.value.x, y: textCompLoc.result.value.y, button: 'left' });
    await sleep(600);

    const textPanelCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const panel = document.querySelector('[data-testid="style-panel"]');
        if (!panel) return { error: 'style panel not found' };
        const row = panel.querySelector('[data-testid="row-text-background"]');
        return { hasTextBg: !!row };
      })()`,
      returnByValue: true
    });
    console.log('Style panel for Text component:', textPanelCheck.result.value);

    // Click background swatch for text component
    await send('Runtime.evaluate', {
      expression: `(() => {
        const panel = document.querySelector('[data-testid="style-panel"]');
        const row = panel?.querySelector('[data-testid="row-text-background"]');
        if (row) {
          const buttons = Array.from(row.querySelectorAll('button'));
          if (buttons[3]) buttons[3].click();
        }
      })()`
    });
    await sleep(500);

    const textCompBg = await send('Runtime.evaluate', {
      expression: `(() => {
        const node = document.querySelector('[data-node-id="text-c"] > div');
        return { bg: node ? window.getComputedStyle(node).backgroundColor : null };
      })()`,
      returnByValue: true
    });
    console.log('Text component computed background:', textCompBg.result.value);
  }

  // Capture screenshot
  const screenshot = await send('Page.captureScreenshot');
  fs.writeFileSync('scripts/verified-line-text-newline-and-bg.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Done! Screenshot saved to scripts/verified-line-text-newline-and-bg.png');

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
