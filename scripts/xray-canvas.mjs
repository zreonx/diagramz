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
const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9233',
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-profile-xray',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await sleep(2000);
  const versionRes = await fetch('http://127.0.0.1:9233/json/list');
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

    const xray = await send('Runtime.evaluate', {
      expression: `(() => {
        const x = 1000, y = 500;
        const els = document.elementsFromPoint(x, y);
        const elDetails = els.map(el => {
          const style = window.getComputedStyle(el);
          return {
            tag: el.tagName,
            className: el.className,
            id: el.id,
            bg: style.backgroundColor,
            bgImage: style.backgroundImage,
            opacity: style.opacity,
            filter: style.filter,
            visibility: style.visibility,
            display: style.display,
            rect: { width: el.offsetWidth, height: el.offsetHeight },
          };
        });

        // Also check if any element has light grey color
        const allWithLightBg = Array.from(document.querySelectorAll('*')).filter(el => {
          const bg = window.getComputedStyle(el).backgroundColor;
          if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return false;
          const nums = bg.replace(/[^0-9,]/g, '').split(',').map(Number);
          if (nums.length >= 3) {
            const [r, g, b] = nums;
            return r > 180 && g > 180 && b > 180;
          }
          return false;
        }).map(el => ({
          tag: el.tagName,
          className: el.className,
          bg: window.getComputedStyle(el).backgroundColor,
        }));

        return {
          elementsAtPoint: elDetails,
          allWithLightBg
        };
      })()`,
      returnByValue: true
    });

    console.log('XRAY raw:\n', JSON.stringify(xray, null, 2));
  }

  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(console.error);
