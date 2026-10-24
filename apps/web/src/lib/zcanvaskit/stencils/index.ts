/**
 * The stencil subsystem: artwork the engine owns, and the lookup that resolves
 * it by id.
 *
 * A stencil used to live in the application, twice over — once as a React
 * component and once as a markup string — and the engine reached up into the
 * app to read it. This directory is that artwork moved down into the engine,
 * collapsed to one copy, in the one form all three of its consumers can use:
 * the canvas, the library panel, and the exporter.
 */

export type {
  StencilDefinition,
  StencilRenderContext,
  StencilViewBox,
} from './types';
export { DEFAULT_STENCIL_VIEW_BOX } from './types';

export { escapeAttr, escapeXml, formatNumber, normalizeStencilColor } from './xml';

export type { StencilRegistry } from './registry';
export {
  createStencilRegistry,
  stencilTransform,
  stencilViewBox,
} from './registry';

export type { ArchitectureStencilMeta } from './architecture';
export { ARCHITECTURE_STENCILS, ARCHITECTURE_STENCIL_META } from './architecture';

export { TECH_ICON_STENCILS } from './tech-icons';

export type { StandardDrawioShapeDef } from './standard-shapes';
export { STANDARD_DRAWIO_SHAPES } from './standard-shapes';

export type { ShapeNodeOptions, ShapeRenderContext } from './shapes';
export {
  renderCloudMarkup,
  renderCylinderMarkup,
  renderDocumentMarkup,
  renderHexagonMarkup,
  renderParallelogramMarkup,
  renderSubroutineMarkup,
} from './shapes';

export type { ElementArrayRender, ExcalidrawElementLike } from './element-array';
export { isExcalidrawElementArray, renderElementArray } from './element-array';

export { BUILTIN_STENCIL_REGISTRY, BUILTIN_STENCILS } from './builtin';

export type {
  ZCanvasComponentTool,
  ZCanvasDragDataTransfer,
  ZCanvasDragItem,
  ZCanvasLegacyMime,
  ZCanvasPatternDragItem,
  ZCanvasPatternEdge,
  ZCanvasPatternNode,
  ZCanvasPatternPayload,
  ZCanvasShapeTool,
  ZCanvasStencilDragItem,
  ZCanvasToolDragItem,
  ZCanvasToolName,
} from './drag-payload';
export {
  COMPONENT_TOOLS,
  hasDragItem,
  isShapeTool,
  isToolName,
  readDragItem,
  SHAPE_TOOLS,
  writeDragItem,
  ZCANVAS_ITEM_MIME,
  ZCANVAS_LEGACY_MIMES,
  ZCANVAS_TOOL_NAMES,
} from './drag-payload';

export type {
  ZCanvasIdFactory,
  ZCanvasPlacement,
  ZCanvasPlacementContext,
} from './placement';
export {
  createIdFactory,
  createShapeNode,
  placeDragItem,
  SHAPE_DEFAULTS,
} from './placement';

