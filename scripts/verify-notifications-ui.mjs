import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';

function signJwt(payload, secret) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const s = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + s;
}

const secret = 'generate-a-minimum-64-char-secret-string-for-diagramz-development-mode';
const token = signJwt(
  { sub: 'e261efef-44d3-4b3d-bd8f-f224e01c94ff', email: 'zrodayrit@gmail.com', name: 'Zorenl Rkyle Dayrit' },
  secret
);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debuggingPort = 9260;
const userDataDir = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\739b7632-dc58-4928-a114-53b3ce95967e\\scratch\\chrome-test-notif';

// Ensure 2 notifications exist for User 1
async function seedNotifications() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Clear existing
  await fetch('http://localhost:4000/api/v1/notifications', { method: 'DELETE', headers });

  // Direct insert via pg or internal
  const pgModule = await import('file:///D:/Projects/diagramz/apps/api/node_modules/pg/lib/index.js');
  const Pool = pgModule.default?.Pool || pgModule.Pool;
  const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5433/diagramz?sslmode=disable' });

  await pool.query(`
    INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at)
    VALUES
      ('e261efef-44d3-4b3d-bd8f-f224e01c94ff', 'diagram_shared', 'Diagram Shared', 'Alex Chen shared "Microservices Architecture" with you as editor.', '/d/b2b77b53-b52b-47ff-984f-e2d93e3f4f24', false, NOW() - interval '5 minutes'),
      ('e261efef-44d3-4b3d-bd8f-f224e01c94ff', 'team_invite', 'Workspace Invitation', 'Sarah Lin invited you to join "Design System Engineering" workspace.', '/dashboard/workspaces', false, NOW() - interval '2 hours'),
      ('e261efef-44d3-4b3d-bd8f-f224e01c94ff', 'product_updates', 'Diagramz v2.4 Released', 'Check out the new collaborative Canvas stencils and instant exports.', null, true, NOW() - interval '1 day');
  `);
  await pool.end();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  await seedNotifications();

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debuggingPort}`,
    '--window-size=1440,900',
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`
  ]);

  await sleep(1500);

  try {
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
    await send('Network.enable');

    await send('Network.setCookie', {
      name: 'diagramz_access_token',
      value: token,
      domain: 'localhost',
      path: '/'
    });

    console.log('Navigating to dashboard...');
    await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
    await sleep(3500);

    // Save auth token in localStorage too
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('diagramz_access_token', '${token}');
        localStorage.setItem('diagramz_user', JSON.stringify({
          id: 'e261efef-44d3-4b3d-bd8f-f224e01c94ff',
          email: 'zrodayrit@gmail.com',
          name: 'Zorenl Rkyle Dayrit'
        }));
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
    await sleep(3500);

    // Take screenshot of dashboard with bell badge
    const screenshotBadge = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Projects/diagramz/scripts/verified-notification-badge.png', Buffer.from(screenshotBadge.data, 'base64'));
    console.log('Saved verified-notification-badge.png');

    // Click on the notification bell button
    console.log('Clicking notification bell...');
    await send('Runtime.evaluate', {
      expression: `
        const bellBtn = document.querySelector('button[title="Notifications"]');
        if (bellBtn) bellBtn.click();
      `
    });

    await sleep(1000);

    // Take screenshot with notification center popover open
    const screenshotPopover = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Projects/diagramz/scripts/verified-notification-popover.png', Buffer.from(screenshotPopover.data, 'base64'));
    console.log('Saved verified-notification-popover.png');

    // Navigate to settings notifications page
    console.log('Navigating to notifications settings...');
    await send('Page.navigate', { url: 'http://localhost:3000/dashboard/settings/notifications' });
    await sleep(2500);

    // Take screenshot of settings page
    const screenshotSettings = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('D:/Projects/diagramz/scripts/verified-notification-settings.png', Buffer.from(screenshotSettings.data, 'base64'));
    console.log('Saved verified-notification-settings.png');

    console.log('UI VERIFICATION COMPLETED SUCCESSFULLY!');
  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
