import { spawn } from 'child_process';
import crypto from 'crypto';

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
const debuggingPort = 9239;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-lib-dom'
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

  // Click library trigger
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.sidebar-trigger, [data-testid="library-button"], button[aria-label*="Library"]');
        if (btn) btn.click();
      })()
    `
  });
  await sleep(1500);

  const domDetails = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const sidebar = document.querySelector('.sidebar--right') || document.querySelector('.layer-ui__library');
        if (!sidebar) return { parentTag: sidebar.parentElement?.tagName, parentClass: sidebar.parentElement?.className, parentBg: window.getComputedStyle(sidebar.parentElement).backgroundColor, parentBorder: window.getComputedStyle(sidebar.parentElement).border,  error: 'no sidebar' };

        const sidebarCs = window.getComputedStyle(sidebar);
        const header = sidebar.querySelector('.sidebar__header') || sidebar.querySelector('[class*="header"]');
        const unit = sidebar.querySelector('.library-unit');
        const unitCs = unit ? window.getComputedStyle(unit) : null;
        const browseBtn = sidebar.querySelector('.library-menu-browse-button');
        const browseCs = browseBtn ? window.getComputedStyle(browseBtn) : null;

        return {
          sidebarTag: sidebar.tagName,
          sidebarClass: sidebar.className,
          sidebarBg: sidebarCs.backgroundColor,
          sidebarBorderLeft: sidebarCs.borderLeft,
          headerText: header ? header.textContent : null,
          headerClass: header ? header.className : null,
          unitBorder: unitCs ? unitCs.border : null,
          unitBg: unitCs ? unitCs.backgroundColor : null,
          unitRadius: unitCs ? unitCs.borderRadius : null,
          browseBtnBg: browseCs ? browseCs.backgroundColor : null,
          browseBtnColor: browseCs ? browseCs.color : null,
          browseBtnRadius: browseCs ? browseCs.borderRadius : null,
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Library DOM details:', JSON.stringify(domDetails.result.value, null, 2));

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
