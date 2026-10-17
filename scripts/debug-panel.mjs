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
const debuggingPort = 9315;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1680,1050',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-debug-panel'
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  try {
    await sleep(3000);
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
    await sleep(1500);

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
        localStorage.setItem('diagramz_theme', 'light');
        document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
    await sleep(3000);

    await send('Runtime.evaluate', {
      expression: `
        const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
        if (row) row.click();
      `
    });
    await sleep(3500);

    const infoRes = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('[data-node-id]'));
          const target = cards.find(c => c.textContent && c.textContent.includes('API Gateway')) || cards[0];
          return {
            totalCards: cards.length,
            targetCard: target ? {
              id: target.getAttribute('data-node-id'),
              left: target.getBoundingClientRect().left,
              top: target.getBoundingClientRect().top,
              width: target.getBoundingClientRect().width,
              height: target.getBoundingClientRect().height
            } : null
          };
        })()
      `
    });
    const info = infoRes.result?.value;
    console.log('Canvas state:', info);

    if (info?.targetCard) {
      const r = info.targetCard;
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      console.log('Clicking on targetCard at:', x, y);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(100);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await sleep(1500);

      const panelRes = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `
          (() => {
            const panel = document.querySelector('[role="group"]');
            return {
              hasPanel: !!panel,
              ariaLabel: panel ? panel.getAttribute('aria-label') : null,
              innerText: panel ? panel.innerText : null
            };
          })()
        `
      });
      console.log('Panel info:', panelRes.result?.value);

      const scr = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-component-style-panel.png', Buffer.from(scr.data, 'base64'));
      console.log('Saved screenshot to verified-component-style-panel.png');
    }

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    chrome.kill();
  }
}

run();
