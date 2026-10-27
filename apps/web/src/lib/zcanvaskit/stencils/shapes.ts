import {
  getActorPaths,
  getCalloutPath,
  getCloudPath,
  getCubePaths,
  getCylinderPaths,
  getDocumentPath,
  getHexagonPath,
  getInternalStoragePaths,
  getParallelogramPath,
  getRoundedRectPath,
  getStarPath,
  getStepPath,
  getSubroutinePaths,
  getTrapezoidPath,
} from '../geometry/shape-paths';
import { formatNumber } from './xml';

/**
 * Node markup for the shapes the engine draws parametrically rather than as
 * fixed artwork: cylinder, cloud, and standard draw.io shapes.
 *
 * These deliberately are *not* registry stencils. A stencil is artwork authored
 * in a fixed coordinate space and scaled into a node box; these are
 * generated from the box itself — a wider cylinder is a different shape, not a
 * stretched one — so a single `viewBox` on a definition would be a lie. What
 * they share with the stencils is the reason they exist: one piece of code that
 * draws the shape, so the canvas and the exporter cannot disagree about it.
 *
 * The path geometry itself lives in `geometry/shape-paths.ts`; this module is
 * the presentation layer over it, and takes already-resolved paint and label
 * attributes so it does not have to know about theme tokens or escaping.
 */

/** Geometry both shape renderers read. */
export interface ShapeRenderContext {
  /** Node width in canvas pixels — the shape is generated to fit it exactly. */
  readonly width: number;
  readonly height: number;
  readonly isDark: boolean;
}

/** Everything needed to draw one of the parametric shapes. */
export interface ShapeNodeOptions extends ShapeRenderContext {
  /** Raw `fill="…" fill-opacity="…"` fragment, already resolved by the caller. */
  readonly fillAttr: string;
  /** Stroke colour, already resolved. */
  readonly stroke: string;
  readonly strokeWidth: number;
  /** Raw ` stroke-dasharray="…"` fragment, or the empty string for a solid outline. */
  readonly dashAttr: string;
  readonly labelColor: string;
  /** Label text. Must already be XML-escaped — this module does not escape. */
  readonly label: string;
}

/** A `round`-style line join, which both shapes want and neither wants to repeat. */
const ROUND_JOIN = 'stroke-linejoin="round" stroke-linecap="round"';

/**
 * The drum, drawn as a body plus a separate full ellipse for the rim.
 */
export function renderCylinderMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;
  const { bodyPath, rx, ry, cx, topY } = getCylinderPaths(width, height);

  return `
    <path d="${bodyPath}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <ellipse cx="${formatNumber(cx)}" cy="${formatNumber(topY)}" rx="${formatNumber(rx)}" ry="${formatNumber(ry)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 8)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The cloud, as a single closed path of six proportional arcs. */
export function renderCloudMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getCloudPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The flowchart Document shape with sinusoidal wavy bottom. */
export function renderDocumentMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getDocumentPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 3)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Data / Input-Output parallelogram shape. */
export function renderParallelogramMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getParallelogramPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Preparation / Loop condition Hexagon shape. */
export function renderHexagonMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getHexagonPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Predefined Process / Subroutine shape with double vertical boundary lines. */
export function renderSubroutineMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;
  const { outerPath, leftLinePath, rightLinePath } = getSubroutinePaths(width, height);

  return `
    <path d="${outerPath}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <path d="${leftLinePath}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} />
    <path d="${rightLinePath}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Draw.io Rounded Rectangle shape. */
export function renderRoundedRectMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getRoundedRectPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Draw.io / UML Actor stick figure shape. */
export function renderActorMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;
  const { head, bodyPath } = getActorPaths(width, height);

  return `
    <circle cx="${formatNumber(head.cx)}" cy="${formatNumber(head.cy)}" r="${formatNumber(head.r)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} />
    <path d="${bodyPath}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height - 4)}" fill="${labelColor}" font-size="11" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Draw.io 3D Isometric Cube shape. */
export function renderCubeMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;
  const { outerPath, innerPaths } = getCubePaths(width, height);

  return `
    <path d="${outerPath}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <path d="${innerPaths}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} stroke-linejoin="round" />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Draw.io Step / Chevron Process Arrow box shape. */
export function renderStepMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getStepPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Draw.io Callout / Speech bubble annotation shape. */
export function renderCalloutMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getCalloutPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height * 0.42)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Draw.io Flowchart manual operation trapezoid shape. */
export function renderTrapezoidMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getTrapezoidPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Draw.io Flowchart internal storage shape. */
export function renderInternalStorageMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;
  const { outerPath, headerLine, sideLine } = getInternalStoragePaths(width, height);

  return `
    <path d="${outerPath}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <path d="${headerLine}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} />
    <path d="${sideLine}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} />
    <text x="${formatNumber(width / 2 + 10)}" y="${formatNumber(height / 2 + 8)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}

/** The Draw.io 5-point Star shape. */
export function renderStarMarkup(options: ShapeNodeOptions): string {
  const { width, height, fillAttr, stroke, strokeWidth, dashAttr, labelColor, label } =
    options;

  return `
    <path d="${getStarPath(width, height)}" ${fillAttr} stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} ${ROUND_JOIN} />
    <text x="${formatNumber(width / 2)}" y="${formatNumber(height / 2 + 5)}" fill="${labelColor}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${label}</text>
  `;
}
