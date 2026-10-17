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
const debuggingPort = 9265;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-layout'
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
  await sleep(1000);

  // Inject improved CSS
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const style = document.createElement('style');
        style.id = 'modern-gallery-fix';
        style.innerHTML = \`
          /* Right Sidebar Drawer Width & Layout */
          .excalidraw .sidebar,
          .excalidraw .sidebar--right,
          .excalidraw .sidebar.default-sidebar {
            width: 360px !important;
            max-width: 90vw !important;
          }

          /* 3-dots trigger button specifically (NOT dropdown menu items!) */
          .excalidraw .library-menu-dropdown-container > button,
          .excalidraw .library-menu-dropdown-container--in-heading > button {
            height: 1.75rem !important;
            width: 1.75rem !important;
            min-width: 1.75rem !important;
            border-radius: calc(var(--radius, 0.5rem) - 2px) !important;
            background-color: transparent !important;
            border: 1px solid transparent !important;
            color: hsl(var(--muted-foreground)) !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            padding: 0 !important;
            transition: all 150ms ease !important;
          }

          .excalidraw .library-menu-dropdown-container > button:hover,
          .excalidraw .library-menu-dropdown-container--in-heading > button:hover {
            background-color: hsl(var(--sidebar-accent)) !important;
            border-color: hsl(var(--sidebar-border)) !important;
            color: hsl(var(--sidebar-accent-foreground)) !important;
          }

          /* 3-dots Dropdown Menu Popover */
          .excalidraw .library-menu .dropdown-menu-container,
          .excalidraw .dropdown-menu.library-menu .dropdown-menu-container {
            display: flex !important;
            flex-direction: column !important;
            min-width: 11rem !important;
            width: max-content !important;
            padding: 4px !important;
            gap: 2px !important;
            background-color: hsl(var(--popover)) !important;
            color: hsl(var(--popover-foreground)) !important;
            border: 1px solid hsl(var(--border)) !important;
            border-radius: var(--radius, 0.5rem) !important;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3) !important;
          }

          /* Dropdown Menu Items inside Library Actions Menu */
          .excalidraw .library-menu .dropdown-menu-item,
          .excalidraw .library-menu .dropdown-menu-item-base {
            width: 100% !important;
            height: 2rem !important;
            min-height: 2rem !important;
            padding: 0 0.625rem !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 0.625rem !important;
            border-radius: calc(var(--radius, 0.5rem) - 2px) !important;
            font-size: 0.8125rem !important;
            font-weight: 500 !important;
            color: hsl(var(--popover-foreground)) !important;
            background: transparent !important;
            border: none !important;
            cursor: pointer !important;
            transition: all 120ms ease !important;
          }

          .excalidraw .library-menu .dropdown-menu-item:hover,
          .excalidraw .library-menu .dropdown-menu-item-base:hover {
            background-color: hsl(var(--accent)) !important;
            color: hsl(var(--accent-foreground)) !important;
          }

          .excalidraw .library-menu .dropdown-menu-item__icon {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 1rem !important;
            height: 1rem !important;
            flex-shrink: 0 !important;
            color: hsl(var(--muted-foreground)) !important;
          }

          .excalidraw .library-menu .dropdown-menu-item__text {
            font-family: inherit !important;
            font-size: 0.8125rem !important;
            display: inline-block !important;
            white-space: nowrap !important;
            color: inherit !important;
          }

          /* Library Header */
          .excalidraw .sidebar__header {
            padding: 0.875rem 1.25rem !important;
          }

          /* Content padding & spacing */
          .excalidraw .library-menu-items-container {
            padding: 0.75rem 1.25rem !important;
          }

          /* Personal Library Empty State: Clean & Compact */
          .excalidraw .library-menu-items__no-items {
            border: 1px dashed hsl(var(--sidebar-border)) !important;
            border-radius: var(--radius, 0.5rem) !important;
            padding: 0.75rem 1rem !important;
            background-color: hsl(var(--muted) / 0.15) !important;
            text-align: center !important;
            margin: 0.25rem 0 1rem 0 !important;
          }

          .excalidraw .library-menu-items__no-items__label {
            font-size: 0.75rem !important;
            font-weight: 500 !important;
            color: hsl(var(--muted-foreground)) !important;
          }

          .excalidraw .library-menu-items__no-items__hint {
            font-size: 0.6875rem !important;
            color: hsl(var(--muted-foreground) / 0.65) !important;
            margin-top: 2px !important;
          }

          /* Section Headers */
          .excalidraw .library-menu-items-container__header {
            font-size: 0.6875rem !important;
            font-weight: 600 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.06em !important;
            color: hsl(var(--muted-foreground)) !important;
            padding: 0.5rem 0 0.375rem 0 !important;
          }

          /* Library Gallery Grid: 3 Clean, Generous Columns */
          .excalidraw .library-menu-items-container__grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
            padding: 4px 0 20px 0 !important;
            width: 100% !important;
          }

          /* Gallery Unit Cards: Clean, High Quality, Modern SaaS Stencil Cards */
          .excalidraw .library-unit,
          .excalidraw .library-unit.library-unit__active {
            width: 100% !important;
            height: 82px !important;
            min-height: 82px !important;
            max-height: 82px !important;
            padding: 8px !important;
            border: 1px solid hsl(var(--sidebar-border)) !important;
            background-color: hsl(var(--card) / 0.7) !important;
            border-radius: var(--radius, 0.5rem) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1) !important;
            cursor: pointer !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
            box-sizing: border-box !important;
            position: relative !important;
          }

          .excalidraw .library-unit:hover,
          .excalidraw .library-unit.library-unit__active:hover {
            border-color: hsl(var(--ring)) !important;
            background-color: hsl(var(--sidebar-accent)) !important;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18) !important;
            transform: translateY(-2px) !important;
          }

          .excalidraw .library-unit--selected,
          .excalidraw .library-unit:active {
            border-color: hsl(var(--primary)) !important;
            background-color: hsl(var(--sidebar-accent)) !important;
            box-shadow: 0 0 0 1.5px hsl(var(--primary)) !important;
          }

          .excalidraw .library-unit__dragger {
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .excalidraw .library-unit__dragger svg {
            max-width: 95% !important;
            max-height: 95% !important;
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2)) !important;
          }

          /* Bottom Actions Dock */
          .excalidraw .library-menu-control-buttons,
          .excalidraw .library-menu-control-buttons--at-bottom {
            padding: 0.875rem 1.25rem !important;
          }
        \`;
        document.head.appendChild(style);
      })()
    `
  });
  await sleep(1000);

  // 1. Click 3 dots button immediately upon library open
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.sidebar .dropdown-menu-button');
        if (btn) {
          btn.click();
          return { clicked: true, className: btn.className, rect: btn.getBoundingClientRect() };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Click 3-dots result:', clickRes.result.value);
  await sleep(1000);

  const debugMenu = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const menu = document.querySelector('.dropdown-menu');
        const container = document.querySelector('.dropdown-menu-container');
        const items = Array.from(document.querySelectorAll('.dropdown-menu-item, .dropdown-menu-item-base'));
        return {
          menu: menu ? {
            className: menu.className,
            style: menu.getAttribute('style'),
            computed: {
              display: window.getComputedStyle(menu).display,
              position: window.getComputedStyle(menu).position,
              top: window.getComputedStyle(menu).top,
              left: window.getComputedStyle(menu).left,
              right: window.getComputedStyle(menu).right,
              bottom: window.getComputedStyle(menu).bottom,
              width: window.getComputedStyle(menu).width,
              height: window.getComputedStyle(menu).height
            }
          } : null,
          container: container ? {
            className: container.className,
            style: container.getAttribute('style'),
            computed: {
              display: window.getComputedStyle(container).display,
              flexDirection: window.getComputedStyle(container).flexDirection,
              width: window.getComputedStyle(container).width,
              height: window.getComputedStyle(container).height,
              padding: window.getComputedStyle(container).padding
            }
          } : null,
          items: items.map(it => ({
            text: it.innerText,
            computed: {
              display: window.getComputedStyle(it).display,
              flexDirection: window.getComputedStyle(it).flexDirection,
              width: window.getComputedStyle(it).width,
              height: window.getComputedStyle(it).height
            }
          }))
        };
      })()
    `,
    returnByValue: true
  });
  console.log('DEBUG MENU:', JSON.stringify(debugMenu.result.value, null, 2));

  // Take screenshot of opened menu
  const shotMenu = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/gallery-modern-menu.png', Buffer.from(shotMenu.data, 'base64'));
  console.log('Saved scripts/gallery-modern-menu.png');

  // Close menu by clicking button again
  await send('Runtime.evaluate', {
    expression: `
      const btn = document.querySelector('.sidebar .dropdown-menu-button');
      if (btn) btn.click();
    `
  });
  await sleep(600);

  // Take screenshot of gallery top
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/gallery-modern-top.png', Buffer.from(shot1.data, 'base64'));
  console.log('Saved scripts/gallery-modern-top.png');

  // Scroll down
  await send('Runtime.evaluate', {
    expression: `
      const items = document.querySelector('.library-menu-items-container__items');
      if (items) items.scrollTop = 250;
    `
  });
  await sleep(800);

  // Take screenshot of scrolled gallery
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/gallery-modern-scrolled.png', Buffer.from(shot2.data, 'base64'));
  console.log('Saved scripts/gallery-modern-scrolled.png');

  await send('Browser.close');
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
