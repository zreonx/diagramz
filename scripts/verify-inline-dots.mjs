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
const debuggingPort = 9245;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-verify-inline'
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
  await sleep(800);

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
  await sleep(1000);

  // 1. Inspect initial top state
  const topState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const dots = document.querySelector('.library-menu-dropdown-container') || document.querySelector('.library-menu-dropdown-container--in-heading');
        const personalH = Array.from(document.querySelectorAll('.library-menu-items-container__header')).find(el => el.textContent.includes('Personal'));
        const container = document.querySelector('.library-menu-items-container');
        
        const dotsRect = dots?.getBoundingClientRect();
        const hRect = personalH?.getBoundingClientRect();
        
        return {
          hasDots: !!dots,
          hasHeader: !!personalH,
          dotsParentClass: dots?.parentElement?.className,
          dotsPosition: dots ? window.getComputedStyle(dots).position : null,
          dotsTop: dotsRect?.top,
          dotsRight: dotsRect?.right,
          dotsCenterY: dotsRect ? dotsRect.top + dotsRect.height / 2 : null,
          headerTop: hRect?.top,
          headerCenterY: hRect ? hRect.top + hRect.height / 2 : null,
          yDiff: (dotsRect && hRect) ? Math.abs((dotsRect.top + dotsRect.height / 2) - (hRect.top + hRect.height / 2)) : null,
          isInsideHeader: personalH ? personalH.contains(dots) : false,
          headerHTML: personalH?.outerHTML
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Top state analysis:', JSON.stringify(topState.result.value, null, 2));

  // Screenshot top state
  const shotTop = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/inline-dots-top.png', Buffer.from(shotTop.data, 'base64'));
  console.log('Saved scripts/inline-dots-top.png');

  // 2. Click the 3-dots button to open menu
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.library-menu-dropdown-container > button, .library-menu-dropdown-container--in-heading > button');
        if (btn) btn.click();
      })()
    `
  });
  await sleep(600);

  const menuState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const menu = document.querySelector('.library-menu .dropdown-menu-container, .dropdown-menu.library-menu');
        const items = Array.from(document.querySelectorAll('.library-menu .dropdown-menu-item, .library-menu .dropdown-menu-item-base')).map(el => el.textContent.trim());
        const menuRect = menu?.getBoundingClientRect();
        return {
          menuFound: !!menu,
          items,
          menuRect: menuRect ? { top: menuRect.top, left: menuRect.left, width: menuRect.width, height: menuRect.height } : null
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Menu opened state:', JSON.stringify(menuState.result.value, null, 2));

  const shotMenu = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/inline-dots-menu.png', Buffer.from(shotMenu.data, 'base64'));
  console.log('Saved scripts/inline-dots-menu.png');

  // Close menu by clicking trigger again
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.library-menu-dropdown-container > button, .library-menu-dropdown-container--in-heading > button');
        if (btn) {
          btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
          btn.click();
        }
      })()
    `
  });
  await sleep(400);

  // 3. Scroll down 400px and check that dots moved with scroll and did NOT stay fixed
  const scrollState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const container = document.querySelector('.library-menu-items-container');
        if (container) {
          container.scrollTop = 450;
        }
        const dots = document.querySelector('.library-menu-dropdown-container') || document.querySelector('.library-menu-dropdown-container--in-heading');
        const personalH = Array.from(document.querySelectorAll('.library-menu-items-container__header')).find(el => el.textContent.includes('Personal'));
        
        const dotsRect = dots?.getBoundingClientRect();
        const hRect = personalH?.getBoundingClientRect();
        const containerRect = container?.getBoundingClientRect();
        
        return {
          containerScrollTop: container?.scrollTop,
          dotsTopAfterScroll: dotsRect?.top,
          headerTopAfterScroll: hRect?.top,
          isDotsVisibleInViewport: dotsRect && containerRect ? (dotsRect.top >= containerRect.top && dotsRect.bottom <= containerRect.bottom) : null
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Scroll state analysis:', JSON.stringify(scrollState.result.value, null, 2));

  const shotScrolled = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/inline-dots-scrolled.png', Buffer.from(shotScrolled.data, 'base64'));
  console.log('Saved scripts/inline-dots-scrolled.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
