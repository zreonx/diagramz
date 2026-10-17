import fs from 'fs';
import path from 'path';

const dir = 'apps/web/public/libraries';

const yt = JSON.parse(fs.readFileSync(path.join(dir, 'software-architecture.excalidrawlib'), 'utf8'));
const ap = JSON.parse(fs.readFileSync(path.join(dir, 'architecture-diagram-components.excalidrawlib'), 'utf8'));
const drw = JSON.parse(fs.readFileSync(path.join(dir, 'drwnio.excalidrawlib'), 'utf8'));
const cld = JSON.parse(fs.readFileSync(path.join(dir, 'cloud.excalidrawlib'), 'utf8'));

const ytRaw = Array.isArray(yt) ? yt : (yt.libraryItems || yt.library || []);
const apRaw = Array.isArray(ap) ? ap : (ap.libraryItems || ap.library || []);
const drwRaw = Array.isArray(drw) ? drw : (drw.libraryItems || drw.library || []);
const cldRaw = Array.isArray(cld) ? cld : (cld.libraryItems || cld.library || []);

// 1. Youri Tjang (@Youri Tjang) items
const ytNames = [
  'Event Bus / Pipeline',
  'Cache / In-Memory Store',
  'Microservice / Service Cluster',
  'Database / Storage Node',
  'Web Browser / Client',
  'Mobile Device / App',
  'Code / Documentation Spec'
];

// 2. Anna Pastushko (@Anna Pastushko) items
const apNames = [
  'Slack Integration',
  'Docker Container',
  'GitHub Repository',
  'VPC Cloud Boundary',
  'Private Subnet',
  'Public Subnet',
  'User / Actor',
  'Users / Team',
  'Client Device',
  'Server / Host Machine',
  'Email Notification'
];

// 3. drwnio (@drwnio.polyrand.net) items
const drwNames = [
  'Server / Host Node',
  'Database Node',
  'Docker Architecture',
  'JSON API / Payload',
  'Kubernetes Node',
  'Load Balancer',
  'PostgreSQL Logo',
  'Redis Logo',
  'Nginx Web Server',
  'RabbitMQ Event Queue',
  'Server Rack',
  'Microchip / CPU Node',
  'Reverse Proxy / Gateway',
  'Storage Archive',
  'Cloud Network Node',
  'Security Shield',
  'Service Mesh / Link',
  'DNS / Domain Gateway'
];

// 4. rfranzke (@rfranzke) items
const cldNames = [
  'Cloud Cluster Node',
  'Network Gateway',
  'Edge Router',
  'Gardener Shoot Cluster',
  'AWS (Amazon Web Services)',
  'Azure Cloud Node',
  'GCP (Google Cloud Platform)',
  'Kubernetes Worker Node',
  'Container Pod',
  'Cloud Storage Disk',
  'Load Balancer Service',
  'Network Ingress',
  'Virtual Machine Host',
  'Security Firewall',
  'Cloud Architecture Complex',
  'Service Route Connector',
  'Database Cluster',
  'Cloud API Endpoint',
  'Multi-Cloud Topology'
];

function normalizeElements(elements) {
  return elements.map(el => {
    const updated = { ...el };
    // Ensure fontFamily is clean Geist/Helvetica sans-serif
    if (updated.type === 'text') {
      updated.fontFamily = 2;
    }
    // Ensure any arrows inside library use modern "arrow" W style
    if (updated.type === 'arrow') {
      updated.endArrowhead = 'arrow';
      updated.strokeWidth = 1;
    }
    return updated;
  });
}

const allLibraryItems = [];

// Add Youri Tjang library
ytRaw.forEach((item, idx) => {
  const elements = Array.isArray(item) ? item : (item.elements || []);
  allLibraryItems.push({
    id: `lib_yt_${idx}`,
    status: 'published',
    created: 1609372800000,
    author: 'Youri Tjang',
    libraryName: 'Software Architecture',
    name: `[Software Architecture] ${ytNames[idx] || `Component #${idx + 1}`} (@Youri Tjang)`,
    shortKey: `yt_${idx}`,
    elements: normalizeElements(elements)
  });
});

// Add Anna Pastushko library
apRaw.forEach((item, idx) => {
  const elements = Array.isArray(item) ? item : (item.elements || []);
  allLibraryItems.push({
    id: `lib_ap_${idx}`,
    status: 'published',
    created: 1653523200000,
    author: 'Anna Pastushko',
    libraryName: 'Architecture diagram components',
    name: `[Architecture] ${apNames[idx] || `Component #${idx + 1}`} (@Anna Pastushko)`,
    shortKey: `ap_${apNames[idx].toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    elements: normalizeElements(elements)
  });
});

// Add drwnio library
drwRaw.forEach((item, idx) => {
  const elements = Array.isArray(item) ? item : (item.elements || []);
  allLibraryItems.push({
    id: `lib_drw_${idx}`,
    status: 'published',
    created: 1611532800000,
    author: 'drwnio.polyrand.net',
    libraryName: 'Software Logos',
    name: `[Software Logos] ${drwNames[idx] || `Logo #${idx + 1}`} (@drwnio.polyrand.net)`,
    shortKey: `drw_${drwNames[idx].toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    elements: normalizeElements(elements)
  });
});

// Add rfranzke library
cldRaw.forEach((item, idx) => {
  const elements = Array.isArray(item) ? item : (item.elements || []);
  allLibraryItems.push({
    id: `lib_cld_${idx}`,
    status: 'published',
    created: 1623024000000,
    author: 'rfranzke',
    libraryName: 'Cloud',
    name: `[Cloud] ${cldNames[idx] || `Symbol #${idx + 1}`} (@rfranzke)`,
    shortKey: `cld_${cldNames[idx].toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    elements: normalizeElements(elements)
  });
});

const outPath = path.resolve('apps/web/src/lib/official-libraries-data.json');
fs.writeFileSync(outPath, JSON.stringify(allLibraryItems, null, 2), 'utf8');
console.log(`Generated official libraries data: ${allLibraryItems.length} items saved to ${outPath}`);
