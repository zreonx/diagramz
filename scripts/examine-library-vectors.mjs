import fs from 'fs';
import path from 'path';

const raw = JSON.parse(fs.readFileSync('apps/web/src/lib/official-libraries-data.json', 'utf8'));

console.log('--- ALL 55 ITEMS WITH EXACT BOUNDS ---');
raw.forEach((item, idx) => {
  const els = item.elements || [];
  const minX = Math.min(...els.map(e => e.x));
  const minY = Math.min(...els.map(e => e.y));
  const maxX = Math.max(...els.map(e => e.x + e.width));
  const maxY = Math.max(...els.map(e => e.y + e.height));
  const w = Math.round(maxX - minX);
  const h = Math.round(maxY - minY);
  console.log(`[${idx}] ${item.id} | ${item.name} | ${w}x${h} | ${els.length} elements`);
});
