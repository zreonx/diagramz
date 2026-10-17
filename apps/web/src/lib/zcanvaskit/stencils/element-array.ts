import type { StencilViewBox } from './types';
import { escapeXml, formatNumber, normalizeStencilColor } from './xml';

/**
 * A framework-free renderer for raw Excalidraw element arrays.
 *
 * This is not a stencil family and is deliberately not registered: a stencil is
 * artwork the engine owns, whereas these arrays are *data* written by an earlier
 * version of the application, which stored drag-and-dropped community stencils
 * as `data.elements` on a node. The panel that produced them is gone, so nothing
 * new will ever be written this way — but diagrams saved before it was removed
 * still contain them, and they have to keep rendering.
 *
 * The markup form also fixes a real bug: the exporter only ever understood
 * `data.archId` and `data.svgPath`, so every one of these nodes exported as
 * nothing at all. Routing them through here means an old diagram now exports
 * what it draws.
 */

/**
 * The subset of an Excalidraw element this renderer understands.
 *
 * Every field is optional because the input is persisted JSON that may predate
 * any given property, and may have been written by a version of the editor that
 * is no longer in the tree.
 */
export interface ExcalidrawElementLike {
  readonly type?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  /** Rotation in radians, as Excalidraw stores it. */
  readonly angle?: number;
  readonly strokeColor?: string;
  readonly backgroundColor?: string;
  readonly strokeWidth?: number;
  readonly strokeStyle?: string;
  readonly roundness?: unknown;
  /** Absolute points, already relative to the element's own origin. */
  readonly points?: ReadonlyArray<readonly [number, number]>;
  readonly text?: string;
  readonly fontSize?: number;
}

/** A rendered element array: the space it was drawn in, and its markup. */
export interface ElementArrayRender {
  /** The bounding box, padded, that the markup should be drawn in. */
  readonly viewBox: StencilViewBox;
  readonly markup: string;
}

/**
 * Whether a value looks like an element array worth rendering.
 *
 * Permissive on purpose — the point is to keep old documents drawing, so the
 * bar is "an array of objects that each name a type", not a full schema check.
 */
export function isExcalidrawElementArray(
  value: unknown
): value is readonly ExcalidrawElementLike[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === 'object' && item !== null && typeof (item as ExcalidrawElementLike).type === 'string'
    )
  );
}

/** A finite number, or the fallback. Keeps `NaN` out of the emitted markup. */
function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Rotates `(x, y)` about `(cx, cy)`; the identity when the angle is zero. */
function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  angle: number
): [number, number] {
  if (!angle) return [x, y];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ];
}

/**
 * The bounding box of an element array, rotation included.
 *
 * Rotated elements are measured by rotating their own bounds rather than by
 * re-deriving the shape, which is exact enough for a view box and works for the
 * point-list elements that have no rectangle to measure.
 */
function measure(
  elements: readonly ExcalidrawElementLike[]
): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (x: number, y: number, cx: number, cy: number, angle: number) => {
    const [rx, ry] = rotatePoint(x, y, cx, cy, angle);
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  };

  for (const element of elements) {
    const ex = num(element.x);
    const ey = num(element.y);
    const ew = num(element.width);
    const eh = num(element.height);
    const angle = num(element.angle);
    const cx = ex + ew / 2;
    const cy = ey + eh / 2;

    if (Array.isArray(element.points) && element.points.length > 0) {
      for (const point of element.points) {
        visit(ex + num(point?.[0]), ey + num(point?.[1]), cx, cy, angle);
      }
    } else {
      visit(ex, ey, cx, cy, angle);
      visit(ex + ew, ey, cx, cy, angle);
      visit(ex + ew, ey + eh, cx, cy, angle);
      visit(ex, ey + eh, cx, cy, angle);
    }
  }

  // A degenerate array (a single point, or all-zero bounds) still needs a box
  // with area, or the viewBox divides by zero downstream.
  const rawWidth = Math.max(maxX - minX, 10);
  const rawHeight = Math.max(maxY - minY, 10);
  const pad = Math.max(rawWidth, rawHeight) * 0.12;

  return {
    minX: minX - pad,
    minY: minY - pad,
    width: rawWidth + pad * 2,
    height: rawHeight + pad * 2,
  };
}

/** The dash pattern for an Excalidraw stroke style, or `undefined` when solid. */
function dashFor(strokeStyle: string | undefined): string | undefined {
  if (strokeStyle === 'dashed') return '6,6';
  if (strokeStyle === 'dotted') return '2,4';
  return undefined;
}

