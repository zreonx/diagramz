/**
 * Turning a drag payload into document nodes.
 *
 * Everything here is pure: given a payload and a drop point it returns the
 * nodes and edges to add, and the ids to select. It touches no React state, no
 * document and no DOM, which is what lets the drop rules be tested directly
 * instead of through a browser.
 *
 * The caller owns the things placement deliberately does not know about: where
 * the pointer landed in canvas coordinates, whether the grid snaps, and how a
 * change is committed to history.
 */

import type { ZCanvasEdge, ZCanvasNode } from '../core/schema';
import { BUILTIN_STENCIL_REGISTRY } from './builtin';
import type {
  ZCanvasDragItem,
  ZCanvasPatternNode,
  ZCanvasPatternPayload,
  ZCanvasShapeTool,
} from './drag-payload';

/** Click-to-draw and drop size for each geometric shape tool. */
export const SHAPE_DEFAULTS: Record<ZCanvasShapeTool, { width: number; height: number }> = {
  rectangle: { width: 160, height: 80 },
  circle: { width: 120, height: 120 },
  diamond: { width: 100, height: 100 },
  triangle: { width: 120, height: 100 },
  cylinder: { width: 110, height: 120 },
  cloud: { width: 180, height: 110 },
};

/**
 * Builds a freshly created geometric shape node centred on a point.
 *
 * No appearance is written onto the node: it renders from the themed default
 * for its kind, which is exactly what Reset restores. A shape only carries
 * `color` / `fill` once the user picks one in the style panel, so the two
 * paths can never disagree.
 *
 * A shape is created with no title, and there is no argument to give it one:
 * the caption for a shape is a text node placed over it, so a shape never
 * carries text of its own.
 */
