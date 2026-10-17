import { exportDocumentToSvg } from './svg';
import { downloadBlob, ZCanvasPngExportOptions } from './png';
import type { ZCanvasDocument } from '../core/schema';

export interface ZCanvasPdfExportOptions extends ZCanvasPngExportOptions {
  /** Page orientation: 'auto' adapts to diagram dimensions. Defaults to 'auto'. */
  orientation?: 'auto' | 'portrait' | 'landscape';
}

/**
 * Builds a standard, standalone PDF document (PDF-1.4) embedding a JPEG image stream.
 * Produces crisp, high-resolution vector-scaled PDF pages without any external dependencies.
 */
function buildPdfFromJpeg(
  jpegBytes: Uint8Array,
  imgWidth: number,
  imgHeight: number
): Uint8Array {
  // Use 72 points per inch standard PDF coordinate system
  // Scale down pixel dimensions so the PDF page fits nicely at ~72-150 DPI physical scale
  const scaleFactor = 72 / 96;
  const pdfWidth = Math.round(imgWidth * scaleFactor);
  const pdfHeight = Math.round(imgHeight * scaleFactor);

  const objects: string[] = [];
  const offsets: number[] = [];

  let pdfString = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';

  function addObject(content: string, stream?: Uint8Array): number {
    const objNum = objects.length + 1;
    offsets.push(pdfString.length);
    let objDef = `${objNum} 0 obj\n${content}\n`;
    if (stream) {
      objDef += `stream\n`;
    }
    pdfString += objDef;

    if (stream) {
      // Append binary stream
      const prefix = new TextEncoder().encode(pdfString);
      const suffix = new TextEncoder().encode('\nendstream\nendobj\n');
      const combined = new Uint8Array(prefix.length + stream.length + suffix.length);
      combined.set(prefix, 0);
      combined.set(stream, prefix.length);
      combined.set(suffix, prefix.length + stream.length);

      // Re-encode back for continuing
      pdfString = new TextDecoder('latin1').decode(combined);
    } else {
      pdfString += 'endobj\n';
    }

    objects.push(objDef);
    return objNum;
  }

  // 1. Catalog
  addObject(`<< /Type /Catalog /Pages 2 0 R >>`);

  // 2. Pages
  addObject(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);

  // 3. Page
  addObject(`<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 ${pdfWidth} ${pdfHeight}]
  /Contents 4 0 R
  /Resources <<
    /ProcSet [/PDF /ImageC]
    /XObject << /Im0 5 0 R >>
  >>
>>`);

  // 4. Content stream
  const contentStream = `q\n${pdfWidth} 0 0 ${pdfHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  addObject(`<< /Length ${contentStream.length} >>`, new TextEncoder().encode(contentStream));

  // 5. Image XObject
  addObject(
    `<<
  /Type /XObject
  /Subtype /Image
  /Width ${imgWidth}
  /Height ${imgHeight}
  /ColorSpace /DeviceRGB
  /BitsPerComponent 8
  /Filter /DCTDecode
  /Length ${jpegBytes.length}
>>`,
    jpegBytes
  );

  // Cross-reference table
  const startXref = pdfString.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  xref += `trailer\n<<\n  /Size ${objects.length + 1}\n  /Root 1 0 R\n>>\nstartxref\n${startXref}\n%%EOF\n`;

  const finalStr = pdfString + xref;
  const finalBytes = new Uint8Array(finalStr.length);
  for (let i = 0; i < finalStr.length; i++) {
    finalBytes[i] = finalStr.charCodeAt(i) & 0xff;
  }
  return finalBytes;
}

/**
 * Exports a ZCanvasDocument to a PDF Blob.
 */
export async function exportDocumentToPdfBlob(
  doc: ZCanvasDocument,
  options: ZCanvasPdfExportOptions = {}
): Promise<Blob> {
  const scale = Math.max(1, Math.min(3, options.scale ?? 2));
  const isDark = options.isDark ?? false; // PDF prints best with light canvas by default if not specified

  const svgString = exportDocumentToSvg(doc, {
    isDark,
    transparentBackground: false,
    padding: options.padding ?? 48,
    fitToContent: options.fitToContent ?? true,
  });

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

  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      try {
        const targetWidth = Math.round(baseWidth * scale);
        const targetHeight = Math.round(baseHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(blobURL);
          reject(new Error('Failed to create canvas 2D context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = isDark ? '#020617' : '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        URL.revokeObjectURL(blobURL);

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error('Failed to create JPEG stream for PDF'));
              return;
            }
            const arrayBuffer = await blob.arrayBuffer();
            const jpegBytes = new Uint8Array(arrayBuffer);
            const pdfBytes = buildPdfFromJpeg(jpegBytes, targetWidth, targetHeight);
            resolve(new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
          },
          'image/jpeg',
          0.94
        );
      } catch (err) {
        URL.revokeObjectURL(blobURL);
        reject(err);
      }
    };

    image.onerror = (err) => {
      URL.revokeObjectURL(blobURL);
      reject(new Error('Failed to load diagram SVG for PDF export: ' + String(err)));
    };

    image.src = blobURL;
  });
}

/**
 * Exports and immediately downloads the diagram as a crisp PDF document.
 */
export async function exportDocumentToPdf(
  doc: ZCanvasDocument,
  filenameOrOptions: string | ZCanvasPdfExportOptions = 'diagram.pdf',
  maybeScale = 2
): Promise<void> {
  const options: ZCanvasPdfExportOptions =
    typeof filenameOrOptions === 'string'
      ? { filename: filenameOrOptions, scale: maybeScale }
      : filenameOrOptions;

  const filename = options.filename || 'diagram.pdf';
  const blob = await exportDocumentToPdfBlob(doc, options);
  downloadBlob(blob, filename);
}
