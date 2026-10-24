/**
 * The one drag payload the engine understands.
 *
 * Four mimetypes used to be in play. The toolbar wrote `application/zcanvas-item`;
 * the library panel wrote `application/diagramz-library-item` and
 * `application/diagramz-pattern`; a fourth, `application/diagramz-component`,
 * was read by the drop handler and written by nothing at all.
 *
 * The canvas's `dragover` guard named only the first — so every drag out of the
 * library panel was refused before it could reach the drop handler, because a
 * browser cancels a drag whose target never calls `preventDefault()`. The drop
 * handler *did* read all four, which is exactly why the failure looked like
 * something else: the code that would have placed the item was correct and
 * simply never ran.
 *
 * One payload type collapses that whole class of bug: there is one mimetype to
 * write and one to guard on, so a producer and a consumer cannot disagree.
 * `placement.ts` turns a payload into document nodes without caring which part
 * of the UI produced it, which is what lets the toolbar, the library panel and
 * any future host share one drop path.
 *
 * `readDragItem` also understands the three legacy mimetypes, so a host can be
 * migrated one writer at a time. That compatibility block is self-contained and
 * is meant to be deleted a release after every writer has moved.
 */

import type { ZCanvasNodeType, ZCanvasTool } from '../core/schema';

/**
 * The drag mimetype. Namespaced `x-` because it is not an IANA-registered type;
 * browsers pass custom types through untouched as long as the source sets them.
 */
export const ZCANVAS_ITEM_MIME = 'application/x-diagramz-item';

/**
 * Mimetypes from before the unification, still read and no longer written here.
 * `application/diagramz-component` is deliberately absent: nothing in this
 * repository has ever written it, so its reader was dead code rather than a
 * compatibility path.
 */
export const ZCANVAS_LEGACY_MIMES = [
  'application/zcanvas-item',
  'application/diagramz-library-item',
  'application/diagramz-pattern',
] as const;

export type ZCanvasLegacyMime = (typeof ZCANVAS_LEGACY_MIMES)[number];

/**
 * The geometric tools, drawn as bare SVG geometry rather than as an HTML card.
 *
 * A drag carrying one of these lands a real shape node. It used to fall through
 * the library-item branches — a standard shape carried no `archId` and no
 * `svgPath`, so it reached the element-array fallback and became an empty `svg`
 * node: a blank rectangle on the canvas.
 */
export const SHAPE_TOOLS = [
  'rectangle',
  'circle',
  'diamond',
  'triangle',
  'cylinder',
  'cloud',
  'document',
  'parallelogram',
  'hexagon',
  'subroutine',
] as const;

export type ZCanvasShapeTool = (typeof SHAPE_TOOLS)[number];

/** The non-geometric tools, each of which lands a fresh component of its kind. */
export const COMPONENT_TOOLS = ['text', 'service', 'table', 'container', 'frame', 'sticky-note'] as const;

export type ZCanvasComponentTool = (typeof COMPONENT_TOOLS)[number];

/** Every tool a drop can name. */
export type ZCanvasToolName = ZCanvasShapeTool | ZCanvasComponentTool;

export const ZCANVAS_TOOL_NAMES: readonly ZCanvasToolName[] = [
  ...SHAPE_TOOLS,
  ...COMPONENT_TOOLS,
];

export function isShapeTool(tool: ZCanvasTool | string): tool is ZCanvasShapeTool {
  return (SHAPE_TOOLS as readonly string[]).includes(tool);
}

export function isToolName(value: unknown): value is ZCanvasToolName {
  return typeof value === 'string' && (ZCANVAS_TOOL_NAMES as readonly string[]).includes(value);
}

/** A pattern node, as the library panel authors one. */
export interface ZCanvasPatternNode {
  id: string;
  type: ZCanvasNodeType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  subtitle?: string;
  badge?: string;
  icon?: string;
  color?: string;
  fields?: Array<{
    name: string;
    type: string;
    pk?: boolean;
    fk?: boolean;
    nullable?: boolean;
    unique?: boolean;
  }>;
}

/**
 * A pattern connector.
 *
 * `source` / `target` are the node ids inside the pattern, before placement.
 * The drop handler used to read `from` / `to` here — names the panel has never
 * written — so every dropped pattern arrived without a single connector.
 */
export interface ZCanvasPatternEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  color?: string;
  style?: 'bezier' | 'step' | 'straight';
  startArrowhead?: NonNullable<import('../core/schema').ZCanvasEdge['startArrowhead']>;
  endArrowhead?: NonNullable<import('../core/schema').ZCanvasEdge['endArrowhead']>;
  sourceOffset?: number;
  targetOffset?: number;
}

