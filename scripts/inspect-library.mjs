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
  { sub: 'e261efef-44d3-4b3d-bd8f-f224e01c94ff', email: 'zrodayrit@gmail.com', name: 'Zorenl Rkyle Dayrit' },
  'generate-a-minimum-64-char-secret-string-for-diagramz-development-mode'
);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9236',
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-profile-library',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await sleep(2000);
  const versionRes = await fetch('http://127.0.0.1:9236/json/list');
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
      return;
    }
  };
  await new Promise((res) => { ws.onopen = res; });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
      return;
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER CONSOLE:', data.params.type, data.params.args?.map(a => a.value || a.description));
    }
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER EXCEPTION:', data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text);
    }
  };
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1000);
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'dark');
    `,
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(3000);

  const diagHref = await send('Runtime.evaluate', {
    expression: `document.querySelector('a[href^="/diagram/"]')?.getAttribute('href')`,
    returnByValue: true
  });

  if (diagHref.result.value) {
    await send('Page.navigate', { url: 'http://localhost:3000' + diagHref.result.value });
    await sleep(4000);

    // Find and click the Library trigger
    const clickRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const trigger = document.querySelector('.sidebar-trigger, .default-sidebar-trigger');
        if (trigger) {
          trigger.click();
          return { found: true, class: trigger.className, text: trigger.innerText };
        }
        return { found: false };
      })()`,
      returnByValue: true
    });
    console.log('Library trigger click:', clickRes.result.value);

    await sleep(2000);

    // Inspect what opened in the DOM
    const openState = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('.library-menu-browse-button');
        const container = document.querySelector('.library-menu-control-buttons');
        const style = btn ? window.getComputedStyle(btn) : null;
        const containerStyle = container ? window.getComputedStyle(container) : null;

        return {
          hasBtn: !!btn,
          btnOuterHtml: btn ? btn.outerHTML : null,
          btnDisplay: style ? style.display : null,
          btnVisibility: style ? style.visibility : null,
          btnOpacity: style ? style.opacity : null,
          btnWidth: style ? style.width : null,
          btnHeight: style ? style.height : null,
          containerOuterHtml: container ? container.outerHTML : null,
          containerDisplay: containerStyle ? containerStyle.display : null,
          containerHeight: containerStyle ? containerStyle.height : null,
        };
      })()`,
      returnByValue: true
    });
    console.log('Button details:', JSON.stringify(openState.result.value, null, 2));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('scripts/library-opened.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved scripts/library-opened.png');
  }

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
