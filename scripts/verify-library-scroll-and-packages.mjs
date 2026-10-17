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
const debuggingPort = 9260;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-lib-final'
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
      (() => {
        const btn = document.querySelector('.sidebar-trigger, [data-testid="library-button"], button[aria-label*="Library"]');
        if (btn) btn.click();
      })()
    `
  });
  await sleep(1500);

  // Inspect state of library
  const inspect1 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const sidebar = document.querySelector('.sidebar--right, .sidebar');
        const container = document.querySelector('.library-menu-items-container');
        const units = document.querySelectorAll('.library-unit');
        const browseBtn = document.querySelector('.library-menu-browse-button');
        const threeDotsBtn = document.querySelector('.sidebar .dropdown-menu-button');
        const controlButtons = document.querySelector('.library-menu-control-buttons');
        const winH = window.innerHeight;
        const cbRect = controlButtons?.getBoundingClientRect();

        return {
          windowHeight: winH,
          totalUnits: units.length,
          containerScrollHeight: container?.scrollHeight,
          containerClientHeight: container?.clientHeight,
          canScroll: container ? container.scrollHeight > container.clientHeight : false,
          hasBrowseBtn: !!browseBtn,
          browseHref: browseBtn?.getAttribute('href'),
          controlButtonsVisibleInViewport: cbRect ? (cbRect.bottom <= winH && cbRect.top >= 0) : false,
          hasThreeDotsBtn: !!threeDotsBtn
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Production Library Inspection:', JSON.stringify(inspect1.result.value, null, 2));

  const scrollCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const items = document.querySelector('.library-menu-items-container__items');
        const container = document.querySelector('.library-menu-items-container');
        return {
          itemsScrollHeight: items?.scrollHeight,
          itemsClientHeight: items?.clientHeight,
          itemsCanScroll: items ? items.scrollHeight > items.clientHeight : false,
          containerScrollHeight: container?.scrollHeight,
          containerClientHeight: container?.clientHeight
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Scroll Check:', JSON.stringify(scrollCheck.result.value, null, 2));

  // Now scroll the .library-menu-items-container__items!
  await send('Runtime.evaluate', {
    expression: `
      const items = document.querySelector('.library-menu-items-container__items');
      if (items) items.scrollTop = 250;
    `
  });
  await sleep(1000);

  const shotScrolled = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/items-scrolled-real.png', Buffer.from(shotScrolled.data, 'base64'));
  console.log('Saved scripts/items-scrolled-real.png');

  // Scroll down in container
  await send('Runtime.evaluate', {
    expression: `
      const container = document.querySelector('.library-menu-items-container');
      if (container) container.scrollTop = 260;
    `
  });
  await sleep(1000);

  // Take screenshot 2: Library scrolled down
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/library-final-scrolled.png', Buffer.from(shot2.data, 'base64'));
  console.log('Saved scripts/library-final-scrolled.png');

  // Scroll back to top
  await send('Runtime.evaluate', {
    expression: `
      const items = document.querySelector('.library-menu-items-container__items');
      if (items) items.scrollTop = 0;
    `
  });
  await sleep(600);

  // Click 3-dots button
  await send('Runtime.evaluate', {
    expression: `
      const btn = document.querySelector('.sidebar .dropdown-menu-button');
      if (btn) btn.click();
    `
  });
  await sleep(800);

  const menuDetails = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const menu = document.querySelector('.sidebar .dropdown-menu, .layer-ui__library .dropdown-menu, .dropdown-menu');
        const container = document.querySelector('.sidebar .dropdown-menu-container, .layer-ui__library .dropdown-menu-container');
        const items = Array.from(document.querySelectorAll('.dropdown-menu-item, .dropdown-menu-item-base')).map(item => ({
          text: item.innerText,
          html: item.outerHTML,
          className: item.className,
          computed: {
            display: window.getComputedStyle(item).display,
            flexDirection: window.getComputedStyle(item).flexDirection,
            width: window.getComputedStyle(item).width,
            height: window.getComputedStyle(item).height,
            padding: window.getComputedStyle(item).padding
          }
        }));
        return {
          menuFound: !!menu,
          menuHTML: menu?.outerHTML,
          menuComputed: menu ? {
            position: window.getComputedStyle(menu).position,
            top: window.getComputedStyle(menu).top,
            left: window.getComputedStyle(menu).left,
            right: window.getComputedStyle(menu).right,
            bottom: window.getComputedStyle(menu).bottom,
            display: window.getComputedStyle(menu).display,
            flexDirection: window.getComputedStyle(menu).flexDirection
          } : null,
          containerHTML: container?.outerHTML,
          containerComputed: container ? {
            display: window.getComputedStyle(container).display,
            flexDirection: window.getComputedStyle(container).flexDirection,
            width: window.getComputedStyle(container).width
          } : null,
          items
        };
      })()
    `,
    returnByValue: true
  });
  console.log('3-Dots Menu Inspection:', JSON.stringify(menuDetails.result.value, null, 2));

  // Take screenshot 3: Package actions dropdown open
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/library-final-package-menu.png', Buffer.from(shot3.data, 'base64'));
  console.log('Saved scripts/library-final-package-menu.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
