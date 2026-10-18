import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const bundleDir = path.join(rootDir, 'deploy', 'monsterasp', 'bundle');
const apiDir = path.join(rootDir, 'apps', 'api');
const sharedDir = path.join(rootDir, 'packages', 'shared');

console.log('🚀 Preparing MonsterASP deployment bundle...');

// 1. Ensure build is fresh
console.log('📦 Step 1: Building shared and api packages...');
execSync('pnpm --filter @diagramz/shared build', { stdio: 'inherit' });
execSync('pnpm --filter @diagramz/api build', { stdio: 'inherit' });

// 2. Clean bundle directory
if (fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

// 3. Copy dist/
console.log('📁 Step 2: Copying compiled NestJS output (dist/)...');
fs.cpSync(path.join(apiDir, 'dist'), path.join(bundleDir, 'dist'), { recursive: true });

// 4. Copy web.config
console.log('⚙️ Step 3: Copying IIS web.config...');
fs.copyFileSync(path.join(apiDir, 'web.config'), path.join(bundleDir, 'web.config'));

// 5. Prepare production package.json
console.log('📄 Step 4: Generating production package.json...');
const apiPkg = JSON.parse(fs.readFileSync(path.join(apiDir, 'package.json'), 'utf8'));

// Delete devDependencies and modify scripts for production
const prodPkg = {
  name: apiPkg.name,
  version: apiPkg.version,
  private: true,
  scripts: {
    start: 'node dist/main.js',
  },
  dependencies: { ...apiPkg.dependencies },
};
// Replace workspace:* with local file or installable reference
delete prodPkg.dependencies['@diagramz/shared'];

fs.writeFileSync(
  path.join(bundleDir, 'package.json'),
  JSON.stringify(prodPkg, null, 2),
  'utf8'
);

// 6. Copy production node_modules
console.log('📦 Step 5: Copying production node_modules...');
const bundleNodeModules = path.join(bundleDir, 'node_modules');
fs.mkdirSync(bundleNodeModules, { recursive: true });

// Read dependencies from package.json and copy them
const apiNodeModules = path.join(apiDir, 'node_modules');
for (const dep of Object.keys(prodPkg.dependencies)) {
  const depSource = path.join(apiNodeModules, dep);
  const depDest = path.join(bundleNodeModules, dep);

  if (fs.existsSync(depSource)) {
    // If it's a scoped package (e.g. @nestjs/common), ensure parent directory exists
    const parentDir = path.dirname(depDest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    // Copy resolving symlinks into real files/folders
    fs.cpSync(depSource, depDest, { recursive: true, dereference: true });
  }
}

// 7. Inject @diagramz/shared into bundle node_modules
console.log('🔗 Step 6: Injecting @diagramz/shared into bundle node_modules...');
const sharedDest = path.join(bundleNodeModules, '@diagramz', 'shared');
fs.mkdirSync(sharedDest, { recursive: true });
fs.cpSync(path.join(sharedDir, 'dist'), path.join(sharedDest, 'dist'), { recursive: true });
fs.copyFileSync(path.join(sharedDir, 'package.json'), path.join(sharedDest, 'package.json'));

// 8. Copy example env if needed
if (fs.existsSync(path.join(apiDir, '.env.example'))) {
  fs.copyFileSync(
    path.join(apiDir, '.env.example'),
    path.join(bundleDir, '.env.example')
  );
}

console.log('✅ MonsterASP bundle ready at:', bundleDir);
