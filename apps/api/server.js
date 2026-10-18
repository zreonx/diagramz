// Root entrypoint for MonsterASP / IIS httpPlatformHandler
console.log(`[MonsterASP] Launching NestJS from server.js (Node ${process.version})...`);
console.log(`[MonsterASP] Assigned PORT: ${process.env.PORT}`);

process.on('uncaughtException', (err) => {
  console.error('[MonsterASP] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MonsterASP] Unhandled Rejection:', reason);
});

// Load compiled NestJS entrypoint
require('./dist/main.js');
