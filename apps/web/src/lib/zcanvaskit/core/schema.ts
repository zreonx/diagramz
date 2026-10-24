import { z } from 'zod';

export const ZCanvasHandlePositionSchema = z.enum(['top', 'right', 'bottom', 'left']);
export type ZCanvasHandlePosition = z.infer<typeof ZCanvasHandlePositionSchema>;

export const ZCanvasPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type ZCanvasPoint = z.infer<typeof ZCanvasPointSchema>;

export const ZCanvasBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type ZCanvasBox = z.infer<typeof ZCanvasBoxSchema>;

export const ZCanvasFieldItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  pk: z.boolean().optional(),
  fk: z.boolean().optional(),
  nullable: z.boolean().optional(),
  unique: z.boolean().optional(),
});
export type ZCanvasFieldItem = z.infer<typeof ZCanvasFieldItemSchema>;

export const ZCanvasNodeTypeSchema = z.enum([
  'card',
  'table',
  'container',
  /** Frame / artboard boundary that encloses diagrams with label and dimensions. */
  'frame',
  'rectangle',
  /** Ellipse inscribed in the node box — a circle when width equals height. */
  'circle',
  'diamond',
  'triangle',
  /** Standard Draw.io cylinder database shape */
  'cylinder',
  /** Standard Draw.io cloud perimeter boundary */
  'cloud',
  'text',
  /** Miro / FigJam style sticky note with pastel colors and quick editing. */
  'sticky-note',
  /** Draw.io flowchart Document shape with sinusoidal wavy bottom. */
  'document',
  /** Draw.io Data / Input-Output parallelogram shape. */
  'parallelogram',
  /** Draw.io Preparation / Loop condition hexagon shape. */
  'hexagon',
  /** Draw.io Predefined Process / Subroutine shape with double side lines. */
  'subroutine',
  /** Rich vector SVG stencil (e.g. Draw.io tech component or vector library item). */
  'svg',
]);
export type ZCanvasNodeType = z.infer<typeof ZCanvasNodeTypeSchema>;

export const ZCanvasNodeSchema = z.object({
  id: z.string(),
  type: ZCanvasNodeTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  title: z.string(),
  subtitle: z.string().optional(),
  badge: z.string().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(ZCanvasFieldItemSchema).optional(),
  color: z.string().optional(),
  fill: z.string().optional(),
  borderColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(5).optional(),
  seed: z.union([z.number(), z.string()]).optional(),
  cornerRadius: z.number().optional(),
  zIndex: z.number().optional(),
  /**
   * Degrees clockwise about the node's own centre.
   *
   * The frame the node occupies stays upright — `x`, `y`, `width` and `height`
   * are the box it was placed in, and this is what turns it — so everything
   * that measures a box goes on working, and a document written before nodes
   * could turn reads as an upright one. See `core/rotation`.
   */
  rotation: z.number().optional(),
  /**
   * The groups this node belongs to, innermost first.
   *
   * A group has no element of its own: it exists only as a name its members
   * share, which is why grouping leaves the document otherwise untouched. The
   * order is what makes nesting work — grouping a group together with something
   * else appends a wider id rather than replacing the inner one, and ungrouping
   * takes the outermost away and leaves the rest.
   */
  groupIds: z.array(z.string()).optional(),
  /**
   * The container this node was placed in, when it has one.
   *
   * Set explicitly, never by a drag: moving a shape across a boundary leaves it
   * standalone. A container that holds children carries them when it moves.
   */
  parentId: z.string().optional(),
  // Typography overrides for text & nodes
  fontSize: z.number().optional(),
  fontFamily: z.enum(['sans', 'mono', 'serif', 'handwriting']).optional(),
  fontWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  textVerticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  /**
   * Whether the element refuses to be edited or moved until it is unlocked.
   *
   * A real field rather than a flag in `data`, because nodes are the only kind
   * with a bag to hide one in and every kind is lockable. A locked element is
   * still selectable and still answers a right-click — unlocking it is how you
   * unlock it. `data.locked` is still read as a fallback, so a document written
   * before the field existed keeps the lock it was given.
   */
  locked: z.boolean().optional(),
  /** Container/VPC collapsed state (Draw.io style subsystem folding). */
  collapsed: z.boolean().optional(),
  /** Original expanded height of the container when collapsed. */
  expandedHeight: z.number().optional(),
  data: z.record(z.any()).optional(),
});
export type ZCanvasNode = z.infer<typeof ZCanvasNodeSchema>;

