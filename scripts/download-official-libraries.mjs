import fs from 'fs';
import path from 'path';

const LIBRARIES = [
  {
    author: 'Youri Tjang',
    name: 'Software Architecture',
    url: 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/youritjang/software-architecture.excalidrawlib',
    file: 'software-architecture.excalidrawlib'
  },
  {
    author: 'Anna Pastushko',
    name: 'Architecture diagram components',
    url: 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/anna-pastushko/architecture-diagram-components.excalidrawlib',
    file: 'architecture-diagram-components.excalidrawlib'
  },
  {
    author: 'drwnio.polyrand.net',
    name: 'Software Logos',
    url: 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/drwnio/drwnio.excalidrawlib',
    file: 'drwnio.excalidrawlib'
  },
  {
    author: 'rfranzke',
    name: 'Cloud',
    url: 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/cloud/cloud.excalidrawlib',
    file: 'cloud.excalidrawlib'
  }
];

const outDir = path.resolve('apps/web/public/libraries');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function download() {
  for (const lib of LIBRARIES) {
    console.log(`Downloading ${lib.name} (@${lib.author})...`);
    const res = await fetch(lib.url);
    if (!res.ok) {
      console.error(`Failed to download ${lib.url}: ${res.statusText}`);
      continue;
    }
    const text = await res.text();
    const data = JSON.parse(text);
    const count = Array.isArray(data) ? data.length : (data.libraryItems || data.library || []).length;
    console.log(`Downloaded ${lib.name}: ${count} components found. Size: ${(text.length / 1024).toFixed(1)} KB`);
    fs.writeFileSync(path.join(outDir, lib.file), text, 'utf8');
  }
  console.log('All libraries downloaded to apps/web/public/libraries/');
}

download().catch(console.error);