export function createShapeNode(
  tool: ZCanvasShapeTool,
  box: { x: number; y: number; width: number; height: number },
  id?: string
): ZCanvasNode {
  return {
    id: id ?? `${tool}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: tool,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    title: '',
  };
}

/** Mints node and edge ids for one placement. */
export type ZCanvasIdFactory = (prefix: string) => string;

/**
 * A collision-free id source.
 *
 * Ids have to be unique for the life of a document, not just for one call —
 * dropping the same stencil twice must produce two different nodes. The
 * timestamp alone is not enough for that, because a pattern places a dozen
 * nodes inside one millisecond, so a monotonic counter is appended. `now` is
 * injectable so a test can pin the clock and assert on exact ids.
 */
export function createIdFactory(
  options: { existing?: ReadonlySet<string>; now?: () => number } = {}
): ZCanvasIdFactory {
  const { existing } = options;
  const now = options.now ?? Date.now;
  let counter = 0;

  return (prefix) => {
    let candidate: string;
    do {
      counter += 1;
      candidate = `${prefix}-${now().toString(36)}-${counter.toString(36)}`;
    } while (existing?.has(candidate));
    return candidate;
  };
}

export interface ZCanvasPlacementContext {
  /** The drop point, in canvas coordinates and already snapped. */
  x: number;
  y: number;
  /** Ids already in the document, so a minted id cannot collide with one. */
  existingNodeIds?: ReadonlySet<string>;
  /** Overrides the id source. Tests use it to stay deterministic. */
  createId?: ZCanvasIdFactory;
}

export interface ZCanvasPlacement {
  nodes: ZCanvasNode[];
  edges: ZCanvasEdge[];
  /**
   * The nodes to select, or empty to leave the selection as it is.
   *
   * Empty is not the same as "select nothing": a dropped pattern leaves the
   * selection alone rather than clearing it, which is what the canvas did
   * before this module existed.
   */
  selectedIds: string[];
  /** A node whose title should open for editing as soon as it lands. */
  startTextEditId?: string;
  /** Whether the nodes belong beneath what is already on the canvas. */
  prepend: boolean;
}

/**
 * Where a stencil's artwork came from, for the fields written onto its node.
 *
 * `data.stencilId` is always written when the payload named one, so a placed
 * stencil can be identified even when its artwork travelled inside the payload
 * rather than being looked up. `data.archId` is written alongside it for the
 * architecture family only: it is the field every diagram saved before this
 * module existed already carries, and forking the persisted format mid-flight
 * would strand them.
 */
function stencilData(
  item: Extract<ZCanvasDragItem, { kind: 'stencil' }>,
  resolved: { title: string; category?: string; accentColor?: string }
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (item.stencilId) {
    data.stencilId = item.stencilId;
    if (item.stencilId.startsWith('arch-')) data.archId = item.stencilId;
  }
  if (item.svgPath) {
    data.svgPath = item.svgPath;
    data.viewBox = item.viewBox ?? '0 0 24 24';
    // The brand colour, when the payload named one. Previously the panel wrote
    // `hex` here while every reader looked for `color`, so the override was
    // silently lost and a logo always drew in the theme ink.
    if (item.color) data.color = item.color;
  } else if (item.elements !== undefined) {
    data.elements = item.elements;
    if (item.libraryName) data.libraryName = item.libraryName;
    if (item.author) data.author = item.author;
  }

  if (resolved.title) data.title = resolved.title;
  if (resolved.category) data.category = resolved.category;
  if (resolved.accentColor) data.accentColor = resolved.accentColor;

  return data;
}

/**
 * Places a payload at a point, or returns `null` when it names nothing the
 * engine can draw.
 *
 * A `null` return is not an error: it is the drop handler's signal to ignore a
 * drag that belongs to some other application.
 */
export function placeDragItem(
  item: ZCanvasDragItem,
  context: ZCanvasPlacementContext
): ZCanvasPlacement | null {
  const createId =
    context.createId ?? createIdFactory({ existing: context.existingNodeIds });

  switch (item.kind) {
    case 'stencil':
      return placeStencil(item, context, createId);
    case 'tool':
      return placeTool(item, context, createId);
    case 'pattern':
      return placePattern(item.pattern, context, createId);
    case 'node':
      return placeSingleNode(item.node, context, createId);
  }
}

/** Fields common to every placed node: centred on the drop point. */
function centred(x: number, y: number, width: number, height: number) {
  return { x: x - width / 2, y: y - height / 2 };
}

function placeStencil(
  item: Extract<ZCanvasDragItem, { kind: 'stencil' }>,
  context: ZCanvasPlacementContext,
  createId: ZCanvasIdFactory
): ZCanvasPlacement | null {
  // Artwork that travelled with the payload wins over a registry lookup: the
  // sender had it in hand, and a lookup would silently substitute whatever the
  // registry holds under the same id today.
  const definition = item.stencilId
    ? BUILTIN_STENCIL_REGISTRY.get(item.stencilId)
    : undefined;

  const hasOwnArtwork = Boolean(item.svgPath) || item.elements !== undefined;
  if (!hasOwnArtwork && !definition) return null;

  const fallbackWidth = item.elements !== undefined ? 120 : item.svgPath ? 80 : 90;
  const fallbackHeight = item.elements !== undefined ? 100 : item.svgPath ? 80 : 90;
  const width = item.width ?? definition?.defaultWidth ?? fallbackWidth;
  const height = item.height ?? definition?.defaultHeight ?? fallbackHeight;

  // Only a name that travelled with the payload is worn, and the library sends
  // none: a place on a diagram is a drawing, not a label, so a component
  // dropped from the panel lands unnamed and the user names it — through Edit
  // Label or the properties panel — only if the diagram calls for a name. The
  // catalogue's own title is still recorded below, as the stencil's identity.
  const title = item.title ?? '';
  const node: ZCanvasNode = {
    id: createId(item.stencilId ?? 'stencil'),
    type: 'svg',
    title,
    ...centred(context.x, context.y, width, height),
    width,
    height,
    data: stencilData(item, {
      // The record's title is the stencil's, not the node's: an unnamed server
      // stencil is still a server stencil when the document is read back, even
      // though nothing is written under its picture.
      title: item.title || definition?.title || '',
      category: item.category ?? definition?.category,
      accentColor: item.accentColor ?? definition?.accentColor,
    }),
  };

  return {
    nodes: [node],
    edges: [],
    selectedIds: [node.id],
    prepend: false,
  };
}

/**
 * The literal defaults for each component tool.
 *
 * The built-in toolbar offers tiles for the geometric tools and for text; the
 * component tools are reachable by any host that writes a tool payload, which
 * is why they keep their own defaults rather than sharing the shape table.
 */
function createComponentNode(
  tool: 'service' | 'table' | 'container' | 'frame',
  context: ZCanvasPlacementContext,
  createId: ZCanvasIdFactory
): ZCanvasNode {
  const id = createId(tool === 'container' ? 'vpc' : tool);

  if (tool === 'frame') {
    const width = 800;
    const height = 600;
    return {
      id,
      type: 'frame',
      title: 'Frame 1',
      ...centred(context.x, context.y, width, height),
      width,
      height,
    };
  }

  if (tool === 'container') {
    const width = 500;
    const height = 350;
    return {
      id,
      type: 'container',
      title: 'Virtual Private Cloud (VPC)',
      ...centred(context.x, context.y, width, height),
      width,
      height,
      // No appearance overrides — renders from the themed default.
    };
  }

  if (tool === 'table') {
    const width = 220;
    const height = 160;
    return {
      id,
      type: 'table',
      title: 'users_table',
      ...centred(context.x, context.y, width, height),
      width,
      height,
      fields: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'email', type: 'varchar(255)' },
        { name: 'created_at', type: 'timestamp' },
      ],
      // No appearance overrides — a new table renders from the themed default.
    };
  }

  const width = 210;
  const height = 76;
  return {
    id,
    type: 'card',
    title: 'New Microservice',
    subtitle: 'Node.js / Express',
    badge: 'Service',
    icon: 'server',
    ...centred(context.x, context.y, width, height),
    width,
    height,
    // No colour override: a fresh component keeps the modern theme default
    // (soft blue border, translucent fill) instead of the toolbar swatch.
  };
}

function placeTool(
  item: Extract<ZCanvasDragItem, { kind: 'tool' }>,
  context: ZCanvasPlacementContext,
  createId: ZCanvasIdFactory
): ZCanvasPlacement {
  if (item.tool === 'text') {
    const width = 140;
    const height = 40;
    const id = createId('text');
    return {
      nodes: [
        {
          id,
          type: 'text',
          ...centred(context.x, context.y, width, height),
          width,
          height,
          title: '',
          // Text inherits the theme foreground until a colour is picked.
        },
      ],
      edges: [],
      selectedIds: [id],
      startTextEditId: id,
      prepend: false,
    };
  }

  if (item.tool === 'service' || item.tool === 'table' || item.tool === 'container' || item.tool === 'frame') {
    const node = createComponentNode(item.tool, context, createId);
    return {
      nodes: [node],
      edges: [],
      selectedIds: [node.id],
      // A container or frame is a boundary: it paints beneath what it encloses. Dropping
      // inside one does not parent the node — grouping is an explicit command,
      // never a side effect of where a component lands.
      prepend: item.tool === 'container' || item.tool === 'frame',
    };
  }

  // A geometric shape. The size is the tool's default unless the payload named
  // one, which is how a library tile can offer a differently proportioned
  // rectangle without the canvas knowing about that tile.
  const defaults = SHAPE_DEFAULTS[item.tool];
  const width = item.width ?? defaults.width;
  const height = item.height ?? defaults.height;
  const node = createShapeNode(
    item.tool,
    {
      ...centred(context.x, context.y, width, height),
      width,
      height,
    },
    createId(item.tool)
  );

  return {
    nodes: [node],
    edges: [],
    selectedIds: [node.id],
    prepend: false,
  };
}

/**
 * Places a pattern: every node at once, offset to the drop point, with its
 * connectors re-pointed at their new ids.
 *
 * All of it lands in one placement so it is one undo step — a pattern that
 * could be taken apart by a single Ctrl+Z would be worse than useless.
 */
function placePattern(
  pattern: ZCanvasPatternPayload,
  context: ZCanvasPlacementContext,
  createId: ZCanvasIdFactory
): ZCanvasPlacement | null {
  if (pattern.nodes.length === 0) return null;

  const idMap = new Map<string, string>();
  const nodes: ZCanvasNode[] = pattern.nodes.map((node) => {
    const id = createId(node.id);
    idMap.set(node.id, id);
    return {
      // The pattern's own layout is relative, so the whole cluster keeps its
      // shape and simply moves to wherever it was dropped.
      ...patternNode(node),
      id,
      x: Math.round(context.x + node.x),
      y: Math.round(context.y + node.y),
    };
  });

  const edges: ZCanvasEdge[] = [];
  for (const edge of pattern.edges) {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    // An edge whose ends are not in the pattern would draw a connector to a
    // node that does not exist, so it is dropped rather than placed.
    if (!source || !target) continue;
    edges.push({
      id: createId('edge'),
      source,
      target,
      label: edge.label,
      color: edge.color,
      style: edge.style ?? 'bezier',
    });
  }

  return {
    nodes,
    edges,
    selectedIds: [],
    prepend: false,
  };
}

/** A pattern node's own fields, without the id and position placement rewrites. */
function patternNode(node: ZCanvasPatternNode): Omit<ZCanvasNode, 'id' | 'x' | 'y'> {
  return {
    type: node.type,
    title: node.title,
    width: node.width,
    height: node.height,
    subtitle: node.subtitle,
    badge: node.badge,
    icon: node.icon,
    color: node.color,
  };
}

/**
 * Places an individual component of a flow as an independent, un-grouped,
 * un-connected single node centred at the drop point.
 */
function placeSingleNode(
  node: ZCanvasPatternNode,
  context: ZCanvasPlacementContext,
  createId: ZCanvasIdFactory
): ZCanvasPlacement {
  const width = node.width || 210;
  const height = node.height || 76;
  const id = createId(node.id || 'flow-node');

  const placedNode: ZCanvasNode = {
    ...patternNode(node),
    id,
    ...centred(context.x, context.y, width, height),
    width,
    height,
  };

  return {
    nodes: [placedNode],
    edges: [],
    selectedIds: [id],
    prepend: node.type === 'container',
  };
}

