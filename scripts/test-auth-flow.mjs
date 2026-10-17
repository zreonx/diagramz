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
const debuggingPort = 9255;
const userDataDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-auth';

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${userDataDir}`
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  await sleep(1500);

  const targetsRes = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data.result);
      callbacks.delete(data.id);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = idCounter++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('1. Testing Landing page when unauthenticated...');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(2000);

  const evalUnauth = await send('Runtime.evaluate', {
    expression: 'document.body.innerText',
    returnByValue: true
  });
  console.log('Has "Sign In" button:', evalUnauth.result?.value?.includes('Sign In'));
  console.log('Has "Get Started" button:', evalUnauth.result?.value?.includes('Get Started'));

  const unauthShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/auth-unauth-landing.png', Buffer.from(unauthShot.data, 'base64'));

  console.log('\n2. Injecting valid auth session into localStorage...');
  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', '${token}');
      localStorage.setItem('diagramz_active_workspace', 'e261efef-44d3-4b3d-bd8f-f224e01c94ff');
    `
  });

  console.log('\n3. Testing Landing page when authenticated...');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(2000);

  const evalAuth = await send('Runtime.evaluate', {
    expression: 'document.body.innerText',
    returnByValue: true
  });
  console.log('Has "Go to Dashboard" button:', evalAuth.result?.value?.includes('Go to Dashboard'));
  console.log('Has user name/email in nav:', evalAuth.result?.value?.includes('Zorenl') || evalAuth.result?.value?.includes('zrodayrit@gmail.com'));

  const authedShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scripts/auth-authed-landing.png', Buffer.from(authedShot.data, 'base64'));

  console.log('\n4. Testing navigating to /login while authenticated...');
  await send('Page.navigate', { url: 'http://localhost:3000/login' });
  await sleep(2000);

  const urlAfterLogin = await send('Runtime.evaluate', {
    expression: 'window.location.pathname',
    returnByValue: true
  });
  console.log('Pathname after visiting /login while authed:', urlAfterLogin.result?.value);

  console.log('\n5. Testing navigating to /register while authenticated...');
  await send('Page.navigate', { url: 'http://localhost:3000/register' });
  await sleep(2000);

  const urlAfterRegister = await send('Runtime.evaluate', {
    expression: 'window.location.pathname',
    returnByValue: true
  });
  console.log('Pathname after visiting /register while authed:', urlAfterRegister.result?.value);

  ws.close();
  chrome.kill();
  console.log('\nAll tests completed successfully!');
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
});
