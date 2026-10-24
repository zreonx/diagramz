import { SHAPE_INSET } from '../rendering/shapes/polygon';

/**
 * Path geometry for the shapes the engine draws as bare SVG outline — the
 * cylinder and the cloud.
 *
 * These live beside the rest of the geometry rather than in the React adapter
 * because two very different consumers need them: the canvas (which renders
 * them into a live SVG) and the exporter (which builds a markup string with no
 * React in sight). Framework independence is the whole point of the split, so
 * the geometry sits on the React-free side of it.
 *
 * The inset itself is not redeclared here — it is the same margin
 * `rendering/shapes/polygon.ts` already defines and documents, and a second
 * copy of `2` is exactly the kind of thing that drifts.
 */

export interface CylinderPaths {
  /** The drum: two vertical sides closed by an arc top and bottom. */
  bodyPath: string;
  /** The full lid ellipse, drawn separately so the rim can read as an opening. */
  lidPath: string;
  /** Horizontal centre of the drum. */
  cx: number;
  /** Vertical centre of the top rim. */
  topY: number;
  /** Horizontal radius of the rim ellipse. */
  rx: number;
  /** Vertical radius of the rim ellipse. */
  ry: number;
}

/**
 * Generates an SVG path for a 3D cylinder / database storage drum.
 */
export function getCylinderPaths(
  width: number,
  height: number,
  inset = SHAPE_INSET
): CylinderPaths {
  const w = Math.max(10, width - inset * 2);
  const h = Math.max(10, height - inset * 2);
  const x = inset;
  const y = inset;
  const ry = Math.min(h * 0.2, 24); // Cap lid depth
  const rx = w / 2;
  const cx = x + rx;
  const topY = y + ry;
  const bottomY = y + h - ry;

  // Body: starts at top-left, curves down to bottom-left, curves across bottom-right, goes up to top-right, curves across top
  const bodyPath = `M ${x} ${topY} L ${x} ${bottomY} A ${rx} ${ry} 0 0 0 ${x + w} ${bottomY} L ${x + w} ${topY} A ${rx} ${ry} 0 0 0 ${x} ${topY} Z`;
  // Lid ellipse
  const lidPath = `M ${cx} ${y} A ${rx} ${ry} 0 1 1 ${cx} ${y + ry * 2} A ${rx} ${ry} 0 1 1 ${cx} ${y} Z`;

  return { bodyPath, lidPath, cx, topY, rx, ry };
}

/**
 * Generates an SVG path for a clean multi-lobe cloud boundary.
 */
export function getCloudPath(
  width: number,
  height: number,
  inset = SHAPE_INSET
): string {
  const w = Math.max(20, width - inset * 2);
  const h = Math.max(20, height - inset * 2);
  const x = inset;
  const y = inset;

  // Draw 6 proportional arcs around the perimeter
  return (
    `M ${x + w * 0.25} ${y + h * 0.85} ` +
    `C ${x + w * 0.05} ${y + h * 0.85} ${x} ${y + h * 0.65} ${x + w * 0.08} ${y + h * 0.45} ` +
    `C ${x} ${y + h * 0.25} ${x + w * 0.15} ${y + h * 0.08} ${x + w * 0.35} ${y + h * 0.15} ` +
    `C ${x + w * 0.45} ${y} ${x + w * 0.65} ${y} ${x + w * 0.72} ${y + h * 0.18} ` +
    `C ${x + w * 0.88} ${y + h * 0.1} ${x + w} ${y + h * 0.3} ${x + w * 0.95} ${y + h * 0.5} ` +
    `C ${x + w * 1.02} ${y + h * 0.7} ${x + w * 0.88} ${y + h * 0.88} ${x + w * 0.75} ${y + h * 0.85} ` +
    `C ${x + w * 0.6} ${y + h * 0.98} ${x + w * 0.4} ${y + h * 0.98} ${x + w * 0.25} ${y + h * 0.85} Z`
  );
}

/**
 * Generates an SVG path for a standard Draw.io flowchart Document shape (wavy bottom).
 */
export function getDocumentPath(
  width: number,
  height: number,
  inset = SHAPE_INSET
): string {
  const w = Math.max(20, width - inset * 2);
  const h = Math.max(20, height - inset * 2);
  const x = inset;
  const y = inset;
  const wave = Math.min(h * 0.15, 18);

  return (
    `M ${x} ${y} ` +
    `L ${x + w} ${y} ` +
    `L ${x + w} ${y + h - wave} ` +
    `Q ${x + w * 0.75} ${y + h} ${x + w * 0.5} ${y + h - wave} ` +
    `Q ${x + w * 0.25} ${y + h - wave * 2} ${x} ${y + h - wave} Z`
  );
}

/**
 * Generates an SVG path for a standard Draw.io Data / Input-Output parallelogram.
 */
export function getParallelogramPath(
  width: number,
  height: number,
  inset = SHAPE_INSET
): string {
  const w = Math.max(20, width - inset * 2);
  const h = Math.max(20, height - inset * 2);
  const x = inset;
  const y = inset;
  const skew = Math.min(w * 0.2, 24);

  return `M ${x + skew} ${y} L ${x + w} ${y} L ${x + w - skew} ${y + h} L ${x} ${y + h} Z`;
}

/**
 * Generates an SVG path for a standard Draw.io Preparation / Loop condition Hexagon.
 */
export function getHexagonPath(
  width: number,
  height: number,
  inset = SHAPE_INSET
): string {
  const w = Math.max(20, width - inset * 2);
  const h = Math.max(20, height - inset * 2);
  const x = inset;
  const y = inset;
  const indent = Math.min(w * 0.18, 22);

  return (
    `M ${x + indent} ${y} ` +
    `L ${x + w - indent} ${y} ` +
    `L ${x + w} ${y + h * 0.5} ` +
    `L ${x + w - indent} ${y + h} ` +
    `L ${x + indent} ${y + h} ` +
    `L ${x} ${y + h * 0.5} Z`
  );
}

export interface SubroutinePaths {
  outerPath: string;
  leftLinePath: string;
  rightLinePath: string;
}

/**
 * Generates SVG paths for a standard Draw.io Predefined Process / Subroutine shape.
 */
export function getSubroutinePaths(
  width: number,
  height: number,
  inset = SHAPE_INSET
): SubroutinePaths {
  const w = Math.max(20, width - inset * 2);
  const h = Math.max(20, height - inset * 2);
  const x = inset;
  const y = inset;
  const offset = Math.min(w * 0.15, 16);

  const outerPath = `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  const leftLinePath = `M ${x + offset} ${y} V ${y + h}`;
  const rightLinePath = `M ${x + w - offset} ${y} V ${y + h}`;

  return { outerPath, leftLinePath, rightLinePath };
}
