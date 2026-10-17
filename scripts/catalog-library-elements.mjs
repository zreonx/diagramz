import fs from 'fs';
import path from 'path';

const dir = 'apps/web/public/libraries';

function inspectLib(file) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const json = JSON.parse(raw);
  const items = Array.isArray(json) ? json : (json.libraryItems || json.library || []);
  return items.map((it, idx) => {
    const els = Array.isArray(it) ? it : (it.elements || []);
    const minX = Math.min(...els.map(e => e.x));
    const minY = Math.min(...els.map(e => e.y));
    const maxX = Math.max(...els.map(e => e.x + e.width));
    const maxY = Math.max(...els.map(e => e.y + e.height));
    const text = els.filter(e => e.type === 'text').map(e => e.text).join(' ');
    return {
      idx,
      text,
      count: els.length,
      w: Math.round(maxX - minX),
      h: Math.round(maxY - minY),
      types: els.map(e => e.type)
    };
  });
}

console.log('Youri Tjang:', JSON.stringify(inspectLib('software-architecture.excalidrawlib'), null, 2));
console.log('Anna Pastushko:', JSON.stringify(inspectLib('architecture-diagram-components.excalidrawlib'), null, 2));
console.log('drwnio:', JSON.stringify(inspectLib('drwnio.excalidrawlib'), null, 2));
console.log('cloud:', JSON.stringify(inspectLib('cloud.excalidrawlib'), null, 2));
