import type { ZCanvasDocument, ZCanvasEdge, ZCanvasNode } from '../core/schema';
import type { ZCanvasFillKind } from '../core/style-models';
import {
  getStrokeDashArray,
  nodeDefaultTokens,
  resolveNodeFillParts,
  resolveNodeStroke,
} from '../core/style-models';
import { getEdgeColor } from '../core/theme-tokens';
import { computeEdgeGeometry, resolveEdgeLabelPositions } from '../geometry';
import { boxCenter, rotatedBounds, rotationOf } from '../core/rotation';
import { resolveInkRender } from '../rendering/ink/freehand';
import {
  diamondVertices,
  getRoundedPolygonPath,
  triangleVertices,
} from '../rendering/shapes/polygon';
import {
  getSketchRectPath,
  getSketchCirclePath,
  getSketchDiamondPath,
  getSketchTrianglePath,
  getSketchEdgePath,
} from '../rendering/sketch/rough-svg';
import {
  isExcalidrawElementArray,
  renderElementArray,
} from '../stencils/element-array';
import { stencilTransform } from '../stencils/registry';
import { renderCloudMarkup, renderCylinderMarkup } from '../stencils/shapes';
import { BUILTIN_STENCIL_REGISTRY } from '../stencils/builtin';
import { escapeAttr, escapeXml, formatNumber, normalizeStencilColor } from '../stencils/xml';

/** `stroke-dasharray` SVG attribute for a stroke style, or an empty string. */
function dashAttr(
  style: 'solid' | 'dashed' | 'dotted' | undefined,
  width = 2
): string {
  const dash = getStrokeDashArray(style, width);
  return dash ? ` stroke-dasharray="${dash}"` : '';
}

/** Formats text with <tspan> tags if it contains multiple lines */
function renderSvgTspans(
  text: string,
  x: number | string,
  centerY: number,
  lineHeight = 16
): string {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length === 1) {
    return escapeXml(lines[0]);
  }
  const totalOffset = ((lines.length - 1) * lineHeight) / 2;
  const startY = centerY - totalOffset;
  return lines
    .map(
      (line, i) =>
        `<tspan x="${x}" y="${Math.round(startY + i * lineHeight)}">${escapeXml(line)}</tspan>`
    )
    .join('');
}

/**
 * `fill` + `fill-opacity` for a node's background, resolved through the very
 * same tokens the canvas paints with. An unstyled node therefore exports the
 * themed tint, and a translucent panel exports translucent rather than as a
 * solid block — SVG takes the two halves as separate attributes, which is why
 * the resolver returns them apart.
 */
function fillAttr(node: ZCanvasNode, kind: ZCanvasFillKind, isDark: boolean): string {
  const { color, opacity } = resolveNodeFillParts(kind, isDark, node.fill, node.fillOpacity);
  if (opacity >= 1) return `fill="${color}"`;

  // Three decimals: below the eye's threshold on any display, and short enough
  // that an 8-digit hex-embedded alpha does not export as a 17-digit float.
  const rounded = Math.round(opacity * 1000) / 1000;
  return `fill="${color}" fill-opacity="${rounded}"`;
}

/** The node's border: the user's colour, or the themed token for its kind. */
function strokeAttr(node: ZCanvasNode, kind: ZCanvasFillKind, isDark: boolean): string {
  // The user's colour is persisted JSON, so it is validated rather than
  // interpolated — the themed token behind it is engine-owned and already safe.
  return normalizeStencilColor(node.color) ?? resolveNodeStroke(kind, isDark);
}

/**
 * The user's colour where it is a colour, and the fallback otherwise.
 *
 * Used for the paints that have no themed token behind them to fall back on —
 * a connector's stroke, a text node's ink — where an invalid value has to
 * resolve to *something* rather than being dropped.
 */
function inkColor(value: unknown, fallback: string): string {
  return normalizeStencilColor(value) ?? fallback;
}

/**
 * `opacity` for a freehand stroke, or an empty string at full strength.
 *
 * Rounded like `fillAttr` does for fills: three decimals is below the eye's
 * threshold and keeps a half-transparent stroke from exporting as a
 * seventeen-digit float.
 */
function inkOpacityAttr(opacity: number | undefined): string {
  if (opacity === undefined || opacity >= 1) return '';
  const rounded = Math.round(Math.max(0, opacity) * 1000) / 1000;
  return ` opacity="${rounded}"`;
}

