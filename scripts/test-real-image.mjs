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
const debuggingPort = 9233;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-img'
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

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'dark');
      document.cookie = 'diagramz_access_token=${token}; path=/';
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/diagram/e980370b-fede-4ad8-85cc-cb06c2f12b70' });
  await sleep(4000);

  // Insert a test image element and file via Excalidraw API
  const insertRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const api = window.__EXCALIDRAW_API__;
        if (!api) return { error: 'no api' };
        
        // 1x1 or sample red dot PNG
        const samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABTSURBVHhe7c4BDQAgDMAw9M86+jAY0nBwK+h01k6vdv4DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgB5p6QJ4Qj7+7AAAAABJRU5ErkJggg==';
        const fileId = 'test_img_file_1';
        
        // Add file
        api.addFiles([{
          id: fileId,
          dataURL: samplePng,
          mimeType: 'image/png',
          created: Date.now()
        }]);
        
        // Add image element
        const imgElement = {
          type: 'image',
          id: 'test_image_el',
          fileId: fileId,
          status: 'saved',
          x: 450,
          y: 200,
          width: 200,
          height: 200,
          scale: [1, 1],
          angle: 0,
          strokeColor: 'transparent',
          backgroundColor: 'transparent',
          fillStyle: 'solid',
          strokeWidth: 1,
          strokeStyle: 'solid',
          roughness: 1,
          opacity: 100,
          groupIds: [],
          strokeSharpness: 'round',
          seed: 12345,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false
        };
        
        const existing = api.getSceneElements().filter(e => e.id !== 'tVm0YfoZpsRrU829EZM-N');
        api.updateScene({
          elements: [...existing, imgElement]
        });
        
        api.scrollToContent(undefined, { fitToViewport: true, animate: false });
        
        return { success: true, count: api.getSceneElements().length };
      })()
    `,
    returnByValue: true
  });
  console.log('Insert image result:', insertRes.result.value);

  await sleep(1500);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/canvas-real-image.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved scripts/canvas-real-image.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
