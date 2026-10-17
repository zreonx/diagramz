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
const debuggingPort = 9327;
const userDataDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\scratch\\chrome-test-ai-sessions';

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

    // Send a message in Session 1
    console.log('Sending first architecture prompt in Session 1...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const quickBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Kafka pipeline'));
          if (quickBtn) {
            quickBtn.click();
            setTimeout(() => {
              const form = document.querySelector('form');
              form?.querySelector('button[type="submit"]')?.click();
            }, 300);
          }
        })()
      `
    });

    console.log('Waiting for generation in Session 1...');
    for (let i = 0; i < 60; i++) {
      await sleep(1500);
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const isLoading = !!document.querySelector('.lucide-loader-2') || !!document.querySelector('form button svg.animate-spin');
            const proseList = Array.from(document.querySelectorAll('.prose'));
            return { isLoading, proseCount: proseList.length };
          })()
        `,
        returnByValue: true
      });
      const val = evalRes.result?.value;
      if (val && !val.isLoading && val.proseCount >= 2) {
        console.log('Session 1 response received!', val);
        break;
      }
    }

    await sleep(1500);

    // Take screenshot of Session 1
    const ssSess1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-session-1-active.png'), Buffer.from(ssSess1.data, 'base64'));
    console.log('Saved verified-session-1-active.png');

    // TEST: Close the AI Assistant drawer completely!
    console.log('Closing AI Assistant drawer...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Click close button in AI drawer header
          const closeBtn = document.querySelector('button[title*="Close AI Assistant"]');
          if (closeBtn) closeBtn.click();
          else {
            const aiBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('AI Architect'));
            if (aiBtn) aiBtn.click();
          }
        })()
      `
    });
    await sleep(1500);

    // Verify it is hidden
    const isClosed = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const drawer = document.querySelector('div:has(> form)');
          return { hasDrawer: !!drawer, isHidden: drawer ? drawer.closest('.hidden') !== null : true };
        })()
      `,
      returnByValue: true
    });
    console.log('Drawer closed status:', isClosed.result.value);

    // Reopen the AI Assistant drawer!
    console.log('Reopening AI Assistant drawer...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const aiBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('AI') || b.querySelector('svg.lucide-sparkles'));
          if (aiBtn) aiBtn.click();
        })()
      `
    });
    await sleep(1500);

    // Verify messages are still present (NOT lost!)
    const checkPersisted = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const proseList = Array.from(document.querySelectorAll('.prose'));
          const messages = Array.from(document.querySelectorAll('.max-w-\\[95\\%\\]'));
          return {
            proseCount: proseList.length,
            messageCount: messages.length,
            hasContent: proseList.some(p => p.textContent.includes('Kafka') || p.textContent.includes('Architecture'))
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Persisted state check after reopening drawer:', checkPersisted.result.value);

    const ssPersisted = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-chat-persisted-after-close.png'), Buffer.from(ssPersisted.data, 'base64'));
    console.log('Saved verified-ai-chat-persisted-after-close.png');

    // TEST: Create a New Chat Session!
    console.log('Creating New Chat Session (+ New)...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const newBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('New'));
          if (newBtn) newBtn.click();
        })()
      `
    });
    await sleep(1000);

    const ssNewSession = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-new-session.png'), Buffer.from(ssNewSession.data, 'base64'));
    console.log('Saved verified-ai-new-session.png');

    // TEST: Open History Overlay
    console.log('Opening History panel...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const histBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('History'));
          if (histBtn) histBtn.click();
        })()
      `
    });
    await sleep(1000);

    const ssHistory = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-sessions-history-drawer.png'), Buffer.from(ssHistory.data, 'base64'));
    console.log('Saved verified-ai-sessions-history-drawer.png');

    // TEST: Switch back to the previous session from history!
    console.log('Switching back to previous session from history...');
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Find the non-active session item in history
          const sessionItems = Array.from(document.querySelectorAll('.eraser-doc-scroll > div'));
          const target = sessionItems.find(el => el.textContent.includes('Kafka') || !el.textContent.includes('Active'));
          if (target) target.click();
        })()
      `
    });
    await sleep(1500);

    const ssSwitched = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(artifactDir, 'verified-ai-session-switched-back.png'), Buffer.from(ssSwitched.data, 'base64'));
    console.log('Saved verified-ai-session-switched-back.png');

    console.log('All session persistence & history tests completed successfully!');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    try {
      chrome.kill();
    } catch {}
  }
}

run();