/** A concrete arrowhead shape (an arrowhead enum value other than `'none'`). */
type ArrowheadType = Exclude<NonNullable<ZCanvasEdge['endArrowhead']>, 'none'>;

/** Resolve a start-end arrowhead: absent/none means no marker. */
function resolveStartArrowhead(
  value: ZCanvasEdge['startArrowhead']
): ArrowheadType | null {
  if (value === undefined || value === 'none') return null;
  return value;
}

/** Resolve an end arrowhead: absent defaults to `'arrow'`, none means no marker. */
function resolveEndArrowhead(
  value: ZCanvasEdge['endArrowhead']
): ArrowheadType | null {
  if (value === undefined) return 'arrow';
  if (value === 'none') return null;
  return value;
}

/** Marker definitions, one per arrowhead type. */
const ARROWHEAD_MARKERS: Record<ArrowheadType, string> = {
  arrow: `<marker id="zcanvas-head-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" fill="context-stroke">
      <path d="M 0 1.5 L 10 5 L 0 8.5 z" />
    </marker>`,
  barbs: `<marker id="zcanvas-head-barbs" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 1 1 L 9.5 5 L 1 9" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </marker>`,
  architectural: `<marker id="zcanvas-head-architectural" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <line x1="1.5" y1="8.5" x2="8.5" y2="1.5" stroke="context-stroke" stroke-width="2" stroke-linecap="round" />
    </marker>`,
  triangle: `<marker id="zcanvas-head-triangle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" fill="context-stroke">
      <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>`,
  circle: `<marker id="zcanvas-head-circle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" fill="context-stroke">
      <circle cx="5" cy="5" r="3.6" />
    </marker>`,
  diamond: `<marker id="zcanvas-head-diamond" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" fill="context-stroke">
      <path d="M 5 0.5 L 9.5 5 L 5 9.5 L 0.5 5 z" />
    </marker>`,
};

/** Stable order so marker output does not depend on edge order. */
const ARROWHEAD_ORDER: ArrowheadType[] = [
  'arrow',
  'barbs',
  'architectural',
  'triangle',
  'circle',
  'diamond',
];

/**
 * The artwork for an `svg` node, resolved newest-format-first.
 *
 * A placed stencil is a node of type `svg` whose identity lives in the loose
 * `data` bag, and that bag has been written four different ways over the life
 * of the app. The order below is deliberate: each fallback exists only to keep
 * a document saved by an older version drawing.
 *
 * 1. `data.stencilId` — what this version writes.
 * 2. `data.archId` — how the previous version identified an architecture
 *    stencil, and still the only id on documents saved before this change.
 * 3. `data.svgPath` — a bare path plus a colour, from when a tech logo had no
 *    id at all.
 * 4. `data.elements` — a raw Excalidraw element array from the community
 *    library tab. The exporter never understood these, so they used to export
 *    as a blank space; they now export as what they draw.
 *
 * A node carrying none of the four returns the empty string — which is a real
 * case, not a defensive one: the toolbar can create an `svg` node with nothing
 * in it yet.
 */
