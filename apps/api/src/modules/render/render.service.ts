import { Injectable, Logger } from '@nestjs/common';
import { ExportFormat } from '@diagramz/shared';

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);

  async renderDiagram(
    format: ExportFormat,
    mermaidCode?: string,
    canvasData?: any,
    scale = 2,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const cleanMermaid = (mermaidCode || '').trim();

    let svg = '';
    if (canvasData && Array.isArray(canvasData.nodes) && canvasData.nodes.length > 0) {
      svg = this.generateSvgFromCanvas(canvasData);
    } else {
      svg = this.generateSvgPlaceholder(cleanMermaid || 'Diagramz Architecture');
    }

    if (format === 'svg') {
      return {
        buffer: Buffer.from(svg, 'utf-8'),
        contentType: 'image/svg+xml',
      };
    }

    if (format === 'pdf') {
      const pdfString = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`;
      return {
        buffer: Buffer.from(pdfString, 'binary'),
        contentType: 'application/pdf',
      };
    }

    // PNG format fallback buffer
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    return {
      buffer: pngHeader,
      contentType: 'image/png',
    };
  }

  private generateSvgFromCanvas(canvasData: any): string {
    const nodes = Array.isArray(canvasData.nodes) ? canvasData.nodes : [];
    const edges = Array.isArray(canvasData.edges) ? canvasData.edges : [];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      minX = Math.min(minX, n.x || 0);
      minY = Math.min(minY, n.y || 0);
      maxX = Math.max(maxX, (n.x || 0) + (n.width || 200));
      maxY = Math.max(maxY, (n.y || 0) + (n.height || 80));
    }

    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 1200;
      maxY = 800;
    }

    const padding = 48;
    const boxX = Math.round(minX - padding);
    const boxY = Math.round(minY - padding);
    const boxW = Math.max(100, Math.round(maxX - minX + padding * 2));
    const boxH = Math.max(80, Math.round(maxY - minY + padding * 2));

    const escape = (str: unknown) =>
      String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const nodesSvg = nodes
      .map((n: any) => {
        const x = n.x || 0;
        const y = n.y || 0;
        const w = n.width || 200;
        const h = n.height || 80;
        const title = escape(n.title || n.label || 'Node');
        const subtitle = n.subtitle ? escape(n.subtitle) : '';
        const badge = n.badge ? escape(n.badge) : '';

        return `
          <g transform="translate(${x}, ${y})">
            <rect width="${w}" height="${h}" rx="10" fill="#202E45" fill-opacity="0.5" stroke="#3E5F91" stroke-width="1.5" />
            <text x="14" y="28" fill="#F4F4F5" font-size="13" font-weight="600" font-family="system-ui, sans-serif">${title}</text>
            ${subtitle ? `<text x="14" y="48" fill="#9294A0" font-size="11" font-family="system-ui, sans-serif">${subtitle}</text>` : ''}
            ${badge ? `<text x="${w - 12}" y="26" fill="#9294A0" font-size="9" font-family="monospace" text-anchor="end">${badge}</text>` : ''}
          </g>
        `;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${boxX} ${boxY} ${boxW} ${boxH}" width="${boxW}" height="${boxH}">
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="#020617" />
  ${nodesSvg}
</svg>`;
  }

  private generateSvgPlaceholder(text: string): string {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" rx="12" fill="url(#bg)" stroke="#334155" stroke-width="2"/>
      <text x="40" y="60" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="20" font-weight="bold">Diagramz Export</text>
      <foreignObject x="40" y="90" width="720" height="470">
        <pre xmlns="http://www.w3.org/1999/xhtml" style="color: #cbd5e1; font-family: monospace; font-size: 13px; white-space: pre-wrap; background: #020617; padding: 16px; border-radius: 8px; border: 1px solid #334155;">${escaped}</pre>
      </foreignObject>
    </svg>`;
  }
}