/**
 * A bare geometric shape: a box, circle, diamond or triangle.
 *
 * These are the shapes a diagram is *built* from rather than written on, and
 * they hold no label of their own — a caption sits over one as a separate
 * {@link ZCanvasNode} of type `text`, so it can be moved, styled and linked
 * independently of the outline underneath it.
 */
export function isGeometricShape(type: ZCanvasNodeType | undefined): boolean {
  return (
    type === 'rectangle' ||
    type === 'circle' ||
    type === 'diamond' ||
    type === 'triangle' ||
    type === 'cylinder' ||
    type === 'cloud' ||
    type === 'document' ||
    type === 'parallelogram' ||
    type === 'hexagon' ||
    type === 'subroutine'
  );
}

/**
 * Whether the node's own `title` can be edited in place.
 *
 * Every written node — a card, a container's frame label, a table header, a
 * text element — is edited by typing on it. A geometric shape is not, because
 * it draws no text of its own…
 *
 * …unless it already carries one. Documents written before shapes lost their
 * labels (and every diagram imported from Mermaid or the legacy format) hold
 * their node names in `title`, and that text is still the only copy of the
 * name. It stays editable so a label can be corrected or emptied out, while a
 * shape can no longer *gain* a label it never had.
 */
export function hasEditableLabel(node: Pick<ZCanvasNode, 'type' | 'title'>): boolean {
  return !isGeometricShape(node.type) || node.title.length > 0;
}

/**
 * Whether a node may only be resized into boxes of the shape it was placed in.
 *
 * A stencil node is artwork, drawn uniform and centred in whatever box it is
 * given — the same thing SVG means by `preserveAspectRatio="xMidYMid meet"`.
 * A box of any other shape therefore renders the drawing inset, with a strip of
 * empty space beside it, and a one-sided drag grows that strip rather than the
 * drawing. Held to its ratio, the size on screen is always the size of the
 * thing that is drawn.
 */
export function holdsAspect(type: ZCanvasNodeType | undefined): boolean {
  return type === 'svg';
}

export const ZCanvasEdgeRoutingSchema = z.enum(['bezier', 'step', 'straight']);
export type ZCanvasEdgeRouting = z.infer<typeof ZCanvasEdgeRoutingSchema>;

export const ZCanvasArrowheadEnum = z.enum([
  'none',
  'arrow',
  'barbs',
  'architectural',
  'triangle',
  'circle',
  'diamond',
  'er-one',
  'er-zero-one',
  'er-many',
  'er-zero-many',
]);