function renderSvgNode(node: ZCanvasNode, isDark: boolean): string {
  const data = (node.data ?? {}) as Record<string, unknown>;

  const stencilId =
    typeof data.stencilId === 'string'
      ? data.stencilId
      : typeof data.techLogoId === 'string'
        ? data.techLogoId
        : typeof data.archId === 'string'
          ? data.archId
          : typeof (node as any).stencilId === 'string'
            ? (node as any).stencilId
            : typeof (node as any).techLogoId === 'string'
              ? (node as any).techLogoId
              : typeof (node as any).archId === 'string'
                ? (node as any).archId
                : undefined;

  const definition = stencilId
    ? BUILTIN_STENCIL_REGISTRY.get(stencilId)
    : undefined;
  if (definition) {
    const { scale, translateX, translateY } = stencilTransform(
      definition,
      node.width,
      node.height
    );
    const artwork = definition.render({
      width: node.width,
      height: node.height,
      isDark,
      color: node.color,
    });
    return `<g transform="translate(${formatNumber(translateX)}, ${formatNumber(translateY)}) scale(${formatNumber(scale)})">${artwork}</g>`;
  }

  if (typeof data.svgPath === 'string' && data.svgPath) {
    // Authored on a 24×24 grid and drawn at 65% of the node, which is how the
    // library panel has always previewed a logo.
    const scale = (Math.min(node.width, node.height) * 0.65) / 24;
    const ox = (node.width - 24 * scale) / 2;
    const oy = (node.height - 24 * scale) / 2;
    const fill = inkColor(data.color, isDark ? '#F4F4F5' : '#18181B');
    return `<g transform="translate(${formatNumber(ox)}, ${formatNumber(oy)}) scale(${formatNumber(scale)})"><path d="${escapeAttr(data.svgPath)}" fill="${fill}" /></g>`;
  }

  if (isExcalidrawElementArray(data.elements)) {
    const { viewBox: box, markup } = renderElementArray(data.elements, { isDark });
    const boxAttr = `${formatNumber(box.x)} ${formatNumber(box.y)} ${formatNumber(box.width)} ${formatNumber(box.height)}`;
    return `<svg x="0" y="0" width="${formatNumber(node.width)}" height="${formatNumber(node.height)}" viewBox="${boxAttr}" preserveAspectRatio="xMidYMid meet" fill="none" overflow="visible">${markup}</svg>`;
  }

  const rawSvg =
    typeof data.svgMarkup === 'string' && data.svgMarkup
      ? data.svgMarkup
      : typeof data.svg === 'string' && data.svg
      ? data.svg
      : null;
  if (rawSvg) {
    if (rawSvg.trim().startsWith('<svg')) {
      return `<g transform="translate(0, 0)">${rawSvg.replace(/^<svg\b([^>]*)>/, `<svg$1 x="0" y="0" width="${formatNumber(node.width)}" height="${formatNumber(node.height)}" preserveAspectRatio="xMidYMid meet">`)}</g>`;
    }
    return `<svg x="0" y="0" width="${formatNumber(node.width)}" height="${formatNumber(node.height)}" preserveAspectRatio="xMidYMid meet" fill="none">${rawSvg}</svg>`;
  }

  return '';
}

/**
 * Wraps a node's markup in the turn it carries.
 *
 * The markup each node type writes is a group translated to the node's corner,
 * so the turn is applied around the node's centre on the outside of it — the
 * same point and the same angle the canvas draws it with, which is what makes
 * an export the drawing rather than a second guess at it.
 */
function turnNodeMarkup(node: ZCanvasNode, markup: string): string {
  const rotation = rotationOf(node);
  if (!rotation) return markup;

  const centre = boxCenter(node);
  return `<g transform="rotate(${formatNumber(rotation)}, ${formatNumber(centre.x)}, ${formatNumber(centre.y)})">${markup}</g>`;
}

/** Common Lucide SVG icon paths for diagram cards */
const CARD_ICONS_SVG: Record<string, string> = {
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  postgres: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  mysql: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  redis: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  cache: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  mongodb: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  'web-server': '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  'app-server': '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  aws: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  'api-gateway': '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  gateway: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  'shield-check': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
  auth: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
  browser: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  client: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  microservice: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  package: '<path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.29 7 12 12.01 20.71 7M12 22.08V12"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  lambda: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  workflow: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
  worker: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20M12 2a14.5 14.5 0 0 1 0 20M2 12h20"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  harddrive: '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y2="16"/>',
};

function renderCardIcon(iconName: string | undefined, isDark: boolean): string | null {
  if (!iconName || iconName === 'none') return null;
  const content = CARD_ICONS_SVG[iconName] || CARD_ICONS_SVG.server;
  const strokeColor = isDark ? '#E4E4E7' : '#27272A';
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}

export interface ZCanvasSvgExportOptions {
  /**
   * Render against the dark theme's tokens and plate. Defaults to `true`.
   */
  isDark?: boolean;
  /**
   * Omit the solid background plate rect, rendering with a transparent background.
   */
  transparentBackground?: boolean;
  /**
   * Padding in pixels around the diagram bounds when fitting to content. Defaults to 48.
   */
  padding?: number;
  /**
   * When true, tightly frames all diagram content.
   */
  fitToContent?: boolean;
}

