import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
const debuggingPort = 9326;
const userDataDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-ai-arch2';

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debuggingPort}`,
  '--window-size=1680,1050',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${userDataDir}`
]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const artifactDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f';

async function run() {
  try {
    await sleep(2500);

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
    await send('DOM.enable');

    console.log('1. Setting auth credentials and navigating...');
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2000);

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('diagramz_access_token', ${JSON.stringify(token)});
        localStorage.setItem('diagramz_theme', 'dark');
        document.cookie = 'diagramz_access_token=${token}; path=/; max-age=86400';
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
    await sleep(3500);

    console.log('Opening diagram from dashboard...');
    await send('Runtime.evaluate', {
      expression: `
        const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
        if (row) row.click();
      `
    });
    await sleep(4000);

    console.log('Opening AI Assistant drawer...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const aiBtn = btns.find(b => b.textContent && b.textContent.includes('AI') || b.querySelector('svg.lucide-sparkles'));
          if (aiBtn) aiBtn.click();
        })()
      `
    });
    await sleep(2000);

    // Capture initial AI Assistant state with markdown greeting
    const ss1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-assistant-greeting.png'), Buffer.from(ss1.data, 'base64'));
    console.log('Saved verified-ai-assistant-greeting.png');

    // Click quick prompt or submit prompt
    console.log('Triggering AI Architect prompt...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const quickBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('AWS Serverless'));
          if (quickBtn) {
            quickBtn.click();
            setTimeout(() => {
              const form = document.querySelector('form');
              if (form) {
                const sub = form.querySelector('button[type="submit"]');
                if (sub) sub.click();
              }
            }, 300);
          } else {
            const input = document.querySelector('input[placeholder*="Ask AI"]');
            if (input) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeInputValueSetter.call(input, 'High availability AWS architecture with API Gateway, Lambda, and PostgreSQL');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              const form = input.closest('form');
              if (form) form.querySelector('button[type="submit"]')?.click();
            }
          }
        })()
      `
    });

    console.log('Waiting for AI generation response and markdown rendering...');
    let generated = false;
    for (let i = 0; i < 60; i++) {
      await sleep(1500);
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const isLoading = !!document.querySelector('.lucide-loader-2') || !!document.querySelector('form button svg.animate-spin');
            const proseList = Array.from(document.querySelectorAll('.prose'));
            const insertBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Insert Architecture to Canvas'));
            return {
              isLoading,
              proseCount: proseList.length,
              hasInsertBtn: !!insertBtn,
            };
          })()
        `,
        returnByValue: true
      });
      const val = evalRes.result?.value;
      console.log(`Poll ${i + 1}:`, val);
      if (val && !val.isLoading && val.proseCount >= 2) {
        console.log('AI response fully received and rendered!', val);
        generated = true;
        break;
      }
    }

    await sleep(2000);

    // Capture screenshot of Markdown rendering, badges, and Native Architecture Card
    const ss2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-markdown-and-architecture-card.png'), Buffer.from(ss2.data, 'base64'));
    console.log('Saved verified-ai-markdown-and-architecture-card.png');

    // Expand Mermaid accordion to verify optional mermaid view
    console.log('Toggling optional Mermaid accordion...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const mermaidToggle = btns.find(b => b.textContent && b.textContent.includes('Mermaid Definition'));
          if (mermaidToggle) mermaidToggle.click();
        })()
      `
    });
    await sleep(1000);

    const ssMermaid = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-mermaid-optional-view.png'), Buffer.from(ssMermaid.data, 'base64'));
    console.log('Saved verified-ai-mermaid-optional-view.png');

    // Click "Insert Architecture to Canvas"
    console.log('Inserting architecture directly to canvas...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const insertBtn = btns.find(b => b.textContent && b.textContent.includes('Insert Architecture to Canvas'));
          if (insertBtn) insertBtn.click();
        })()
      `
    });
    await sleep(2500);

    const ss3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-architecture-inserted-on-canvas.png'), Buffer.from(ss3.data, 'base64'));
    console.log('Saved verified-ai-architecture-inserted-on-canvas.png');

    // Close AI drawer and fit to content
    console.log('Closing AI drawer to inspect full canvas...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const aiBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('AI Architect'));
          if (aiBtn) aiBtn.click();
        })()
      `
    });
    await sleep(1500);

    // Zoom to fit or pan right to show inserted nodes
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Trigger keyboard Shift+1 for zoom to fit if available, or simulate mouse drag
          window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', shiftKey: true, bubbles: true }));
        })()
      `
    });
    await sleep(1000);

    const ssFullCanvas = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-full-canvas-view.png'), Buffer.from(ssFullCanvas.data, 'base64'));
    console.log('Saved verified-ai-full-canvas-view.png');

    console.log('All verifications finished!');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try {
      chrome.kill();
    } catch {}
  }
}

run();