export const ZCanvasEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: ZCanvasHandlePositionSchema.optional(),
  targetHandle: ZCanvasHandlePositionSchema.optional(),
  sourcePoint: ZCanvasPointSchema.optional(),
  targetPoint: ZCanvasPointSchema.optional(),
  /** Custom offset in pixels along the source shape side relative to its midpoint. */
  sourceOffset: z.number().optional(),
  /** Custom offset in pixels along the target shape side relative to its midpoint. */
  targetOffset: z.number().optional(),
  /** Custom offset in pixels for orthogonal step or bezier line bend position. */
  stepOffset: z.number().optional(),
  /** Custom intermediate Draw.io-style waypoints / bend coordinates along the connector. */
  waypoints: z.array(ZCanvasPointSchema).optional(),
  label: z.string().optional(),
  /** Source-side connector label (e.g. UML '1', or client annotation). */
  sourceLabel: z.string().optional(),
  /** Target-side connector label (e.g. UML '0..*', or server annotation). */
  targetLabel: z.string().optional(),
  /** Custom offset for the line label relative to its default midpoint along the line. */
  labelOffset: z.object({ x: z.number(), y: z.number() }).optional(),
  /** Custom background colour for the line text label. */
  labelBg: z.string().optional(),
  /** Custom text colour for the line text label. */
  labelColor: z.string().optional(),
  style: ZCanvasEdgeRoutingSchema.optional().default('bezier'),
  /** Line jumps / bridges (Draw.io style) when crossing other connectors. */
  lineJumps: z.enum(['none', 'arc', 'gap']).optional(),
  animated: z.boolean().optional(),
  /** Directional flow speed ('slow' = 1.8s, 'normal' = 0.9s, 'fast' = 0.45s). */
  animationSpeed: z.enum(['slow', 'normal', 'fast']).optional(),
  /** Directional flow animation direction. */
  animationDirection: z.enum(['forward', 'reverse']).optional(),
  color: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  /** Line ends/corners: `round` (default) or `sharp` (butt caps, mitred joins). */
  lineCap: z.enum(['round', 'sharp']).optional(),
  opacity: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(5).optional(),
  seed: z.union([z.number(), z.string()]).optional(),
  startArrowhead: ZCanvasArrowheadEnum.optional(),
  endArrowhead: ZCanvasArrowheadEnum.optional(),
  /** See {@link ZCanvasNodeSchema}'s `locked`. */
  locked: z.boolean().optional(),
});
export type ZCanvasEdge = z.infer<typeof ZCanvasEdgeSchema>;

export const ZCanvasDrawingStrokeSchema = z.object({
  id: z.string(),
  points: z.array(ZCanvasPointSchema),
  color: z.string(),
  width: z.number(),
  opacity: z.number().min(0).max(1).optional(),
  /**
   * Dash pattern of the ink. Optional, so documents written before the pen
   * gained a stroke style still parse — an absent value is a solid line.
   */
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  smoothing: z.number().optional(),
  roughness: z.number().optional(),
  /**
   * How much the stroke thins towards each end, as it was drawn. Stored rather
   * than re-read from `preset`, so ink keeps the shape it was drawn with even
   * if the preset table is retuned later.
   */
  taper: z.number().min(0).max(1).optional(),
  preset: z.string().optional(),
  /** See {@link ZCanvasNodeSchema}'s `locked`. */
  locked: z.boolean().optional(),
});
export type ZCanvasDrawingStroke = z.infer<typeof ZCanvasDrawingStrokeSchema>;

export const ZCanvasViewportSchema = z.object({
  zoom: z.number().default(1),
  panX: z.number().default(40),
  panY: z.number().default(40),
});
export type ZCanvasViewport = z.infer<typeof ZCanvasViewportSchema>;

export const ZCanvasPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(ZCanvasNodeSchema).default([]),
  edges: z.array(ZCanvasEdgeSchema).default([]),
  strokes: z.array(ZCanvasDrawingStrokeSchema).default([]),
  viewport: ZCanvasViewportSchema.optional(),
});
export type ZCanvasPage = z.infer<typeof ZCanvasPageSchema>;

export const ZCanvasDocumentSchema = z.object({
  version: z.literal(1).default(1),
  nodes: z.array(ZCanvasNodeSchema).default([]),
  edges: z.array(ZCanvasEdgeSchema).default([]),
  strokes: z.array(ZCanvasDrawingStrokeSchema).default([]),
  viewport: ZCanvasViewportSchema.default({ zoom: 1, panX: 40, panY: 40 }),
  /** Multi-page / multi-sheet workbook support (Draw.io sheets model) */
  pages: z.array(ZCanvasPageSchema).optional(),
  activePageId: z.string().optional(),
});
export type ZCanvasDocument = z.infer<typeof ZCanvasDocumentSchema>;

export type ZCanvasTool =
  | 'select'
  | 'hand'
  | 'laser'
  | 'frame'
  | 'rectangle'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'cylinder'
  | 'cloud'
  | 'sticky-note'
  | 'document'
  | 'parallelogram'
  | 'hexagon'
  | 'subroutine'
  | 'text'
  | 'pen'
  | 'line'
  | 'arrow'
  | 'eraser'
  | 'card'
  | 'table'
  | 'container';
