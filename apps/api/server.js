// Root entrypoint for MonsterASP / IIS httpPlatformHandler
console.log(`[MonsterASP] Launching NestJS from server.js (Node ${process.version})...`);
console.log(`[MonsterASP] Assigned PORT: ${process.env.PORT}`);

process.on('uncaughtException', (err) => {
  console.error('[MonsterASP] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MonsterASP] Unhandled Rejection:', reason);
});

// Load bundled NestJS entrypoint (or fallback to dist/main.js)
const fs = require('fs');
const path = require('path');
if (fs.existsSync(path.join(__dirname, 'index.js'))) {
  require('./index.js');
} else {
  require('./dist/main.js');
}
