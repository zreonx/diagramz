import fs from 'fs';

const f = 'apps/web/public/excalidraw-assets/vendor-677e88ca78c86bddf13d.js';
const code = fs.readFileSync(f, 'utf8');
const idx = code.indexOf(',T=(t,e)=>{');
if (idx === -1) {
  const idx2 = code.indexOf('T=(t,e)=>{');
  console.log('Index T2:', idx2);
  console.log(code.slice(idx2, idx2 + 2000));
} else {
  console.log('Index T:', idx);
  console.log(code.slice(idx, idx + 2000));
}
