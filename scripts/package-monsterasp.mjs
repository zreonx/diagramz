import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const bundleDir = path.join(rootDir, 'deploy', 'monsterasp', 'bundle');
const apiDir = path.join(rootDir, 'apps', 'api');

console.log('🚀 Preparing MonsterASP deployment bundle...');

// 1. Ensure fresh compilation of shared library and api
console.log('📦 Step 1: Building shared and api packages...');
execSync('pnpm --filter @diagramz/shared build', { stdio: 'inherit' });
execSync('pnpm --filter @diagramz/api build', { stdio: 'inherit' });

// 2. Clean bundle directory
if (fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

// 3. Compile entire NestJS app + dependencies into a standalone bundle via @vercel/ncc
// This avoids transferring 20,000+ files in node_modules over FTPS, reducing upload from 2 hours to 10 seconds.
console.log('📦 Step 2: Bundling complete application via @vercel/ncc...');
execSync(`pnpm exec ncc build "${path.join(apiDir, 'dist', 'main.js')}" -o "${bundleDir}" --minify`, { stdio: 'inherit' });

// 4. Copy IIS web.config and server.js wrapper
console.log('⚙️ Step 3: Copying IIS web.config and server.js...');
fs.copyFileSync(path.join(apiDir, 'web.config'), path.join(bundleDir, 'web.config'));
fs.copyFileSync(path.join(apiDir, 'server.js'), path.join(bundleDir, 'server.js'));

// 5. Ensure logs directory exists for httpPlatformHandler stdout logging
const logsDir = path.join(bundleDir, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
fs.writeFileSync(path.join(logsDir, 'readme.txt'), 'MonsterASP httpPlatformHandler stdout logs go here\n', 'utf8');

// 6. Copy example env if needed
if (fs.existsSync(path.join(apiDir, '.env.example'))) {
  fs.copyFileSync(
    path.join(apiDir, '.env.example'),
    path.join(bundleDir, '.env.example')
  );
}

console.log('✅ MonsterASP bundle ready at:', bundleDir);
