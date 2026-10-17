import { registerTsResolver } from '../apps/web/test/register-ts-resolver.mjs';
import fs from 'fs';

registerTsResolver();

const { exportDocumentToSvg } = await import('../apps/web/src/lib/zcanvaskit/export/svg.ts');
const { ZCanvasDocumentSchema } = await import('../apps/web/src/lib/zcanvaskit/core/schema.ts');

const sampleDiagram = ZCanvasDocumentSchema.parse({
  version: 1,
  nodes: [
    {
      id: 'gw',
      type: 'card',
      x: 100,
      y: 100,
      width: 220,
      height: 72,
      title: 'API Gateway',
      subtitle: 'Envoy / Rate Limiter',
      badge: 'Gateway',
      icon: 'api-gateway',
      color: '#3b82f6',
    },
    {
      id: 'auth',
      type: 'card',
      x: 420,
      y: 100,
      width: 220,
      height: 72,
      title: 'Auth Service',
      subtitle: 'Rust / JWT & OAuth2',
      badge: 'Auth',
      icon: 'auth',
      color: '#8b5cf6',
    },
    {
      id: 'db',
      type: 'card',
      x: 420,
      y: 240,
      width: 220,
      height: 72,
      title: 'PostgreSQL DB',
      subtitle: 'HA Primary + Replicas',
      badge: 'SQL',
      icon: 'postgres',
      color: '#3b82f6',
    },
    {
      id: 'redis',
      type: 'card',
      x: 100,
      y: 240,
      width: 220,
      height: 72,
      title: 'Redis Cache',
      subtitle: 'Sessions & Rate Limits',
      badge: 'Cache',
      icon: 'redis',
      color: '#ef4444',
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'gw',
      target: 'auth',
      label: 'Validate Token',
      color: '#8b5cf6',
      style: 'bezier',
      strokeWidth: 2,
    },
    {
      id: 'e2',
      source: 'auth',
      target: 'db',
      label: 'Store User',
      color: '#3b82f6',
      style: 'bezier',
      strokeWidth: 2,
    },
    {
      id: 'e3',
      source: 'gw',
      target: 'redis',
      label: 'Check Rate Limit',
      color: '#ef4444',
      style: 'bezier',
      strokeWidth: 2,
    },
  ],
  strokes: [],
});

// Export in Dark Mode
const svgDark = exportDocumentToSvg(sampleDiagram, { isDark: true, fitToContent: true, padding: 40 });
const outDarkPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-export-dark.svg';
fs.writeFileSync(outDarkPath, svgDark, 'utf-8');
console.log('Saved dark SVG export to:', outDarkPath);

// Export in Light Mode with Transparent Background
const svgLightTrans = exportDocumentToSvg(sampleDiagram, { isDark: false, transparentBackground: true, fitToContent: true, padding: 40 });
const outLightTransPath = 'C:\\Users\\Zorenl\\.gemini\\antigravity-cli\\brain\\768a6ff1-a73e-4925-b3c5-1a925c09fb1f\\verified-export-transparent.svg';
fs.writeFileSync(outLightTransPath, svgLightTrans, 'utf-8');
console.log('Saved transparent SVG export to:', outLightTransPath);