export interface ZCanvasPatternPayload {
  id?: string;
  title: string;
  nodes: ZCanvasPatternNode[];
  edges: ZCanvasPatternEdge[];
}

/**
 * Artwork the engine can draw, named rather than embedded.
 *
 * `stencilId` is a registry id (`arch-load-balancer`, `tech-postgres`). The
 * other three fields carry artwork the payload brings with it, and are listed
 * in the order `placement.ts` prefers them: an element array, a vector path,
 * and only then a registry lookup. `stencilId` is recorded on the node either
 * way, so a stencil can be identified even when its artwork travelled with it.
 */
export interface ZCanvasStencilDragItem {
  kind: 'stencil';
  stencilId?: string;
  svgPath?: string;
  viewBox?: string;
  elements?: unknown;
  /** Ink override for `svgPath` artwork. */
  color?: string;
  title?: string;
  category?: string;
  accentColor?: string;
  width?: number;
  height?: number;
  libraryName?: string;
  author?: string;
}

export interface ZCanvasToolDragItem {
  kind: 'tool';
  tool: ZCanvasToolName;
  /** Size override for a shape tool; ignored by the component tools. */
  width?: number;
  height?: number;
}

export interface ZCanvasPatternDragItem {
  kind: 'pattern';
  pattern: ZCanvasPatternPayload;
}

export interface ZCanvasNodeDragItem {
  kind: 'node';
  node: ZCanvasPatternNode;
}

export type ZCanvasDragItem =
  | ZCanvasStencilDragItem
  | ZCanvasToolDragItem
  | ZCanvasPatternDragItem
  | ZCanvasNodeDragItem;

/**
 * The slice of `DataTransfer` this module uses.
 *
 * Declared structurally rather than as `DataTransfer` so the whole protocol can
 * be exercised without a browser: a test passes an object with a `types` list
 * and a data map, and the real `DataTransfer` satisfies it unchanged.
 */
export interface ZCanvasDragDataTransfer {
  types: readonly string[];
  getData(format: string): string;
  setData(format: string, data: string): void;
  effectAllowed?: string;
}

/** `setData` silently drops a payload over 8 MB, so refuse it up front. */
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Writes a payload, and the drop effect the source is offering.
 *
 * Serialising here rather than at each call site is what makes the mimetype
 * impossible to get wrong: a writer names the payload, not the wire format.
 */
export function writeDragItem(
  dataTransfer: ZCanvasDragDataTransfer,
  item: ZCanvasDragItem
): void {
  const payload = JSON.stringify(item);

  if (payload.length > MAX_PAYLOAD_BYTES) {
    // Better to refuse the drag than to hand the drop handler a truncated
    // string, which would parse as garbage or fail outright.
    throw new Error(`drag payload is ${payload.length} bytes, over the 8 MB limit`);
  }

  dataTransfer.setData(ZCANVAS_ITEM_MIME, payload);
  dataTransfer.effectAllowed = 'copy';
}

/**
 * Whether a dragover event belongs to this protocol.
 *
 * Separate from `readDragItem` because browsers blank `getData` during
 * `dragover` — `types` is the only thing readable then, and `dragover` is
 * precisely where the drop has to be accepted. Reading the payload here would
 * always come back empty and the drop would never be accepted.
 */
export function hasDragItem(
  dataTransfer: { types: readonly string[] } | null | undefined
): boolean {
  if (!dataTransfer?.types) return false;
  const types = dataTransfer.types;
  return (
    types.includes(ZCANVAS_ITEM_MIME) ||
    ZCANVAS_LEGACY_MIMES.some((mime) => types.includes(mime))
  );
}

/**
 * Reads a payload, in the modern format or in any legacy format still in use.
 *
 * Returns `null` for anything it cannot make sense of — a drag from another
 * application, a malformed payload, or a legacy payload naming a tool that no
 * longer exists. A caller treats `null` as "not for me" and lets the event
 * through untouched.
 */
export function readDragItem(dataTransfer: {
  getData(format: string): string;
}): ZCanvasDragItem | null {
  const own = readJson(dataTransfer.getData(ZCANVAS_ITEM_MIME));
  const ownItem = normalizeItem(own);
  if (ownItem) return ownItem;

  // Legacy adapters. Delete this block once no writer in the wild uses them.
  const legacyTool = dataTransfer.getData('application/zcanvas-item');
  if (legacyTool && isToolName(legacyTool)) {
    return { kind: 'tool', tool: legacyTool };
  }

  const legacyPattern = dataTransfer.getData('application/diagramz-pattern');
  if (legacyPattern) {
    const pattern = adaptLegacyPattern(readJson(legacyPattern));
    if (pattern) return pattern;
  }

  const legacyLibrary = dataTransfer.getData('application/diagramz-library-item');
  if (legacyLibrary) {
    const item = adaptLegacyLibraryItem(readJson(legacyLibrary));
    if (item) return item;
  }

  return null;
}