/** Builds the `M x y L x y …` path for a point-list element. */
function pointsToPath(
  element: ExcalidrawElementLike,
  close: boolean
): string | undefined {
  if (!Array.isArray(element.points) || element.points.length < 2) return undefined;
  const ox = num(element.x);
  const oy = num(element.y);
  const d = element.points
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${formatNumber(ox + num(point?.[0]))} ${formatNumber(oy + num(point?.[1]))}`;
    })
    .join(' ');
  return close ? `${d} Z` : d;
}

/**
 * Renders an element array to SVG markup plus the box it should be drawn in.
 *
 * The returned markup carries no wrapping `<svg>`: the canvas wraps it in one
 * with the view box, and the exporter inlines it into the larger document, and
 * neither should have to strip a wrapper the other added.
 */
export function renderElementArray(
  elements: readonly ExcalidrawElementLike[],
  { isDark }: { isDark: boolean }
): ElementArrayRender {
  const bounds = measure(elements);
  const viewBox: StencilViewBox = {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
  };

  const defaultStroke = isDark ? '#f4f4f5' : '#18181b';

  const parts: string[] = [];

  elements.forEach((element, index) => {
    // Excalidraw's near-black defaults are really "the theme's ink", so they are
    // mapped onto the theme rather than honoured — otherwise a stored stencil
    // draws black on a dark plate. Anything else must still be a colour, which
    // is what keeps a hand-edited document from putting `url(…)` in a paint
    // attribute.
    const rawStroke = element.strokeColor;
    const isThemeInk =
      rawStroke === '#000000' || rawStroke === '#000' || rawStroke === '#1e1e1e';
    const stroke =
      isThemeInk || rawStroke === undefined
        ? defaultStroke
        : normalizeStencilColor(rawStroke) ?? defaultStroke;

    const rawFill = element.backgroundColor;
    const fill =
      rawFill && rawFill !== 'transparent'
        ? normalizeStencilColor(rawFill) ?? 'none'
        : 'none';

    const strokeWidth = Math.max(num(element.strokeWidth, 1), 1);
    const dash = dashFor(element.strokeStyle);
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
    const paint = `stroke="${stroke}" stroke-width="${formatNumber(strokeWidth)}"${dashAttr}`;

    const ex = num(element.x);
    const ey = num(element.y);
    const ew = num(element.width);
    const eh = num(element.height);

    const angle = num(element.angle);
    const angleDeg = angle ? (angle * 180) / Math.PI : 0;
    const transform = angleDeg
      ? ` rotate(${formatNumber(angleDeg)} ${formatNumber(ex + ew / 2)} ${formatNumber(ey + eh / 2)})`
      : '';

    let shape = '';

    switch (element.type) {
      case 'rectangle': {
        const rx = element.roundness ? 6 : 0;
        shape = `<rect x="${formatNumber(ex)}" y="${formatNumber(ey)}" width="${formatNumber(ew)}" height="${formatNumber(eh)}" rx="${rx}" ${paint} fill="${fill}" />`;
        break;
      }
      case 'ellipse': {
        shape = `<ellipse cx="${formatNumber(ex + ew / 2)}" cy="${formatNumber(ey + eh / 2)}" rx="${formatNumber(ew / 2)}" ry="${formatNumber(eh / 2)}" ${paint} fill="${fill}" />`;
        break;
      }
      case 'diamond': {
        const dcx = ex + ew / 2;
        const dcy = ey + eh / 2;
        const points =
          `${formatNumber(dcx)},${formatNumber(ey)} ` +
          `${formatNumber(ex + ew)},${formatNumber(dcy)} ` +
          `${formatNumber(dcx)},${formatNumber(ey + eh)} ` +
          `${formatNumber(ex)},${formatNumber(dcy)}`;
        shape = `<polygon points="${points}" ${paint} fill="${fill}" />`;
        break;
      }
      case 'line':
      case 'draw': {
        // A `draw` stroke is only closed when it has a fill, matching how the
        // editor previewed it.
        const d = pointsToPath(element, fill !== 'none');
        if (d) {
          shape = `<path d="${d}" ${paint} fill="${fill}" stroke-linecap="round" stroke-linejoin="round" />`;
        }
        break;
      }
      case 'arrow': {
        const d = pointsToPath(element, false);
        if (d) {
          shape = `<path d="${d}" ${paint} fill="none" stroke-linecap="round" />`;
        }
        break;
      }
      case 'text': {
        shape =
          `<text x="${formatNumber(ex + ew / 2)}" y="${formatNumber(ey + num(element.height, 14) / 2)}" ` +
          `fill="${stroke}" font-size="${formatNumber(Math.max(num(element.fontSize, 12), 10))}" ` +
          `text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">` +
          `${escapeXml(element.text)}</text>`;
        break;
      }
      default:
        break;
    }

    if (!shape) return;

    parts.push(
      transform
        ? `<g key="${index}" transform="${transform.trim()}">${shape}</g>`
        : shape
    );
  });

  return { viewBox, markup: parts.join('\n') };
}
