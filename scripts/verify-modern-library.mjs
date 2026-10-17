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
const debuggingPort = 9268;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-prod-verify'
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

  // Open library
  await send('Runtime.evaluate', {
    expression: `
      const btn = document.querySelector('.sidebar-trigger, [data-testid="library-button"], button[aria-label*="Library"]');
      if (btn) btn.click();
    `
  });
  await sleep(1200);

  // 1. Click 3-dots button to open package dropdown menu
  const clickResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.library-menu-dropdown-container .dropdown-menu-button, .library-menu-dropdown-container button');
        if (btn) {
          btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          btn.click();
          return { found: true, className: btn.className };
        }
        return { found: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Click 3-dots result:', clickResult.result.value);
  await sleep(1000);

  // Inspect 3-dots dropdown menu
  const menuInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const menu = document.querySelector('.dropdown-menu');
        const items = Array.from(document.querySelectorAll('.dropdown-menu-item, .dropdown-menu-item-base')).map(it => ({
          text: it.innerText.trim(),
          width: window.getComputedStyle(it).width,
          height: window.getComputedStyle(it).height
        }));
        return {
          menuVisible: !!menu,
          items
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Production 3-Dots Menu Info:', JSON.stringify(menuInfo.result.value, null, 2));

  // Take screenshot 1: 3-dots dropdown menu
  const shotMenu = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/prod-library-menu.png', Buffer.from(shotMenu.data, 'base64'));
  console.log('Saved scripts/prod-library-menu.png');

  // Close dropdown menu by clicking the 3-dots button again
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.library-menu-dropdown-container .dropdown-menu-button, .library-menu-dropdown-container button');
        if (btn) {
          btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          btn.click();
        }
      })()
    `
  });
  await sleep(600);

  // Inspect gallery cards layout
  const galleryInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const grid = document.querySelector('.library-menu-items-container__grid');
        const unit = document.querySelector('.library-unit');
        const browseBtn = document.querySelector('.library-menu-browse-button');
        const itemsContainer = document.querySelector('.library-menu-items-container__items');
        return {
          gridColumns: grid ? window.getComputedStyle(grid).gridTemplateColumns : null,
          gridGap: grid ? window.getComputedStyle(grid).gap : null,
          unitWidth: unit ? window.getComputedStyle(unit).width : null,
          unitHeight: unit ? window.getComputedStyle(unit).height : null,
          unitBorder: unit ? window.getComputedStyle(unit).border : null,
          unitBg: unit ? window.getComputedStyle(unit).backgroundColor : null,
          hasBrowseBtn: !!browseBtn,
          itemsCanScroll: itemsContainer ? itemsContainer.scrollHeight > itemsContainer.clientHeight : false
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Production Gallery Info:', JSON.stringify(galleryInfo.result.value, null, 2));

  // Take screenshot 2: Gallery Top
  const shotTop = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/prod-library-top.png', Buffer.from(shotTop.data, 'base64'));
  console.log('Saved scripts/prod-library-top.png');

  // Scroll down to view the rest of the stencils
  await send('Runtime.evaluate', {
    expression: `
      const items = document.querySelector('.library-menu-items-container__items');
      if (items) items.scrollTop = 280;
    `
  });
  await sleep(800);

  // Take screenshot 3: Gallery Scrolled
  const shotScrolled = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/prod-library-scrolled.png', Buffer.from(shotScrolled.data, 'base64'));
  console.log('Saved scripts/prod-library-scrolled.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