/** `JSON.parse` without the throw, for a payload that may be anything at all. */
function readJson(raw: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Builds a stencil payload holding only the fields that were actually there.
 *
 * One builder serves both the current payload and the legacy adapter, so a
 * caller cannot tell from the returned shape which mimetype a drag arrived
 * under — and a payload read back after `writeDragItem` is the payload that
 * went in, key for key.
 */
function stencilItem(source: Record<string, unknown>): ZCanvasStencilDragItem | null {
  const item: ZCanvasStencilDragItem = { kind: 'stencil' };

  const stencilId = asString(source.stencilId);
  if (stencilId) item.stencilId = stencilId;
  const svgPath = asString(source.svgPath);
  if (svgPath) item.svgPath = svgPath;
  const viewBox = asString(source.viewBox);
  if (viewBox) item.viewBox = viewBox;
  const color = asString(source.color);
  if (color) item.color = color;
  const title = asString(source.title);
  if (title) item.title = title;
  const category = asString(source.category);
  if (category) item.category = category;
  const accentColor = asString(source.accentColor);
  if (accentColor) item.accentColor = accentColor;
  const width = asNumber(source.width);
  if (width !== undefined) item.width = width;
  const height = asNumber(source.height);
  if (height !== undefined) item.height = height;
  const libraryName = asString(source.libraryName);
  if (libraryName) item.libraryName = libraryName;
  const author = asString(source.author);
  if (author) item.author = author;
  if (source.elements !== undefined) item.elements = source.elements;

  // A stencil with neither artwork nor a name would place an empty node.
  return item.stencilId || item.svgPath || item.elements ? item : null;
}

/** Builds a tool payload, carrying a size only when the sender gave one. */
function toolItem(
  tool: ZCanvasToolName,
  source: Record<string, unknown> = {}
): ZCanvasToolDragItem {
  const item: ZCanvasToolDragItem = { kind: 'tool', tool };

  const width = asNumber(source.width);
  if (width !== undefined) item.width = width;
  const height = asNumber(source.height);
  if (height !== undefined) item.height = height;

  return item;
}

/**
 * Builds a pattern node holding only the fields that were there.
 *
 * The same builder serves a node inside a pattern and a node dragged on its
 * own, so both read back key for key. What differs between the two is only how
 * much is missing: a pattern node arrives complete from the panel, while a node
 * drag may name nothing but a title, and `fallback` supplies the rest.
 */
function nodeItem(
  raw: Record<string, unknown>,
  fallback: { title: string; width: number; height: number }
): ZCanvasPatternNode | null {
  const id = asString(raw.id);
  const type = asString(raw.type);
  if (!id || !type) return null;

  const node: ZCanvasPatternNode = {
    id,
    type: type as ZCanvasNodeType,
    title: asString(raw.title) ?? fallback.title,
    x: asNumber(raw.x) ?? 0,
    y: asNumber(raw.y) ?? 0,
    width: asNumber(raw.width) ?? fallback.width,
    height: asNumber(raw.height) ?? fallback.height,
  };

  const subtitle = asString(raw.subtitle);
  if (subtitle) node.subtitle = subtitle;
  const badge = asString(raw.badge);
  if (badge) node.badge = badge;
  const icon = asString(raw.icon);
  if (icon) node.icon = icon;
  const color = asString(raw.color);
  if (color) node.color = color;
  if (Array.isArray(raw.fields)) {
    node.fields = raw.fields
      .filter((f): f is Record<string, unknown> => isRecord(f) && typeof f.name === 'string')
      .map((f) => ({
        name: String(f.name),
        type: typeof f.type === 'string' ? f.type : 'varchar(255)',
        ...(f.pk === true ? { pk: true } : {}),
        ...(f.fk === true ? { fk: true } : {}),
        ...(f.nullable === true ? { nullable: true } : {}),
        ...(f.unique === true ? { unique: true } : {}),
      }));
  }

  return node;
}

/** The defaults a pattern authors its own nodes with, and a lone node drag. */
const PATTERN_NODE_DEFAULTS = { title: '', width: 160, height: 76 };
const DRAGGED_NODE_DEFAULTS = { title: 'Node', width: 210, height: 76 };

/**
 * Validates a payload that claims to be ours.
 *
 * A payload is JSON from the same page, so this is not a trust boundary — it is
 * a shape check, because a payload written by an older build of the page can
 * legitimately be missing fields the current one expects.
 */
function normalizeItem(value: unknown): ZCanvasDragItem | null {
  if (!isRecord(value)) return null;

  if (value.kind === 'tool') {
    return isToolName(value.tool) ? toolItem(value.tool, value) : null;
  }

  if (value.kind === 'stencil') {
    return stencilItem(value);
  }

  if (value.kind === 'pattern') {
    return adaptLegacyPattern(value.pattern);
  }

  if (value.kind === 'node' && isRecord(value.node)) {
    // A node drag is a single component of a flow, placed on its own rather
    // than as part of a cluster: same shape as a pattern node, its own defaults.
    const node = nodeItem(value.node, DRAGGED_NODE_DEFAULTS);
    return node ? { kind: 'node', node } : null;
  }

  return null;
}

/**
 * Reads a pattern payload, in the current shape or the one the panel wrote
 * before the field names were settled.
 *
 * The old reader looked for `from` / `to` on each edge, which no writer has ever
 * produced; rather than repeat that, this accepts either spelling and resolves
 * both to `source` / `target`.
 */
function adaptLegacyPattern(value: unknown): ZCanvasPatternDragItem | null {
  if (!isRecord(value)) return null;

  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  const rawEdges = Array.isArray(value.edges) ? value.edges : [];
  if (rawNodes.length === 0) return null;

  const nodes: ZCanvasPatternNode[] = [];
  for (const raw of rawNodes) {
    if (!isRecord(raw)) continue;
    const node = nodeItem(raw, PATTERN_NODE_DEFAULTS);
    if (node) nodes.push(node);
  }
  if (nodes.length === 0) return null;

  const known = new Set(nodes.map((node) => node.id));
  const edges: ZCanvasPatternEdge[] = [];
  for (const raw of rawEdges) {
    if (!isRecord(raw)) continue;
    const source = asString(raw.source) ?? asString(raw.from);
    const target = asString(raw.target) ?? asString(raw.to);
    // An edge pointing at a node the payload does not carry would render as a
    // connector to nowhere, so it is dropped rather than placed.
    if (!source || !target || !known.has(source) || !known.has(target)) continue;

    const edge: ZCanvasPatternEdge = {
      id: asString(raw.id) ?? `edge-${edges.length + 1}`,
      source,
      target,
    };
    const label = asString(raw.label);
    if (label) edge.label = label;
    const color = asString(raw.color);
    if (color) edge.color = color;
    if (raw.style === 'bezier' || raw.style === 'step' || raw.style === 'straight') {
      edge.style = raw.style;
    }
    const startArrowhead = asString(raw.startArrowhead);
    if (startArrowhead) edge.startArrowhead = startArrowhead as ZCanvasPatternEdge['startArrowhead'];
    const endArrowhead = asString(raw.endArrowhead);
    if (endArrowhead) edge.endArrowhead = endArrowhead as ZCanvasPatternEdge['endArrowhead'];
    const sourceOffset = asNumber(raw.sourceOffset);
    if (sourceOffset !== undefined) edge.sourceOffset = sourceOffset;
    const targetOffset = asNumber(raw.targetOffset);
    if (targetOffset !== undefined) edge.targetOffset = targetOffset;
    edges.push(edge);
  }

  const pattern: ZCanvasPatternPayload = {
    title: asString(value.title) ?? 'Pattern',
    nodes,
    edges,
  };
  const id = asString(value.id);
  if (id) pattern.id = id;

  return { kind: 'pattern', pattern };
}

/**
 * Reads a library-item payload from before the unification.
 *
 * The payload had no discriminator: the drop handler worked out what it held by
 * looking for `archId`, then a shape `type`, then `svgPath`, then an element
 * array. The same order is reproduced here so an old payload places exactly
 * what it used to.
 */
function adaptLegacyLibraryItem(value: unknown): ZCanvasDragItem | null {
  if (!isRecord(value)) return null;

  const archId = asString(value.archId);
  if (archId) return stencilItem({ ...value, stencilId: archId });

  const type = value.type;
  if (typeof type === 'string' && isShapeTool(type)) return toolItem(type, value);

  const svgPath = asString(value.svgPath);
  const elements =
    Array.isArray(value.elements) && value.elements.length > 0 ? value.elements : undefined;
  if (svgPath || elements) {
    return stencilItem({
      ...value,
      svgPath,
      elements,
      stencilId: asString(value.id),
      // The old payload called the ink `hex` while every reader looked for
      // `color`, so a tech logo always drew in the theme ink rather than its
      // brand colour. Both names are accepted here; the new payload has one.
      color: asString(value.color) ?? asString(value.hex),
      title: asString(value.title) ?? asString(value.cleanName) ?? asString(value.name),
    });
  }

  return null;
}
