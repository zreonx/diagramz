import { exportDocumentToSvg, ZCanvasSvgExportOptions } from './svg';
import type { ZCanvasDocument } from '../core/schema';

export interface ZCanvasPngExportOptions extends ZCanvasSvgExportOptions {
  /** Resolution multiplier: 1 = Standard, 2 = Retina HD, 3 = 4K Ultra. Defaults to 2. */
  scale?: number;
  /** Output filename when triggering a download. Defaults to 'diagram.png'. */
  filename?: string;
}

/**
 * Renders a ZCanvasDocument into a high-DPI PNG Blob.
 * Uses high-quality offscreen canvas anti-aliasing and subpixel smoothing.
 */
export async function exportDocumentToPngBlob(
  doc: ZCanvasDocument,
  options: ZCanvasPngExportOptions = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.max(1, Math.min(4, options.scale ?? 2));
  const isDark = options.isDark ?? true;
  const transparentBackground = options.transparentBackground ?? false;

  const svgString = exportDocumentToSvg(doc, {
    isDark,
    transparentBackground,
    padding: options.padding ?? 48,
    fitToContent: options.fitToContent ?? true,
  });

  // Extract explicit canvas bounds from SVG attributes / viewBox
  const vbMatch = /viewBox="([^"]+)"/.exec(svgString);
  let baseWidth = 1200;
  let baseHeight = 800;

  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      baseWidth = Math.round(parts[2]);
      baseHeight = Math.round(parts[3]);
    }
  }

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const URL = window.URL || window.webkitURL || window;
  const blobURL = URL.createObjectURL(svgBlob);

  return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      try {
        const targetWidth = Math.round(baseWidth * scale);
        const targetHeight = Math.round(baseHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) {
          URL.revokeObjectURL(blobURL);
          reject(new Error('Failed to create 2D canvas context'));
          return;
        }

        // Crisp retina smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Background plate (unless transparent is requested)
        if (!transparentBackground) {
          ctx.fillStyle = isDark ? '#020617' : '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        }

        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(blobURL);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, width: targetWidth, height: targetHeight });
            } else {
              reject(new Error('Canvas rasterization failed'));
            }
          },
          'image/png'
        );
      } catch (err) {
        URL.revokeObjectURL(blobURL);
        reject(err);
      }
    };

    image.onerror = (err) => {
      URL.revokeObjectURL(blobURL);
      reject(new Error('Failed to load SVG for PNG export: ' + String(err)));
    };

    image.src = blobURL;
  });
}

/**
 * Downloads a Blob as a file with the given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const URL = window.URL || window.webkitURL || window;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports and immediately downloads the diagram as a high-resolution PNG.
 * Supports both legacy signature (filename, scale) and options object.
 */
export async function exportDocumentToPng(
  doc: ZCanvasDocument,
  filenameOrOptions: string | ZCanvasPngExportOptions = 'diagram.png',
  maybeScale = 2
): Promise<void> {
  const options: ZCanvasPngExportOptions =
    typeof filenameOrOptions === 'string'
      ? { filename: filenameOrOptions, scale: maybeScale }
      : filenameOrOptions;

  const filename = options.filename || 'diagram.png';
  const { blob } = await exportDocumentToPngBlob(doc, options);
  downloadBlob(blob, filename);
}

/**
 * Copies a high-definition PNG of the diagram directly into the user's system clipboard.
 */
export async function exportDocumentToClipboard(
  doc: ZCanvasDocument,
  options: ZCanvasPngExportOptions = {}
): Promise<void> {
  const { blob } = await exportDocumentToPngBlob(doc, options);
  if (!navigator.clipboard || !navigator.clipboard.write) {
    throw new Error('Clipboard image copy is not supported in this browser environment');
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': blob,
    }),
  ]);
}
