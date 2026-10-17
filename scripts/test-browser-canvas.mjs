import { spawn } from 'child_process';
import crypto from 'crypto';

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
const debuggingPort = 9222;

console.log('[Test Suite] Launching headless Chrome on port', debuggingPort);
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-profile',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await sleep(2000);

  const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
  const targets = await versionRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  if (!pageTarget) {
    throw new Error('No page target found');
  }

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

  const uncaughtErrors = [];

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve } = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
      return;
    }

    if (data.method === 'Runtime.exceptionThrown') {
      const desc = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text;
      uncaughtErrors.push(desc);
    }
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  await send('Runtime.enable');
  await send('Page.enable');

  const routesToTest = [
    { url: 'http://localhost:3000/login', auth: false, check: (text) => text.includes('Sign in') || text.includes('Email') },
    { url: 'http://localhost:3000/register', auth: false, check: (text) => text.includes('Create') || text.includes('Register') },
    { url: 'http://localhost:3000/dashboard', auth: true, check: (text) => text.includes('Overview') || text.includes('Workspaces') || text.includes('Diagrams') || text.includes('New Diagram') },
    { url: 'http://localhost:3000/dashboard/workspaces', auth: true, check: (text) => text.includes('Team & Members') || text.includes('Members') },
    { url: 'http://localhost:3000/dashboard/settings', auth: true, check: (text) => text.includes('Settings') || text.includes('Profile') },
    { url: 'http://localhost:3000/dashboard/settings/appearance', auth: true, check: (text) => text.includes('Appearance') || text.includes('Theme') },
    {
      url: 'http://localhost:3000/diagram/e980370b-fede-4ad8-85cc-cb06c2f12b70',
      auth: true,
      check: (text, extra) => !extra.hasLoadingForever && !extra.hasErrorBanner && extra.canvasElements >= 1,
    },
    {
      url: 'http://localhost:3000/share/662665dd1871fbdb4f99b424af89e7f5',
      auth: false,
      check: (text, extra) => !extra.hasLoadingForever && !extra.hasErrorBanner && (text.includes('Test') || text.includes('Architecture Overview')),
    },
  ];

  // Set auth token on base domain
  console.log('[Test Suite] Configuring auth session in browser...');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1500);
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});`,
  });

  let allPassed = true;

  for (const route of routesToTest) {
    uncaughtErrors.length = 0;
    console.log(`\n[Testing Route] ${route.url}...`);
    await send('Page.navigate', { url: route.url });
    await sleep(4000);

    const evalResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        return {
          textSnippet: text.substring(0, 150).replace(/\\n/g, ' '),
          hasErrorBanner: text.includes('Canvas Render Issue') || text.includes('Application error') || text.includes('Minified React error'),
          hasLoadingForever: text.includes('Loading scene…'),
          canvasElements: document.querySelectorAll('canvas').length,
          hasSidebar: !!document.querySelector('[data-sidebar]') || !!document.querySelector('aside'),
        };
      })()`,
      returnByValue: true,
    });

    const info = evalResult?.result?.value;
    const passed = route.check(info?.textSnippet || '', info) && uncaughtErrors.length === 0 && !info?.hasErrorBanner;

    if (passed) {
      console.log(`  ✓ PASSED: ${route.url}`);
      console.log(`    Snippet: ${info?.textSnippet.substring(0, 80)}...`);
      if (info?.canvasElements) console.log(`    Canvases: ${info.canvasElements}`);
    } else {
      console.error(`  ✗ FAILED: ${route.url}`);
      console.error('    Details:', info);
      if (uncaughtErrors.length > 0) {
        console.error('    Uncaught Exceptions:', uncaughtErrors);
      }
      allPassed = false;
    }
  }

  ws.close();
  chrome.kill();

  if (!allPassed) {
    console.error('\n[Test Suite] Some routes failed verification.');
    process.exit(1);
  }

  console.log('\n=============================================');
  console.log('ALL ROUTES PASSED VERIFICATION WITH 0 ERRORS!');
  console.log('=============================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('[Test Suite Error]', err);
  chrome.kill();
  process.exit(1);
});
