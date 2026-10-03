const fs = require('fs');
const path = require('path');

function patchFile(filePath, searchStr, replaceStr) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-excalidraw] Patched: ${filePath}`);
    return true;
  }
  return false;
}

function findExcalidrawDirs(rootDir) {
  const dirs = [];
  function walk(current) {
    if (!fs.existsSync(current)) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(current, entry.name);
          if (entry.name === '@excalidraw') {
            const excalPath = path.join(fullPath, 'excalidraw');
            if (fs.existsSync(excalPath)) {
              dirs.push(excalPath);
            }
          } else if (entry.name !== '.git' && entry.name !== '.next' && entry.name !== 'dist') {
            walk(fullPath);
          }
        }
      }
    } catch {}
  }
  walk(rootDir);
  return dirs;
}

const excalidrawDirs = findExcalidrawDirs(path.resolve(__dirname, '..'));

console.log(`[patch-excalidraw] Found ${excalidrawDirs.length} Excalidraw installation(s).`);

for (const dir of excalidrawDirs) {
  // 1. Patch ReactCurrentOwner in dist/excalidraw.production.min.js
  const prodBundle = path.join(dir, 'dist', 'excalidraw.production.min.js');
  patchFile(
    prodBundle,
    'r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner',
    '(r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED||r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE||{}).ReactCurrentOwner||{current:null}'
  );

  // 2. Patch process.env in main.js
  const mainJs = path.join(dir, 'main.js');
  patchFile(
    mainJs,
    'if (process.env.IS_PREACT === "true")',
    'if (typeof process !== "undefined" && process.env && process.env.IS_PREACT === "true")'
  );
}

console.log('[patch-excalidraw] Excalidraw patch process complete.');