export function exportDocumentToSvg(
  doc: ZCanvasDocument,
  {
    isDark = true,
    transparentBackground = false,
    padding = 48,
    fitToContent,
  }: ZCanvasSvgExportOptions = {}
): string {
  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
  const resolvedLabels = resolveEdgeLabelPositions(doc.edges, nodeMap, 'bezier');

  // Secondary text (badges, subtitles, field types) borrows the connector
  // tokens, which are already the muted greys of the active theme.
  const mutedText = getEdgeColor('default', isDark);
  const faintText = getEdgeColor('muted', isDark);
  // A neutral surface for the connector-label pill.
  const surface = nodeDefaultTokens('text', isDark);
  const plate = isDark ? '#020617' : '#FFFFFF';

  // Find canvas bounds
  let minX: number;
  let minY: number;
  let width: number;
  let height: number;

  if (fitToContent === false) {
    let bMinX = 0;
    let bMinY = 0;
    let bMaxX = 1200;
    let bMaxY = 800;

    doc.nodes.forEach((n) => {
      const frame = rotatedBounds(n);
      bMinX = Math.min(bMinX, frame.x - 40);
      bMinY = Math.min(bMinY, frame.y - 40);
      bMaxX = Math.max(bMaxX, frame.x + frame.width + 40);
      bMaxY = Math.max(bMaxY, frame.y + frame.height + 40);
    });

    minX = bMinX;
    minY = bMinY;
    width = Math.max(1000, bMaxX - bMinX);
    height = Math.max(700, bMaxY - bMinY);
  } else {
    let cMinX = Infinity;
    let cMinY = Infinity;
    let cMaxX = -Infinity;
    let cMaxY = -Infinity;

    doc.nodes.forEach((n) => {
      const frame = rotatedBounds(n);
      cMinX = Math.min(cMinX, frame.x);
      cMinY = Math.min(cMinY, frame.y);
      cMaxX = Math.max(cMaxX, frame.x + frame.width);
      cMaxY = Math.max(cMaxY, frame.y + frame.height);
    });

    doc.edges.forEach((e) => {
      const res = computeEdgeGeometry(e, nodeMap, e.style === 'step' ? 'step' : 'bezier');
      if (res) {
        cMinX = Math.min(cMinX, res.p1.x, res.p2.x, res.midPoint.x);
        cMinY = Math.min(cMinY, res.p1.y, res.p2.y, res.midPoint.y);
        cMaxX = Math.max(cMaxX, res.p1.x, res.p2.x, res.midPoint.x);
        cMaxY = Math.max(cMaxY, res.p1.y, res.p2.y, res.midPoint.y);
        if (e.label) {
          const pos = resolvedLabels.get(e.id) ?? {
            x: res.midPoint.x + (e.labelOffset?.x || 0),
            y: res.midPoint.y + (e.labelOffset?.y || 0),
          };
          const lx = pos.x;
          const ly = pos.y;
          const labelLines = e.label.split('\n');
          const maxLen = Math.max(...labelLines.map((l) => l.length), 0);
          const halfW = Math.max(36, maxLen * 7 + 20) / 2;
          const halfH = Math.max(24, labelLines.length * 16 + 8) / 2;
          cMinX = Math.min(cMinX, lx - halfW);
          cMaxX = Math.max(cMaxX, lx + halfW);
          cMinY = Math.min(cMinY, ly - halfH);
          cMaxY = Math.max(cMaxY, ly + halfH);
        }
      }
    });

    doc.strokes.forEach((s) => {
      for (const pt of s.points) {
        const rad = (s.width || 2) + 2;
        cMinX = Math.min(cMinX, pt.x - rad);
        cMinY = Math.min(cMinY, pt.y - rad);
        cMaxX = Math.max(cMaxX, pt.x + rad);
        cMaxY = Math.max(cMaxY, pt.y + rad);
      }
    });

    if (!isFinite(cMinX) || !isFinite(cMinY)) {
      minX = 0;
      minY = 0;
      width = 800;
      height = 600;
    } else {
      const pad = Math.max(20, padding);
      minX = Math.round(cMinX - pad);
      minY = Math.round(cMinY - pad);
      width = Math.max(100, Math.round(cMaxX - cMinX + pad * 2));
      height = Math.max(80, Math.round(cMaxY - cMinY + pad * 2));
    }
  }

  // Ink goes through the same resolver the canvas paints with, so an export is
  // the drawing rather than a second guess at it.
  const strokesSvg = doc.strokes
    .map((s) => {
      const ink = resolveInkRender(s);
      if (!ink.d) return '';
      const dash = ink.strokeDasharray ? ` stroke-dasharray="${ink.strokeDasharray}"` : '';
      const width = ink.strokeWidth ? ` stroke-width="${ink.strokeWidth}"` : '';
      return `<path d="${ink.d}" fill="${ink.fill}" stroke="${ink.stroke}"${width}${dash}${inkOpacityAttr(s.opacity)} stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join('\n');

  // Collect the arrowhead types actually used so `<defs>` stays minimal.
  const usedArrowheads = new Set<ArrowheadType>();
  doc.edges.forEach((e) => {
    const start = resolveStartArrowhead(e.startArrowhead);
    const end = resolveEndArrowhead(e.endArrowhead);
    if (start) usedArrowheads.add(start);
    if (end) usedArrowheads.add(end);
  });

  const markersSvg = ARROWHEAD_ORDER.filter((t) => usedArrowheads.has(t))
    .map((t) => ARROWHEAD_MARKERS[t])
    .join('\n    ');

  const edgesSvg = doc.edges
    .map((e) => {
      const res = computeEdgeGeometry(e, nodeMap, e.style === 'step' ? 'step' : 'bezier');
      if (!res) return '';

    const { pathD, midPoint, p1, p2 } = res;

      const edgePathD =
        (e.roughness ?? 0) > 0 && e.style === 'straight'
          ? getSketchEdgePath(p1, p2, e.seed || e.id, e.roughness ?? 1.4)
          : pathD;

      const startArrow = resolveStartArrowhead(e.startArrowhead);
      const endArrow = resolveEndArrowhead(e.endArrowhead);

      const capAttr =
        e.lineCap === 'sharp'
          ? 'stroke-linecap="butt" stroke-linejoin="miter"'
          : 'stroke-linecap="round" stroke-linejoin="round"';

      let labelSvg = '';
      if (e.label) {
        const pos = resolvedLabels.get(e.id) ?? {
          x: midPoint.x + (e.labelOffset?.x || 0),
          y: midPoint.y + (e.labelOffset?.y || 0),
        };
        const lx = pos.x;
        const ly = pos.y;
        const labelLines = e.label.split('\n');
        const maxLen = Math.max(...labelLines.map((l) => l.length), 0);
        const lBoxW = Math.max(36, maxLen * 7 + 20);
        const lBoxH = Math.max(24, labelLines.length * 16 + 8);
        const halfW = lBoxW / 2;
        const halfH = lBoxH / 2;
        const isTrans = e.labelBg === 'transparent';
        const bgFill = isTrans ? 'transparent' : e.labelBg || surface.background;
        const strokeColor = isTrans ? 'transparent' : surface.border;
        const textFill = e.labelColor || (e.labelBg && !isTrans ? (isDark ? '#FFFFFF' : '#1E293B') : surface.text);
        const textStartY = -((labelLines.length - 1) * 16) / 2 + 4;
        const tspans = labelLines
          .map(
            (line, idx) =>
              `<tspan x="0" dy="${idx === 0 ? 0 : 16}">${escapeXml(line || ' ')}</tspan>`
          )
          .join('');
        labelSvg = `
          <g transform="translate(${lx}, ${ly})">
            <rect x="${-halfW}" y="${-halfH}" width="${lBoxW}" height="${lBoxH}" rx="6" fill="${bgFill}" stroke="${strokeColor}" stroke-width="1" />
            <text x="0" y="${textStartY}" fill="${textFill}" font-size="11" font-family="monospace" text-anchor="middle">${tspans}</text>
          </g>
        `;
      }

      const connectorSvg = `
        <path d="${edgePathD}" stroke="${inkColor(e.color, getEdgeColor('default', isDark))}" stroke-width="${e.strokeWidth || 2}" fill="none"${dashAttr(e.strokeStyle, e.strokeWidth)} ${capAttr} ${startArrow ? `marker-start="url(#zcanvas-head-${startArrow})"` : ''} ${endArrow ? `marker-end="url(#zcanvas-head-${endArrow})"` : ''} />
        ${labelSvg}
      `;

      return typeof e.opacity === 'number'
        ? `<g opacity="${e.opacity}">${connectorSvg}</g>`
        : connectorSvg;
    })
    .join('\n');

  const nodesSvg = doc.nodes
    .map((n) => {
      if (n.type === 'container') {
        const sub = n.subtitle || n.description;
        return `
          <g transform="translate(${n.x}, ${n.y})">
            <rect width="${n.width}" height="${n.height}" rx="16" ${fillAttr(n, 'container', isDark)} stroke="${strokeAttr(n, 'container', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />
            <text x="16" y="${sub ? 24 : 26}" fill="${mutedText}" font-size="12" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(n.title)}</text>
            ${sub ? `<text x="16" y="38" fill="${faintText}" font-size="10" font-family="system-ui, sans-serif">${escapeXml(sub)}</text>` : ''}
            ${n.badge ? `<text x="${n.width - 16}" y="26" fill="${strokeAttr(n, 'container', isDark)}" font-size="10" font-family="monospace" text-anchor="end">${escapeXml(n.badge)}</text>` : ''}
          </g>
        `;
      }
      if (n.type === 'frame') {
        return `
          <g transform="translate(${n.x}, ${n.y})">
            <rect width="${n.width}" height="${n.height}" rx="8" ${fillAttr(n, 'frame', isDark)} stroke="${strokeAttr(n, 'frame', isDark)}" stroke-width="${n.strokeWidth || 1.5}"${dashAttr(n.strokeStyle, n.strokeWidth)} />
            <g transform="translate(0, -20)">
              <text x="4" y="14" fill="${mutedText}" font-size="11" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(n.title)}</text>
              <text x="${n.width - 4}" y="14" fill="${faintText}" font-size="9" font-family="monospace" text-anchor="end">${Math.round(n.width)} × ${Math.round(n.height)}</text>
            </g>
          </g>
        `;
      }
      if (n.type === 'table') {
        const border = strokeAttr(n, 'table', isDark);
        const fieldsSvg = (n.fields || [])
          .map(
            (f, i) =>
              `<text x="12" y="${46 + i * 18}" fill="${mutedText}" font-size="11" font-family="monospace">${f.pk ? '🔑 ' : ''}${escapeXml(f.name)}</text>
               <text x="${n.width - 12}" y="${46 + i * 18}" fill="${faintText}" font-size="10" font-family="monospace" text-anchor="end">${escapeXml(f.type)}</text>`
          )
          .join('\n');
        return `
          <g transform="translate(${n.x}, ${n.y})">
            <rect width="${n.width}" height="${n.height}" rx="10" ${fillAttr(n, 'table', isDark)} stroke="${border}" stroke-width="1.5" />
            <rect width="${n.width}" height="28" rx="10" fill="${border}" fill-opacity="0.12" />
            <text x="12" y="19" fill="${nodeDefaultTokens('table', isDark).text}" font-size="12" font-weight="600" font-family="monospace">${escapeXml(n.title)}</text>
            <text x="${n.width - 12}" y="19" fill="${border}" font-size="10" font-family="system-ui, sans-serif" text-anchor="end">TABLE</text>
            ${fieldsSvg}
          </g>
        `;
      }
      if (n.type === 'diamond') {
        const cx = n.width / 2;
        const cy = n.height / 2;
        const rough = n.roughness ?? 0;
        const geomSvg =
          rough > 0
            ? `<path d="${getSketchDiamondPath(n.width, n.height, n.seed || n.id, rough)}" ${fillAttr(n, 'diamond', isDark)} stroke="${strokeAttr(n, 'diamond', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />`
            : `<path d="${getRoundedPolygonPath(diamondVertices(n.width, n.height))}" ${fillAttr(n, 'diamond', isDark)} stroke="${strokeAttr(n, 'diamond', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />`;
        return `
          <g transform="translate(${n.x}, ${n.y})">
            ${geomSvg}
            <text x="${cx}" y="${cy + 4}" fill="${nodeDefaultTokens('diamond', isDark).text}" font-size="12" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${escapeXml(n.title)}</text>
          </g>
        `;
      }
      if (n.type === 'circle') {
        const rx = Math.max(1, n.width / 2 - 2);
        const ry = Math.max(1, n.height / 2 - 2);
        const rough = n.roughness ?? 0;
        const geomSvg =
          rough > 0
            ? `<path d="${getSketchCirclePath(n.width, n.height, n.seed || n.id, rough)}" ${fillAttr(n, 'circle', isDark)} stroke="${strokeAttr(n, 'circle', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />`
            : `<ellipse cx="${n.width / 2}" cy="${n.height / 2}" rx="${rx}" ry="${ry}" ${fillAttr(n, 'circle', isDark)} stroke="${strokeAttr(n, 'circle', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />`;
        return `
          <g transform="translate(${n.x}, ${n.y})">
            ${geomSvg}
            <text x="${n.width / 2}" y="${n.height / 2 + 5}" fill="${nodeDefaultTokens('circle', isDark).text}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${renderSvgTspans(n.title, n.width / 2, n.height / 2 + 5)}</text>
          </g>
        `;
      }
      if (n.type === 'triangle') {
        const rough = n.roughness ?? 0;
        const geomSvg =
          rough > 0
            ? `<path d="${getSketchTrianglePath(n.width, n.height, n.seed || n.id, rough)}" ${fillAttr(n, 'triangle', isDark)} stroke="${strokeAttr(n, 'triangle', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />`
            : `<path d="${getRoundedPolygonPath(triangleVertices(n.width, n.height))}" ${fillAttr(n, 'triangle', isDark)} stroke="${strokeAttr(n, 'triangle', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />`;
        return `
          <g transform="translate(${n.x}, ${n.y})">
            ${geomSvg}
            <text x="${n.width / 2}" y="${n.height * 0.62}" fill="${nodeDefaultTokens('triangle', isDark).text}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${renderSvgTspans(n.title, n.width / 2, n.height * 0.62)}</text>
          </g>
        `;
      }
      if (n.type === 'text') {
        const lines = (n.title || '').split('\n');
        const textY = lines.length > 1 ? 20 : 24;
        const tspans = lines.map((l, i) => `<tspan x="4" y="${textY + i * 20}">${escapeXml(l)}</tspan>`).join('');
        const bgSvg =
          n.fill && n.fill !== 'transparent'
            ? `<rect width="${n.width}" height="${n.height}" rx="6" ${fillAttr(n, 'rectangle', isDark)} />`
            : '';
        return `
          <g transform="translate(${n.x}, ${n.y})">
            ${bgSvg}
            <text x="4" y="${textY}" fill="${inkColor(n.color, nodeDefaultTokens('text', isDark).text)}" font-size="${n.fontSize || 14}" font-weight="${n.fontWeight || 600}" font-family="${n.fontFamily === 'mono' ? 'monospace' : 'system-ui, sans-serif'}">${tspans}</text>
          </g>
        `;
      }
      if (n.type === 'rectangle') {
        const rough = n.roughness ?? 0;
        const geomSvg =
          rough > 0
            ? `<path d="${getSketchRectPath(0, 0, n.width, n.height, n.seed || n.id, rough)}" ${fillAttr(n, 'rectangle', isDark)} stroke="${strokeAttr(n, 'rectangle', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />`
            : `<rect width="${n.width}" height="${n.height}" rx="12" ${fillAttr(n, 'rectangle', isDark)} stroke="${strokeAttr(n, 'rectangle', isDark)}" stroke-width="${n.strokeWidth || 2}"${dashAttr(n.strokeStyle, n.strokeWidth)} />`;
        return `
          <g transform="translate(${n.x}, ${n.y})">
            ${geomSvg}
            <text x="${n.width / 2}" y="${n.height / 2 + 5}" fill="${nodeDefaultTokens('rectangle', isDark).text}" font-size="13" font-weight="600" font-family="system-ui, sans-serif" text-anchor="middle">${renderSvgTspans(n.title, n.width / 2, n.height / 2 + 5)}</text>
          </g>
        `;
      }
      if (n.type === 'cylinder') {
        const geomSvg = renderCylinderMarkup({
          width: n.width,
          height: n.height,
          isDark,
          fillAttr: fillAttr(n, 'cylinder', isDark),
          stroke: strokeAttr(n, 'cylinder', isDark),
          strokeWidth: n.strokeWidth || 2,
          dashAttr: dashAttr(n.strokeStyle, n.strokeWidth),
          labelColor: nodeDefaultTokens('cylinder', isDark).text,
          label: renderSvgTspans(n.title, n.width / 2, n.height / 2 + 8),
        });
        return `
          <g transform="translate(${n.x}, ${n.y})">
            ${geomSvg}
          </g>
        `;
      }
      if (n.type === 'cloud') {
        const geomSvg = renderCloudMarkup({
          width: n.width,
          height: n.height,
          isDark,
          fillAttr: fillAttr(n, 'cloud', isDark),
          stroke: strokeAttr(n, 'cloud', isDark),
          strokeWidth: n.strokeWidth || 2,
          dashAttr: dashAttr(n.strokeStyle, n.strokeWidth),
          labelColor: nodeDefaultTokens('cloud', isDark).text,
          label: renderSvgTspans(n.title, n.width / 2, n.height / 2 + 5),
        });
        return `
          <g transform="translate(${n.x}, ${n.y})">
            ${geomSvg}
          </g>
        `;
      }
      if (n.type === 'svg') {
        const svgGraphic = renderSvgNode(n, isDark);
        return `
          <g transform="translate(${n.x}, ${n.y})">
            ${svgGraphic}
            ${n.title ? `<text x="${formatNumber(n.width / 2)}" y="${formatNumber(n.height + 16)}" fill="${nodeDefaultTokens('card', isDark).text}" font-size="11" font-weight="500" font-family="system-ui, sans-serif" text-anchor="middle">${escapeXml(n.title)}</text>` : ''}
          </g>
        `;
      }
      const iconMarkup = renderCardIcon(n.icon, isDark);
      const hasIcon = !!iconMarkup;
      const iconY = Math.max(8, Math.round((n.height - 28) / 2));
      const iconGroup = hasIcon
        ? `<rect x="10" y="${iconY}" width="28" height="28" rx="7" fill="${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}" stroke="${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}" stroke-width="1" />
          <g transform="translate(16, ${iconY + 6})">${iconMarkup}</g>`
        : '';

      const badgeW = n.badge ? Math.max(34, n.badge.length * 6.5 + 12) : 0;
      const badgeX = n.width - badgeW - 12;
      const badgeMarkup = n.badge
        ? `<rect x="${badgeX}" y="10" width="${badgeW}" height="18" rx="4" fill="${isDark ? '#1e293b' : '#f1f5f9'}" fill-opacity="0.8" stroke="${isDark ? '#334155' : '#e2e8f0'}" stroke-width="0.75" />
          <text x="${badgeX + badgeW / 2}" y="22" fill="${mutedText}" font-size="9" font-family="monospace" text-anchor="middle">${escapeXml(n.badge)}</text>`
        : '';

      const align = n.textAlign || 'left';
      const textAnchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      const textX =
        align === 'center'
          ? n.width / 2
          : align === 'right'
          ? n.width - (n.badge ? badgeW + 18 : 14)
          : (hasIcon ? 46 : 14);

      let titleY = 28;
      let subtitleY = 48;
      const cardDesc = n.subtitle || n.description;
      if (n.textVerticalAlign === 'top') {
        titleY = 24;
        subtitleY = 42;
      } else if (n.textVerticalAlign === 'bottom') {
        titleY = n.height - (cardDesc ? 28 : 16);
        subtitleY = n.height - 12;
      } else if (n.textVerticalAlign === 'middle') {
        if (cardDesc) {
          titleY = Math.round(n.height / 2 - 2);
          subtitleY = Math.round(n.height / 2 + 16);
        } else {
          titleY = Math.round(n.height / 2 + 5);
        }
      }

      const fontFamily =
        n.fontFamily === 'mono' ? 'monospace' : n.fontFamily === 'serif' ? 'serif' : 'system-ui, sans-serif';
      const fontSize = typeof n.fontSize === 'number' ? n.fontSize : 13;

      return `
        <g transform="translate(${n.x}, ${n.y})">
          <rect width="${n.width}" height="${n.height}" rx="10" ${fillAttr(n, 'card', isDark)} stroke="${strokeAttr(n, 'card', isDark)}" stroke-width="1.5" />
          ${iconGroup}
          <text x="${textX}" y="${titleY}" fill="${nodeDefaultTokens('card', isDark).text}" font-size="${fontSize}" font-weight="600" font-family="${fontFamily}" text-anchor="${textAnchor}">${escapeXml(n.title)}</text>
          ${cardDesc ? `<text x="${textX}" y="${subtitleY}" fill="${mutedText}" font-size="11" font-family="${fontFamily}" text-anchor="${textAnchor}">${escapeXml(cardDesc)}</text>` : ''}
          ${badgeMarkup}
        </g>
      `;
    })
    .map((markup, index) => turnNodeMarkup(doc.nodes[index], markup))
    .join('\n');

  const bgPlate = transparentBackground
    ? ''
    : `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${plate}" />\n  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <defs>
    ${markersSvg}
  </defs>
  ${bgPlate}${strokesSvg}
  ${edgesSvg}
  ${nodesSvg}
</svg>`;
}

export function downloadSvg(svgString: string, filename = 'diagram.svg'): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
