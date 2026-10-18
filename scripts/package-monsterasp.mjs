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

// 3. Deploy isolated production bundle with full dependency closure (including transitive deps like tslib)
console.log('📦 Step 2: Deploying production bundle via pnpm deploy...');
execSync(`pnpm --filter @diagramz/api deploy --prod "${bundleDir}"`, { stdio: 'inherit' });

// 4. Copy IIS web.config
console.log('⚙️ Step 3: Copying IIS web.config...');
fs.copyFileSync(path.join(apiDir, 'web.config'), path.join(bundleDir, 'web.config'));

// 5. Clean unnecessary source/config files to reduce FTPS payload
console.log('🧹 Step 4: Pruning development/source files from bundle...');
const pruneList = [
  path.join(bundleDir, 'src'),
  path.join(bundleDir, '.turbo'),
  path.join(bundleDir, 'Dockerfile'),
  path.join(bundleDir, 'drizzle.config.ts'),
  path.join(bundleDir, 'nest-cli.json'),
  path.join(bundleDir, 'tsconfig.json'),
  path.join(bundleDir, 'node_modules', '@diagramz', 'shared', 'src'),
  path.join(bundleDir, 'node_modules', '@diagramz', 'shared', '.turbo'),
];

for (const target of pruneList) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

// 6. Copy example env if needed
if (fs.existsSync(path.join(apiDir, '.env.example'))) {
  fs.copyFileSync(
    path.join(apiDir, '.env.example'),
    path.join(bundleDir, '.env.example')
  );
}

console.log('✅ MonsterASP bundle ready at:', bundleDir);
