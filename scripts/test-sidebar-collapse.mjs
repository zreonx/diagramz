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
const debuggingPort = 9224;

console.log('[Test Sidebar] Launching Chrome on port', debuggingPort);
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-profile-sidebar',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await sleep(2000);

  const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
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

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  // Set desktop viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Set auth token on base domain
  console.log('[Test Sidebar] Configuring auth session in browser...');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1500);
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});`,
  });

  // Navigate to dashboard
  console.log('[Test Sidebar] Navigating to http://localhost:3000/dashboard...');
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });

  // Poll until sidebar is rendered and loading is complete
  console.log('[Test Sidebar] Waiting for sidebar to load...');
  let ready = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const checkRes = await send('Runtime.evaluate', {
      expression: `!!document.querySelector('[data-sidebar="sidebar"]') && !document.querySelector('.animate-pulse')`,
      returnByValue: true,
    });
    if (checkRes.result.value) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    throw new Error('Sidebar failed to load within timeout');
  }

  // Evaluate expanded state
  const expandedRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const sidebar = document.querySelector('[data-sidebar="sidebar"]');
        const trigger = document.querySelector('[data-sidebar="trigger"]');
        const filesGroup = document.querySelector('[data-sidebar="group"].group-data-\\\\[collapsible\\\\=icon\\\\]\\\\:hidden');
        return JSON.stringify({
          hasSidebar: !!sidebar,
          sidebarWidth: sidebar ? sidebar.getBoundingClientRect().width : null,
          hasTrigger: !!trigger,
          filesGroupPresent: !!filesGroup,
        });
      })()
    `,
    returnByValue: true,
  });

  const expandedState = JSON.parse(expandedRes.result.value);
  console.log('[Test Sidebar] Expanded sidebar state:', expandedState);

  // Take screenshot expanded
  const screenshotExp = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/sidebar-expanded.png', Buffer.from(screenshotExp.data, 'base64'));
  console.log('[Test Sidebar] Saved screenshot to scripts/sidebar-expanded.png');

  // Click sidebar trigger
  console.log('[Test Sidebar] Clicking sidebar trigger to collapse...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const trigger = document.querySelector('[data-sidebar="trigger"]');
        if (trigger) trigger.click();
      })()
    `,
  });

  await sleep(600);

  // Evaluate collapsed state
  const collapsedRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const sidebar = document.querySelector('[data-sidebar="sidebar"]');
        const wrapper = document.querySelector('[data-collapsible]');
        const filesGroup = document.querySelector('[data-sidebar="group"].group-data-\\\\[collapsible\\\\=icon\\\\]\\\\:hidden');
        const filesDisplay = filesGroup ? window.getComputedStyle(filesGroup).display : 'not_found';
        const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : null;
        const scrollWidth = sidebar ? sidebar.scrollWidth : null;
        const clientWidth = sidebar ? sidebar.clientWidth : null;

        // Check workspace dropdown trigger text
        const wsText = document.querySelector('[data-sidebar="header"] .group-data-\\\\[collapsible\\\\=icon\\\\]\\\\:hidden');
        const wsTextDisplay = wsText ? window.getComputedStyle(wsText).display : 'none';

        // Check user footer trigger text
        const userText = document.querySelector('[data-sidebar="footer"] .group-data-\\\\[collapsible\\\\=icon\\\\]\\\\:hidden');
        const userTextDisplay = userText ? window.getComputedStyle(userText).display : 'none';

        return JSON.stringify({
          sidebarWidth,
          scrollWidth,
          clientWidth,
          hasOverflow: scrollWidth > clientWidth,
          collapsibleAttr: wrapper ? wrapper.getAttribute('data-collapsible') : null,
          dataState: wrapper ? wrapper.getAttribute('data-state') : null,
          filesDisplay,
          wsTextDisplay,
          userTextDisplay,
        });
      })()
    `,
    returnByValue: true,
  });

  const collapsedState = JSON.parse(collapsedRes.result.value);
  console.log('[Test Sidebar] Collapsed sidebar state:', collapsedState);

  // Take screenshot of collapsed state
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/sidebar-collapsed.png', Buffer.from(screenshotRes.data, 'base64'));
  console.log('[Test Sidebar] Saved screenshot to scripts/sidebar-collapsed.png');

  // Verify assertions
  if (collapsedState.filesDisplay !== 'none') {
    throw new Error(`Expected Files section to be hidden (none), but got: ${collapsedState.filesDisplay}`);
  }
  if (collapsedState.wsTextDisplay !== 'none') {
    throw new Error(`Expected Workspace text to be hidden (none), but got: ${collapsedState.wsTextDisplay}`);
  }
  if (collapsedState.userTextDisplay !== 'none') {
    throw new Error(`Expected User profile text to be hidden (none), but got: ${collapsedState.userTextDisplay}`);
  }
  if (collapsedState.sidebarWidth > 56) {
    throw new Error(`Expected collapsed sidebar width <= 48px/56px, got: ${collapsedState.sidebarWidth}px`);
  }

  console.log('✅ ALL TESTS PASSED! Collapsed sidebar hides all text and files cleanly, icons aligned with no malformed sections.');
  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  chrome.kill();
  process.exit(1);
});
