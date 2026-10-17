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
const debuggingPort = 9377;
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1440,900',
  '--no-sandbox',
  '--disable-gpu',
  '--user-data-dir=C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-badges-3'
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await sleep(1500);

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
    }
  };

  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await sleep(1000);

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
      localStorage.setItem('diagramz_theme', 'dark');
      document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
    `,
  });

  // Navigate to dashboard and click first diagram
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
  await sleep(2500);

  await send('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
      if (row) row.click();
    `,
  });
  await sleep(3500);

  // Switch view to 'Canvas' only for maximum canvas visibility
  await send('Runtime.evaluate', {
    expression: `
      const canvasBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Canvas');
      if (canvasBtn) canvasBtn.click();
    `
  });
  await sleep(1000);

  // Open Component Library
  const openLib = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Components') || b.querySelector('svg.lucide-boxes'));
        if (btn) {
          btn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Open library:', openLib.result.value);
  await sleep(1500);

  // Click VPC Container tile in Standard Shapes
  const placeVpc = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const spans = Array.from(document.querySelectorAll('span, p, div'));
        const vpcTile = spans.find(el => el.textContent === 'VPC Container' || el.textContent === 'Container');
        const clickTarget = vpcTile?.closest('.cursor-grab') || vpcTile?.closest('button') || vpcTile;
        if (clickTarget) {
          clickTarget.click();
          return { placedVpc: true };
        }
        return { placedVpc: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Place VPC:', placeVpc.result.value);
  await sleep(1000);

  // Click Service / Microservice tile
  const placeService = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const spans = Array.from(document.querySelectorAll('span, p, div'));
        const srvTile = spans.find(el => el.textContent === 'Microservice' || el.textContent === 'Database Table');
        const clickTarget = srvTile?.closest('.cursor-grab') || srvTile?.closest('button') || srvTile;
        if (clickTarget) {
          clickTarget.click();
          return { placedService: true };
        }
        return { placedService: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Place Service:', placeService.result.value);
  await sleep(1000);

  // Close library drawer
  await send('Runtime.evaluate', {
    expression: `
      const closeBtn = document.querySelector('.w-80 button svg.lucide-x, .border-r button svg.lucide-x');
      if (closeBtn && closeBtn.closest('button')) closeBtn.closest('button').click();
    `
  });
  await sleep(1000);

  // Inspect the canvas nodes
  const canvasInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const vpcTitle = Array.from(document.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('Virtual Private Cloud'));
        const containerNode = vpcTitle?.closest('.group\\/node, [data-node-id]');
        const vpcBadge = containerNode?.querySelector('.rounded-full.bg-primary\\/10');

        return {
          hasVpcTitle: !!vpcTitle,
          vpcTitleText: vpcTitle?.textContent,
          hasBadge: !!vpcBadge,
          badgeText: vpcBadge?.textContent
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Canvas container state:', canvasInfo.result.value);

  // Click on the VPC container to select it and show Style Panel with optional Badge and Description
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const vpcTitle = Array.from(document.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('Virtual Private Cloud'));
        if (vpcTitle) {
          vpcTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          vpcTitle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      })()
    `
  });
  await sleep(1500);

  // In the Style Panel, set Description to '10.0.0.0/16 - Primary Region VPC'
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const descInput = document.querySelector('input[placeholder*="10.0.0.0/16"]');
        if (descInput) {
          descInput.focus();
          descInput.value = '10.0.0.0/16 · Primary Region Secure Isolation';
          descInput.dispatchEvent(new Event('input', { bubbles: true }));
          descInput.dispatchEvent(new Event('change', { bubbles: true }));
          return { updatedDescription: true };
        }
        return { updatedDescription: false };
      })()
    `,
    returnByValue: true
  });
  await sleep(1000);

  // Capture Screenshot 1: VPC Container with full clean title and description (no overflowing badge)
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const out1 = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-optional-badges-vpc-container.png';
  fs.writeFileSync(out1, Buffer.from(shot1.data, 'base64'));
  console.log(`Saved screenshot 1 to ${out1}`);

  chrome.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
