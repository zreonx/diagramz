'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  ZCanvasTool,
  ZCanvasNode,
  ZCanvasEdge,
  ZCanvasEdgeRouting,
  ZCanvasDrawingStroke,
  ZCanvasDocument,
  ZCanvasPage,
  ZCanvasHandlePosition,
  ZCanvasPoint,
  ZCanvasBox,
  hasEditableLabel,
  holdsAspect,
  isGeometricShape,
} from '../core/schema';
import {
  boxCenter,
  normalizeRotation,
  rotationDelta,
  rotationOf,
  snapRotation,
} from '../core/rotation';
import {
  getHandlePoint,
  getNearestHandle,
  getNearestSideAndOffset,
  computeEdgeGeometry,
  computeMultiConnectionOffsets,
  resolveEdgeLabelPositions,
  edgeIntersectsBox,
  computeSmoothBezierPath,
  computeOrthogonalStepPath,
  snapToGrid,
  doBoxesIntersect,
  calculateAlignmentGuides,
  injectLineJumps,
  AlignmentGuide,
  findStrokeAt,
  getStrokeBounds,
  getStrokesBounds,
  resizeBoxFromHandle,
  resizeStroke,
  beginSelectionDrag,
  isDragSnapshotMovable,
  translateSelection,
  type ZCanvasDragSelection,
  type ZCanvasDragSnapshot,
  type ZCanvasResizeHandle,
} from '../geometry';
import { ZCanvasHistory } from '../core/history';
import { beautifyArchitectureLayout } from '../core/layout-beautifier';
import { ZCanvasToolbar } from './ZCanvasToolbar';
import { ZCanvasMinimap } from './ZCanvasMinimap';
import { ZCanvasShortcutsDialog } from './ZCanvasShortcutsDialog';
import { ZCanvasSettingsDialog } from './ZCanvasSettingsDialog';
import { ZCanvasContextMenu } from './ZCanvasContextMenu';
import {
  copySelection,
  pasteClipboard,
  duplicateSelection,
  getInternalClipboard,
} from '../core/clipboard';
import {
  activeGroupIdOf,
  canGroup,
  expandSelection,
  expandSelectionInContext,
  groupFrames,
  groupIdsOf,
  groupNodes,
  isGrouped,
  pruneEmptyGroupBoxes,
  pruneGroups,
  scaleNodesInBox,
  ungroupNodes,
} from '../core/grouping';
import {
  boundaryAtPoint,
  childIdsOf,
  encloses,
  isBoundaryNode,
  FRAME_PRESETS,
  type ZCanvasFramePreset,
} from '../core/boundaries';
import {
  nodeStackKey,
  paintOrderRanks,
  topmostNodeAt,
  findConnectableNodeAt,
  type FindConnectableNodeOptions,
} from '../core/paint-order';
import { isLocked, lockedIds as lockedElementIds } from '../core/locking';
import {
  pressModifiers,
  selectionAfterPress,
  toggleInSelection,
  togglesSelection,
  unionSelections,
  widensSelection,
  type ZCanvasPressModifiers,
} from '../core/selection';
import {
  ReorderNodesCommand,
  ToggleLockCommand,
  StackingDirection,
} from '../core/commands';
import {
  loadCanvasSettings,
  saveCanvasSettings,
  ZCanvasSettings,
} from '../core/settings';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, clampZoom } from '../core/viewport';
import {
  DEFAULT_DRAW_COLOR,
  DEFAULT_PEN_STYLE,
  applyPenStyleToStroke,
  getStrokeDashArray,
  penInkGeometry,
  resolveNodeFill,
  resolveNodeStroke,
  withOpacity,
} from '../core/style-models';
import { resolveInkRender } from '../rendering/ink/freehand';
import {
  diamondVertices,
  getRoundedPolygonPath,
  triangleVertices,
} from '../rendering/shapes/polygon';
import { PEN_CURSOR } from './cursors';
import { getSketchRectPath, getSketchEdgePath } from '../rendering/sketch/rough-svg';
import {
  ZCanvasShapeGeometry,
  ZCanvasSvgShapeType,
} from './ZCanvasShapeGeometry';
import {
  ZCanvasStylePanel,
  ZCanvasStyleTarget,
  ZCanvasNodeStylePatch,
  ZCanvasEdgeStylePatch,
  ZCanvasPenStylePatch,
} from './ZCanvasStylePanel';
import { QuickConnectPicker, type QuickConnectOption } from './QuickConnectPicker';
import { ZCanvasSheetTabs } from './ZCanvasSheetTabs';
import { ZCanvasPresentationDock } from './ZCanvasPresentationDock';
import { exportDocumentToSvg, downloadSvg } from '../export/svg';
import { exportDocumentToPng } from '../export/png';
import { Server, Database, Layers, Key, Lock, Plus, RotateCw, X, Frame, Maximize2, Minus, Hand, ChevronUp, ChevronRight, ChevronDown, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { getEdgeColor } from '../core/theme-tokens';
import {
  ZCanvasElementArrayGraphic,
  ZCanvasStencilGraphic,
} from './ZCanvasArtwork';
import { resolveIconMap, type ZCanvasRenderers } from './renderers';
import {
  createShapeNode,
  hasDragItem,
  isShapeTool,
  placeDragItem,
  readDragItem,
  SHAPE_DEFAULTS,
  type ZCanvasShapeTool,
} from '../stencils';

/**
 * The part of a pointer event every gesture on this canvas reads.
 *
 * Both React's synthetic event and a native one satisfy it, which is what lets
 * a drag that has left the canvas be driven by a window listener and an
 * ordinary move inside it be driven by the element's own handler — the same
 * function, handed either kind of event.
 */
type CanvasPointer = {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  /**
   * The DOM event behind a React one, when there is one. It is how the window
   * listeners recognise the dispatch the canvas has already handled, so they can
   * leave that one alone — see `seenPointerEventRef`.
   */
  nativeEvent?: Event;
};

/**
 * How far the selection wash reaches past the ink it marks, in canvas pixels at
 * 100% zoom. Drawn as an extra-thick stroke of the ink's own path beneath it —
 * the only way a wash can show on a filled mark, whose path is its silhouette
 * and would be completely hidden by an identical fill underneath.
 *
 * Divided by the zoom where it is used, so the wash keeps the same screen
 * thickness however far the canvas is zoomed.
 */
const INK_SELECTION_PADDING = 8;

/** How much of the ink the wash lets through: enough to read, not to recolour. */
const INK_SELECTION_WASH_OPACITY = 0.4;

/**
 * How far the pointer may travel before a press stops counting as a click.
 *
 * Measured in screen pixels rather than canvas units, so the threshold means the
 * same thing at every zoom: it is about how steady the hand was, not about how
 * far the canvas moved underneath it.
 */
const CLICK_SLOP_PX = 3;

/**
 * How small a node may be dragged before it stops shrinking.
 *
 * Two numbers rather than one because a shape has always been allowed to be
 * narrower than it is tall: the floor is what a card's header and a stencil's
 * artwork need to stay legible, not one dimension.
 */
const MIN_NODE_WIDTH = 80;
const MIN_NODE_HEIGHT = 40;

/** Node types rendered as bare SVG geometry rather than an HTML card. */
export function isSvgShapeType(
  type: ZCanvasNode['type']
): type is ZCanvasSvgShapeType {
  return (
    type === 'circle' ||
    type === 'diamond' ||
    type === 'triangle' ||
    type === 'cylinder' ||
    type === 'cloud'
  );
}

/** Arrowhead variants a connector end can use. */
export type ZCanvasArrowhead = NonNullable<ZCanvasEdge['endArrowhead']>;

export const ARROWHEAD_TYPES: ZCanvasArrowhead[] = [
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
];

/**
 * Marker definitions for each arrowhead variant, rendered once into `<defs>`.
 * `refX` places the anchor so the glyph sits at the line end rather than
 * overlapping back along it; `orient="auto-start-reverse"` lets one marker
 * serve both ends of a connector.
 */
export const ARROWHEAD_MARKERS: Array<{
  type: Exclude<ZCanvasArrowhead, 'none'>;
  refX: number;
  refY: number;
  viewBox?: string;
  markerWidth?: string;
  markerHeight?: string;
  content: React.ReactNode;
}> = [
  { type: 'arrow', refX: 9, refY: 5, content: <path d="M 0 1.5 L 10 5 L 0 8.5 z" /> },
  {
    type: 'barbs',
    refX: 9,
    refY: 5,
    content: (
      <path
        d="M 1 1 L 9.5 5 L 1 9"
        fill="none"
        stroke="context-stroke"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    type: 'architectural',
    refX: 5,
    refY: 5,
    content: (
      <line
        x1="1.5"
        y1="8.5"
        x2="8.5"
        y2="1.5"
        stroke="context-stroke"
        strokeWidth="2"
        strokeLinecap="round"
      />
    ),
  },
  { type: 'triangle', refX: 9, refY: 5, content: <path d="M 0 0 L 10 5 L 0 10 z" /> },
  { type: 'circle', refX: 5, refY: 5, content: <circle cx="5" cy="5" r="3.6" /> },
  { type: 'diamond', refX: 5, refY: 5, content: <path d="M 5 0.5 L 9.5 5 L 5 9.5 L 0.5 5 z" /> },
  {
    type: 'er-one',
    refX: 15,
    refY: 6,
    viewBox: '0 0 16 12',
    markerWidth: '9',
    markerHeight: '7',
    content: (
      <g stroke="context-stroke" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <line x1="8" y1="1.5" x2="8" y2="10.5" />
        <line x1="12.5" y1="1.5" x2="12.5" y2="10.5" />
      </g>
    ),
  },
  {
    type: 'er-zero-one',
    refX: 15,
    refY: 6,
    viewBox: '0 0 16 12',
    markerWidth: '9',
    markerHeight: '7',
    content: (
      <g stroke="context-stroke" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <circle cx="5.5" cy="6" r="3.2" fill="var(--card, #0f172a)" />
        <line x1="12.5" y1="1.5" x2="12.5" y2="10.5" />
      </g>
    ),
  },
  {
    type: 'er-many',
    refX: 15,
    refY: 6,
    viewBox: '0 0 16 12',
    markerWidth: '9',
    markerHeight: '7',
    content: (
      <g stroke="context-stroke" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6.5" y1="1.5" x2="6.5" y2="10.5" />
        <path d="M 15 1.2 L 8 6 L 15 10.8" />
        <line x1="8" y1="6" x2="15" y2="6" />
      </g>
    ),
  },
  {
    type: 'er-zero-many',
    refX: 15,
    refY: 6,
    viewBox: '0 0 16 12',
    markerWidth: '9',
    markerHeight: '7',
    content: (
      <g stroke="context-stroke" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="4.5" cy="6" r="3" fill="var(--card, #0f172a)" />
        <path d="M 15 1.2 L 8.5 6 L 15 10.8" />
        <line x1="8.5" y1="6" x2="15" y2="6" />
      </g>
    ),
  },
];

/** `marker-start` / `marker-end` URL for a resolved arrowhead type. */
function arrowheadMarkerUrl(type: ZCanvasArrowhead): string | undefined {
  return type === 'none' ? undefined : `url(#zcanvas-head-${type})`;
}

/**
 * The padlock itself.
 *
 * One lock reads like every other, wherever it is worn, so the pill is drawn
 * once and positioned by whoever has a place to put it.
 */
function LockPill() {
  return (
    <div className="rounded-full bg-amber-500 text-white p-1 shadow-md ring-2 ring-background">
      <Lock className="w-3 h-3" />
    </div>
  );
}

/**
 * A lock worn by something drawn on the canvas rather than by a node wrapper.
 *
 * A shape has a wrapper of its own to hang a badge on, but a connector and a
 * mark of ink are drawn by the canvas SVG underneath it: they have nowhere to
 * hang one that is not simply a point in canvas space. This places a pill at
 * such a point, through the same transform the canvas is under, and gives back
 * the two things that placement needs:
 *
 * - `scale(1 / zoom)` about the anchor keeps the badge the same size on screen
 *   at every zoom — it marks the element, it is not part of it. Scaling first
 *   means the offset shrinks with it, so the pill keeps its distance from the
 *   point it marks rather than drifting away from it as the user zooms out.
 * - no pointer events, so it neither hides the element's own grasps nor
 *   becomes one: the lock is read, not grabbed.
 */
function LockBadge({
  id,
  at,
  zoom,
  z,
  offset,
}: {
  /** The element the lock belongs to, for the badge to be read back by. */
  id: string;
  at: { x: number; y: number };
  zoom: number;
  z: number;
  offset: string;
}) {
  return (
    <div
      data-lock-badge={id}
      className="absolute pointer-events-none"
      style={{
        left: `${at.x}px`,
        top: `${at.y}px`,
        transform: `scale(${1 / zoom}) translate(${offset})`,
        transformOrigin: '0 0',
        zIndex: z,
      }}
    >
      <LockPill />
    </div>
  );
}

/**
 * Resolves each end of a connector to a concrete arrowhead.
 *
 * An unset end defaults to an arrow so plain arrows keep working, while an
 * unset start stays bare — the classic "arrow, not double arrow" default.
 */
export function resolveEdgeArrowheads(edge: ZCanvasEdge): {
  start: ZCanvasArrowhead;
  end: ZCanvasArrowhead;
} {
  return {
    start: edge.startArrowhead ?? 'none',
    end: edge.endArrowhead ?? 'arrow',
  };
}

interface AutoResizeTextareaProps {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}

function AutoResizeTextarea({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
  className,
  style,
  autoFocus = true,
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(24, textareaRef.current.scrollHeight)}px`;
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onSave();
          }
          // Plain Enter inserts a new line (native textarea behavior, do not preventDefault)
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className={cn(
        'bg-transparent border-none outline-none resize-none w-full p-0 shadow-none ring-0 overflow-hidden leading-snug',
        className
      )}
      style={{
        height: 'auto',
        ...style,
      }}
    />
  );
}

export interface ZCanvasProps {
  initialDocument: ZCanvasDocument;
  onChange?: (document: ZCanvasDocument) => void;
  readOnly?: boolean;
  /**
   * Presentation the host lends the engine. Optional: the engine draws with its
   * own defaults when nothing is supplied, so it stands alone.
   */
  renderers?: ZCanvasRenderers;
  edgeRouting?: ZCanvasEdgeRouting;
  onEdgeRoutingChange?: (routing: ZCanvasEdgeRouting) => void;
  onNodeDoubleClick?: (node: ZCanvasNode) => void;
}

export function ZCanvas({
  initialDocument,
  onChange,
  readOnly = false,
  renderers,
  edgeRouting: propEdgeRouting,
  onEdgeRoutingChange,
  onNodeDoubleClick,
}: ZCanvasProps) {
  const iconMap = useMemo(() => resolveIconMap(renderers), [renderers]);
  const [nodes, setNodes] = useState<ZCanvasNode[]>(initialDocument.nodes || []);
  const [edges, setEdges] = useState<ZCanvasEdge[]>(initialDocument.edges || []);
  const [strokes, setStrokes] = useState<ZCanvasDrawingStroke[]>(initialDocument.strokes || []);
  const [viewport, setViewport] = useState(initialDocument.viewport || { zoom: 1, panX: 40, panY: 40 });

  // Multi-Page Workbook model (Draw.io style)
  const [pages, setPages] = useState<ZCanvasPage[]>(() => {
    if (initialDocument.pages && initialDocument.pages.length > 0) {
      return initialDocument.pages;
    }
    return [
      {
        id: 'page-1',
        name: 'Page 1',
        nodes: initialDocument.nodes || [],
        edges: initialDocument.edges || [],
        strokes: initialDocument.strokes || [],
        viewport: initialDocument.viewport,
      },
    ];
  });
  const [activePageId, setActivePageId] = useState<string>(() => {
    if (initialDocument.activePageId && initialDocument.pages?.some((p) => p.id === initialDocument.activePageId)) {
      return initialDocument.activePageId;
    }
    return initialDocument.pages?.[0]?.id || 'page-1';
  });
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const activePageIdRef = useRef(activePageId);
  activePageIdRef.current = activePageId;

  // Presentation Mode & Glowing Neon Laser Pointer
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [laserTrail, setLaserTrail] = useState<Array<{ x: number; y: number; time: number }>>([]);

  const [activeTool, setActiveTool] = useState<ZCanvasTool>(readOnly ? 'hand' : 'select');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  useEffect(() => {
    if (readOnly) {
      setActiveTool('hand');
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setSelectedStrokeIds([]);
    }
  }, [readOnly]);
  /**
   * The node the user actually pressed, which is not always the only selected
   * one: pressing a grouped shape selects the rest of its group so the members
   * drag together. The style panel edits this node, so the pressed one stays
   * styleable while its group-mates ride along in the selection.
   */
  const [primarySelectedNodeId, setPrimarySelectedNodeId] = useState<string | null>(null);
  /**
   * The boundary the pointer is over, when it is over nothing else.
   *
   * A boundary paints below its contents, so the patch of canvas a press reaches
   * inside one is the box itself. Saying so before the press — a box already in
   * hand shows a move cursor, one not yet picked up shows a pointer — is what
   * makes the body read as grabbable rather than as empty canvas. It is only
   * ever the boundary the pointer is over and no child is: everywhere else the
   * element under the pointer carries its own cursor.
   */
  const [hoveredBoundaryId, setHoveredBoundaryId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  /**
   * Connectors in the selection, oldest pick first.
   *
   * A connector is picked in sets like every other element — a marquee sweep
   * catches as many as it crosses — so this is a list, and deleting, nudging or
   * sweeping reaches all of them. The one the style panel edits is the last one
   * picked, which is why no second piece of "primary" state is kept beside it:
   * a primary that could disagree with the list is a bug waiting to happen, so
   * it is derived instead.
   */
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  /** The connector the style panel shows and edits: the one picked last. */
  const selectedEdgeId = selectedEdgeIds.length > 0 ? selectedEdgeIds[selectedEdgeIds.length - 1] : null;
  /**
   * Ink picked with the select tool.
   *
   * Strokes are elements in their own right: a mark is selected, moved, scaled,
   * restyled, copied and deleted exactly like a shape. They are kept in their
   * own list rather than folded into `selectedNodeIds` because a stroke is not
   * a node — it has no box, no label and no children — and pretending otherwise
   * would push every node-shaped assumption onto it.
   */
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);

  const { isDark } = useTheme();

  // Canvas Settings & Customizations (Grid style, snapping, routing, background tone)
  const [settings, setSettings] = useState<ZCanvasSettings>(loadCanvasSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleUpdateSettings = useCallback((newPartial: Partial<ZCanvasSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      saveCanvasSettings(updated);
      if (newPartial.edgeRouting) {
        setEdgeStyle(newPartial.edgeRouting);
      }
      return updated;
    });
  }, []);

  /**
   * Edits the freehand pen's tool settings. Separate from the document on
   * purpose: this is what the pen will draw next, so it is neither an undoable
   * edit nor something that restyles the ink already on the canvas.
   */
  const updatePenStyle = useCallback(
    (patch: ZCanvasPenStylePatch) => {
      const next: Partial<ZCanvasSettings> = {};
      if (patch.color !== undefined) next.penColor = patch.color;
      // The nib is a freehand preset, shared with the canvas settings dialog,
      // so the two controls can never drift apart.
      if (patch.preset !== undefined) next.strokePreset = patch.preset;
      if (patch.sloppiness !== undefined) next.penSloppiness = patch.sloppiness;
      if (patch.strokeStyle !== undefined) next.penStrokeStyle = patch.strokeStyle;
      if (patch.opacity !== undefined) next.penOpacity = patch.opacity;
      if (Object.keys(next).length === 0) return;
      handleUpdateSettings(next);
    },
    [handleUpdateSettings]
  );

  /**
   * Picking a tool. The drawing tools drop the selection: the style panel switches
   * to that tool's own options, and a selection ring left on a shape the user is no
   * longer editing is just noise. Tools that return the canvas to `select` after
   * one use keep their selection — a freshly drawn shape is meant to stay selected.
   */
  const selectTool = useCallback((tool: ZCanvasTool) => {
    if (tool === 'pen' || tool === 'eraser') {
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setPrimarySelectedNodeId(null);
      setSelectedStrokeIds([]);
    }
    setActiveTool(tool);
  }, []);

  const snap = useCallback(
    (val: number) => {
      return settings.snapToGrid ? snapToGrid(val, settings.snapSize || 8) : Math.round(val);
    },
    [settings.snapToGrid, settings.snapSize]
  );

  // Styling & Routing Options
  const [edgeStyle, setEdgeStyle] = useState<ZCanvasEdgeRouting>(propEdgeRouting || 'bezier');

  // Synchronize canvas line routing when toggled from header menu
  useEffect(() => {
    if (propEdgeRouting && propEdgeRouting !== edgeStyle) {
      setEdgeStyle(propEdgeRouting);
      handleUpdateSettings({ edgeRouting: propEdgeRouting });
    }
  }, [propEdgeRouting, edgeStyle, handleUpdateSettings]);

  /** The single drawing colour for pen strokes and new connectors. Hard-coded
   * because the toolbar no longer offers a colour swatch: shape and component
   * appearance comes from the theme, and a connector's colour is set in the
   * style panel after it is drawn. */
  const activeColor = DEFAULT_DRAW_COLOR;

  // History Undo/Redo Manager
  const historyRef = useRef<ZCanvasHistory<ZCanvasDocument>>(
    new ZCanvasHistory<ZCanvasDocument>(50)
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Panning & Interaction Refs
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number; dist?: number; zoom?: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Marquee Selection Box
  const [marqueeBox, setMarqueeBox] = useState<ZCanvasBox | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * The selection a sweep that widens started from, or `null` for a sweep that
   * builds its own.
   *
   * Held for the whole sweep rather than read again on every move: a widening
   * gesture only ever adds, so a box dragged back off an element it caught
   * leaves that element picked. A sweep that re-decided from the live selection
   * each frame would take it back out, which is the silent loss the widening
   * modifiers exist to prevent.
   */
  const marqueeBaseRef = useRef<{
    nodeIds: string[];
    edgeIds: string[];
    strokeIds: string[];
  } | null>(null);

  // Alignment Guidelines (Smart Guides)
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);

  // Dragging Node(s)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * What the move in flight is measured from.
   *
   * A drag moves the whole selection, not the one kind of element the press
   * happened to land on, so a single snapshot serves shapes, free connectors
   * and ink together. Taking it once at the press is what keeps them under the
   * pointer however long the drag runs.
   */
  const dragSnapshotRef = useRef<ZCanvasDragSnapshot | null>(null);

  /**
   * A press on the body of a boundary that has not been resolved yet.
   *
   * The body of a boundary is a bare patch of canvas: it is painted below
   * everything it encloses, so a press that reaches the canvas inside one is a
   * press on the box itself. That press can mean either of two things, and the
   * press alone cannot say which — a click picks the box up, a drag sweeps a
   * selection over what is inside it. Which one it was is only known when the
   * pointer comes back up, so the press is held here until then.
   */
  const pendingBoundaryPressRef = useRef<{
    nodeId: string;
    clientX: number;
    clientY: number;
    /** The modifiers the press was made with, replayed on the release. */
    modifiers: ZCanvasPressModifiers;
  } | null>(null);

  // Resizing Node
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<ZCanvasResizeHandle | null>(null);
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    startWidth: number;
    startHeight: number;
    /** The angle the node was at when the grip was taken, so the drag is
     * measured along the axes the shape is showing. */
    startRotation: number;
  }>({
    startX: 0,
    startY: 0,
    nodeStartX: 0,
    nodeStartY: 0,
    startWidth: 0,
    startHeight: 0,
    startRotation: 0,
  });

  // Turning a node from the grip above it.
  const [rotatingNodeId, setRotatingNodeId] = useState<string | null>(null);
  const rotateStartRef = useRef<{
    nodeId: string;
    /** The node's centre, which is the point the whole gesture turns about. */
    centre: ZCanvasPoint;
    /** Where the pointer was at the press, so the turn is measured from it. */
    startPoint: ZCanvasPoint;
    startRotation: number;
    moved: boolean;
  } | null>(null);

  // A selection being moved as one, by a gesture measured from the pointer.
  const [draggingSelection, setDraggingSelection] = useState(false);
  /**
   * A drag of the whole selection, begun on an element that has no box of its
   * own to be measured from — a mark of ink, or a line drawn free of any shape.
   *
   * A press on a shape measures its move against that shape's own frame, so it
   * has `draggingNodeId` to hang from. Ink and a free connector have no frame,
   * so the gesture is measured from the point the pointer went down on. Both
   * move everything the press left selected, through the same snapshot, so a
   * selection of shapes and lines travels as one however it was grabbed.
   */
  const selectionDragRef = useRef<{
    startPoint: ZCanvasPoint;
    moved: boolean;
  } | null>(null);

  // Scaling picked ink from a corner of its box.
  const [resizingInk, setResizingInk] = useState(false);
  const strokeResizeRef = useRef<{
    handle: string;
    startPoint: ZCanvasPoint;
    /** The selection box as it stood when the handle was taken hold of. */
    box: ZCanvasBox;
    origin: Map<string, ZCanvasDrawingStroke>;
    moved: boolean;
  } | null>(null);

  // Connecting Nodes
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingHandlePos, setConnectingHandlePos] = useState<ZCanvasHandlePosition>('right');
  const [connectingSourceOffset, setConnectingSourceOffset] = useState<number>(0);
  const [connectLinePos, setConnectLinePos] = useState<ZCanvasPoint | null>(null);
  const [quickConnectState, setQuickConnectState] = useState<{
    sourceId: string;
    sourceHandle: ZCanvasHandlePosition;
    sourceOffset?: number;
    pt: ZCanvasPoint;
  } | null>(null);

  // Freehand Drawing (Catmull-Rom ink)
  const [currentStroke, setCurrentStroke] = useState<ZCanvasDrawingStroke | null>(null);

  // Interactive Drag-to-Create Shape
  const [drawingShapeBox, setDrawingShapeBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    tool: ZCanvasShapeTool | 'text' | 'frame';
  } | null>(null);
  const drawingShapeStartRef = useRef<{
    x: number;
    y: number;
    tool: ZCanvasShapeTool | 'text' | 'frame';
  } | null>(null);

  // Interactive Line & Arrow Drag-to-Create
  const [drawingLine, setDrawingLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    hasArrow: boolean;
  } | null>(null);
  const drawingLineStartRef = useRef<{
    x: number;
    y: number;
    hasArrow: boolean;
  } | null>(null);

  // Re-positioning an existing line/arrow (drag whole edge, adjust bend position, or drag one endpoint)
  const [edgeDraft, setEdgeDraft] = useState<{
    edgeId: string;
    p1: ZCanvasPoint;
    p2: ZCanvasPoint;
    /** Node the dragged endpoint would snap onto, if any */
    attachNodeId: string | null;
    attachHandle?: ZCanvasHandlePosition;
    attachOffset?: number;
  } | null>(null);
  const edgeDragRef = useRef<{
    edgeId: string;
    mode: 'none' | 'move' | 'source' | 'target' | 'position' | 'waypoint';
    startPoint: ZCanvasPoint;
    origin: { p1: ZCanvasPoint; p2: ZCanvasPoint };
    originStepOffset?: number;
    currentStepOffset?: number;
    waypointIndex?: number;
    originWaypoints?: ZCanvasPoint[];
    currentWaypoints?: ZCanvasPoint[];
    sourcePos?: ZCanvasHandlePosition;
    targetPos?: ZCanvasHandlePosition;
    edgeStyle?: ZCanvasEdgeRouting;
    moved?: boolean;
  } | null>(null);
  const edgeDraftRef = useRef<typeof edgeDraft>(null);

  // Eraser Interaction State
  const isErasingRef = useRef(false);

  // In-place text editing
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'title' | 'subtitle' | 'badge' | 'field_name' | 'field_type' | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Connection label editing modal
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [editingConnectionText, setEditingConnectionText] = useState<string>('');

  // Edge label dragging & repositioning
  const draggingEdgeLabelRef = useRef<{
    edgeId: string;
    startClientX: number;
    startClientY: number;
    startOffset: { x: number; y: number };
    midPoint: ZCanvasPoint;
    p1: ZCanvasPoint;
    p2: ZCanvasPoint;
    moved: boolean;
  } | null>(null);
  const [draggingEdgeLabelId, setDraggingEdgeLabelId] = useState<string | null>(null);
  const lastLabelClickRef = useRef<{ edgeId: string; time: number } | null>(null);
  const [activeLineDrag, setActiveLineDrag] = useState<{
    edgeId: string;
    offset: number;
    isCenter: boolean;
    style: ZCanvasEdgeRouting;
  } | null>(null);

  // Keyboard Shortcuts Cheatsheet Modal
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Draw.io Group Drill-Down State:
  // Single-click on a grouped node selects the whole group; double-click enters
  // the group (`enteredGroupId`) and selects the individual child component.
  const [enteredGroupId, setEnteredGroupId] = useState<string | null>(null);
  const justDrilledIntoGroupRef = useRef<string | null>(null);

  // Collective Group / Multi-Selection Box Resize State
  const groupResizeRef = useRef<{
    handle: ZCanvasResizeHandle;
    startPoint: ZCanvasPoint;
    box: ZCanvasBox;
    originNodes: Map<string, ZCanvasNode>;
    moved: boolean;
  } | null>(null);
  const [resizingGroupBox, setResizingGroupBox] = useState(false);

  // The document as it stood when the current live-editing gesture began.
  const gestureBaselineRef = useRef<ZCanvasDocument | null>(null);

  // Spacebar Quick-Pan tracking
  const isSpacePressedRef = useRef(false);
  const toolBeforeSpaceRef = useRef<ZCanvasTool>('select');

  // Track cursor position in canvas world coordinates
  const lastMousePosRef = useRef<{ clientX: number; clientY: number } | null>(null);

  /**
   * The DOM event the canvas itself has already handled, if any.
   *
   * A gesture is driven by the canvas root's own handlers, but the canvas root
   * is not the only thing inside the canvas: the floating toolbar and the style
   * panel sit on top of it, and a release that lands on one of them is stopped
   * before it can reach the root — so the drag it belonged to never ended and
   * the component went on following the pointer until the next click. "Did the
   * event land inside the canvas element" cannot tell those apart, because both
   * do; the identity of the event can, so the window listeners below stand down
   * for exactly the dispatch the root already saw and take care of every other
   * one. Running a release twice is not harmless: it would record one drag as
   * two undo steps.
   */
  const seenPointerEventRef = useRef<Event | null>(null);

  // Helper to accurately map browser screen coordinates into canvas world space
  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const offsetX = rect ? clientX - rect.left : clientX;
      const offsetY = rect ? clientY - rect.top : clientY;
      return {
        x: (offsetX - viewport.panX) / viewport.zoom,
        y: (offsetY - viewport.panY) / viewport.zoom,
      };
    },
    [viewport]
  );

  /**
   * Selection arrives as whole groups.
   *
   * Picking any member picks the group it belongs to, whether it was picked by
   * a click or caught by a sweep, so a group behaves as one element without
   * anything being drawn for it. `Alt` is the way past: it picks the element
   * under the pointer on its own, which is how one member of a group is
   * restyled or nudged by itself.
   */
  const selectWholeGroups = useCallback(
    (ids: string[], activeEnteredGroup: string | null = enteredGroupId) =>
      ids.length === 0 ? ids : expandSelectionInContext(nodes, ids, activeEnteredGroup),
    [nodes, enteredGroupId]
  );

  /**
   * Paint order for the elements layer.
   *
   * Document order is the source of truth, so Bring to Front / Send to Back
   * move an element against every other one — a VPC included. `paintOrderRanks`
   * holds the two rules that refine it, and the ranking is derived here rather
   * than beside the renderer because both the renderer and the press that picks
   * an element read it, and a press must resolve to whatever is painted on top.
   */
  const paintOrder = useMemo(() => paintOrderRanks(nodes), [nodes]);

  /**
   * Topmost node whose bounding box contains the given canvas-space point.
   *
   * Resolved by paint order rather than by walking the document, so the element
   * a press lands on is the element drawn under the pointer. Walking the
   * document backwards got this wrong for a boundary that encloses its
   * contents: the box comes later in the file, so the walk returned the box and
   * the shape inside it could not be picked through it.
   */
  const findNodeAt = useCallback(
    (pt: ZCanvasPoint, options?: FindConnectableNodeOptions): ZCanvasNode | null =>
      findConnectableNodeAt(nodes, pt, paintOrder, options),
    [nodes, paintOrder]
  );

  /** The ids of every element a lock is holding still. */
  const lockedIds = useMemo(
    () => lockedElementIds({ nodes, edges, strokes }),
    [nodes, edges, strokes]
  );

  /**
   * The part of a selection a gesture is allowed to change.
   *
   * One predicate, applied wherever a selection is about to be written to, so
   * that "locked" means the same thing to a drag, a nudge, a Delete and a style
   * change. A locked element stays in the selection rather than being dropped
   * from it: it is still highlighted, still answers a click, and still carries
   * the menu that unlocks it — it simply does not move.
   */
  const movable = useCallback(
    (ids: string[]) => (lockedIds.size === 0 ? ids : ids.filter((id) => !lockedIds.has(id))),
    [lockedIds]
  );

  /**
   * Whether a lock is holding the element with this id still.
   *
   * The same set `movable` reads, asked by id rather than by list, for the
   * panels and editors that reach an element by naming it — the style panel
   * edits whatever the primary selection is, the table body edits the row under
   * the pointer, and neither of those arrives with a selection to filter.
   */
  const isLockedNode = useCallback((id: string) => lockedIds.has(id), [lockedIds]);
  const isLockedStroke = isLockedNode;
  const isLockedEdge = isLockedNode;

  // Sync state upward & to history
  const commitState = useCallback(
    (
      newNodes: ZCanvasNode[],
      newEdges: ZCanvasEdge[],
      newStrokes: ZCanvasDrawingStroke[],
      recordHistory = true
    ) => {
      const currentDoc: ZCanvasDocument = {
        version: 1,
        nodes,
        edges,
        strokes,
        viewport,
        pages: pagesRef.current,
        activePageId: activePageIdRef.current,
      };

      if (recordHistory) {
        historyRef.current.push(currentDoc);
        setCanUndo(historyRef.current.canUndo());
        setCanRedo(historyRef.current.canRedo());
      }

      setNodes(newNodes);
      setEdges(newEdges);
      setStrokes(newStrokes);

      const updatedPages = pagesRef.current.map((p) =>
        p.id === activePageIdRef.current
          ? { ...p, nodes: newNodes, edges: newEdges, strokes: newStrokes, viewport }
          : p
      );
      setPages(updatedPages);

      if (onChange) {
        onChange({
          version: 1,
          nodes: newNodes,
          edges: newEdges,
          strokes: newStrokes,
          viewport,
          pages: updatedPages,
          activePageId: activePageIdRef.current,
        });
      }
    },
    [nodes, edges, strokes, viewport, onChange]
  );

  // Undo / Redo Handlers
  const handleUndo = useCallback(() => {
    const currentDoc: ZCanvasDocument = {
      version: 1,
      nodes,
      edges,
      strokes,
      viewport,
      pages: pagesRef.current,
      activePageId: activePageIdRef.current,
    };
    const prev = historyRef.current.undo(currentDoc);
    if (prev) {
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setStrokes(prev.strokes || []);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
      const updatedPages = pagesRef.current.map((p) =>
        p.id === activePageIdRef.current
          ? { ...p, nodes: prev.nodes, edges: prev.edges, strokes: prev.strokes || [], viewport }
          : p
      );
      setPages(updatedPages);
      if (onChange) {
        onChange({
          ...prev,
          viewport,
          pages: updatedPages,
          activePageId: activePageIdRef.current,
        });
      }
    }
  }, [nodes, edges, strokes, viewport, onChange]);

  const handleRedo = useCallback(() => {
    const currentDoc: ZCanvasDocument = {
      version: 1,
      nodes,
      edges,
      strokes,
      viewport,
      pages: pagesRef.current,
      activePageId: activePageIdRef.current,
    };
    const next = historyRef.current.redo(currentDoc);
    if (next) {
      setNodes(next.nodes);
      setEdges(next.edges);
      setStrokes(next.strokes || []);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
      const updatedPages = pagesRef.current.map((p) =>
        p.id === activePageIdRef.current
          ? { ...p, nodes: next.nodes, edges: next.edges, strokes: next.strokes || [], viewport }
          : p
      );
      setPages(updatedPages);
      if (onChange) {
        onChange({
          ...next,
          viewport,
          pages: updatedPages,
          activePageId: activePageIdRef.current,
        });
      }
    }
  }, [nodes, edges, strokes, viewport, onChange]);

  // Multi-Page Workbook Handlers
  const handleSelectPage = useCallback(
    (pageId: string) => {
      if (pageId === activePageIdRef.current) return;
      const savedPages = pagesRef.current.map((p) =>
        p.id === activePageIdRef.current
          ? { ...p, nodes, edges, strokes, viewport }
          : p
      );
      const targetPage = savedPages.find((p) => p.id === pageId);
      if (!targetPage) return;

      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setSelectedStrokeIds([]);
      setPrimarySelectedNodeId(null);
      historyRef.current = new ZCanvasHistory(100);
      setCanUndo(false);
      setCanRedo(false);

      const newNodes = targetPage.nodes || [];
      const newEdges = targetPage.edges || [];
      const newStrokes = targetPage.strokes || [];
      const newVp = targetPage.viewport || { zoom: 1, panX: 40, panY: 40 };

      setNodes(newNodes);
      setEdges(newEdges);
      setStrokes(newStrokes);
      setViewport(newVp);
      setActivePageId(pageId);
      setPages(savedPages);

      if (onChange) {
        onChange({
          version: 1,
          nodes: newNodes,
          edges: newEdges,
          strokes: newStrokes,
          viewport: newVp,
          pages: savedPages,
          activePageId: pageId,
        });
      }
    },
    [nodes, edges, strokes, viewport, onChange]
  );

  const handleAddPage = useCallback(() => {
    const savedPages = pagesRef.current.map((p) =>
      p.id === activePageIdRef.current
        ? { ...p, nodes, edges, strokes, viewport }
        : p
    );
    const newPageId = `page-${Date.now()}`;
    const newPageName = `Page ${savedPages.length + 1}`;
    const newVp = { zoom: 1, panX: 40, panY: 40 };
    const newPage: ZCanvasPage = {
      id: newPageId,
      name: newPageName,
      nodes: [],
      edges: [],
      strokes: [],
      viewport: newVp,
    };
    const nextPages = [...savedPages, newPage];

    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedStrokeIds([]);
    setPrimarySelectedNodeId(null);
    historyRef.current = new ZCanvasHistory(100);
    setCanUndo(false);
    setCanRedo(false);

    setNodes([]);
    setEdges([]);
    setStrokes([]);
    setViewport(newVp);
    setActivePageId(newPageId);
    setPages(nextPages);

    if (onChange) {
      onChange({
        version: 1,
        nodes: [],
        edges: [],
        strokes: [],
        viewport: newVp,
        pages: nextPages,
        activePageId: newPageId,
      });
    }
  }, [nodes, edges, strokes, viewport, onChange]);

  const handleRenamePage = useCallback(
    (id: string, newName: string) => {
      const updated = pagesRef.current.map((p) => (p.id === id ? { ...p, name: newName } : p));
      setPages(updated);
      if (onChange) {
        onChange({
          version: 1,
          nodes,
          edges,
          strokes,
          viewport,
          pages: updated,
          activePageId: activePageIdRef.current,
        });
      }
    },
    [nodes, edges, strokes, viewport, onChange]
  );

  const handleDuplicatePage = useCallback(
    (id: string) => {
      const savedPages = pagesRef.current.map((p) =>
        p.id === activePageIdRef.current
          ? { ...p, nodes, edges, strokes, viewport }
          : p
      );
      const targetIdx = savedPages.findIndex((p) => p.id === id);
      if (targetIdx === -1) return;
      const target = savedPages[targetIdx];

      const clonedId = `page-${Date.now()}`;
      const clonedPage: ZCanvasPage = {
        ...target,
        id: clonedId,
        name: `${target.name} (Copy)`,
        nodes: JSON.parse(JSON.stringify(target.nodes)),
        edges: JSON.parse(JSON.stringify(target.edges)),
        strokes: JSON.parse(JSON.stringify(target.strokes || [])),
        viewport: target.viewport ? { ...target.viewport } : undefined,
      };

      const nextPages = [...savedPages];
      nextPages.splice(targetIdx + 1, 0, clonedPage);

      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setSelectedStrokeIds([]);
      setPrimarySelectedNodeId(null);
      historyRef.current = new ZCanvasHistory(100);
      setCanUndo(false);
      setCanRedo(false);

      const newVp = clonedPage.viewport || { zoom: 1, panX: 40, panY: 40 };
      setNodes(clonedPage.nodes);
      setEdges(clonedPage.edges);
      setStrokes(clonedPage.strokes || []);
      setViewport(newVp);
      setActivePageId(clonedId);
      setPages(nextPages);

      if (onChange) {
        onChange({
          version: 1,
          nodes: clonedPage.nodes,
          edges: clonedPage.edges,
          strokes: clonedPage.strokes || [],
          viewport: newVp,
          pages: nextPages,
          activePageId: clonedId,
        });
      }
    },
    [nodes, edges, strokes, viewport, onChange]
  );

  const handleDeletePage = useCallback(
    (id: string) => {
      if (pagesRef.current.length <= 1) return;
      const currentPages = pagesRef.current;
      const targetIdx = currentPages.findIndex((p) => p.id === id);
      if (targetIdx === -1) return;

      const nextPages = currentPages.filter((p) => p.id !== id);

      if (id === activePageIdRef.current) {
        const newIdx = Math.min(targetIdx, nextPages.length - 1);
        const newPage = nextPages[newIdx];

        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        setSelectedStrokeIds([]);
        setPrimarySelectedNodeId(null);
        historyRef.current = new ZCanvasHistory(100);
        setCanUndo(false);
        setCanRedo(false);

        const newVp = newPage.viewport || { zoom: 1, panX: 40, panY: 40 };
        setNodes(newPage.nodes);
        setEdges(newPage.edges);
        setStrokes(newPage.strokes || []);
        setViewport(newVp);
        setActivePageId(newPage.id);
        setPages(nextPages);

        if (onChange) {
          onChange({
            version: 1,
            nodes: newPage.nodes,
            edges: newPage.edges,
            strokes: newPage.strokes || [],
            viewport: newVp,
            pages: nextPages,
            activePageId: newPage.id,
          });
        }
      } else {
        setPages(nextPages);
        if (onChange) {
          onChange({
            version: 1,
            nodes,
            edges,
            strokes,
            viewport,
            pages: nextPages,
            activePageId: activePageIdRef.current,
          });
        }
      }
    },
    [nodes, edges, strokes, viewport, onChange]
  );

  // Clipboard: Copy selected elements
  const handleCopy = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedStrokeIds.length === 0) return;
    const doc: ZCanvasDocument = { version: 1, nodes, edges, strokes, viewport };
    copySelection(doc, selectedNodeIds, selectedStrokeIds);
  }, [selectedNodeIds, selectedStrokeIds, nodes, edges, strokes, viewport]);

  // Clipboard: Cut selected elements
  const handleCut = useCallback(() => {
    // Copy takes the selection as it stands — reading an element is not editing
    // it — but Cut removes what it takes, so a locked element stays behind.
    handleCopy();
    const toDelete = new Set(movable(selectedNodeIds));
    const inkToDelete = new Set(movable(selectedStrokeIds));
    if (toDelete.size === 0 && inkToDelete.size === 0) return;
    // Cutting one of a pair leaves the other alone, so the group it was in goes
    // with it rather than lingering around a single element.
    commitState(
      pruneGroups(nodes.filter((n) => !toDelete.has(n.id))),
      edges.filter((ed) => !toDelete.has(ed.source) && !toDelete.has(ed.target)),
      strokes.filter((s) => !inkToDelete.has(s.id))
    );
    setSelectedNodeIds([]);
    setSelectedStrokeIds([]);
  }, [
    selectedNodeIds,
    selectedStrokeIds,
    handleCopy,
    commitState,
    nodes,
    edges,
    strokes,
    movable,
  ]);

  // Clipboard: Paste elements with offset
  const handlePaste = useCallback(() => {
    const doc: ZCanvasDocument = { version: 1, nodes, edges, strokes, viewport };
    const res = pasteClipboard(doc, { x: 30, y: 30 });
    if (res) {
      commitState(res.newNodes, res.newEdges, res.newStrokes);
      setSelectedNodeIds(res.pastedNodeIds);
      setSelectedStrokeIds(res.pastedStrokeIds);
      setSelectedEdgeIds([]);
    }
  }, [nodes, edges, strokes, viewport, commitState]);

  // Duplicate in place
  const handleDuplicate = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedStrokeIds.length === 0) return;
    const doc: ZCanvasDocument = { version: 1, nodes, edges, strokes, viewport };
    const res = duplicateSelection(doc, selectedNodeIds, { x: 30, y: 30 }, selectedStrokeIds);
    if (res) {
      commitState(res.newNodes, res.newEdges, res.newStrokes);
      setSelectedNodeIds(res.duplicatedNodeIds);
      setSelectedStrokeIds(res.duplicatedStrokeIds);
      setSelectedEdgeIds([]);
    }
  }, [selectedNodeIds, selectedStrokeIds, nodes, edges, strokes, viewport, commitState]);

  /**
   * Deletes everything that is selected.
   *
   * A sweep can pick shapes, connectors and ink at once, so this takes the
   * whole selection rather than stopping at the first kind it finds — a Delete
   * that quietly left half of what was framed on the canvas would read as the
   * key not working. All three go in one commit, so undoing the Delete brings
   * back exactly what it took.
   *
   * The keyboard and the canvas context menu both come through here, so they
   * cannot drift apart.
   *
   * A locked element is left where it is. It comes out of the sets up front
   * rather than being filtered at the end, so a locked shape takes its
   * connectors with it out of the delete: a connector hanging off a shape that
   * survived would otherwise be removed because the shape *looked* deleted.
   */
  const handleDeleteSelection = useCallback(() => {
    const nodesToDelete = new Set(movable(selectedNodeIds));
    const connectorsToDelete = new Set(movable(selectedEdgeIds));
    const inkToDelete = new Set(movable(selectedStrokeIds));
    if (nodesToDelete.size === 0 && connectorsToDelete.size === 0 && inkToDelete.size === 0) {
      return;
    }

    // A group of one is not a group: deleting one of a pair takes the group
    // with it, so the survivor is not left framed on its own.
    const nextNodes = pruneGroups(nodes.filter((n) => !nodesToDelete.has(n.id)));
    // A connector goes when it was picked, and also when a shape at either end
    // of it was: one left anchored to a shape that no longer exists would be
    // drawn pointing at nothing.
    const nextEdges = edges.filter(
      (ed) =>
        !connectorsToDelete.has(ed.id) &&
        !nodesToDelete.has(ed.source) &&
        !nodesToDelete.has(ed.target)
    );
    const nextStrokes = strokes.filter((s) => !inkToDelete.has(s.id));

    commitState(nextNodes, nextEdges, nextStrokes);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setSelectedStrokeIds([]);
  }, [
    selectedNodeIds,
    selectedEdgeIds,
    selectedStrokeIds,
    commitState,
    nodes,
    edges,
    strokes,
    movable,
  ]);

  /**
   * Selects every element on the canvas — shapes, connectors and ink alike.
   *
   * Every kind, because a selection is what the gestures act on: leaving the
   * connectors out meant Select All and a marquee disagreed about what
   * "everything" is, and a drag or a nudge then moved the shapes and the ink
   * while the lines between them stayed behind.
   */
  const handleSelectAll = useCallback(() => {
    setSelectedNodeIds(nodes.map((n) => n.id));
    setSelectedEdgeIds(edges.map((e) => e.id));
    setSelectedStrokeIds(strokes.map((s) => s.id));
  }, [nodes, edges, strokes]);

  // Stacking Order Reorder handler
  const handleReorder = useCallback(
    (direction: StackingDirection) => {
      if (selectedNodeIds.length === 0) return;
      const cmd = new ReorderNodesCommand(direction);
      cmd.execute({
        document: { version: 1, nodes, edges, strokes, viewport },
        selectedNodeIds,
        selectedEdgeId,
        commit: (upd) => {
          if (upd.nodes) commitState(upd.nodes, edges, strokes);
        },
        select: (ids) => setSelectedNodeIds(ids),
      });
    },
    [nodes, edges, strokes, viewport, selectedNodeIds, selectedEdgeId, commitState]
  );

  // Lock / Unlock handler
  const handleToggleLock = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0 && selectedStrokeIds.length === 0) {
      return;
    }
    const cmd = new ToggleLockCommand();
    cmd.execute({
      document: { version: 1, nodes, edges, strokes, viewport },
      selectedNodeIds,
      selectedEdgeId,
      selectedEdgeIds,
      selectedStrokeIds,
      commit: (upd) => {
        commitState(upd.nodes ?? nodes, upd.edges ?? edges, upd.strokes ?? strokes);
      },
      select: (ids) => setSelectedNodeIds(ids),
    });
  }, [
    nodes,
    edges,
    strokes,
    viewport,
    selectedNodeIds,
    selectedEdgeIds,
    selectedEdgeId,
    selectedStrokeIds,
    commitState,
  ]);

  /**
   * Turns the picked shapes by a fixed step.
   *
   * Each shape turns where it stands rather than the selection turning as one
   * body: a group has no geometry of its own, so there is no shared centre to
   * turn about, and turning each member is the behaviour a nudge and a resize
   * already share. A locked shape is left where it is, like every other way of
   * changing one.
   */
  const handleRotateSelection = useCallback(
    (degrees: number) => {
      if (readOnly) return;
      const turned = new Map<string, number>();
      for (const node of nodes) {
        if (!selectedNodeIds.includes(node.id) || isLocked(node)) continue;
        turned.set(node.id, normalizeRotation(rotationOf(node) + degrees));
      }
      if (turned.size === 0) return;

      commitState(
        nodes.map((node) =>
          turned.has(node.id) ? { ...node, rotation: turned.get(node.id) } : node
        ),
        edges,
        strokes
      );
    },
    [readOnly, nodes, edges, strokes, selectedNodeIds, commitState]
  );

  /**
   * Nudges everything selected by one step.
   *
   * A selection is not one kind of thing — a sweep can hold shapes, the
   * connectors between them and ink all at once — so this moves the whole of it
   * rather than stopping at the first kind it finds. That was the same
   * first-match chain the Delete key used to have, and it failed the same way:
   * with a shape and a free arrow both picked, only one of them moved.
   *
   * The step is applied as asked rather than snapped. Snapping is a rule about
   * where a dragged element's corner comes to rest; a nudge is the gesture for
   * placing something exactly, and rounding a 10px step onto a 12px grid left
   * the element jumping 12 or not moving at all.
   */
  const handleNudge = useCallback(
    (dx: number, dy: number) => {
      const doc = { nodes, edges, strokes };
      const snapshot = beginSelectionDrag(doc, {
        nodeIds: selectedNodeIds,
        edgeIds: selectedEdgeIds,
        strokeIds: selectedStrokeIds,
      });
      if (!isDragSnapshotMovable(snapshot)) return;

      const next = translateSelection(snapshot, doc, dx, dy);
      commitState(next.nodes, next.edges, next.strokes);
    },
    [selectedNodeIds, selectedEdgeIds, selectedStrokeIds, nodes, edges, strokes, commitState]
  );

  // Zoom to Fit all nodes
  const handleZoomToFit = useCallback(() => {
    if (nodes.length === 0 || !canvasRef.current) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const { clientWidth, clientHeight } = canvasRef.current;
    const padding = 80;

    const scaleX = (clientWidth - padding * 2) / Math.max(boundsWidth, 100);
    const scaleY = (clientHeight - padding * 2) / Math.max(boundsHeight, 100);
    const fitZoom = Math.min(1.5, Math.max(0.3, Math.min(scaleX, scaleY)));

    const centerX = minX + boundsWidth / 2;
    const centerY = minY + boundsHeight / 2;

    setViewport({
      zoom: Number(fitZoom.toFixed(2)),
      panX: Math.round(clientWidth / 2 - centerX * fitZoom),
      panY: Math.round(clientHeight / 2 - centerY * fitZoom),
    });
  }, [nodes]);

  const handleBeautify = useCallback(() => {
    if (nodes.length === 0) return;
    const beautified = beautifyArchitectureLayout(nodes, edges, {
      minHorizontalGap: 160,
      minVerticalGap: 170,
      containerPadding: 55,
      containerHeaderHeight: 65,
      containerGap: 80,
    });
    const containers = beautified.nodes.filter((n: any) => n.type === 'container' || n.type === 'frame');
    const nonContainers = beautified.nodes.filter((n: any) => n.type !== 'container' && n.type !== 'frame');
    commitState([...containers, ...nonContainers], beautified.edges, strokes);
    toast.success('Beautified diagram architecture layout!');
  }, [nodes, edges, strokes, commitState]);

  /** Zooms in or out anchored exactly at the viewport screen center. */
  const zoomByCenter = useCallback((deltaZoom: number) => {
    const el = canvasRef.current;
    const clientWidth = el ? el.clientWidth : window.innerWidth;
    const clientHeight = el ? el.clientHeight : window.innerHeight;
    const centerX = clientWidth / 2;
    const centerY = clientHeight / 2;

    setViewport((v) => {
      const nextZoom = clampZoom(v.zoom + deltaZoom);
      if (nextZoom === v.zoom) return v;
      const scaleChange = nextZoom / v.zoom;
      return {
        zoom: nextZoom,
        panX: centerX - (centerX - v.panX) * scaleChange,
        panY: centerY - (centerY - v.panY) * scaleChange,
      };
    });
  }, []);

  // Align Selected Nodes Utility
  const handleAlignNodes = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      // A locked element is not part of the gesture at all — it is not moved,
      // and it does not set the edge the others line up against either, because
      // a lock that still pulled its neighbours into line would be doing work.
      const targets = movable(selectedNodeIds);
      if (targets.length < 2) return;
      const selected = nodes.filter((n) => targets.includes(n.id));
      if (selected.length < 2) return;

      let targetVal = 0;
      if (alignment === 'left') targetVal = Math.min(...selected.map((n) => n.x));
      else if (alignment === 'center') {
        const minX = Math.min(...selected.map((n) => n.x));
        const maxX = Math.max(...selected.map((n) => n.x + n.width));
        targetVal = (minX + maxX) / 2;
      } else if (alignment === 'right') {
        targetVal = Math.max(...selected.map((n) => n.x + n.width));
      } else if (alignment === 'top') {
        targetVal = Math.min(...selected.map((n) => n.y));
      } else if (alignment === 'middle') {
        const minY = Math.min(...selected.map((n) => n.y));
        const maxY = Math.max(...selected.map((n) => n.y + n.height));
        targetVal = (minY + maxY) / 2;
      } else if (alignment === 'bottom') {
        targetVal = Math.max(...selected.map((n) => n.y + n.height));
      }

      const newNodes = nodes.map((n) => {
        if (!targets.includes(n.id)) return n;
        if (alignment === 'left') return { ...n, x: targetVal };
        if (alignment === 'center') return { ...n, x: Math.round(targetVal - n.width / 2) };
        if (alignment === 'right') return { ...n, x: targetVal - n.width };
        if (alignment === 'top') return { ...n, y: targetVal };
        if (alignment === 'middle') return { ...n, y: Math.round(targetVal - n.height / 2) };
        if (alignment === 'bottom') return { ...n, y: targetVal - n.height };
        return n;
      });

      commitState(newNodes, edges, strokes);
    },
    [nodes, selectedNodeIds, edges, strokes, commitState, movable]
  );

  // Distribute Nodes Evenly Utility
  const handleDistributeNodes = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      // Locked elements are left out for the same reason they are left out of
      // Align: even spacing is a statement about the elements that move.
      const targets = movable(selectedNodeIds);
      if (targets.length < 2) return;
      const selected = nodes.filter((n) => targets.includes(n.id));
      if (direction === 'horizontal') {
        const sorted = [...selected].sort((a, b) => a.x - b.x);
        const minX = sorted[0].x;
        const maxX = sorted[sorted.length - 1].x;
        const totalSpacing = maxX - minX;
        const step = totalSpacing / (sorted.length - 1);
        const newMap = new Map<string, number>();
        sorted.forEach((n, idx) => {
          newMap.set(n.id, Math.round(minX + step * idx));
        });
        const newNodes = nodes.map((n) => (newMap.has(n.id) ? { ...n, x: newMap.get(n.id)! } : n));
        commitState(newNodes, edges, strokes);
      } else {
        const sorted = [...selected].sort((a, b) => a.y - b.y);
        const minY = sorted[0].y;
        const maxY = sorted[sorted.length - 1].y;
        const totalSpacing = maxY - minY;
        const step = totalSpacing / (sorted.length - 1);
        const newMap = new Map<string, number>();
        sorted.forEach((n, idx) => {
          newMap.set(n.id, Math.round(minY + step * idx));
        });
        const newNodes = nodes.map((n) => (newMap.has(n.id) ? { ...n, y: newMap.get(n.id)! } : n));
        commitState(newNodes, edges, strokes);
      }
    },
    [nodes, selectedNodeIds, edges, strokes, commitState, movable]
  );

  // Match Width / Height Across Selected Nodes Utility
  const handleMatchNodeSize = useCallback(
    (dimension: 'width' | 'height') => {
      const targets = movable(selectedNodeIds);
      if (targets.length < 2) return;
      const selected = nodes.filter((n) => targets.includes(n.id));
      if (selected.length < 2) return;

      const refNode =
        selected.find((n) => n.id === primarySelectedNodeId) ?? selected[selected.length - 1];
      if (!refNode) return;

      const newNodes = nodes.map((n) => {
        if (!targets.includes(n.id)) return n;
        return dimension === 'width'
          ? { ...n, width: refNode.width }
          : { ...n, height: refNode.height };
      });
      commitState(newNodes, edges, strokes);
    },
    [nodes, selectedNodeIds, primarySelectedNodeId, edges, strokes, commitState, movable]
  );

  // Clear Canvas Utility
  const handleClearCanvas = useCallback(() => {
    if (nodes.length === 0 && edges.length === 0 && strokes.length === 0) return;
    commitState([], [], []);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
  }, [nodes, edges, strokes, commitState]);

  // Quick Connect Shape Picker selection
  const handleQuickConnectSelect = useCallback(
    (option: QuickConnectOption) => {
      if (!quickConnectState) return;
      const { sourceId, sourceHandle, sourceOffset, pt } = quickConnectState;
      const sourceNode = nodes.find((n) => n.id === sourceId);
      if (!sourceNode) {
        setQuickConnectState(null);
        return;
      }

      const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      let newNode: ZCanvasNode;

      if (option.id === 'clone') {
        const cloneW = sourceNode.width;
        const cloneH = sourceNode.height;
        newNode = {
          ...sourceNode,
          id: newId,
          x: snap(pt.x - cloneW / 2),
          y: snap(pt.y - cloneH / 2),
          groupIds: undefined,
          locked: undefined,
        };
      } else {
        const defaults = SHAPE_DEFAULTS[option.type as ZCanvasShapeTool] ?? { width: 140, height: 70 };
        newNode = createShapeNode(option.type as ZCanvasShapeTool, {
          x: snap(pt.x - defaults.width / 2),
          y: snap(pt.y - defaults.height / 2),
          width: defaults.width,
          height: defaults.height,
        });
        newNode.id = newId;
        newNode.title = option.label;
      }

      const srcAnchor = getHandlePoint(
        sourceNode,
        sourceHandle,
        rotationOf(sourceNode),
        sourceOffset
      );
      const targetRes = getNearestSideAndOffset(newNode, srcAnchor);
      const isErdRelation = sourceNode.type === 'table' && newNode.type === 'table';

      const newEdge: ZCanvasEdge = {
        id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        source: sourceId,
        target: newId,
        sourceHandle,
        sourceOffset,
        targetHandle: targetRes.side,
        style: isErdRelation ? 'step' : edgeStyle,
        color: isErdRelation ? '#0d9488' : activeColor,
        ...(isErdRelation
          ? { label: '1 : N', startArrowhead: 'er-one', endArrowhead: 'er-many' }
          : {}),
      };

      commitState([...nodes, newNode], [...edges, newEdge], strokes);
      setSelectedNodeIds([newId]);
      setPrimarySelectedNodeId(newId);
      setQuickConnectState(null);
      startEditing(newId, 'title', newNode.title);
    },
    [quickConnectState, nodes, edges, strokes, commitState, snap, activeColor, edgeStyle]
  );

  /**
   * Groups the selection.
   *
   * A group is a name its members share, so this writes no element, draws
   * nothing and changes no geometry — the selection simply starts answering as
   * one. The editor frames the group while it is selected and forgets it the
   * moment the selection moves on, which is the whole of what grouping looks
   * like.
   *
   * A selection that already holds part of a group takes the rest of it along,
   * so grouping never splits a group in two; grouping inside a container no
   * longer hands the members to it either, because that is containment and this
   * is grouping.
   *
   * A locked member is not grouped. It would gain a shared name it could never
   * be moved under anyway, and a lock that blocked grouping the rest of the
   * selection would make one pinned element hold up the whole gesture.
   */
  const handleGroupSelection = useCallback(() => {
    const targets = movable(selectedNodeIds);
    const next = groupNodes(nodes, targets);
    if (next === nodes) return;

    // Grouping exits any entered group so the newly formed group is selected as a unit.
    setEnteredGroupId(null);
    setSelectedNodeIds(expandSelection(next, targets));
    commitState(next, edges, strokes);
  }, [nodes, edges, strokes, selectedNodeIds, commitState, movable]);

  /**
   * Releases the selection from its group.
   *
   * One level at a time for nested groups, and nothing is removed from the
   * canvas: ungrouping two elements leaves two elements. The one exception is a
   * group box left in a document by an older version of the editor, which is
   * swept up once it holds nothing.
   */
  const handleUngroupSelection = useCallback(() => {
    // A group box left by an older editor is the one thing ungrouping still
    // takes off the canvas. Its members are released first, which is what
    // leaves it empty for `pruneEmptyGroupBoxes` to find; a boundary the user
    // drew by hand is never named here, so it is never released or removed.
    const legacyBoxes = new Set(
      nodes.filter((node) => node.data?.groupBox === true).map((node) => node.id)
    );
    const targets = movable(selectedNodeIds);
    const selected = new Set(targets);
    const heldByLegacyBox = (node: ZCanvasNode) =>
      selected.has(node.id) && legacyBoxes.has(node.parentId ?? '');
    // Identity is kept when there is nothing to release, so a command that
    // changes nothing does not land in history as an undo step.
    const released = nodes.some(heldByLegacyBox)
      ? nodes.map((node) => (heldByLegacyBox(node) ? { ...node, parentId: undefined } : node))
      : nodes;

    const next = pruneEmptyGroupBoxes(ungroupNodes(released, targets));
    if (next === nodes) return;

    setEnteredGroupId(null);
    setSelectedNodeIds(selectedNodeIds.filter((id) => next.some((node) => node.id === id)));
    commitState(next, edges, strokes);
  }, [nodes, edges, strokes, selectedNodeIds, commitState, movable]);

  /**
   * Wraps selected elements under a new Frame artboard.
   */
  const handleFrameSelection = useCallback(() => {
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id) && n.type !== 'frame');
    if (selected.length === 0) return;
    const padding = 32;
    const minX = Math.min(...selected.map((n) => n.x));
    const minY = Math.min(...selected.map((n) => n.y));
    const maxX = Math.max(...selected.map((n) => n.x + n.width));
    const maxY = Math.max(...selected.map((n) => n.y + n.height));

    const frameCount = nodes.filter((n) => n.type === 'frame').length;
    const frameId = `frame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const frameNode: ZCanvasNode = {
      id: frameId,
      type: 'frame',
      title: `Frame ${frameCount + 1}`,
      x: Math.round(minX - padding),
      y: Math.round(minY - padding),
      width: Math.round(maxX - minX + padding * 2),
      height: Math.round(maxY - minY + padding * 2),
    };

    const updatedNodes = nodes.map((n) =>
      selectedNodeIds.includes(n.id) ? { ...n, parentId: frameId } : n
    );

    commitState([frameNode, ...updatedNodes], edges, strokes);
    setSelectedNodeIds([frameId]);
    toast.success(`Created ${frameNode.title} with ${selected.length} items`);
  }, [nodes, selectedNodeIds, edges, strokes, commitState]);

  /**
   * Resizes and repositions a frame or container to snugly match all its enclosed content.
   */
  const handleFitFrameToContent = useCallback(
    (frameId: string) => {
      const frame = nodes.find((n) => n.id === frameId && (n.type === 'frame' || n.type === 'container'));
      if (!frame) return;

      // Find all content items belonging to or geometrically inside/intersecting this frame
      const directChildren = nodes.filter((n) => n.id !== frame.id && n.parentId === frame.id);
      const enclosedChildren = nodes.filter(
        (n) => n.id !== frame.id && n.type !== 'frame' && encloses(frame, n)
      );
      const overlappingChildren = nodes.filter((n) => {
        if (n.id === frame.id || n.type === 'frame') return false;
        const centerX = n.x + n.width / 2;
        const centerY = n.y + n.height / 2;
        return (
          centerX >= frame.x - 40 &&
          centerX <= frame.x + frame.width + 40 &&
          centerY >= frame.y - 40 &&
          centerY <= frame.y + frame.height + 40
        );
      });

      const candidateMap = new Map<string, ZCanvasNode>();
      for (const item of [...directChildren, ...enclosedChildren, ...overlappingChildren]) {
        candidateMap.set(item.id, item);
      }
      const items = Array.from(candidateMap.values());

      if (items.length === 0) {
        toast.info('No content items found inside or near this frame.');
        return;
      }

      const isFrame = frame.type === 'frame';
      const pad = isFrame ? 36 : 50;
      const header = isFrame ? 42 : 60;

      const minX = Math.min(...items.map((n) => n.x));
      const maxX = Math.max(...items.map((n) => n.x + n.width));
      const minY = Math.min(...items.map((n) => n.y));
      const maxY = Math.max(...items.map((n) => n.y + n.height));

      const updatedFrame: ZCanvasNode = {
        ...frame,
        x: Math.round(minX - pad),
        y: Math.round(minY - header),
        width: Math.round(Math.max(200, maxX - minX + pad * 2)),
        height: Math.round(Math.max(140, (maxY - minY) + header + pad)),
      };

      // Ensure all enclosed items have their parentId set to this frameId
      const updatedNodes = nodes.map((n) => {
        if (n.id === frame.id) return updatedFrame;
        if (items.some((item) => item.id === n.id) && !n.parentId) {
          return { ...n, parentId: frame.id };
        }
        return n;
      });

      commitState(updatedNodes, edges, strokes);
      toast.success(`Frame matched to ${items.length} item${items.length === 1 ? '' : 's'}`);
    },
    [nodes, edges, strokes, commitState]
  );

  /**
   * Places a frame preset centered on the current canvas view.
   */
  const handlePlaceFramePreset = useCallback((preset: ZCanvasFramePreset) => {
    const frameCount = nodes.filter((n) => n.type === 'frame').length;
    const title = `Frame ${frameCount + 1} (${preset.name.split(' (')[0]})`;
    const centerCanvasX = (typeof window !== 'undefined' ? window.innerWidth / 2 - viewport.panX : 400) / viewport.zoom;
    const centerCanvasY = (typeof window !== 'undefined' ? window.innerHeight / 2 - viewport.panY : 300) / viewport.zoom;
    const newNode: ZCanvasNode = {
      id: `frame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'frame',
      title,
      x: snap(centerCanvasX - preset.width / 2),
      y: snap(centerCanvasY - preset.height / 2),
      width: preset.width,
      height: preset.height,
    };
    commitState([newNode, ...nodes], edges, strokes);
    setSelectedNodeIds([newNode.id]);
    setActiveTool('select');
    toast.success(`Placed ${title}`);
  }, [nodes, viewport, edges, strokes, commitState, snap]);

  /**
   * Exports an individual frame and its enclosed content to PNG or SVG.
   */
  const handleExportFrame = useCallback((frame: ZCanvasNode, format: 'png' | 'svg') => {
    const enclosedNodes = nodes.filter(
      (n) => n.id === frame.id || n.parentId === frame.id || encloses(frame, n)
    );
    const enclosedNodeIds = new Set(enclosedNodes.map((n) => n.id));
    const enclosedEdges = edges.filter(
      (e) => enclosedNodeIds.has(e.source) && enclosedNodeIds.has(e.target)
    );
    const enclosedStrokes = strokes.filter((s) =>
      s.points.some((p) => p.x >= frame.x && p.x <= frame.x + frame.width && p.y >= frame.y && p.y <= frame.y + frame.height)
    );

    const frameDoc: ZCanvasDocument = {
      version: 1,
      nodes: enclosedNodes,
      edges: enclosedEdges,
      strokes: enclosedStrokes,
      viewport: { zoom: 1, panX: 0, panY: 0 },
    };

    const filename = `${(frame.title || 'frame').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.${format}`;

    if (format === 'svg') {
      const svgData = exportDocumentToSvg(frameDoc, { isDark, fitToContent: true });
      downloadSvg(svgData, filename);
      toast.success(`Exported ${frame.title} as SVG`);
    } else {
      exportDocumentToPng(frameDoc, { isDark, fitToContent: true, filename, scale: 2 });
      toast.success(`Exported ${frame.title} as HD PNG (2x)`);
    }
  }, [nodes, edges, strokes, isDark]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      // Letter shortcuts compare case-insensitively: holding Shift reports the
      // key as an uppercase letter, so `Ctrl+Shift+Z` arrives as 'Z'.
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // , or Ctrl+, : Open Canvas Settings
      if (e.key === ',' || (isMod && e.key === ',')) {
        e.preventDefault();
        setShowSettings((prev) => !prev);
        return;
      }

      // ? or Ctrl+/ : Open shortcuts help cheatsheet
      if (e.key === '?' || (isMod && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Spacebar hold : Quick Pan tool
      if (e.code === 'Space' && !e.repeat && !isSpacePressedRef.current) {
        isSpacePressedRef.current = true;
        toolBeforeSpaceRef.current = activeTool;
        setActiveTool('hand');
        return;
      }

      // Enter : Edit selected node label / text.
      if (e.key === 'Enter' && selectedNodeIds.length === 1) {
        const n = nodes.find((node) => node.id === selectedNodeIds[0]);
        if (n && (hasEditableLabel(n) || isGeometricShape(n.type))) {
          e.preventDefault();
          startEditing(n.id, 'title', n.title || '');
          return;
        }
      }
      if (e.key === 'Enter' && selectedEdgeId) {
        const ed = edges.find((edge) => edge.id === selectedEdgeId);
        if (ed) {
          e.preventDefault();
          setEditingConnectionId(ed.id);
          setEditingConnectionText(ed.label || '');
          return;
        }
      }

      // Ctrl+A : Select all — the connectors and the ink included, so one press
      // picks up everything a copy, a move or an export would carry.
      if (isMod && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Ctrl+C : Copy
      if (isMod && e.key === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Ctrl+X : Cut
      if (isMod && e.key === 'x') {
        e.preventDefault();
        handleCut();
        return;
      }

      // Ctrl+V : Paste
      if (isMod && e.key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Ctrl+D : Duplicate
      if (isMod && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
        return;
      }

      // ] and [ : Stacking Order
      if (e.key === ']' && selectedNodeIds.length > 0) {
        e.preventDefault();
        handleReorder(isMod ? 'forward' : 'front');
        return;
      }
      if (e.key === '[' && selectedNodeIds.length > 0) {
        e.preventDefault();
        handleReorder(isMod ? 'backward' : 'back');
        return;
      }

      // Undo / Redo
      if (isMod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      } else if (isMod && key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Group / Ungroup
      if (isMod && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          handleUngroupSelection();
        } else {
          handleGroupSelection();
        }
        return;
      }

      // Ctrl+Alt+F : Frame selection
      if (isMod && e.altKey && key === 'f') {
        e.preventDefault();
        handleFrameSelection();
        return;
      }

      // Ctrl+Shift+L : Lock / Unlock the selection. Shift is what keeps it off
      // the plain letter, which belongs to a tool.
      if (isMod && e.shiftKey && key === 'l') {
        e.preventDefault();
        handleToggleLock();
        return;
      }

      // Shift+F : Fit Frame to Content (when a frame or container is selected)
      if (e.shiftKey && !isMod && !e.altKey && key === 'f') {
        const frameToFit = nodes.find((n) => selectedNodeIds.includes(n.id) && (n.type === 'frame' || n.type === 'container'));
        if (frameToFit) {
          e.preventDefault();
          handleFitFrameToContent(frameToFit.id);
          return;
        }
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelection();
        return;
      }

      // Escape : Exit entered group (Draw.io style) or Deselect & Abort
      if (e.key === 'Escape') {
        if (enteredGroupId) {
          const groupMembers = nodes
            .filter((n) => groupIdsOf(n).includes(enteredGroupId))
            .map((n) => n.id);
          setEnteredGroupId(null);
          if (groupMembers.length > 0) {
            setSelectedNodeIds(groupMembers);
            return;
          }
        }
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        setSelectedStrokeIds([]);
        // Nothing is selected, so nothing is the one being edited — a primary
        // left standing would make the next press on a boundary's body move it
        // instead of sweeping.
        setPrimarySelectedNodeId(null);
        setConnectingSourceId(null);
        setConnectLinePos(null);
        setMarqueeBox(null);
        setShowShortcuts(false);
        edgeDragRef.current = null;
        edgeDraftRef.current = null;
        setEdgeDraft(null);
        setActiveLineDrag(null);
        return;
      }

      // Arrow Keys : Nudge Selection (Alt+Arrow = 1px fine nudge, Arrow = 10px, Shift+Arrow = 20px)
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0 || selectedStrokeIds.length > 0)
      ) {
        e.preventDefault();
        const step = e.altKey ? 1 : e.shiftKey ? 20 : settings.snapToGrid ? 10 : 1;
        if (e.key === 'ArrowUp') handleNudge(0, -step);
        if (e.key === 'ArrowDown') handleNudge(0, step);
        if (e.key === 'ArrowLeft') handleNudge(-step, 0);
        if (e.key === 'ArrowRight') handleNudge(step, 0);
        return;
      }

      // Zoom Controls via Keyboard (centered on canvas view)
      if (isMod && (key === '=' || key === '+')) {
        e.preventDefault();
        zoomByCenter(ZOOM_STEP);
        return;
      }
      if (isMod && key === '-') {
        e.preventDefault();
        zoomByCenter(-ZOOM_STEP);
        return;
      }
      if (isMod && key === '0') {
        e.preventDefault();
        setViewport({ zoom: 1, panX: 40, panY: 40 });
        return;
      }
      if (e.shiftKey && (e.key === '!' || e.key === '1')) {
        e.preventDefault();
        handleZoomToFit();
        return;
      }

      // F5 toggles Presentation Mode
      if (e.key === 'F5') {
        e.preventDefault();
        setIsPresentationMode((prev) => !prev);
        return;
      }

      // Presentation Mode active controls
      if (isPresentationMode) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsPresentationMode(false);
          setActiveTool('select');
          return;
        }
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          setActiveTool((prev) => (prev === 'laser' ? 'select' : 'laser'));
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          const currIdx = pagesRef.current.findIndex((p) => p.id === activePageIdRef.current);
          if (currIdx < pagesRef.current.length - 1) {
            handleSelectPage(pagesRef.current[currIdx + 1].id);
          }
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          const currIdx = pagesRef.current.findIndex((p) => p.id === activePageIdRef.current);
          if (currIdx > 0) {
            handleSelectPage(pagesRef.current[currIdx - 1].id);
          }
          return;
        }
      }

      // Single-Key Tool Switching (when no modifier key is active)
      if (!isMod && !e.altKey && !e.shiftKey) {
        if (e.key === 'v' || e.key === '1') {
          setActiveTool('select');
        } else if (e.key === 'h' || e.key === '2') {
          setActiveTool('hand');
        } else if (e.key === 'f') {
          setActiveTool('frame');
        } else if (e.key === 'r') {
          setActiveTool('rectangle');
        } else if (e.key === 'o') {
          setActiveTool('circle');
        } else if (e.key === 'd') {
          setActiveTool('diamond');
        } else if (e.key === 't') {
          setActiveTool('text');
        } else if (e.key === 'p') {
          selectTool('pen');
        } else if (e.key === 'l') {
          setActiveTool('line');
        } else if (e.key === 'a') {
          setActiveTool('arrow');
        } else if (e.key === 'e') {
          selectTool('eraser');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isSpacePressedRef.current) {
        isSpacePressedRef.current = false;
        setActiveTool(toolBeforeSpaceRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    readOnly,
    activeTool,
    isPresentationMode,
    handleSelectPage,
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    handleDeleteSelection,
    handleSelectAll,
    handleNudge,
    handleZoomToFit,
    handleGroupSelection,
    handleUngroupSelection,
    handleToggleLock,
    selectedNodeIds,
    selectedEdgeIds,
    selectedStrokeIds,
    nodes,
    edges,
    strokes,
    commitState,
    selectTool,
  ]);

  // Sync when parent initialDocument updates
  useEffect(() => {
    if (initialDocument) {
      if (initialDocument.nodes) setNodes(initialDocument.nodes);
      if (initialDocument.edges) setEdges(initialDocument.edges);
      if (initialDocument.strokes) setStrokes(initialDocument.strokes);
      if (initialDocument.viewport) setViewport(initialDocument.viewport);
      if (initialDocument.pages && initialDocument.pages.length > 0) {
        setPages(initialDocument.pages);
      }
      if (initialDocument.activePageId) {
        setActivePageId(initialDocument.activePageId);
      }
    }
  }, [initialDocument]);

  // Listen to external toggle presentation events
  useEffect(() => {
    const handleToggle = () => {
      setIsPresentationMode((prev) => !prev);
    };
    window.addEventListener('zcanvas:toggle-presentation', handleToggle);
    return () => window.removeEventListener('zcanvas:toggle-presentation', handleToggle);
  }, []);

  // Fading laser pointer cleanup interval
  useEffect(() => {
    if (laserTrail.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setLaserTrail((prev) => {
        const next = prev.filter((p) => now - p.time < 1000);
        return next.length === prev.length ? prev : next;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [laserTrail.length]);

  // Non-passive wheel listener to strictly prevent browser page zoom and zoom precisely into cursor point
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor pointer
        const zoomDelta = -e.deltaY * 0.003;
        setViewport((v) => {
          const newZoom = clampZoom(v.zoom + zoomDelta);
          if (newZoom === v.zoom) return v;

          // Anchor formula: cursor canvas coordinate stays locked under the mouse
          const scaleChange = newZoom / v.zoom;
          const newPanX = mouseX - (mouseX - v.panX) * scaleChange;
          const newPanY = mouseY - (mouseY - v.panY) * scaleChange;

          return {
            zoom: newZoom,
            panX: newPanX,
            panY: newPanY,
          };
        });
      } else {
        // Pan smoothly
        setViewport((v) => ({
          ...v,
          panX: v.panX - e.deltaX,
          panY: v.panY - e.deltaY,
        }));
      }
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheelNative);
    };
  }, []);

  // Touch Handlers for Mobile / Touch Panning and Pinch-Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX - viewport.panX,
        y: touch.clientY - viewport.panY,
      };
      if (readOnly || activeTool === 'hand') {
        setIsPanning(true);
      }
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        dist,
        zoom: viewport.zoom,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    if (e.touches.length === 1 && (readOnly || activeTool === 'hand' || isPanning)) {
      const touch = e.touches[0];
      setViewport((v) => ({
        ...v,
        panX: touch.clientX - touchStartRef.current!.x,
        panY: touch.clientY - touchStartRef.current!.y,
      }));
    } else if (e.touches.length === 2 && touchStartRef.current.dist && touchStartRef.current.zoom) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchStartRef.current.dist;
      const newZoom = clampZoom(touchStartRef.current.zoom * scale);
      setViewport((v) => ({ ...v, zoom: newZoom }));
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setIsPanning(false);
  };

  // Pointer Down on Canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };

    if (activeTool === 'laser') {
      if (e.button === 1) {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - viewport.panX, y: e.clientY - viewport.panY };
      }
      return;
    }

    const isBackground =
      e.target === canvasRef.current ||
      (e.target as HTMLElement).tagName === 'svg' ||
      (e.target as HTMLElement).id === 'zcanvas-grid';

    if (readOnly || activeTool === 'hand' || (isBackground && e.button === 1) || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - viewport.panX, y: e.clientY - viewport.panY };
      return;
    }

    // Interactive Rubberband Drag-to-Create Shape Tools (Rectangle, Circle, Diamond, Triangle, Text, Frame)
    if (!readOnly && (isShapeTool(activeTool) || activeTool === 'text' || activeTool === 'frame')) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      drawingShapeStartRef.current = { x: pt.x, y: pt.y, tool: activeTool };
      setDrawingShapeBox({
        x: snap(pt.x),
        y: snap(pt.y),
        width: 0,
        height: 0,
        tool: activeTool,
      });
      return;
    }

    // Interactive Rubberband Line & Arrow Tools (may start on top of a component)
    if (!readOnly && (activeTool === 'line' || activeTool === 'arrow')) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      const startX = snap(pt.x);
      const startY = snap(pt.y);
      drawingLineStartRef.current = { x: startX, y: startY, hasArrow: activeTool === 'arrow' };
      setDrawingLine({
        x1: startX,
        y1: startY,
        x2: startX,
        y2: startY,
        hasArrow: activeTool === 'arrow',
      });
      return;
    }

    // Eraser Tool Start
    if (!readOnly && activeTool === 'eraser') {
      isErasingRef.current = true;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      // Erase strokes near clicked point
      const threshold = 18;
      const remainingStrokes = strokes.filter((s) => {
        // The eraser never consults the selection, so the lock has to be read
        // here as well — this is the one path that would otherwise rub out
        // locked ink without anything having picked it.
        if (isLocked(s)) return true;
        return !s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= threshold);
      });
      if (remainingStrokes.length !== strokes.length) {
        // Open the gesture before the strokes change, so press-and-drag erasing
        // undoes as the single step the user performed.
        beginStylePreview();
        setStrokes(remainingStrokes);
      }
      return;
    }

    if (activeTool === 'pen' && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      // Sub-pixel, quantised to a tenth of a pixel. Rounding the trail to whole
      // pixels makes ink staircase at every zoom level, which is exactly the
      // jitter the streamline and the outline are there to remove.
      const startX = Math.round(pt.x * 10) / 10;
      const startY = Math.round(pt.y * 10) / 10;
      // The whole nib — width, tracking and taper — from the preset, and how
      // far the hand wanders from the sloppiness level. Recorded on the stroke
      // now: restyling the pen later leaves this ink as it was drawn.
      const geometry = penInkGeometry({
        preset: settings.strokePreset || 'natural',
        sloppiness: settings.penSloppiness,
      });
      const newStroke: ZCanvasDrawingStroke = {
        id: `stroke-${Date.now().toString(36)}`,
        points: [{ x: startX, y: startY }],
        color: settings.penColor,
        width: geometry.width,
        strokeStyle: settings.penStrokeStyle,
        opacity: settings.penOpacity,
        smoothing: geometry.smoothing,
        roughness: geometry.roughness,
        taper: geometry.taper,
        preset: settings.strokePreset || 'natural',
      };
      setCurrentStroke(newStroke);
      return;
    }

    if (isBackground && activeTool === 'select' && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);

      // Ink is picked in canvas space rather than by what the pointer landed
      // on. The strokes are painted with `pointer-events: none`, so a press over
      // one arrives here as a press on the canvas; the mark is then grabbed by
      // how close the pointer came, which is the only test that stays fair on a
      // thin, sloppy line.
      const hitStroke = findStrokeAt(strokes, pt);
      if (hitStroke) {
        const alreadyPicked = selectedStrokeIds.includes(hitStroke.id);
        // Shift and Ctrl/Cmd both widen a selection; Ctrl/Cmd toggles, so does
        // Shift here — ink is the one element a press can take back out with
        // either, because a sloppy line is the one a user re-picks by accident.
        const widening = widensSelection(e);
        const nextIds = widening
          ? toggleInSelection(selectedStrokeIds, hitStroke.id)
          : alreadyPicked
          ? selectedStrokeIds
          : [hitStroke.id];

        setSelectedStrokeIds(nextIds);

        // Picking fresh ink replaces whatever else was selected; a press that
        // widens the selection leaves the rest of it alone, so shapes and
        // connectors picked before this one stay picked.
        const replacesTheRest = !widening && !alreadyPicked;
        if (replacesTheRest) {
          setSelectedNodeIds([]);
          setSelectedEdgeIds([]);
          setPrimarySelectedNodeId(null);
        }

        // Only ink the press left selected is dragged: a Shift-click that took
        // a stroke out of the selection is a toggle, not a grab. What the grab
        // moves is the whole selection, which is the ink plus whatever the
        // press left standing beside it.
        if (nextIds.includes(hitStroke.id)) {
          beginStrokeDrag(pt, {
            nodeIds: replacesTheRest ? [] : selectedNodeIds,
            edgeIds: replacesTheRest ? [] : selectedEdgeIds,
            strokeIds: nextIds,
          });
        }
        return;
      }

      // A boundary is read last, because that is where it paints. A box is a
      // plate big enough to hold a diagram, so its contents sit on top of it and
      // take a press before it does; the plate is only reached where nothing
      // covers it. That is what makes the body of a boundary grabbable: the
      // title bar and the frame bands are simply the parts of it that no child
      // is over.
      const boundary = boundaryAtPoint(nodes, pt);
      if (boundary) {
        const selection = selectOnPress(boundary, pressModifiers(e));
        if (!isLocked(boundary)) {
          beginNodeDrag(boundary, e.clientX, e.clientY, selection);
        }
        return;
      }

      marqueeStartRef.current = { x: pt.x, y: pt.y };
      setMarqueeBox({ x: pt.x, y: pt.y, width: 0, height: 0 });
      // A sweep builds its own selection, so whatever the style panel was
      // pointed at is no longer part of one.
      setPrimarySelectedNodeId(null);
      setEnteredGroupId(null);
      // Shift and Ctrl/Cmd both mean the same thing here as everywhere else on
      // this canvas: widen, never replace. The base is taken now, because from
      // here on the selection is whatever the box has swept.
      marqueeBaseRef.current = widensSelection(e)
        ? {
            nodeIds: [...selectedNodeIds],
            edgeIds: [...selectedEdgeIds],
            strokeIds: [...selectedStrokeIds],
          }
        : null;
      if (!marqueeBaseRef.current) {
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        setSelectedStrokeIds([]);
      }
      return;
    }

    if (isBackground) {
      setEnteredGroupId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setSelectedStrokeIds([]);
      setPrimarySelectedNodeId(null);
      setConnectingSourceId(null);
      setConnectLinePos(null);
    }
  };

  // Pointer Move
  const handleMouseMove = (e: CanvasPointer) => {
    seenPointerEventRef.current = e.nativeEvent ?? null;
    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };

    if (activeTool === 'laser') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const now = Date.now();
        setLaserTrail((prev) => [...prev.filter((p) => now - p.time < 1000), { x: sx, y: sy, time: now }]);
      }
    }

    if (isPanning) {
      setViewport((v) => ({
        ...v,
        panX: e.clientX - panStartRef.current.x,
        panY: e.clientY - panStartRef.current.y,
      }));
      return;
    }

    // Re-positioning an existing line / arrow
    const edgeDrag = edgeDragRef.current;
    if (edgeDrag && edgeDrag.mode !== 'none' && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);

      if (edgeDrag.mode === 'waypoint' && edgeDrag.originWaypoints && edgeDrag.waypointIndex !== undefined) {
        const dx = pt.x - edgeDrag.startPoint.x;
        const dy = pt.y - edgeDrag.startPoint.y;

        if (!edgeDrag.moved && Math.hypot(dx, dy) > CLICK_SLOP_PX) {
          edgeDrag.moved = true;
        }

        if (!edgeDrag.moved) return;

        const wpIdx = edgeDrag.waypointIndex;
        const origWp = edgeDrag.originWaypoints[wpIdx];
        if (!origWp) return;

        let nextX = snap(origWp.x + dx);
        let nextY = snap(origWp.y + dy);

        // Draw.io orthogonal alignment snapping against neighboring vertices (within 8px)
        const prevVertex = wpIdx === 0 ? edgeDrag.origin.p1 : edgeDrag.originWaypoints[wpIdx - 1];
        const nextVertex =
          wpIdx === edgeDrag.originWaypoints.length - 1
            ? edgeDrag.origin.p2
            : edgeDrag.originWaypoints[wpIdx + 1];
        const guides: AlignmentGuide[] = [];

        if (prevVertex && Math.abs(nextX - prevVertex.x) < 8) {
          nextX = prevVertex.x;
          guides.push({ type: 'vertical', coordinate: prevVertex.x });
        } else if (nextVertex && Math.abs(nextX - nextVertex.x) < 8) {
          nextX = nextVertex.x;
          guides.push({ type: 'vertical', coordinate: nextVertex.x });
        }

        if (prevVertex && Math.abs(nextY - prevVertex.y) < 8) {
          nextY = prevVertex.y;
          guides.push({ type: 'horizontal', coordinate: prevVertex.y });
        } else if (nextVertex && Math.abs(nextY - nextVertex.y) < 8) {
          nextY = nextVertex.y;
          guides.push({ type: 'horizontal', coordinate: nextVertex.y });
        }

        setActiveGuides(guides);

        const nextWaypoints = edgeDrag.originWaypoints.map((w, idx) =>
          idx === wpIdx ? { x: nextX, y: nextY } : w
        );
        edgeDrag.currentWaypoints = nextWaypoints;
        setEdges((prev) =>
          prev.map((ed) => (ed.id === edgeDrag.edgeId ? { ...ed, waypoints: nextWaypoints } : ed))
        );
        return;
      }

      if (edgeDrag.mode === 'position') {
        const dx = pt.x - edgeDrag.startPoint.x;
        const dy = pt.y - edgeDrag.startPoint.y;

        if (!edgeDrag.moved && Math.hypot(dx, dy) > CLICK_SLOP_PX) {
          edgeDrag.moved = true;
        }

        if (!edgeDrag.moved) return;

        let delta = 0;
        if (edgeDrag.edgeStyle === 'step') {
          // For orthogonal steps, moving perpendicular to the segment shifts the step:
          // Left/Right handles have a vertical middle segment -> shifted by dx.
          // Top/Bottom handles have a horizontal middle segment -> shifted by dy.
          delta = (edgeDrag.sourcePos === 'left' || edgeDrag.sourcePos === 'right') ? dx : dy;
        } else if (edgeDrag.edgeStyle === 'bezier') {
          // Bezier midpoint shifts at 0.5 * stepOffset, so delta * 2 gives true 1:1 direct tracking
          delta = ((edgeDrag.sourcePos === 'left' || edgeDrag.sourcePos === 'right') ? dy : dx) * 2;
        } else {
          delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        }
        let newStepOffset = Math.round((edgeDrag.originStepOffset ?? 0) + delta);
        // Draw.io magnetic detent snap to center (0px) if within 8px
        if (Math.abs(newStepOffset) < 8) newStepOffset = 0;

        if (edgeDrag.currentStepOffset === newStepOffset) return;
        edgeDrag.currentStepOffset = newStepOffset;

        setActiveLineDrag({
          edgeId: edgeDrag.edgeId,
          offset: newStepOffset,
          isCenter: newStepOffset === 0,
          style: edgeDrag.edgeStyle ?? 'bezier',
        });
        return;
      }

      if (edgeDrag.mode === 'move') {
        const dx = pt.x - edgeDrag.startPoint.x;
        const dy = pt.y - edgeDrag.startPoint.y;
        const nextP1 = { x: snap(edgeDrag.origin.p1.x + dx), y: snap(edgeDrag.origin.p1.y + dy) };
        const nextP2 = { x: snap(edgeDrag.origin.p2.x + dx), y: snap(edgeDrag.origin.p2.y + dy) };
        const prev = edgeDraftRef.current;
        if (
          prev &&
          prev.edgeId === edgeDrag.edgeId &&
          prev.p1.x === nextP1.x &&
          prev.p1.y === nextP1.y &&
          prev.p2.x === nextP2.x &&
          prev.p2.y === nextP2.y &&
          prev.attachNodeId === null
        ) {
          return;
        }
        const draft = {
          edgeId: edgeDrag.edgeId,
          p1: nextP1,
          p2: nextP2,
          attachNodeId: null,
        };
        edgeDraftRef.current = draft;
        setEdgeDraft(draft);
      } else {
        // Dragging one endpoint: snap onto a node's nearest anchor or side position when hovering one.
        // Inner shapes take priority over boundary containers so lines connect to shapes seamlessly.
        const fixed = edgeDrag.mode === 'source' ? edgeDrag.origin.p2 : edgeDrag.origin.p1;
        const hovered = findNodeAt(pt, { allowBoundary: false }) ?? findNodeAt(pt, { allowBoundary: true, boundaryThreshold: 14 });
        let moving = { x: snap(pt.x), y: snap(pt.y) };
        let attachHandle: ZCanvasHandlePosition | undefined = undefined;
        let attachOffset: number | undefined = undefined;

        if (hovered) {
          const res = getNearestSideAndOffset(hovered, pt);
          moving = res.point;
          attachHandle = res.side;
          attachOffset = res.offset;
        }

        const draft = {
          edgeId: edgeDrag.edgeId,
          p1: edgeDrag.mode === 'source' ? moving : fixed,
          p2: edgeDrag.mode === 'target' ? moving : fixed,
          attachNodeId: hovered ? hovered.id : null,
          attachHandle,
          attachOffset,
        };
        const prev = edgeDraftRef.current;
        if (
          prev &&
          prev.edgeId === draft.edgeId &&
          prev.p1.x === draft.p1.x &&
          prev.p1.y === draft.p1.y &&
          prev.p2.x === draft.p2.x &&
          prev.p2.y === draft.p2.y &&
          prev.attachNodeId === draft.attachNodeId &&
          prev.attachHandle === draft.attachHandle &&
          prev.attachOffset === draft.attachOffset
        ) {
          return;
        }
        edgeDraftRef.current = draft;
        setEdgeDraft(draft);
      }
      return;
    }

    // Interactive Rubberband Line / Arrow Creation Drag
    if (drawingLineStartRef.current && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      const x2 = snap(pt.x);
      const y2 = snap(pt.y);
      setDrawingLine({
        x1: drawingLineStartRef.current.x,
        y1: drawingLineStartRef.current.y,
        x2,
        y2,
        hasArrow: drawingLineStartRef.current.hasArrow,
      });
      return;
    }

    // Continuous Drag Erasing
    if (isErasingRef.current && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      const threshold = 18;
      const remainingStrokes = strokes.filter((s) => {
        if (isLocked(s)) return true;
        return !s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= threshold);
      });
      if (remainingStrokes.length !== strokes.length) {
        beginStylePreview();
        setStrokes(remainingStrokes);
      }
      return;
    }

    // Interactive Rubberband Shape Creation Drag
    if (drawingShapeStartRef.current && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      const startX = drawingShapeStartRef.current.x;
      const startY = drawingShapeStartRef.current.y;
      const currentX = pt.x;
      const currentY = pt.y;
      let width = Math.abs(currentX - startX);
      let height = Math.abs(currentY - startY);

      if (e.shiftKey && isShapeTool(drawingShapeStartRef.current.tool)) {
        const size = Math.max(width, height);
        width = size;
        height = size;
      }

      const x = currentX >= startX ? startX : startX - width;
      const y = currentY >= startY ? startY : startY - height;

      setDrawingShapeBox({
        x: snap(x),
        y: snap(y),
        width: snap(width),
        height: snap(height),
        tool: drawingShapeStartRef.current.tool,
      });
      return;
    }

    // Dragging the selection, from a press that landed on ink or on a line
    // drawn free of any shape
    const selectionDrag = selectionDragRef.current;
    if (selectionDrag && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      // Snapping moves the selection as a whole rather than snapping each traced
      // point, which would bend the line onto the grid instead of moving it.
      const dx = snap(pt.x - selectionDrag.startPoint.x);
      const dy = snap(pt.y - selectionDrag.startPoint.y);
      // The first move that leaves the origin opens the gesture; afterwards the
      // ink follows the pointer all the way back, so a drag can be undone by
      // returning to where it started.
      if (dx === 0 && dy === 0 && !selectionDrag.moved) return;

      const snapshot = dragSnapshotRef.current;
      if (!snapshot) return;

      selectionDrag.moved = true;

      // The press landed on a stroke or on a free line, but neither is
      // necessarily all that was selected: picking a line with `Ctrl`, or
      // pressing one that a previous sweep caught alongside the shapes, leaves
      // a mixed selection. Grabbing any member of a selection and pulling moves
      // the selection.
      const doc = { nodes, edges, strokes };
      const next = translateSelection(snapshot, doc, dx, dy);

      beginStylePreview();
      setNodes(next.nodes);
      setEdges(next.edges);
      setStrokes(next.strokes);
      return;
    }

    // Scaling picked ink from a handle on its box
    const inkResize = strokeResizeRef.current;
    if (inkResize && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      let rawDx = pt.x - inkResize.startPoint.x;
      let rawDy = pt.y - inkResize.startPoint.y;
      const isSide =
        inkResize.handle === 'n' ||
        inkResize.handle === 's' ||
        inkResize.handle === 'e' ||
        inkResize.handle === 'w';

      if (e.shiftKey && !isSide) {
        if (Math.abs(rawDx) >= Math.abs(rawDy)) {
          rawDy = 0;
        } else {
          rawDx = 0;
        }
      }

      const box = resizeBoxFromHandle(
        inkResize.box,
        inkResize.handle,
        rawDx,
        rawDy,
        { uniform: false }
      );

      const changed =
        box.x !== inkResize.box.x ||
        box.y !== inkResize.box.y ||
        box.width !== inkResize.box.width ||
        box.height !== inkResize.box.height;
      if (!changed && !inkResize.moved) return;

      inkResize.moved = true;
      beginStylePreview();
      setStrokes((prev) =>
        prev.map((stroke) => {
          const origin = inkResize.origin.get(stroke.id);
          return origin ? resizeStroke(origin, inkResize.box, box) : stroke;
        })
      );
      return;
    }

    // Scaling a Group Frame or Multi-Selection Bounding Box
    const groupResize = groupResizeRef.current;
    if (groupResize && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      const rawDx = pt.x - groupResize.startPoint.x;
      const rawDy = pt.y - groupResize.startPoint.y;
      const isSide =
        groupResize.handle === 'n' ||
        groupResize.handle === 's' ||
        groupResize.handle === 'e' ||
        groupResize.handle === 'w';

      const newBox = resizeBoxFromHandle(
        groupResize.box,
        groupResize.handle,
        rawDx,
        rawDy,
        {
          minWidth: 48,
          minHeight: 48,
          uniform: !isSide && e.shiftKey,
          snap,
        }
      );

      const changed =
        newBox.x !== groupResize.box.x ||
        newBox.y !== groupResize.box.y ||
        newBox.width !== groupResize.box.width ||
        newBox.height !== groupResize.box.height;
      if (!changed && !groupResize.moved) return;

      groupResize.moved = true;
      beginStylePreview();
      setNodes((prev) => scaleNodesInBox(prev, groupResize.originNodes, groupResize.box, newBox));
      return;
    }

    // Marquee Drag Box Selection
    if (marqueeStartRef.current && !readOnly) {
      // A press that has travelled is a sweep, and a sweep is not a click: the
      // box the press landed on was not what was being asked for, so it is not
      // picked up when the pointer comes back up.
      const pending = pendingBoundaryPressRef.current;
      if (
        pending &&
        Math.hypot(e.clientX - pending.clientX, e.clientY - pending.clientY) > CLICK_SLOP_PX
      ) {
        pendingBoundaryPressRef.current = null;
      }

      const pt = getCanvasPoint(e.clientX, e.clientY);
      const currentX = pt.x;
      const currentY = pt.y;
      const x = Math.min(marqueeStartRef.current.x, currentX);
      const y = Math.min(marqueeStartRef.current.y, currentY);
      const width = Math.abs(currentX - marqueeStartRef.current.x);
      const height = Math.abs(currentY - marqueeStartRef.current.y);

      const mBox = { x, y, width, height };
      setMarqueeBox(mBox);

      // A sweep that widens adds to what was picked when it started, so the two
      // halves of a selection can be built with two boxes instead of one.
      const base = marqueeBaseRef.current;

      const selected = nodes
        // A locked element is never swept up. It is still reached by clicking
        // it, which is how its menu — and so its Unlock — is found, but a box
        // dragged across the canvas is not a request to act on it.
        .filter((node) => !lockedIds.has(node.id) && doBoxesIntersect(mBox, node))
        .map((n) => n.id);
      // A sweep that catches one member of a group catches the group, so a
      // half-covered group is never left half-selected.
      const swept = selectWholeGroups(selected);
      setSelectedNodeIds(base ? unionSelections(base.nodeIds, swept) : swept);

      // Ink is caught by the same sweep: a mark counts when any of it falls
      // inside the box, measured against the ink's own spread rather than the
      // bare path, so a faint line is as selectable as a bold one.
      const sweptStrokes = strokes
        .filter(
          (stroke) =>
            !lockedIds.has(stroke.id) &&
            stroke.points.length > 0 &&
            doBoxesIntersect(mBox, getStrokeBounds(stroke))
        )
        .map((stroke) => stroke.id);
      setSelectedStrokeIds(
        base ? unionSelections(base.strokeIds, sweptStrokes) : sweptStrokes
      );

      // Connectors answer to the same sweep, by the swath their routed path
      // occupies rather than by their two ends — a curve bows past those, so
      // measuring the ends alone would leave the bend uncaught.
      const sweptEdges = edges
        .filter(
          (edge) => !lockedIds.has(edge.id) && edgeIntersectsBox(edge, mBox, nodeMap, edgeStyle)
        )
        .map((e) => e.id);
      setSelectedEdgeIds(base ? unionSelections(base.edgeIds, sweptEdges) : sweptEdges);
      return;
    }

    if (currentStroke && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      const currentX = Math.round(pt.x * 10) / 10;
      const currentY = Math.round(pt.y * 10) / 10;
      setCurrentStroke((prev) => {
        if (!prev) return null;
        // A resting pointer keeps reporting the same position; those repeats
        // would each become a document point and an outline vertex for no
        // visible gain. The ink module would drop them later anyway — dropping
        // them here also keeps the stroke that reaches the document small.
        const last = prev.points[prev.points.length - 1];
        if (last && Math.hypot(currentX - last.x, currentY - last.y) < 0.75) {
          return prev;
        }
        return {
          ...prev,
          points: [...prev.points, { x: currentX, y: currentY }],
        };
      });
      return;
    }

    if (draggingNodeId && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      const currentX = pt.x;
      const currentY = pt.y;

      const snapshot = dragSnapshotRef.current;
      const primaryOrigin = snapshot?.nodes.get(draggingNodeId);
      if (!snapshot || !primaryOrigin) return;

      const candidateX = snap(currentX - dragOffsetRef.current.x);
      const candidateY = snap(currentY - dragOffsetRef.current.y);

      const otherBoxes = nodes.filter((n) => !snapshot.nodes.has(n.id));
      const { snappedX, snappedY, guides } = settings.showGuides
        ? calculateAlignmentGuides(
            { x: candidateX, y: candidateY, width: primaryOrigin.width, height: primaryOrigin.height },
            otherBoxes
          )
        : { snappedX: candidateX, snappedY: candidateY, guides: [] };
      setActiveGuides(guides);

      // The pressed element decides where the whole selection lands: it is the
      // one the pointer is holding, and the rest keep their offsets from it
      // rather than each being snapped on its own, which would pull a group
      // apart. Everything the snapshot holds — shapes, free connectors and ink
      // alike — moves by that one delta.
      const doc = { nodes, edges, strokes };
      const next = translateSelection(
        snapshot,
        doc,
        snappedX - primaryOrigin.x,
        snappedY - primaryOrigin.y
      );

      beginStylePreview();
      setNodes(next.nodes);
      setEdges(next.edges);
      setStrokes(next.strokes);
      return;
    }

    // Moving edge label position along/near the line
    if (draggingEdgeLabelRef.current && !readOnly) {
      const drag = draggingEdgeLabelRef.current;
      const clientDx = (e.clientX - drag.startClientX) / viewport.zoom;
      const clientDy = (e.clientY - drag.startClientY) / viewport.zoom;

      if (!drag.moved && Math.hypot(clientDx, clientDy) > CLICK_SLOP_PX) {
        drag.moved = true;
      }

      if (drag.moved) {
        let targetOffsetX = Math.round(drag.startOffset.x + clientDx);
        let targetOffsetY = Math.round(drag.startOffset.y + clientDy);

        // Magnetic snap to line center if close to 0 (within 6px)
        if (Math.hypot(targetOffsetX, targetOffsetY) < 6) {
          targetOffsetX = 0;
          targetOffsetY = 0;
        }

        beginStylePreview();
        setEdges((prev) =>
          prev.map((ed) =>
            ed.id === drag.edgeId
              ? { ...ed, labelOffset: { x: targetOffsetX, y: targetOffsetY } }
              : ed
          )
        );
      }
      return;
    }

    if (rotatingNodeId && rotateStartRef.current && !readOnly) {
      const rot = rotateStartRef.current;
      const pt = getCanvasPoint(e.clientX, e.clientY);
      let degrees = rot.startRotation + rotationDelta(rot.startPoint, pt, rot.centre);
      // Shift holds the turn to whole steps. Without it the angle is free,
      // which is the only way to land on a shape that is not a multiple of 15.
      if (e.shiftKey) degrees = snapRotation(degrees);

      rot.moved = true;
      beginStylePreview();
      setNodes((prev) =>
        prev.map((n) =>
          n.id === rot.nodeId ? { ...n, rotation: normalizeRotation(degrees) } : n
        )
      );
      return;
    }

    if (resizingNodeId && resizeHandle && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);

      beginStylePreview();
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== resizingNodeId) return n;
          const start = resizeStartRef.current;

          let rawDx = pt.x - start.startX;
          let rawDy = pt.y - start.startY;

          const isSide =
            resizeHandle === 'n' ||
            resizeHandle === 's' ||
            resizeHandle === 'e' ||
            resizeHandle === 'w';

          const isShape = isGeometricShape(n.type);

          // For geometric shapes (rectangle, circle, diamond, triangle, cylinder, cloud):
          // If Shift is held, it makes a perfect shape (1:1 aspect ratio: square, circle, etc.)
          if (e.shiftKey && isShape) {
            return {
              ...n,
              ...resizeBoxFromHandle(
                {
                  x: start.nodeStartX,
                  y: start.nodeStartY,
                  width: start.startWidth,
                  height: start.startHeight,
                  rotation: start.startRotation,
                },
                resizeHandle,
                rawDx,
                rawDy,
                {
                  minWidth: 24,
                  minHeight: 24,
                  aspectRatio: 1, // 1:1 perfect shape!
                  snap,
                }
              ),
            };
          }

          // For components / cards / tables / containers or non-shape stencils:
          // When Shift is held on corner handles, constrain resize precisely to horizontal or vertical axis
          if (e.shiftKey && !isSide) {
            const rot = (start.startRotation * Math.PI) / 180;
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);
            // Local box displacement
            const localDx = rawDx * cos + rawDy * sin;
            const localDy = rawDx * -sin + rawDy * cos;

            if (Math.abs(localDx) >= Math.abs(localDy)) {
              // Constrain to purely horizontal resize (lock vertical)
              rawDx = localDx * cos;
              rawDy = localDx * sin;
            } else {
              // Constrain to purely vertical resize (lock horizontal)
              rawDx = -localDy * sin;
              rawDy = localDy * cos;
            }
          }

          return {
            ...n,
            ...resizeBoxFromHandle(
              {
                x: start.nodeStartX,
                y: start.nodeStartY,
                width: start.startWidth,
                height: start.startHeight,
                rotation: start.startRotation,
              },
              resizeHandle,
              rawDx,
              rawDy,
              {
                minWidth: isShape ? 24 : MIN_NODE_WIDTH,
                minHeight: isShape ? 24 : MIN_NODE_HEIGHT,
                // Only corner handles use uniform, and only when Shift is NOT constraining to axis
                uniform: !isSide && !e.shiftKey && holdsAspect(n.type),
                snap,
              }
            ),
          };
        })
      );
      return;
    }

    if (connectingSourceId && !readOnly) {
      const pt = getCanvasPoint(e.clientX, e.clientY);
      const target = findNodeAt(pt);
      if (target && target.id !== connectingSourceId) {
        const res = getNearestSideAndOffset(target, pt);
        setConnectLinePos(res.point);
      } else {
        setConnectLinePos({ x: pt.x, y: pt.y });
      }
    }

    // Reached only when no gesture claimed the move, which is exactly when a
    // hover is worth reporting. The updater returns the current value when
    // nothing changed, so a pointer crossing a boundary does not re-render on
    // every frame of the crossing.
    if (!readOnly && activeTool === 'select') {
      const canvasPt = getCanvasPoint(e.clientX, e.clientY);
      const hovered = boundaryAtPoint(nodes, canvasPt);
      const hoveredId = hovered?.id ?? null;
      setHoveredBoundaryId((current) => (current === hoveredId ? current : hoveredId));

      // Direct hit on a node (exact bounds)
      const directNode = findNodeAt(canvasPt);
      let nextHoveredNodeId = directNode?.id ?? null;

      // Hysteresis: If already hovering a node, check if pointer is still
      // within the anchor perimeter margin (~18px) of that same node before dropping hover.
      // This prevents rapid oscillation/flicker when cursor moves toward or over anchor handles outside node bounds.
      if (!nextHoveredNodeId && hoveredNodeId) {
        const paddedHit = findNodeAt(canvasPt, { padding: 18 });
        if (paddedHit && paddedHit.id === hoveredNodeId) {
          nextHoveredNodeId = hoveredNodeId;
        }
      }

      setHoveredNodeId((current) => (current === nextHoveredNodeId ? current : nextHoveredNodeId));
    }
  };

  // Pointer Up
  const handleMouseUp = (e?: CanvasPointer) => {
    // The window listeners call this without an event — they are the fallback
    // for a release the canvas never saw — so the marker is only written when
    // this really is the canvas's own dispatch.
    if (e) seenPointerEventRef.current = e.nativeEvent ?? null;
    setIsPanning(false);
    setActiveGuides([]);

    // Moving edge label position
    if (draggingEdgeLabelRef.current && !readOnly) {
      const drag = draggingEdgeLabelRef.current;
      draggingEdgeLabelRef.current = null;
      setDraggingEdgeLabelId(null);
      if (drag.moved) {
        flushStyleBaseline();
      }
      return;
    }

    // Eraser Tool End
    if (isErasingRef.current && !readOnly) {
      isErasingRef.current = false;
      // The strokes were removed live during the drag, so the pre-erase
      // document only survives in the gesture baseline.
      flushStyleBaseline();
      return;
    }

    // Moving or scaling picked ink, or moving a selection grabbed by a free
    // line. The selection was rewritten live during the drag, so
    // `flushStyleBaseline` is what turns the whole gesture into one undo step —
    // restoring the geometry from before the press.
    const selectionGesture =
      selectionDragRef.current ?? strokeResizeRef.current ?? groupResizeRef.current;
    if (selectionGesture) {
      const { moved } = selectionGesture;
      // The refs are only ever set by a non-read-only press, but the gesture is
      // closed either way so a mode change mid-drag cannot leave the ink stuck
      // in a dragging state.
      selectionDragRef.current = null;
      strokeResizeRef.current = null;
      groupResizeRef.current = null;
      dragSnapshotRef.current = null;
      setDraggingSelection(false);
      setResizingInk(false);
      setResizingGroupBox(false);
      // A press that never moved anything has nothing to record; it was a click
      // that picked an element, and history should not remember it.
      if (moved && !readOnly) flushStyleBaseline();
      return;
    }

    // Re-positioning an existing line / arrow: commit the dragged geometry
    const edgeDrag = edgeDragRef.current;
    const draft = edgeDraftRef.current;
    if (edgeDrag && !readOnly) {
      const dragMode = edgeDrag.mode;
      edgeDragRef.current = null;
      edgeDraftRef.current = null;
      setEdgeDraft(null);

      if (dragMode === 'waypoint') {
        if (edgeDrag.moved && edgeDrag.currentWaypoints) {
          flushStyleBaseline();
        } else {
          gestureBaselineRef.current = null;
        }
        return;
      }

      if (dragMode === 'position') {
        flushStyleBaseline();
        const finalOffset = edgeDrag.currentStepOffset ?? edgeDrag.originStepOffset ?? 0;
        const originOffset = edgeDrag.originStepOffset ?? 0;
        const wasMoved = edgeDrag.moved && finalOffset !== originOffset;
        setActiveLineDrag(null);
        if (wasMoved) {
          const nextEdges = edges.map((ed) => (ed.id === edgeDrag.edgeId ? { ...ed, stepOffset: finalOffset } : ed));
          setEdges(nextEdges);
          commitState(nodes, nextEdges, strokes);
        }
        return;
      }

      if (draft && draft.edgeId === edgeDrag.edgeId && dragMode !== 'none') {
        const edge = edges.find((ed) => ed.id === edgeDrag.edgeId);
        if (edge) {
          const moved =
            Math.abs(draft.p1.x - edgeDrag.origin.p1.x) > 0.5 ||
            Math.abs(draft.p1.y - edgeDrag.origin.p1.y) > 0.5 ||
            Math.abs(draft.p2.x - edgeDrag.origin.p2.x) > 0.5 ||
            Math.abs(draft.p2.y - edgeDrag.origin.p2.y) > 0.5;

          if (moved) {
            const next: ZCanvasEdge = { ...edge };

            if (dragMode === 'move') {
              next.sourcePoint = draft.p1;
              next.targetPoint = draft.p2;
            } else {
              const end = dragMode;
              const otherNodeId = end === 'source' ? edge.target : edge.source;
              // Never attach an endpoint onto the node the other endpoint already sits on
              const attachNodeId =
                draft.attachNodeId && draft.attachNodeId !== otherNodeId ? draft.attachNodeId : null;

              if (attachNodeId) {
                if (end === 'source') {
                  delete next.sourcePoint;
                  next.source = attachNodeId;
                  next.sourceHandle = draft.attachHandle ?? 'right';
                  next.sourceOffset = draft.attachOffset && draft.attachOffset !== 0 ? draft.attachOffset : undefined;
                } else {
                  delete next.targetPoint;
                  next.target = attachNodeId;
                  next.targetHandle = draft.attachHandle ?? 'left';
                  next.targetOffset = draft.attachOffset && draft.attachOffset !== 0 ? draft.attachOffset : undefined;
                }
              } else if (end === 'source') {
                delete next.sourceHandle;
                delete next.sourceOffset;
                next.source = '';
                next.sourcePoint = draft.p1;
              } else {
                delete next.targetHandle;
                delete next.targetOffset;
                next.target = '';
                next.targetPoint = draft.p2;
              }
            }

            commitState(
              nodes,
              edges.map((ed) => (ed.id === next.id ? next : ed)),
              strokes
            );
          }
        }
      }
      return;
    }

    // Line / Arrow Tool Creation on Drag Release
    if (drawingLineStartRef.current && !readOnly) {
      const lineData = drawingLine;
      drawingLineStartRef.current = null;
      setDrawingLine(null);

      if (lineData && Math.hypot(lineData.x2 - lineData.x1, lineData.y2 - lineData.y1) > 10) {
        // Create a line or arrow; auto-attach either end that lands on a component
        const startPt = { x: lineData.x1, y: lineData.y1 };
        const endPt = { x: lineData.x2, y: lineData.y2 };
        const startNode = findNodeAt(startPt, { allowBoundary: false });
        const endNode = findNodeAt(endPt, { allowBoundary: false });

        const newEdge: ZCanvasEdge = {
          id: `edge-${Date.now().toString(36)}`,
          source: '',
          target: '',
          sourcePoint: startPt,
          targetPoint: endPt,
          style: edgeStyle,
          color: activeColor,
          strokeWidth: 2,
          endArrowhead: lineData.hasArrow ? 'arrow' : 'none',
        };

        if (startNode) {
          delete newEdge.sourcePoint;
          newEdge.source = startNode.id;
          newEdge.sourceHandle = getNearestHandle(startNode, endPt);
        }
        if (endNode && startNode?.id !== endNode.id) {
          delete newEdge.targetPoint;
          newEdge.target = endNode.id;
          newEdge.targetHandle = getNearestHandle(endNode, startPt);
        }

        commitState(nodes, [...edges, newEdge], strokes);
        setSelectedEdgeIds([newEdge.id]);
        setSelectedNodeIds([]);
        setActiveTool('select');
      }
      return;
    }

    // Shape Creation on Drag or Click Release
    if (drawingShapeStartRef.current && !readOnly) {
      const { tool, x: startX, y: startY } = drawingShapeStartRef.current;
      drawingShapeStartRef.current = null;
      const box = drawingShapeBox;
      setDrawingShapeBox(null);

      const isDrag = box && box.width >= 24 && box.height >= 24;

      let newNode: ZCanvasNode;
      if (tool === 'frame') {
        const frameWidth = isDrag ? Math.max(120, box.width) : 800;
        const frameHeight = isDrag ? Math.max(80, box.height) : 600;
        const frameX = isDrag ? box.x : snap(startX) - frameWidth / 2;
        const frameY = isDrag ? box.y : snap(startY) - frameHeight / 2;
        const frameCount = nodes.filter((n) => n.type === 'frame').length;
        newNode = {
          id: `frame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'frame',
          title: `Frame ${frameCount + 1}`,
          x: frameX,
          y: frameY,
          width: frameWidth,
          height: frameHeight,
        };
        // Frames prepend so they sit under elements
        commitState([newNode, ...nodes], edges, strokes);
        setSelectedNodeIds([newNode.id]);
        setActiveTool('select');
        return;
      }

      if (isShapeTool(tool)) {
        const defaults = SHAPE_DEFAULTS[tool];
        newNode = createShapeNode(
          tool,
          isDrag
            ? { x: box.x, y: box.y, width: box.width, height: box.height }
            : {
                x: snap(startX) - defaults.width / 2,
                y: snap(startY) - defaults.height / 2,
                width: defaults.width,
                height: defaults.height,
              }
        );
        if (settings.strokeWidth) newNode.strokeWidth = settings.strokeWidth;
        if (settings.strokeStyle) newNode.strokeStyle = settings.strokeStyle;
        if (settings.fontFamily) newNode.fontFamily = settings.fontFamily;
        if (settings.fontSize) newNode.fontSize = settings.fontSize;
      } else {
        const x = isDrag ? box.x : snap(startX) - 70;
        const y = isDrag ? box.y : snap(startY) - 20;
        const width = isDrag ? box.width : 140;
        const height = isDrag ? box.height : 40;
        newNode = {
          id: `text-${Date.now().toString(36)}`,
          type: 'text',
          x,
          y,
          width,
          height,
          title: '',
          fontFamily: settings.fontFamily ?? 'sans',
          fontSize: settings.fontSize ?? 16,
        };
      }

      // Check if placed inside a container
      // Placement inside a container does not parent the node: grouping is an
      // explicit choice the user makes, never a side effect of where they drew.
      commitState([...nodes, newNode], edges, strokes);
      setSelectedNodeIds([newNode.id]);
      setActiveTool('select');

      // If text tool, immediately start in-place editing right where it was created
      if (tool === 'text') {
        startEditing(newNode.id, 'title', '');
      }
      return;
    }

    if (marqueeStartRef.current) {
      marqueeStartRef.current = null;
      marqueeBaseRef.current = null;
      setMarqueeBox(null);
    }

    // A press on the body of a boundary that never travelled was a click on it,
    // and this is where that press finally means something. Held until the
    // release rather than applied at the press, because until the pointer comes
    // back up it is still possible the press was the start of a sweep.
    const pendingBoundary = pendingBoundaryPressRef.current;
    pendingBoundaryPressRef.current = null;
    if (pendingBoundary) {
      const boundary = nodes.find((n) => n.id === pendingBoundary.nodeId);
      if (boundary) {
        selectOnPress(boundary, pendingBoundary.modifiers);
      }
    }

    if (currentStroke && !readOnly) {
      // A tap is a dot, and a dot is a mark the user meant to make. Requiring
      // a third point dropped those on the floor, so a click with the pen drew
      // nothing at all.
      if (currentStroke.points.length > 0) {
        commitState(nodes, edges, [...strokes, currentStroke]);
      }
      setCurrentStroke(null);
    }

    if (draggingNodeId && !readOnly) {
      // One undo step for the whole drag, restoring where the node started.
      // Nothing about the drag re-parents or ungroups: moving a shape across a
      // boundary leaves it standalone, and moving a member of a group moves the
      // group with it because the whole group is selected, not because the drag
      // rewrote anything about it.
      flushStyleBaseline();
      setDraggingNodeId(null);
      dragSnapshotRef.current = null;
    }

    if (resizingNodeId && !readOnly) {
      // Resizing wrote straight to state, so the baseline holds the old size.
      flushStyleBaseline();
      setResizingNodeId(null);
      setResizeHandle(null);
    }

    if (rotatingNodeId && !readOnly) {
      const rot = rotateStartRef.current;
      rotateStartRef.current = null;
      setRotatingNodeId(null);
      // A grip that was pressed and let go without turning anything is not an
      // edit, and a click that picks a shape should not be one undo step.
      if (rot?.moved) flushStyleBaseline();
      else gestureBaselineRef.current = null;
    }

    if (connectingSourceId && !readOnly) {
      if (lastMousePosRef.current) {
        const pt = getCanvasPoint(lastMousePosRef.current.clientX, lastMousePosRef.current.clientY);
        const targetNode = findNodeAt(pt);
        const sourceNode = nodes.find((n) => n.id === connectingSourceId);
        if (targetNode && targetNode.id !== connectingSourceId) {
          const res = getNearestSideAndOffset(targetNode, pt);
          const isErdRelation = sourceNode?.type === 'table' && targetNode.type === 'table';
          const newEdge: ZCanvasEdge = {
            id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            source: connectingSourceId,
            target: targetNode.id,
            sourceHandle: connectingHandlePos,
            sourceOffset: connectingSourceOffset !== 0 ? connectingSourceOffset : undefined,
            targetHandle: res.side,
            targetOffset: res.offset !== 0 ? res.offset : undefined,
            label: isErdRelation ? '1 : N' : 'Flow',
            color: isErdRelation ? '#0d9488' : activeColor,
            style: isErdRelation ? 'step' : edgeStyle,
            ...(isErdRelation
              ? { startArrowhead: 'er-one', endArrowhead: 'er-many' }
              : {}),
          };
          commitState(nodes, [...edges, newEdge], strokes);
        } else if (!targetNode) {
          // Draw.io / Eraser style: releasing a dragged connector over empty canvas space
          // (>= 60px away from source anchor) opens the Quick Connect Picker.
          if (sourceNode) {
            const srcAnchor = getHandlePoint(
              sourceNode,
              connectingHandlePos,
              rotationOf(sourceNode),
              connectingSourceOffset
            );
            const dragDist = Math.hypot(pt.x - srcAnchor.x, pt.y - srcAnchor.y);
            if (dragDist >= 60) {
              setQuickConnectState({
                sourceId: connectingSourceId,
                sourceHandle: connectingHandlePos,
                sourceOffset: connectingSourceOffset !== 0 ? connectingSourceOffset : undefined,
                pt,
              });
            }
          }
        }
      }
      setConnectingSourceId(null);
      setConnectLinePos(null);
      setConnectingSourceOffset(0);
    }
  };

  // Latest-value mirrors. The gesture handlers are rebuilt on every render, and
  // the window listeners below are installed once, so they read the handlers
  // through these rather than capturing the first render's copy.
  const moveHandlerRef = useRef<(e: CanvasPointer) => void>(handleMouseMove);
  const upHandlerRef = useRef<() => void>(handleMouseUp);
  const gestureLiveRef = useRef(false);

  useEffect(() => {
    moveHandlerRef.current = handleMouseMove;
    upHandlerRef.current = handleMouseUp;

    // Every way a gesture can be in flight. A gesture that is not in progress
    // must not be driven from the window, or a press on a panel would count as
    // a press on the canvas.
    gestureLiveRef.current =
      draggingNodeId !== null ||
      resizingNodeId !== null ||
      rotatingNodeId !== null ||
      isPanning ||
      connectingSourceId !== null ||
      currentStroke !== null ||
      isErasingRef.current ||
      marqueeStartRef.current !== null ||
      drawingLineStartRef.current !== null ||
      edgeDragRef.current !== null ||
      selectionDragRef.current !== null ||
      strokeResizeRef.current !== null;
  });

  /**
   * Finishes a gesture the canvas itself could not.
   *
   * A drag can leave the canvas two ways, and both used to leave it open, with
   * the component following the pointer until the next click ended it.
   *
   * The first is the panels around the canvas — the library, the document
   * editor, the assistant. They are siblings of the canvas, so the release
   * simply never arrives. The second is the surfaces painted on top of the
   * canvas: the floating toolbar and the style panel stop their events so a
   * press on them is not a press on the canvas, and a release over one is
   * stopped along with it, so the canvas root — which is an ancestor in the DOM
   * and would otherwise hear it — never does.
   *
   * So while a gesture is in flight the window is listened to as well, and any
   * event the canvas root did not handle is handed to the same handlers it
   * uses: the drag keeps up with the pointer wherever it goes and, more to the
   * point, the release ends it wherever it happens. The one dispatch the root
   * already saw is left alone, because running a release twice would record a
   * single drag as two undo steps.
   *
   * Losing the window ends the gesture too. Releasing the button over another
   * application, or alt-tabbing away mid-drag, delivers no `mouseup` at all,
   * and a drag that cannot be ended is worse than one that ends early.
   */
  useEffect(() => {
    const onWindowMove = (e: MouseEvent) => {
      if (!gestureLiveRef.current || e === seenPointerEventRef.current) return;
      moveHandlerRef.current(e);
    };

    const endGesture = (e: MouseEvent) => {
      if (!gestureLiveRef.current || e === seenPointerEventRef.current) return;
      upHandlerRef.current();
    };

    const onWindowBlur = () => {
      if (!gestureLiveRef.current) return;
      upHandlerRef.current();
    };

    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', endGesture);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', endGesture);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, []);

  /**
   * Opens a move from a press that landed on ink.
   *
   * The snapshot covers the whole selection rather than the ink alone, because
   * the press may have landed inside a selection the ink is only part of. Every
   * element keeps the geometry it had at the moment of the press, so the move is
   * always measured from the original rather than accumulated frame by frame —
   * which is what stops a slow drag from drifting away from the pointer.
   */
  const beginStrokeDrag = (pt: ZCanvasPoint, selection: ZCanvasDragSelection) => {
    const snapshot = beginSelectionDrag({ nodes, edges, strokes }, selection);
    // Nothing movable also covers a selection of nothing but locked ink, which
    // leaves the press to select rather than to start a move that would record
    // an undo step undoing nothing.
    if (!isDragSnapshotMovable(snapshot)) return;

    dragSnapshotRef.current = snapshot;
    selectionDragRef.current = { startPoint: pt, moved: false };
    setDraggingSelection(true);
  };

  /** Ink Resize Handle Mouse Down */
  const handleStrokeResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    if (readOnly || activeTool !== 'select') return;
    e.stopPropagation();

    const picked = strokes.filter((s) => selectedStrokeIds.includes(s.id) && !isLocked(s));
    const box = getStrokesBounds(picked);
    if (!box) return;

    const origin = new Map<string, ZCanvasDrawingStroke>();
    for (const stroke of picked) origin.set(stroke.id, stroke);

    strokeResizeRef.current = {
      handle,
      startPoint: getCanvasPoint(e.clientX, e.clientY),
      box,
      origin,
      moved: false,
    };
    setResizingInk(true);
  };

  /** Collective Group / Multi-Selection Resize Handle Mouse Down */
  const handleGroupResizeMouseDown = (
    e: React.MouseEvent,
    handle: ZCanvasResizeHandle,
    targetNodeIds: string[]
  ) => {
    if (readOnly || activeTool !== 'select') return;
    e.stopPropagation();

    const movableIds = new Set(movable(targetNodeIds));
    const picked = nodes.filter((n) => movableIds.has(n.id) && !isBoundaryNode(n));
    if (picked.length < 2) return;

    const minX = Math.min(...picked.map((n) => n.x));
    const minY = Math.min(...picked.map((n) => n.y));
    const maxX = Math.max(...picked.map((n) => n.x + n.width));
    const maxY = Math.max(...picked.map((n) => n.y + n.height));
    const box: ZCanvasBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    const originNodes = new Map<string, ZCanvasNode>();
    for (const n of picked) originNodes.set(n.id, n);

    groupResizeRef.current = {
      handle,
      startPoint: getCanvasPoint(e.clientX, e.clientY),
      box,
      originNodes,
      moved: false,
    };
    setResizingGroupBox(true);
  };

  /**
   * Applies a press to the node selection, and reports what the selection is.
   *
   * Returned as well as set, because the move that may follow is measured from
   * the selection this press produced, and reading it back through the state
   * would mean waiting a render for it. It is also the one place a press on a
   * node changes the selection, so the title bar, the frame bands and the body
   * of a boundary cannot come to disagree about what pressing one means.
   *
   * A press inside an existing selection leaves that selection standing, which
   * is what lets a swept or grouped selection be dragged as a whole instead of
   * collapsing to the one element under the pointer. `Alt` is the way past it.
   * Leaving it standing means leaving *all* of it standing: the connectors a
   * sweep caught are members of the same selection, and dropping them here
   * would leave a swept selection unable to move as one the moment it was
   * grabbed by a shape rather than by a connector.
   *
   * `Shift` adds a shape to the selection. `Ctrl` / `Cmd` toggles one — a shape
   * already picked comes back out — which is how the same modifier behaves on a
   * connector and a mark of ink, so building a selection out of all three kinds
   * is one gesture rather than three.
   */
  const selectOnPress = (
    node: ZCanvasNode,
    modifiers: ZCanvasPressModifiers,
    activeEnteredGroup: string | null = enteredGroupId
  ): ZCanvasDragSelection => {
    const picked = selectedNodeIds.includes(node.id);
    const togglingOut = picked && !modifiers.altKey && togglesSelection(modifiers);
    const keepsSelection = !modifiers.altKey && picked;
    const isBoundary = isBoundaryNode(node);

    let next: string[];

    if (togglingOut) {
      next = selectedNodeIds.filter((id) => id !== node.id);
    } else if (modifiers.altKey) {
      next = widensSelection(modifiers) ? unionSelections(selectedNodeIds, [node.id]) : [node.id];
    } else if (keepsSelection) {
      next = selectedNodeIds;
    } else if (widensSelection(modifiers)) {
      // If clicking a boundary node (container or frame), select ONLY the boundary node.
      // If clicking a regular node, expand to regular grouped peers only (never pull in the parent container).
      const expanded = isBoundary
        ? [node.id]
        : selectWholeGroups([node.id], activeEnteredGroup).filter((id) => {
            const n = nodes.find((item) => item.id === id);
            return !n || !isBoundaryNode(n);
          });
      next = unionSelections(selectedNodeIds, expanded);
    } else {
      const expanded = isBoundary
        ? [node.id]
        : selectWholeGroups([node.id], activeEnteredGroup).filter((id) => {
            const n = nodes.find((item) => item.id === id);
            return !n || !isBoundaryNode(n);
          });
      next = expanded;
    }

    // The pressed node is the one the style panel edits.
    setPrimarySelectedNodeId(togglingOut ? next[next.length - 1] ?? null : node.id);

    // A press that replaces the selection replaces all of it.
    const otherKindsSurvive = !modifiers.altKey && (picked || widensSelection(modifiers));
    const edgeIds = otherKindsSurvive ? selectedEdgeIds : [];
    const strokeIds = otherKindsSurvive ? selectedStrokeIds : [];
    setSelectedEdgeIds(edgeIds);
    setSelectedStrokeIds(strokeIds);

    // Note: When a parent container/frame moves, all children and enclosed/grouped shapes
    // move with it synchronously (handled in beginSelectionDrag), but selecting a parent
    // container selects ONLY the parent container. This prevents lagging and unwanted behavior.

    if (next !== selectedNodeIds) setSelectedNodeIds(next);
    return { nodeIds: next, edgeIds, strokeIds };
  };

  /**
   * Opens a move on `node` from a press at a client point.
   *
   * What moves is the whole selection, not the one shape the press landed on:
   * the shapes, any connector carrying its own endpoints, and the ink a sweep
   * caught along with them. The snapshot is taken here, at the press, so the
   * move is measured from where everything started — and `selection` is passed
   * in rather than read back, because the press has just decided it and reading
   * it through the state would mean waiting a render for it.
   */
  const beginNodeDrag = (
    node: ZCanvasNode,
    clientX: number,
    clientY: number,
    selection: ZCanvasDragSelection
  ) => {
    // A press on a locked element still selects it — that is how its menu is
    // reached — but no move opens. Guarding here rather than at each caller
    // covers the title bar, the frame bands, the body of a boundary and a plain
    // shape with one rule, so they cannot come apart on it.
    if (isLocked(node)) return;

    setDraggingNodeId(node.id);
    dragSnapshotRef.current = beginSelectionDrag({ nodes, edges, strokes }, selection);

    const pt = getCanvasPoint(clientX, clientY);
    dragOffsetRef.current = {
      x: pt.x - node.x,
      y: pt.y - node.y,
    };
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: ZCanvasNode) => {
    if (readOnly) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - viewport.panX, y: e.clientY - viewport.panY };
      return;
    }
    // Only the select tool edits elements. Any other tool lets the press fall
    // through to the canvas, so drawing can start on top of an existing
    // component and the hand tool pans across one instead of dragging it.
    if (activeTool !== 'select') return;
    e.stopPropagation();

    // If we had entered a group previously and the user now clicks a node
    // outside that group, exit the entered group first.
    let activeEnteredGroup = enteredGroupId;
    if (activeEnteredGroup && !groupIdsOf(node).includes(activeEnteredGroup)) {
      activeEnteredGroup = null;
      setEnteredGroupId(null);
    }

    // Draw.io Group Drill-Down:
    // Single-click selects the whole group (`governingGroup`); double-clicking a
    // component inside that group enters `governingGroup` and selects the child
    // component inside the group so it can be moved, resized, or styled on its own.
    const modifiers = pressModifiers(e);
    if (e.detail >= 2 && !modifiers.shiftKey && !modifiers.ctrlKey && !modifiers.metaKey && !isBoundaryNode(node)) {
      const governingGroup = activeGroupIdOf(node, activeEnteredGroup);
      if (governingGroup) {
        setEnteredGroupId(governingGroup);
        const subIds = expandSelectionInContext(nodes, [node.id], governingGroup).filter((id) => {
          const n = nodes.find((item) => item.id === id);
          return !n || !isBoundaryNode(n);
        });
        setSelectedNodeIds(subIds);
        setPrimarySelectedNodeId(node.id);
        setSelectedEdgeIds([]);
        setSelectedStrokeIds([]);
        justDrilledIntoGroupRef.current = node.id;
        beginNodeDrag(node, e.clientX, e.clientY, {
          nodeIds: subIds,
          edgeIds: [],
          strokeIds: [],
        });
        return;
      }
    }

    const selection = selectOnPress(node, modifiers, activeEnteredGroup);
    beginNodeDrag(node, e.clientX, e.clientY, selection);
  };

  // Resize Handle Mouse Down
  const handleResizeMouseDown = (
    e: React.MouseEvent,
    node: ZCanvasNode,
    handle: ZCanvasResizeHandle
  ) => {
    // A resize grip is a select-tool affordance: under any other tool the press
    // belongs to the canvas, so dragging a grip pans or draws instead.
    if (readOnly || activeTool !== 'select') return;
    e.stopPropagation();
    if (isLocked(node)) return;
    setResizingNodeId(node.id);
    setResizeHandle(handle);
    const pt = getCanvasPoint(e.clientX, e.clientY);
    resizeStartRef.current = {
      startX: pt.x,
      startY: pt.y,
      nodeStartX: node.x,
      nodeStartY: node.y,
      startWidth: node.width,
      startHeight: node.height,
      startRotation: rotationOf(node),
    };
  };

  // Rotate Handle Mouse Down
  const handleRotateMouseDown = (e: React.MouseEvent, node: ZCanvasNode) => {
    // Like the resize grips, the rotate grip belongs to the select tool.
    if (readOnly || activeTool !== 'select') return;
    e.stopPropagation();
    if (isLocked(node)) return;
    rotateStartRef.current = {
      nodeId: node.id,
      // The centre is taken once, at the press: a turn is measured against the
      // point it started around, not against wherever the shape has since
      // moved, and nothing in this gesture moves it.
      centre: boxCenter(node),
      startPoint: getCanvasPoint(e.clientX, e.clientY),
      startRotation: rotationOf(node),
      moved: false,
    };
    setRotatingNodeId(node.id);
  };

  // Edge Drag Start (moves a freeform line/arrow, or just selects an attached edge)
  const handleEdgeMouseDown = (e: React.MouseEvent, edge: ZCanvasEdge) => {
    if (readOnly) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - viewport.panX, y: e.clientY - viewport.panY };
      return;
    }
    if (activeTool !== 'select' || e.button !== 0) return;
    e.stopPropagation();

    // Shift or Ctrl/Cmd widens the selection the way it does for a shape — with
    // Ctrl/Cmd toggling, so a line picked by mistake comes back out. A plain
    // press on one that is already picked leaves the rest of the selection
    // standing, so the drag that follows is over the set the user built rather
    // than over whatever the pointer happened to land on.
    const widening = widensSelection(e);
    const alreadyPicked = selectedEdgeIds.includes(edge.id);
    // A press that replaces the selection replaces all of it: a shape left
    // marked as the one being edited would have the style panel pointing at
    // something the canvas no longer shows as picked, and the next press on a
    // boundary's body would move a box nothing has selected.
    //
    // A widening press is not that press. It was impossible to build a
    // selection of shapes and connectors together for exactly this reason: the
    // first Ctrl-click on a line threw the shapes away, so the second had
    // nothing left to join. A press that lands on a line already in the
    // selection is not that press either — it is a hand taking hold of the
    // selection to move it.
    const othersSurvive = !e.altKey && (alreadyPicked || widening);

    const nextEdgeIds = selectionAfterPress(selectedEdgeIds, edge.id, e);
    // The press may have taken this connector *out* — Ctrl-clicking a picked
    // line is the toggle every other editor has taught. Nothing below arms a
    // move for a line the press just dropped.
    const picked = nextEdgeIds.includes(edge.id);
    setSelectedEdgeIds(nextEdgeIds);

    if (!othersSurvive) {
      setSelectedNodeIds([]);
      setSelectedStrokeIds([]);
      setPrimarySelectedNodeId(null);
    }

    const geo = computeEdgeGeometry(edge, nodeMap, edgeStyle);
    if (!geo) return;

    // A locked connector is still picked by the press above; what it does not
    // do is open a move. The endpoints of an attached connector are draggable
    // through their own handles, which are guarded where they are drawn.
    if (isLocked(edge) || !picked) return;

    // A line drawn free of any shape has no frame to be measured against, so a
    // drag that starts on one moves the selection the way a drag that starts on
    // a mark of ink does — from the point the pointer went down on. Without
    // this the selection a Ctrl-click builds would come apart the moment it was
    // dragged by one of its lines: the shapes would stay where they were.
    if (edge.sourcePoint && edge.targetPoint) {
      const dragSelection: ZCanvasDragSelection = {
        nodeIds: othersSurvive ? selectedNodeIds : [],
        edgeIds: nextEdgeIds,
        strokeIds: othersSurvive ? selectedStrokeIds : [],
      };
      const snapshot = beginSelectionDrag({ nodes, edges, strokes }, dragSelection);
      if (!isDragSnapshotMovable(snapshot)) return;

      dragSnapshotRef.current = snapshot;
      selectionDragRef.current = {
        startPoint: getCanvasPoint(e.clientX, e.clientY),
        moved: false,
      };
      setDraggingSelection(true);
      return;
    }

    // If user holds Alt, detach from shapes into a freeform line and move freely
    if (e.altKey) {
      const detachedEdge: ZCanvasEdge = {
        ...edge,
        source: '',
        target: '',
        sourceHandle: undefined,
        targetHandle: undefined,
        sourceOffset: undefined,
        targetOffset: undefined,
        sourcePoint: geo.p1,
        targetPoint: geo.p2,
      };
      const updatedEdges = edges.map((ed) => (ed.id === edge.id ? detachedEdge : ed));
      setEdges(updatedEdges);
      const dragSelection: ZCanvasDragSelection = {
        nodeIds: othersSurvive ? selectedNodeIds : [],
        edgeIds: nextEdgeIds,
        strokeIds: othersSurvive ? selectedStrokeIds : [],
      };
      const snapshot = beginSelectionDrag({ nodes, edges: updatedEdges, strokes }, dragSelection);
      if (isDragSnapshotMovable(snapshot)) {
        dragSnapshotRef.current = snapshot;
        selectionDragRef.current = {
          startPoint: getCanvasPoint(e.clientX, e.clientY),
          moved: false,
        };
        setDraggingSelection(true);
        return;
      }
    }

    // Dragging an attached connector directly adjusts its bend / position
    beginStylePreview();
    edgeDragRef.current = {
      edgeId: edge.id,
      mode: 'position',
      startPoint: getCanvasPoint(e.clientX, e.clientY),
      origin: { p1: geo.p1, p2: geo.p2 },
      originStepOffset: edge.stepOffset ?? 0,
      currentStepOffset: edge.stepOffset ?? 0,
      sourcePos: geo.sourcePos,
      targetPos: geo.targetPos,
      edgeStyle: edge.style ?? edgeStyle,
      moved: false,
    };
  };

  // Line Position / Bend Handle Drag Start
  const handleLinePositionMouseDown = (
    e: React.MouseEvent,
    edge: ZCanvasEdge,
    geo: { p1: ZCanvasPoint; p2: ZCanvasPoint; sourcePos: ZCanvasHandlePosition; targetPos: ZCanvasHandlePosition }
  ) => {
    if (readOnly || activeTool !== 'select' || e.button !== 0) return;
    e.stopPropagation();

    setSelectedEdgeIds([edge.id]);
    setSelectedNodeIds([]);
    setSelectedStrokeIds([]);
    setPrimarySelectedNodeId(null);

    if (isLocked(edge)) return;

    beginStylePreview();
    edgeDragRef.current = {
      edgeId: edge.id,
      mode: 'position',
      startPoint: getCanvasPoint(e.clientX, e.clientY),
      origin: { p1: geo.p1, p2: geo.p2 },
      originStepOffset: edge.stepOffset ?? 0,
      currentStepOffset: edge.stepOffset ?? 0,
      sourcePos: geo.sourcePos,
      targetPos: geo.targetPos,
      edgeStyle: edge.style ?? edgeStyle,
      moved: false,
    };
  };

  // Drag an existing custom waypoint handle
  const handleWaypointMouseDown = (
    e: React.MouseEvent,
    edge: ZCanvasEdge,
    waypointIndex: number,
    geo: { p1: ZCanvasPoint; p2: ZCanvasPoint }
  ) => {
    if (readOnly || activeTool !== 'select' || e.button !== 0) return;
    e.stopPropagation();

    setSelectedEdgeIds([edge.id]);
    setSelectedNodeIds([]);
    setSelectedStrokeIds([]);
    setPrimarySelectedNodeId(null);

    if (isLocked(edge) || !edge.waypoints || !edge.waypoints[waypointIndex]) return;

    const originWaypoints = edge.waypoints.map((w) => ({ ...w }));
    beginStylePreview();
    edgeDragRef.current = {
      edgeId: edge.id,
      mode: 'waypoint',
      startPoint: getCanvasPoint(e.clientX, e.clientY),
      origin: { p1: geo.p1, p2: geo.p2 },
      waypointIndex,
      originWaypoints,
      currentWaypoints: originWaypoints,
      edgeStyle: edge.style ?? edgeStyle,
      moved: false,
    };
  };

  // Drag a Draw.io virtual segment midpoint handle to insert and move a new bend/waypoint
  const handleVirtualMidpointMouseDown = (
    e: React.MouseEvent,
    edge: ZCanvasEdge,
    segmentIndex: number,
    midPt: ZCanvasPoint,
    geo: { p1: ZCanvasPoint; p2: ZCanvasPoint; vertices: ZCanvasPoint[] }
  ) => {
    if (readOnly || activeTool !== 'select' || e.button !== 0) return;
    e.stopPropagation();

    setSelectedEdgeIds([edge.id]);
    setSelectedNodeIds([]);
    setSelectedStrokeIds([]);
    setPrimarySelectedNodeId(null);

    if (isLocked(edge)) return;

    const baseInterior =
      edge.waypoints && edge.waypoints.length > 0
        ? edge.waypoints.map((w) => ({ ...w }))
        : geo.vertices.slice(1, -1).map((w) => ({ ...w }));

    const insertIdx = Math.max(0, Math.min(baseInterior.length, segmentIndex));
    const originWaypoints = [
      ...baseInterior.slice(0, insertIdx),
      { x: Math.round(midPt.x), y: Math.round(midPt.y) },
      ...baseInterior.slice(insertIdx),
    ];

    beginStylePreview();
    edgeDragRef.current = {
      edgeId: edge.id,
      mode: 'waypoint',
      startPoint: getCanvasPoint(e.clientX, e.clientY),
      origin: { p1: geo.p1, p2: geo.p2 },
      waypointIndex: insertIdx,
      originWaypoints,
      currentWaypoints: originWaypoints,
      edgeStyle: edge.style ?? edgeStyle,
      moved: false,
    };
  };

  // Edge Label Drag Start (slide along / near the line)
  const handleEdgeLabelMouseDown = (
    e: React.MouseEvent,
    edge: ZCanvasEdge,
    midPoint: ZCanvasPoint,
    p1: ZCanvasPoint,
    p2: ZCanvasPoint
  ) => {
    if (readOnly) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - viewport.panX, y: e.clientY - viewport.panY };
      return;
    }
    if (activeTool !== 'select' || e.button !== 0) return;
    e.stopPropagation();

    setSelectedEdgeIds([edge.id]);
    setSelectedNodeIds([]);
    setSelectedStrokeIds([]);
    setPrimarySelectedNodeId(null);

    if (isLocked(edge)) return;

    const now = Date.now();
    if (
      e.detail === 2 ||
      (lastLabelClickRef.current &&
        lastLabelClickRef.current.edgeId === edge.id &&
        now - lastLabelClickRef.current.time < 400)
    ) {
      lastLabelClickRef.current = null;
      startConnectionEdit(edge);
      return;
    }
    lastLabelClickRef.current = { edgeId: edge.id, time: now };

    const currentPos = resolvedEdgeLabels.get(edge.id) ?? {
      x: midPoint.x + (edge.labelOffset?.x ?? 0),
      y: midPoint.y + (edge.labelOffset?.y ?? 0),
    };
    const effectiveOffset = {
      x: currentPos.x - midPoint.x,
      y: currentPos.y - midPoint.y,
    };

    draggingEdgeLabelRef.current = {
      edgeId: edge.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffset: effectiveOffset,
      midPoint,
      p1,
      p2,
      moved: false,
    };
    setDraggingEdgeLabelId(edge.id);
  };

  // Edge Endpoint Drag Start (re-position / attach / detach one end of an edge)
  const handleEdgeEndpointMouseDown = (
    e: React.MouseEvent,
    edge: ZCanvasEdge,
    end: 'source' | 'target'
  ) => {
    if (readOnly || activeTool !== 'select' || e.button !== 0) return;
    e.stopPropagation();

    setSelectedEdgeIds([edge.id]);
    setSelectedNodeIds([]);

    const geo = computeEdgeGeometry(edge, nodeMap, edgeStyle);
    if (!geo) return;

    // An endpoint drag re-anchors or detaches a connector, which is a change to
    // the element itself rather than a move of the selection.
    if (isLocked(edge)) return;

    gestureLiveRef.current = true;
    beginStylePreview();
    edgeDragRef.current = {
      edgeId: edge.id,
      mode: end,
      startPoint: getCanvasPoint(e.clientX, e.clientY),
      origin: { p1: geo.p1, p2: geo.p2 },
    };
  };

  // Connection Handle Start
  const handleAnchorMouseDown = (
    e: React.MouseEvent,
    nodeId: string,
    pos: ZCanvasHandlePosition,
    offset = 0
  ) => {
    // Connection anchors are a select-tool affordance, so the hand and draw
    // tools keep the press rather than starting a connection.
    if (readOnly || activeTool !== 'select') return;
    e.stopPropagation();
    // A connector drawn from a locked shape would be a reason for that shape's
    // frame to grow a new element, so the anchor of a locked shape does not
    // start one. Dropping onto a locked shape is still allowed: the connection
    // belongs to the shape being dragged from.
    const source = nodes.find((n) => n.id === nodeId);
    if (source && isLocked(source)) return;
    setConnectingSourceId(nodeId);
    setConnectingHandlePos(pos);
    setConnectingSourceOffset(offset);
    const srcPt = source
      ? getHandlePoint(source, pos, rotationOf(source), offset)
      : getCanvasPoint(e.clientX, e.clientY);
    setConnectLinePos(srcPt);
  };

  // Connection Handle Drop
  const handleAnchorMouseUp = (
    e: React.MouseEvent,
    targetNodeId: string,
    targetPos: ZCanvasHandlePosition,
    offset = 0
  ) => {
    if (readOnly) return;
    e.stopPropagation();

    if (connectingSourceId && connectingSourceId !== targetNodeId) {
      const sourceNode = nodes.find((n) => n.id === connectingSourceId);
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      const isErdRelation = sourceNode?.type === 'table' && targetNode?.type === 'table';
      const newEdge: ZCanvasEdge = {
        id: `edge-${Date.now().toString(36)}`,
        source: connectingSourceId,
        target: targetNodeId,
        sourceHandle: connectingHandlePos,
        sourceOffset: connectingSourceOffset !== 0 ? connectingSourceOffset : undefined,
        targetHandle: targetPos,
        targetOffset: offset !== 0 ? offset : undefined,
        label: isErdRelation ? '1 : N' : 'Flow',
        color: isErdRelation ? '#0d9488' : activeColor,
        style: isErdRelation ? 'step' : edgeStyle,
        ...(isErdRelation
          ? { startArrowhead: 'er-one', endArrowhead: 'er-many' }
          : {}),
      };
      commitState(nodes, [...edges, newEdge], strokes);
    }
    setConnectingSourceId(null);
    setConnectLinePos(null);
    setConnectingSourceOffset(0);
  };

  /**
   * Draw.io Directional Quick-Clone & Connect:
   * Clicking one of the 4 directional chevrons around a selected node clones
   * the node in that direction (with a 120px gap) and connects an edge in one click.
   */
  const handleQuickCloneInDirection = useCallback(
    (e: React.MouseEvent, sourceNode: ZCanvasNode, dir: ZCanvasHandlePosition) => {
      e.stopPropagation();
      e.preventDefault();
      if (readOnly || isLocked(sourceNode)) return;

      const gap = 120;
      let nextX = sourceNode.x;
      let nextY = sourceNode.y;
      let targetHandle: ZCanvasHandlePosition = 'left';

      if (dir === 'right') {
        nextX = snap(sourceNode.x + sourceNode.width + gap);
        targetHandle = 'left';
      } else if (dir === 'left') {
        nextX = snap(sourceNode.x - sourceNode.width - gap);
        targetHandle = 'right';
      } else if (dir === 'bottom') {
        nextY = snap(sourceNode.y + sourceNode.height + gap);
        targetHandle = 'top';
      } else if (dir === 'top') {
        nextY = snap(sourceNode.y - sourceNode.height - gap);
        targetHandle = 'bottom';
      }

      const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const clonedNode: ZCanvasNode = {
        ...sourceNode,
        id: newId,
        x: nextX,
        y: nextY,
        groupIds: undefined,
        locked: undefined,
      };

      const newEdge: ZCanvasEdge = {
        id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        source: sourceNode.id,
        target: newId,
        sourceHandle: dir,
        targetHandle,
        style: edgeStyle,
        color: activeColor,
      };

      commitState([...nodes, clonedNode], [...edges, newEdge], strokes);
      setSelectedNodeIds([newId]);
      setPrimarySelectedNodeId(newId);
    },
    [readOnly, snap, edgeStyle, activeColor, nodes, edges, strokes, commitState]
  );

  // Node Map for edge calculations (memoized to eliminate reallocation per render)
  const nodeMap = useMemo(() => new Map<string, ZCanvasNode>(nodes.map((n) => [n.id, n])), [nodes]);

  // Multi-connection port offsets (distributes multiple connectors attaching to the same side of a shape, like Draw.io)
  const multiPortOffsets = useMemo(
    () => computeMultiConnectionOffsets(edges, nodeMap),
    [edges, nodeMap]
  );

  // Edge geometries cache (memoized to avoid re-routing all bezier/orthogonal paths on every cursor move)
  const edgeGeometries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeEdgeGeometry>>();
    for (const edge of edges) {
      const offsets = multiPortOffsets.get(edge.id);
      map.set(edge.id, computeEdgeGeometry(edge, nodeMap, edgeStyle, offsets));
    }
    return map;
  }, [edges, nodeMap, edgeStyle, multiPortOffsets]);

  // Non-colliding connector label positions (resolves bidirectional multi-edge and geometric collisions)
  const resolvedEdgeLabels = useMemo(() => {
    return resolveEdgeLabelPositions(edges, nodeMap, edgeStyle, edgeGeometries);
  }, [edges, nodeMap, edgeStyle, edgeGeometries]);

  /**
   * The frames this selection draws: one per group it touches.
   *
   * Derived rather than stored, because there is nothing to store — a frame is
   * a reading of the document, so it follows the members as they move and
   * disappears the moment none of them is selected.
   */
  const selectionFrames = useMemo(() => {
    // Exclude boundary nodes (containers/frames) from triggering group frames around their children
    const nonBoundarySelectedIds = selectedNodeIds.filter((id) => {
      const n = nodes.find((node) => node.id === id);
      return !n || !isBoundaryNode(n);
    });
    return groupFrames(nodes, nonBoundarySelectedIds);
  }, [nodes, selectedNodeIds]);

  /**
   * Bounding box of multiple selected ungrouped nodes, for drawing a collective
   * multi-selection resize frame when 2+ ungrouped nodes are selected.
   */
  const multiSelectionBox = useMemo(() => {
    if (selectedNodeIds.length <= 1) return null;
    if (selectionFrames.length > 0) return null; // Group frames already render for groups
    const targets = nodes.filter((n) => selectedNodeIds.includes(n.id) && !isBoundaryNode(n));
    if (targets.length <= 1) return null;
    const minX = Math.min(...targets.map((n) => n.x));
    const minY = Math.min(...targets.map((n) => n.y));
    const maxX = Math.max(...targets.map((n) => n.x + n.width));
    const maxY = Math.max(...targets.map((n) => n.y + n.height));
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [nodes, selectedNodeIds, selectionFrames]);

  // In-place text edit
  const startEditing = (
    nodeId: string,
    field: 'title' | 'subtitle' | 'badge' | 'field_name' | 'field_type',
    initialText: string,
    fieldIndex?: number,
    forceEdit = false
  ) => {
    if (readOnly) return;
    // Draw.io Group Drill-Down:
    // If this double-click just drilled down from a group selection to select
    // the individual child component, consume the drill-down and do NOT open
    // the text input yet. Double-clicking the already-selected child opens it.
    if (!forceEdit && justDrilledIntoGroupRef.current === nodeId) {
      justDrilledIntoGroupRef.current = null;
      return;
    }

    const target = nodes.find((n) => n.id === nodeId);
    if (target && isLocked(target)) return;

    if (!forceEdit && target && !isBoundaryNode(target)) {
      const governingGroup = activeGroupIdOf(target, enteredGroupId);
      if (governingGroup) {
        setEnteredGroupId(governingGroup);
        const subIds = expandSelectionInContext(nodes, [nodeId], governingGroup).filter((id) => {
          const n = nodes.find((item) => item.id === id);
          return !n || !isBoundaryNode(n);
        });
        setSelectedNodeIds(subIds);
        setPrimarySelectedNodeId(nodeId);
        return;
      }
    }

    setEditingNodeId(nodeId);
    setEditingField(field);
    setEditingFieldIndex(fieldIndex !== undefined ? fieldIndex : null);
    setEditingValue(initialText);
  };

  const saveEditing = () => {
    if (!editingNodeId || !editingField) return;

    if ((editingField === 'field_name' || editingField === 'field_type') && editingFieldIndex !== null) {
      commitState(
        nodes.map((n) => {
          if (n.id !== editingNodeId || !n.fields) return n;
          const updatedFields = [...n.fields];
          if (updatedFields[editingFieldIndex]) {
            const currentItem = updatedFields[editingFieldIndex];
            updatedFields[editingFieldIndex] = {
              ...currentItem,
              [editingField === 'field_name' ? 'name' : 'type']: editingValue.trim() || (editingField === 'field_name' ? 'column' : 'text'),
            };
          }
          return {
            ...n,
            fields: updatedFields,
          };
        }),
        edges,
        strokes
      );
    } else {
      commitState(
        nodes.map((n) => {
          if (n.id !== editingNodeId) return n;
          if (editingField === 'badge') {
            const trimmed = editingValue.trim();
            return {
              ...n,
              badge: trimmed.length > 0 ? trimmed : undefined,
            };
          }
          const textVal = editingValue.trimEnd();
          const updated: ZCanvasNode = {
            ...n,
            [editingField]: textVal,
          };
          if (n.type === 'text' && editingField === 'title') {
            const lineCount = (textVal || '').split('\n').length;
            const approxHeight = Math.max(40, lineCount * ((n.fontSize || 15) * 1.35) + 16);
            if (approxHeight > n.height) {
              updated.height = Math.round(approxHeight);
            }
          }
          return updated;
        }),
        edges,
        strokes
      );
    }

    setEditingNodeId(null);
    setEditingField(null);
    setEditingFieldIndex(null);
    setEditingValue('');
  };

  const handleAddField = (nodeId: string) => {
    if (readOnly) return;
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode || targetNode.type !== 'table') return;
    if (isLocked(targetNode)) return;

    const currentFields = targetNode.fields || [];
    const newField = {
      name: `field_${currentFields.length + 1}`,
      type: 'varchar(255)',
    };
    const nextFields = [...currentFields, newField];
    const newHeight = Math.max(targetNode.height, 100 + nextFields.length * 24);

    commitState(
      nodes.map((n) =>
        n.id === nodeId
          ? { ...n, fields: nextFields, height: newHeight }
          : n
      ),
      edges,
      strokes
    );
    // Start editing the new field name immediately
    startEditing(nodeId, 'field_name', newField.name, nextFields.length - 1, true);
  };

  const handleRemoveField = (nodeId: string, fieldIndex: number) => {
    if (readOnly) return;
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode || targetNode.type !== 'table') return;
    if (isLocked(targetNode)) return;

    const currentFields = targetNode.fields || [];
    if (fieldIndex < 0 || fieldIndex >= currentFields.length) return;

    const nextFields = currentFields.filter((_, i) => i !== fieldIndex);

    // Mirror the 24px-per-row growth in `handleAddField`: shrink the node by one
    // row when it was sized to fit its fields, but never below the fitted height
    // of the remaining fields (or the minimum table height).
    const fittedBefore = 100 + currentFields.length * 24;
    const fittedAfter = 100 + nextFields.length * 24;
    const newHeight =
      targetNode.height <= fittedBefore
        ? Math.max(fittedAfter, 120)
        : Math.max(targetNode.height - 24, fittedAfter, 120);

    // Abandon an edit of the removed row, and keep the tracked index pointing at
    // the same field when a *later* row was being edited.
    if (editingNodeId === nodeId && editingFieldIndex !== null) {
      if (editingFieldIndex === fieldIndex) {
        setEditingNodeId(null);
        setEditingField(null);
        setEditingFieldIndex(null);
        setEditingValue('');
      } else if (editingFieldIndex > fieldIndex) {
        setEditingFieldIndex(editingFieldIndex - 1);
      }
    }

    commitState(
      nodes.map((n) =>
        n.id === nodeId ? { ...n, fields: nextFields, height: newHeight } : n
      ),
      edges,
      strokes
    );
  };

  const handleToggleFieldFlag = (nodeId: string, fieldIndex: number, flag: 'pk' | 'fk') => {
    if (readOnly) return;
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode || targetNode.type !== 'table') return;
    if (isLocked(targetNode)) return;

    const currentFields = targetNode.fields || [];
    if (fieldIndex < 0 || fieldIndex >= currentFields.length) return;

    const nextFields = currentFields.map((f, i) =>
      i === fieldIndex ? { ...f, [flag]: !f[flag] } : f
    );

    commitState(
      nodes.map((n) => (n.id === nodeId ? { ...n, fields: nextFields } : n)),
      edges,
      strokes
    );
  };

  /**
   * Live-editing gestures — dragging, resizing, erasing, and the colour
   * picker's continuous preview — mutate state on every pointer move. They
   * cannot record history through `commitState`: by the time they commit, the
   * state argument already holds the *result*, so the pushed snapshot would be
   * the end state and one undo would appear to do nothing.
   *
   * Instead a gesture snapshots the document on its first move and pushes that
   * once on release, so the whole gesture is one undo step that restores where
   * it started. `beginStylePreview` opens a gesture for the style controls and
   * the pointer handlers open one for their own drags; `commitGesture` closes
   * whichever is open and reports whether it recorded anything, which also
   * keeps a press-and-release that changed nothing out of the history.
   */
  const beginStylePreview = useCallback(() => {
    if (!gestureBaselineRef.current) {
      gestureBaselineRef.current = { version: 1, nodes, edges, strokes, viewport };
    }
  }, [nodes, edges, strokes, viewport]);

  /** Pushes the pre-gesture document. Returns whether a gesture was open. */
  const flushStyleBaseline = useCallback(() => {
    const baseline = gestureBaselineRef.current;
    gestureBaselineRef.current = null;
    if (!baseline) return false;
    historyRef.current.push(baseline);
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
    return true;
  }, []);

  const previewNodeStyle = useCallback(
    (nodeId: string, patch: ZCanvasNodeStylePatch) => {
      if (readOnly) return;
      if (isLockedNode(nodeId)) return;
      const isBatchVisualPatch =
        selectedNodeIds.length > 1 &&
        selectedNodeIds.includes(nodeId) &&
        !('fields' in patch) &&
        !('height' in patch) &&
        !('badge' in patch) &&
        !('description' in patch) &&
        !('subtitle' in patch);
      const targetIds = new Set(isBatchVisualPatch ? movable(selectedNodeIds) : [nodeId]);
      beginStylePreview();
      commitState(
        nodes.map((n) => (targetIds.has(n.id) ? { ...n, ...patch } : n)),
        edges,
        strokes,
        false
      );
    },
    [readOnly, nodes, edges, strokes, selectedNodeIds, movable, commitState, beginStylePreview, isLockedNode]
  );

  const commitNodeStyle = useCallback(
    (nodeId: string, patch: ZCanvasNodeStylePatch) => {
      if (readOnly) return;
      if (isLockedNode(nodeId)) return;
      const isBatchVisualPatch =
        selectedNodeIds.length > 1 &&
        selectedNodeIds.includes(nodeId) &&
        !('fields' in patch) &&
        !('height' in patch) &&
        !('badge' in patch) &&
        !('description' in patch) &&
        !('subtitle' in patch);
      const targetIds = new Set(isBatchVisualPatch ? movable(selectedNodeIds) : [nodeId]);
      const hadPreview = flushStyleBaseline();
      commitState(
        nodes.map((n) => (targetIds.has(n.id) ? { ...n, ...patch } : n)),
        edges,
        strokes,
        !hadPreview
      );
    },
    [readOnly, nodes, edges, strokes, selectedNodeIds, movable, commitState, flushStyleBaseline, isLockedNode]
  );

  /**
   * Restyling ink that is already on the canvas.
   *
   * Same two-step shape as a node's appearance: a control being dragged
   * previews live with no history entry, and the value it settles on closes the
   * gesture as a single undo step.
   */
  const previewStrokeStyle = useCallback(
    (strokeId: string, patch: ZCanvasPenStylePatch) => {
      if (readOnly) return;
      if (isLockedStroke(strokeId)) return;
      beginStylePreview();
      commitState(
        nodes,
        edges,
        strokes.map((s) => (s.id === strokeId ? applyPenStyleToStroke(s, patch) : s)),
        false
      );
    },
    [readOnly, nodes, edges, strokes, commitState, beginStylePreview, isLockedStroke]
  );

  const commitStrokeStyle = useCallback(
    (strokeId: string, patch: ZCanvasPenStylePatch) => {
      if (readOnly) return;
      if (isLockedStroke(strokeId)) return;
      const hadPreview = flushStyleBaseline();
      commitState(
        nodes,
        edges,
        strokes.map((s) => (s.id === strokeId ? applyPenStyleToStroke(s, patch) : s)),
        !hadPreview
      );
    },
    [readOnly, nodes, edges, strokes, commitState, flushStyleBaseline, isLockedStroke]
  );

  /**
   * Puts a stroke back to the library's default ink.
   *
   * Ink has no theme to fall back to — it is a mark the user made, not a
   * component the app draws — so its reset is the pen's factory setting.
   */
  const resetStrokeStyle = useCallback(
    (strokeId: string) => {
      if (readOnly) return;
      if (isLockedStroke(strokeId)) return;
      gestureBaselineRef.current = null;
      commitState(
        nodes,
        edges,
        strokes.map((s) => (s.id === strokeId ? applyPenStyleToStroke(s, DEFAULT_PEN_STYLE) : s))
      );
    },
    [readOnly, nodes, edges, strokes, commitState, isLockedStroke]
  );

  /** Drops border/fill overrides so a shape falls back to the container defaults. */
  const resetNodeStyle = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      if (isLockedNode(nodeId)) return;
      const targetIds = new Set(
        selectedNodeIds.length > 1 && selectedNodeIds.includes(nodeId)
          ? movable(selectedNodeIds)
          : [nodeId]
      );
      gestureBaselineRef.current = null;
      const next = nodes.map((n) => {
        if (!targetIds.has(n.id)) return n;
        const cleared: ZCanvasNode = { ...n };
        delete cleared.color;
        delete cleared.fill;
        delete cleared.strokeWidth;
        delete cleared.strokeStyle;
        delete cleared.fillOpacity;
        return cleared;
      });
      commitState(next, edges, strokes);
    },
    [readOnly, nodes, edges, strokes, selectedNodeIds, movable, commitState, isLockedNode]
  );

  /**
   * Sets connector routing from the style panel, either on the connector being
   * edited or on every connector at once. The canvas-wide default in settings
   * follows along so connectors drawn afterwards match.
   */
  const commitEdgeRouting = useCallback(
    (style: ZCanvasEdgeRouting, scope: 'single' | 'all') => {
      if (readOnly) return;
      gestureBaselineRef.current = null;

      if (scope === 'single' && selectedEdgeId) {
        // A locked connector keeps the routing it was locked with. The
        // canvas-wide default still follows the panel, so connectors drawn
        // afterwards are unaffected by the lock.
        if (!isLockedEdge(selectedEdgeId)) {
          commitState(
            nodes,
            edges.map((e) => (e.id === selectedEdgeId ? { ...e, style } : e)),
            strokes
          );
        }
      } else {
        commitState(
          nodes,
          edges.map((e) => (isLockedEdge(e.id) ? e : { ...e, style })),
          strokes
        );
      }

      setEdgeStyle(style);
      handleUpdateSettings({ edgeRouting: style });
      onEdgeRoutingChange?.(style);
    },
    [readOnly, nodes, edges, strokes, commitState, selectedEdgeId, handleUpdateSettings, isLockedEdge, onEdgeRoutingChange]
  );

  const previewEdgeStyle = useCallback(
    (edgeId: string, patch: ZCanvasEdgeStylePatch) => {
      if (readOnly) return;
      if (isLockedEdge(edgeId)) return;
      beginStylePreview();
      commitState(
        nodes,
        edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
        strokes,
        false
      );
    },
    [readOnly, nodes, edges, strokes, commitState, beginStylePreview, isLockedEdge]
  );

  const commitEdgeStyle = useCallback(
    (edgeId: string, patch: ZCanvasEdgeStylePatch) => {
      if (readOnly) return;
      if (isLockedEdge(edgeId)) return;
      const hadPreview = flushStyleBaseline();
      commitState(
        nodes,
        edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
        strokes,
        !hadPreview
      );
    },
    [readOnly, nodes, edges, strokes, commitState, flushStyleBaseline, isLockedEdge]
  );

  /** Drops connector appearance overrides so it falls back to theme defaults. */
  const resetEdgeStyle = useCallback(
    (edgeId: string) => {
      if (readOnly) return;
      if (isLockedEdge(edgeId)) return;
      gestureBaselineRef.current = null;
      const next = edges.map((e) => {
        if (e.id !== edgeId) return e;
        const cleared: ZCanvasEdge = { ...e };
        delete cleared.color;
        delete cleared.strokeWidth;
        delete cleared.strokeStyle;
        delete cleared.lineCap;
        delete cleared.opacity;
        delete cleared.startArrowhead;
        delete cleared.endArrowhead;
        delete cleared.labelBg;
        delete cleared.labelColor;
        return cleared;
      });
      commitState(nodes, next, strokes);
    },
    [readOnly, nodes, edges, strokes, commitState, isLockedEdge]
  );

  // Connection label edit
  const startConnectionEdit = (edge: ZCanvasEdge) => {
    if (readOnly) return;
    if (isLocked(edge)) return;
    setEditingConnectionId(edge.id);
    setEditingConnectionText(edge.label || '');
  };

  const saveConnectionEdit = () => {
    if (!editingConnectionId) return;
    commitState(
      nodes,
      edges.map((e) =>
        e.id === editingConnectionId
          ? { ...e, label: editingConnectionText.trim() || undefined }
          : e
      ),
      strokes
    );
    setEditingConnectionId(null);
    setEditingConnectionText('');
  };

  // Export actions
  const handleExportSvg = () => {
    const currentDoc: ZCanvasDocument = { version: 1, nodes, edges, strokes, viewport };
    const svgData = exportDocumentToSvg(currentDoc, { isDark, fitToContent: true });
    downloadSvg(svgData, 'architecture-diagram.svg');
    toast.success('Exported diagram as SVG');
  };

  const handleExportPng = () => {
    const currentDoc: ZCanvasDocument = { version: 1, nodes, edges, strokes, viewport };
    exportDocumentToPng(currentDoc, { isDark, fitToContent: true, filename: 'architecture-diagram.png', scale: 2 });
    toast.success('Exported diagram as HD PNG (2x)');
  };

  /**
   * Decides whether a drag may land, which is the only place a drop is
   * permitted.
   *
   * A browser cancels the whole gesture if `dragover` does not call
   * `preventDefault()`, and never fires `drop` at all. The old guard named two
   * mimetypes while the library panel wrote different ones, so nothing dragged
   * out of the panel could ever land — the drop handler was correct and simply
   * never ran. `hasDragItem` answers for every format the engine understands,
   * so a writer and this guard cannot disagree about the format.
   *
   * It reads `types` and never `getData`: browsers blank the payload during
   * `dragover`, and the payload is not needed to accept the drag anyway.
   */
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    if (!hasDragItem(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  /**
   * Places whatever was dropped.
   *
   * Every kind of drag — a toolbar tool, a library stencil, a whole pattern —
   * arrives as one payload and becomes nodes inside `placeDragItem`, so this
   * knows nothing about where the drag came from. The toolbar and the library
   * panel therefore share one placement path rather than one per source.
   */
  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    const item = readDragItem(e.dataTransfer);
    // Not a payload this canvas understands: leave the event alone.
    if (!item) return;
    e.preventDefault();

    const dropPt = getCanvasPoint(e.clientX, e.clientY);
    const placement = placeDragItem(item, {
      x: snap(dropPt.x),
      y: snap(dropPt.y),
      existingNodeIds: new Set(nodes.map((node) => node.id)),
    });
    if (!placement) return;

    commitState(
      // A container is a boundary, so it goes underneath, where it paints
      // behind whatever it encloses.
      placement.prepend ? [...placement.nodes, ...nodes] : [...nodes, ...placement.nodes],
      [...edges, ...placement.edges],
      strokes
    );

    // Empty means "leave the selection alone" — a dropped pattern is a cluster,
    // not one thing to select.
    if (placement.selectedIds.length > 0) setSelectedNodeIds(placement.selectedIds);
    setActiveTool('select');
    if (placement.startTextEditId) {
      startEditing(placement.startTextEditId, 'title', '');
    }
    // Nothing is announced. What landed is on the canvas, under the pointer
    // that dropped it, and already selected — a toast would be a second telling
    // of something the user is looking at, on a gesture they will repeat.
  };

  // Component that a line/arrow being drawn would snap onto
  const lineSnapNodeId = drawingLine
    ? findNodeAt({ x: drawingLine.x2, y: drawingLine.y2 }, { allowBoundary: false })?.id ?? null
    : null;

  /**
   * The geometry of every stroke on the canvas, keyed by stroke id.
   *
   * Ink is not cheap to resolve — it cleans, smooths and walks an outline round
   * each stroke — and the canvas re-renders on every pointer move, pan and
   * selection change while the ink itself rarely changes. Keying by id means a
   * stroke added, erased or restyled only rebuilds what actually changed; the
   * live stroke under the nib is deliberately not in here, because that one is
   * rebuilt every frame by design.
   */
  const inkRenders = useMemo(() => {
    const renders = new Map<string, ReturnType<typeof resolveInkRender>>();
    for (const stroke of strokes) renders.set(stroke.id, resolveInkRender(stroke));
    return renders;
  }, [strokes]);

  /**
   * The ink currently picked, in the order it is painted.
   *
   * Filtering against the live stroke list means an id left behind by a delete
   * or an undo simply stops matching, instead of needing to be pruned from the
   * selection everywhere the document can change.
   */
  const selectedStrokes = useMemo(
    () => strokes.filter((stroke) => selectedStrokeIds.includes(stroke.id)),
    [strokes, selectedStrokeIds]
  );

  /**
   * The box the picked ink occupies — the frame its handles hang off.
   * `null` when nothing is picked, so an empty selection draws no frame at all.
   */
  const selectedInkBox = useMemo(() => getStrokesBounds(selectedStrokes), [selectedStrokes]);

  // What the style panel edits: the pressed node, one selected node, one
  // selected connector, one picked stroke — or the pen itself, while it is in
  // hand and there is nothing on the canvas to describe.
  const styleTarget: ZCanvasStyleTarget | null = (() => {
    if (readOnly) return null;

    // The pen's options are the panel while the pen is in hand — the tool is
    // what is being styled, so there is no element to select first.
    if (activeTool === 'pen') {
      return {
        kind: 'pen',
        pen: {
          color: settings.penColor,
          preset: settings.strokePreset || 'natural',
          sloppiness: settings.penSloppiness,
          strokeStyle: settings.penStrokeStyle,
          opacity: settings.penOpacity,
        },
      };
    }

    // The pressed node wins, so a container that brought its group into the
    // selection still opens the panel.
    if (selectedNodeIds.length >= 1) {
      const targetId =
        primarySelectedNodeId && selectedNodeIds.includes(primarySelectedNodeId)
          ? primarySelectedNodeId
          : selectedNodeIds[selectedNodeIds.length - 1];
      const node = nodes.find((n) => n.id === targetId);
      if (node) return { kind: 'node', node };
      return null;
    }
    if (selectedNodeIds.length === 0 && selectedEdgeId) {
      const edge = edges.find((e) => e.id === selectedEdgeId);
      if (edge) return { kind: 'edge', edge };
      return null;
    }

    // One stroke at a time, the same rule shapes and connectors follow: the
    // panel edits an element, and a selection of several has no single
    // appearance to show.
    if (selectedStrokes.length === 1 && selectedNodeIds.length === 0 && !selectedEdgeId) {
      return { kind: 'stroke', stroke: selectedStrokes[0] };
    }

    return null;
  })();

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative w-full h-full overflow-hidden select-none',
        settings.fontFamily === 'mono'
          ? 'font-mono'
          : settings.fontFamily === 'serif'
          ? 'font-serif'
          : settings.fontFamily === 'handwriting'
          ? 'font-sans tracking-wide'
          : 'font-sans',
        settings.backgroundTone === 'warm'
          ? 'bg-[#FAF8F5] dark:bg-[#1A1A1E]'
          : settings.backgroundTone === 'cool'
          ? 'bg-[#F3F4F6] dark:bg-[#16171B]'
          : settings.backgroundTone === 'contrast'
          ? 'bg-[#FFFFFF] dark:bg-[#121214]'
          : 'bg-canvas',
        readOnly
          ? (isPanning ? 'cursor-grabbing' : 'cursor-grab')
          : activeTool === 'hand' || isPanning
          ? 'cursor-grab active:cursor-grabbing'
          : draggingSelection
          ? 'cursor-move'
          : resizingInk
          ? 'cursor-nwse-resize'
          : resizingNodeId && (resizeHandle === 'nw' || resizeHandle === 'se')
          ? 'cursor-nwse-resize'
          : resizingNodeId && (resizeHandle === 'ne' || resizeHandle === 'sw')
          ? 'cursor-nesw-resize'
          : resizingNodeId && (resizeHandle === 'n' || resizeHandle === 's')
          ? 'cursor-ns-resize'
          : resizingNodeId && (resizeHandle === 'e' || resizeHandle === 'w')
          ? 'cursor-ew-resize'
          : activeTool === 'pen'
          ? 'cursor-crosshair'
          : isShapeTool(activeTool)
          ? 'cursor-cell'
          : activeTool === 'text'
          ? 'cursor-text'
          : hoveredBoundaryId && hoveredBoundaryId === primarySelectedNodeId
          ? 'cursor-move'
          : hoveredBoundaryId
          ? 'cursor-pointer'
          : 'cursor-default'
      )}
      // The pen draws with a pencil, not a crosshair. The cursor value carries
      // its own `crosshair` fallback and the class above is a second one, for
      // any browser that refuses an SVG cursor outright. Panning wins the
      // cursor back: the hand is what the gesture means while it lasts.
      style={{
        cursor:
          activeTool === 'pen' && !isPanning
            ? PEN_CURSOR
            : activeTool === 'laser' && !isPanning
            ? 'crosshair'
            : undefined,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDoubleClick={(e) => {
        if (readOnly || activeTool !== 'select') return;
        const isBackground =
          e.target === canvasRef.current ||
          (e.target as HTMLElement).tagName === 'svg' ||
          (e.target as HTMLElement).id === 'zcanvas-grid';
        if (!isBackground) return;
        const pt = getCanvasPoint(e.clientX, e.clientY);
        if (findNodeAt(pt) || findStrokeAt(strokes, pt)) return;
        const defaults = SHAPE_DEFAULTS.rectangle;
        const newNode = createShapeNode('rectangle', {
          x: snap(pt.x - defaults.width / 2),
          y: snap(pt.y - defaults.height / 2),
          width: defaults.width,
          height: defaults.height,
        });
        newNode.title = 'New Step';
        commitState([...nodes, newNode], edges, strokes);
        setSelectedNodeIds([newNode.id]);
        setPrimarySelectedNodeId(newNode.id);
        startEditing(newNode.id, 'title', newNode.title);
      }}
      onContextMenu={(e) => {
        if (readOnly) return;
        e.preventDefault();
        // A right-click over ink picks it, exactly as a node's own handler does,
        // so the menu describes what the pointer is over. The press only reaches
        // here when no shape claimed it: the strokes are painted with
        // `pointer-events: none`, so ink arrives as a press on the background.
        const hitStroke = findStrokeAt(strokes, getCanvasPoint(e.clientX, e.clientY));
        if (hitStroke && !selectedStrokeIds.includes(hitStroke.id)) {
          setSelectedStrokeIds([hitStroke.id]);
          setSelectedNodeIds([]);
          setSelectedEdgeIds([]);
        }
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* Floating Toolbar */}
      {!readOnly && !isPresentationMode && (
        <ZCanvasToolbar
          activeTool={activeTool}
          onSelectTool={selectTool}
          onPlaceFramePreset={handlePlaceFramePreset}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExportSvg={handleExportSvg}
          onExportPng={handleExportPng}
          onOpenShortcuts={() => setShowShortcuts(true)}
          onOpenSettings={() => setShowSettings(true)}
          edgeRouting={edgeStyle}
          onToggleEdgeRouting={(routing) => {
            setEdgeStyle(routing);
            handleUpdateSettings({ edgeRouting: routing });
            onEdgeRoutingChange?.(routing);
            if (selectedEdgeIds.length > 0) {
              const toggled = new Set(selectedEdgeIds);
              commitState(
                nodes,
                edges.map((e) => (toggled.has(e.id) ? { ...e, style: routing } : e)),
                strokes
              );
            }
          }}
        />
      )}

      {/* Floating Viewport Navigation Dock (Zoom controls & Fit to content) */}
      {!isPresentationMode && (
        <div
          className={cn(
            'absolute z-20 flex items-center bg-card/90 backdrop-blur-md border border-border shadow-md rounded-xl p-1 gap-0.5 text-xs select-none transition-all',
            settings.showMinimap ? 'bottom-4 right-52' : 'bottom-4 right-4'
          )}
        >
          {readOnly && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-muted-foreground border-r border-border mr-0.5"
              title="Viewing mode: Drag anywhere to move around, scroll to zoom"
            >
              <Hand className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">View Mode</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => zoomByCenter(-ZOOM_STEP)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Zoom Out (Ctrl+-)"
            aria-label="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewport({ zoom: 1, panX: 40, panY: 40 })}
            className="px-1.5 h-7 flex items-center justify-center font-mono text-[11px] rounded-lg hover:bg-muted text-foreground transition-colors cursor-pointer min-w-[42px]"
            title="Reset Zoom to 100% (Ctrl+0)"
            aria-label="Reset Zoom"
          >
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomByCenter(ZOOM_STEP)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Zoom In (Ctrl++)"
            aria-label="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            type="button"
            onClick={handleZoomToFit}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Fit to Screen (Shift+1)"
            aria-label="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Minimap (configurable in Settings) */}
      {settings.showMinimap && !isPresentationMode && (
        <ZCanvasMinimap nodes={nodes} viewport={viewport} />
      )}

      {/* SVG Canvas for Grid, Bezier Connections, and Ink Paths */}
      <svg
        id="zcanvas-grid"
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        style={{
          transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          overflow: 'visible',
        }}
      >
        <defs>
          {/* Dynamic Infinite Grid Pattern based on User Settings */}
          {settings.gridStyle === 'dots' && (
            <pattern
              id="zcanvas-active-pattern"
              width={settings.gridSize}
              height={settings.gridSize}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={settings.gridSize / 2}
                cy={settings.gridSize / 2}
                r={1.25}
                fill={isDark ? '#3A3B43' : '#D8D8D0'}
                opacity={0.8}
              />
            </pattern>
          )}

          {settings.gridStyle === 'mesh' && (
            <pattern
              id="zcanvas-active-pattern"
              width={settings.gridSize}
              height={settings.gridSize}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${settings.gridSize} 0 L 0 0 0 ${settings.gridSize}`}
                fill="none"
                stroke={isDark ? '#383940' : '#E3E3DC'}
                strokeWidth={0.8}
                opacity={0.5}
              />
            </pattern>
          )}

          {settings.gridStyle === 'cross' && (
            <pattern
              id="zcanvas-active-pattern"
              width={settings.gridSize}
              height={settings.gridSize}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${settings.gridSize / 2 - 3} ${settings.gridSize / 2} L ${settings.gridSize / 2 + 3} ${settings.gridSize / 2} M ${settings.gridSize / 2} ${settings.gridSize / 2 - 3} L ${settings.gridSize / 2} ${settings.gridSize / 2 + 3}`}
                fill="none"
                stroke={isDark ? '#4A4B54' : '#C9C9C0'}
                strokeWidth={1}
                opacity={0.7}
              />
            </pattern>
          )}

          {ARROWHEAD_MARKERS.map(({ type, refX, refY, viewBox, markerWidth, markerHeight, content }) => (
            <marker
              key={type}
              id={`zcanvas-head-${type}`}
              viewBox={viewBox ?? '0 0 10 10'}
              refX={refX}
              refY={refY}
              markerWidth={markerWidth ?? '6'}
              markerHeight={markerHeight ?? '6'}
              orient="auto-start-reverse"
            >
              <g fill="context-stroke">{content}</g>
            </marker>
          ))}
        </defs>

        {/* Viewport-adaptive infinite grid rect (covers visible window + 5000px in all directions) */}
        {settings.gridStyle !== 'none' &&
          (() => {
            const gSize = settings.gridSize;
            const pad = 5000;
            const clientW = typeof window !== 'undefined' ? window.innerWidth : 1920;
            const clientH = typeof window !== 'undefined' ? window.innerHeight : 1080;
            const gridX = Math.floor((-viewport.panX / viewport.zoom - pad) / gSize) * gSize;
            const gridY = Math.floor((-viewport.panY / viewport.zoom - pad) / gSize) * gSize;
            const gridW = Math.ceil((clientW / viewport.zoom + pad * 2) / gSize) * gSize;
            const gridH = Math.ceil((clientH / viewport.zoom + pad * 2) / gSize) * gSize;
            return (
              <rect
                x={gridX}
                y={gridY}
                width={gridW}
                height={gridH}
                fill="url(#zcanvas-active-pattern)"
              />
            );
          })()}

        {/* Smart Alignment Guides (Figma & Draw.io style with spanning caps and spacing badges) */}
        {activeGuides.map((guide, i) => {
          if (guide.spacingBadge) {
            const badge = guide.spacingBadge;
            return (
              <g key={`badge-${i}`} transform={`translate(${badge.x}, ${badge.y})`} className="pointer-events-none select-none">
                <rect
                  x="-22"
                  y="-10"
                  width="44"
                  height="20"
                  rx="10"
                  fill={isDark ? '#1e1b4b' : '#fdf2f8'}
                  stroke="#ec4899"
                  strokeWidth="1"
                  className="shadow-xs"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#db2777"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {`${badge.orientation === 'horizontal' ? '↔' : '↕'} ${badge.distance}`}
                </text>
              </g>
            );
          }

          const isH = guide.type === 'horizontal';
          const x1 = isH ? (guide.start ?? -5000) : guide.coordinate;
          const y1 = isH ? guide.coordinate : (guide.start ?? -5000);
          const x2 = isH ? (guide.end ?? 5000) : guide.coordinate;
          const y2 = isH ? guide.coordinate : (guide.end ?? 5000);

          return (
            <g key={`guide-${i}`} className="pointer-events-none">
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#ec4899"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              {/* Optional endpoint caps if finite span */}
              {guide.start !== undefined && guide.end !== undefined && (
                <>
                  <line
                    x1={isH ? x1 : x1 - 4}
                    y1={isH ? y1 - 4 : y1}
                    x2={isH ? x1 : x1 + 4}
                    y2={isH ? y1 + 4 : y1}
                    stroke="#ec4899"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={isH ? x2 : x2 - 4}
                    y1={isH ? y2 - 4 : y2}
                    x2={isH ? x2 : x2 + 4}
                    y2={isH ? y2 + 4 : y2}
                    stroke="#ec4899"
                    strokeWidth={1.5}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* Freehand Strokes */}
        {/* A wash of the accent colour under the picked ink, so a selection
            reads at a glance even where the marks are faint or overlapping. It
            is a stroke rather than a fill of the ink's own path — a filled mark
            would hide an identical fill beneath it — and it sits under the ink,
            leaving every stroke its true colour. */}
        {selectedStrokes.map((s) => {
          const ink = inkRenders.get(s.id) ?? resolveInkRender(s);
          if (!ink.d) return null;
          return (
            <path
              key={`ink-halo-${s.id}`}
              d={ink.d}
              fill="none"
              stroke={getEdgeColor('selected', isDark)}
              strokeWidth={
                (ink.strokeWidth || 0) + INK_SELECTION_PADDING / viewport.zoom
              }
              opacity={INK_SELECTION_WASH_OPACITY}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          );
        })}

        {strokes.map((s) => {
          // One shared resolver paints the ink here and in the SVG/PNG
          // exporters, so an export cannot disagree with the canvas. Memoised
          // on the strokes array: panning, zooming and selecting re-render the
          // canvas far more often than the ink actually changes.
          const ink = inkRenders.get(s.id) ?? resolveInkRender(s);
          if (!ink.d) return null;
          return (
            <path
              key={s.id}
              d={ink.d}
              data-ink={s.id}
              fill={ink.fill}
              stroke={ink.stroke}
              strokeWidth={ink.strokeWidth || undefined}
              strokeDasharray={ink.strokeDasharray}
              opacity={s.opacity ?? 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              // Ink is not a click target. A press over it belongs to the
              // canvas, which finds the stroke by how close the pointer came —
              // so a mark is picked by its shape rather than by the pixels the
              // pointer happened to land on, and drawing over existing ink
              // still starts a new stroke.
              pointerEvents="none"
            />
          );
        })}

        {currentStroke &&
          (() => {
            // Rebuilt every frame: this is the ink still under the nib.
            const ink = resolveInkRender(currentStroke);
            if (!ink.d) return null;
            return (
              <path
                d={ink.d}
                fill={ink.fill}
                stroke={ink.stroke}
                strokeWidth={ink.strokeWidth || undefined}
                strokeDasharray={ink.strokeDasharray}
                opacity={currentStroke.opacity ?? 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            );
          })()}

        {/* Dynamic Connecting Line with Draw.io Magnetic Target Snapping */}
        {connectingSourceId && connectLinePos && (
          (() => {
            const srcNode = nodeMap.get(connectingSourceId);
            if (!srcNode) return null;
            const srcPt = getHandlePoint(srcNode, connectingHandlePos, rotationOf(srcNode), connectingSourceOffset);
            const hoveredTarget =
              findNodeAt(connectLinePos, { allowBoundary: false }) ??
              findNodeAt(connectLinePos, { allowBoundary: true, boundaryThreshold: 14 });
            const snapRes =
              hoveredTarget && hoveredTarget.id !== connectingSourceId
                ? getNearestSideAndOffset(hoveredTarget, connectLinePos)
                : null;
            const endPt = snapRes ? snapRes.point : connectLinePos;
            const tgtHandle = snapRes ? snapRes.side : 'left';
            const pathD =
              edgeStyle === 'straight'
                ? `M ${srcPt.x} ${srcPt.y} L ${endPt.x} ${endPt.y}`
                : edgeStyle === 'step'
                  ? computeOrthogonalStepPath(srcPt, endPt, connectingHandlePos, tgtHandle).pathD
                  : computeSmoothBezierPath(srcPt, endPt, connectingHandlePos, tgtHandle).pathD;
            return (
              <g className="pointer-events-none select-none">
                <path
                  d={pathD}
                  stroke="#60a5fa"
                  strokeWidth={2.5}
                  strokeDasharray="6 6"
                  fill="none"
                  markerEnd="url(#zcanvas-head-arrow)"
                />
                {snapRes && hoveredTarget && (
                  <g data-testid="drawio-connect-target-reticle">
                    <rect
                      x={hoveredTarget.x - 3}
                      y={hoveredTarget.y - 3}
                      width={hoveredTarget.width + 6}
                      height={hoveredTarget.height + 6}
                      rx={8}
                      fill={isDark ? '#38BDF80d' : '#0284C70a'}
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={1.5 / viewport.zoom}
                      strokeDasharray={`${5 / viewport.zoom} ${4 / viewport.zoom}`}
                    />
                    <circle
                      cx={endPt.x}
                      cy={endPt.y}
                      r={8.5 / viewport.zoom}
                      fill={isDark ? '#38BDF833' : '#0284C733'}
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={2 / viewport.zoom}
                      className="animate-pulse"
                    />
                    <circle
                      cx={endPt.x}
                      cy={endPt.y}
                      r={3 / viewport.zoom}
                      fill={isDark ? '#38BDF8' : '#0284C7'}
                    />
                  </g>
                )}
              </g>
            );
          })()
        )}

        {/* Connections and Independent Lines/Arrows */}
        {edges.map((edge) => {
          const isDraggingThisLine = activeLineDrag?.edgeId === edge.id;
          const effectiveEdge = isDraggingThisLine
            ? { ...edge, stepOffset: activeLineDrag.offset }
            : edge;
          const geo = isDraggingThisLine
            ? computeEdgeGeometry(effectiveEdge, nodeMap, edgeStyle, multiPortOffsets.get(edge.id))
            : (edgeGeometries.get(edge.id) ?? computeEdgeGeometry(edge, nodeMap, edgeStyle));
          if (!geo) return null;

          // While an endpoint (or the whole edge) is being dragged, preview the new geometry
          const draft = edgeDraft?.edgeId === edge.id ? edgeDraft : null;
          const p1 = draft ? draft.p1 : geo.p1;
          const p2 = draft ? draft.p2 : geo.p2;

          // Calculate effective edge roughness (per-edge override or canvas-level sloppiness/preset)
          const edgeEffectiveRoughness =
            edge.roughness ??
            (settings.stylePreset === 'sketch'
              ? 1.5
              : settings.sloppiness === 'artist'
              ? 1.4
              : settings.sloppiness === 'cartoonist'
              ? 2.5
              : 0);

          const isStraight = (edge.style ?? edgeStyle) === 'straight' || Boolean(draft);
          const computedPathD =
            isStraight && edgeEffectiveRoughness > 0 && (!edge.waypoints || edge.waypoints.length === 0)
              ? getSketchEdgePath(p1, p2, edge.seed || edge.id, edgeEffectiveRoughness)
              : draft
              ? `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
              : geo.pathD;

          const lineJumpsStyle = edge.lineJumps;
          const otherEdgeVerticesList =
            lineJumpsStyle && lineJumpsStyle !== 'none'
              ? edges
                  .filter((other) => other.id !== edge.id)
                  .map((other) => edgeGeometries.get(other.id)?.vertices)
                  .filter((v): v is ZCanvasPoint[] => Boolean(v && v.length >= 2))
              : [];
          const pathD =
            lineJumpsStyle && lineJumpsStyle !== 'none' && geo.vertices && geo.vertices.length >= 2
              ? injectLineJumps(geo.vertices, otherEdgeVerticesList, lineJumpsStyle, 6)
              : computedPathD;
          const midPoint = draft
            ? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
            : geo.midPoint;

          const isSelected = selectedEdgeIds.includes(edge.id);
          const defaultEdgeColor = getEdgeColor('default', isDark);
          const selectedEdgeColor = getEdgeColor('selected', isDark);
          const { start: startHead, end: endHead } = resolveEdgeArrowheads(edge);
          const canMove = Boolean(edge.sourcePoint && edge.targetPoint);
          const edgeStrokeWidth = edge.strokeWidth ?? (isSelected ? 2.5 : 1.75);
          // `sharp` gives butt caps and mitred corners; `round` (the default)
          // keeps the soft, hand-drawn feel the rest of the canvas uses.
          const sharp = edge.lineCap === 'sharp';

          return (
            <g
              key={edge.id}
              data-edge-id={edge.id}
              data-testid={`edge-${edge.id}`}
              className={cn(
                'pointer-events-auto',
                readOnly
                  ? (isPanning ? 'cursor-grabbing' : 'cursor-grab')
                  : activeTool === 'select'
                  ? 'cursor-pointer'
                  : 'cursor-default'
              )}
              onMouseDown={(e) => handleEdgeMouseDown(e, edge)}
              onDoubleClick={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                startConnectionEdit(edge);
              }}
              onContextMenu={(e) => {
                if (readOnly) return;
                e.preventDefault();
                e.stopPropagation();
                setSelectedEdgeIds([edge.id]);
                setSelectedNodeIds([]);
                setContextMenuPos({ x: e.clientX, y: e.clientY });
              }}
            >
              {/* Invisible thick hit-area for selecting / grabbing the edge */}
              <path d={pathD} stroke="transparent" strokeWidth={16} fill="none" />

              {/* Draw.io Style Middle Segment Drag Area when selected */}
              {isSelected && !readOnly && activeTool === 'select' && (edge.style === 'step' || edgeStyle === 'step') && (
                geo.sourcePos === 'left' || geo.sourcePos === 'right' ? (
                  <line
                    data-testid={`edge-segment-drag-${edge.id}`}
                    x1={midPoint.x}
                    y1={p1.y}
                    x2={midPoint.x}
                    y2={p2.y}
                    stroke="transparent"
                    strokeWidth={22}
                    className="cursor-ew-resize pointer-events-auto"
                    onMouseDown={(e) => handleLinePositionMouseDown(e, edge, geo)}
                  >
                    <title>Drag segment to adjust line position</title>
                  </line>
                ) : (
                  <line
                    data-testid={`edge-segment-drag-${edge.id}`}
                    x1={p1.x}
                    y1={midPoint.y}
                    x2={p2.x}
                    y2={midPoint.y}
                    stroke="transparent"
                    strokeWidth={22}
                    className="cursor-ns-resize pointer-events-auto"
                    onMouseDown={(e) => handleLinePositionMouseDown(e, edge, geo)}
                  >
                    <title>Drag segment to adjust line position</title>
                  </line>
                )
              )}

              <path
                d={pathD}
                stroke={isSelected ? selectedEdgeColor : edge.color || defaultEdgeColor}
                strokeWidth={edgeStrokeWidth}
                fill="none"
                strokeDasharray={
                  edge.animated
                    ? getStrokeDashArray(edge.strokeStyle, edgeStrokeWidth) || '8 6'
                    : getStrokeDashArray(edge.strokeStyle, edgeStrokeWidth)
                }
                strokeLinecap={sharp ? 'butt' : 'round'}
                strokeLinejoin={sharp ? 'miter' : 'round'}
                markerStart={arrowheadMarkerUrl(startHead)}
                markerEnd={arrowheadMarkerUrl(endHead)}
                opacity={edge.opacity ?? 1}
                className="transition-colors duration-150"
              >
                {edge.animated && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="28"
                    to="0"
                    dur="0.9s"
                    repeatCount="indefinite"
                  />
                )}
              </path>

              {/* Connector Label (positioned at resolved non-colliding position or custom offset) */}
              {editingConnectionId === edge.id ? (
                (() => {
                  const labelPos = resolvedEdgeLabels.get(edge.id) ?? {
                    x: midPoint.x + (edge.labelOffset?.x ?? 0),
                    y: midPoint.y + (edge.labelOffset?.y ?? 0),
                  };
                  const lines = editingConnectionText.split('\n');
                  const maxLineLen = Math.max(...lines.map((l) => l.length), 6);
                  const foWidth = Math.max(140, Math.min(360, maxLineLen * 8.5 + 32));
                  const foHeight = Math.max(38, lines.length * 20 + 20);
                  const isTrans = edge.labelBg === 'transparent';
                  const bgStyle = isTrans
                    ? undefined
                    : edge.labelBg
                    ? edge.labelBg
                    : undefined;

                  return (
                    <foreignObject
                      x={labelPos.x - foWidth / 2}
                      y={labelPos.y - foHeight / 2}
                      width={foWidth}
                      height={foHeight}
                      className="overflow-visible pointer-events-auto"
                    >
                      <textarea
                        autoFocus
                        rows={Math.max(1, lines.length)}
                        placeholder="Edge label (Enter for new line)..."
                        className="w-full h-full min-h-[36px] px-2.5 py-1.5 text-xs font-mono text-center rounded-md border shadow-md outline-none bg-background text-foreground border-primary ring-1 ring-primary resize-none leading-relaxed"
                        style={{
                          backgroundColor: bgStyle,
                          color: edge.labelColor || undefined,
                        }}
                        value={editingConnectionText}
                        onChange={(e) => setEditingConnectionText(e.target.value)}
                        onBlur={saveConnectionEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setEditingConnectionId(null);
                          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            e.stopPropagation();
                            saveConnectionEdit();
                          }
                          // Plain Enter and Shift+Enter natively insert a newline in textarea!
                        }}
                      />
                    </foreignObject>
                  );
                })()
              ) : edge.label ? (
                (() => {
                  const labelPos = resolvedEdgeLabels.get(edge.id) ?? {
                    x: midPoint.x + (edge.labelOffset?.x ?? 0),
                    y: midPoint.y + (edge.labelOffset?.y ?? 0),
                  };
                  const labelX = labelPos.x;
                  const labelY = labelPos.y;
                  const isDraggingLabel = draggingEdgeLabelId === edge.id;
                  const lines = edge.label.split('\n');
                  const maxLineLen = Math.max(...lines.map((l) => l.length), 0);
                  const lineHeight = 16;
                  const padX = 10;
                  const padY = 6;
                  const badgeWidth = Math.max(36, maxLineLen * 7 + padX * 2);
                  const badgeHeight = Math.max(24, lines.length * lineHeight + padY * 2 - 4);
                  const halfWidth = badgeWidth / 2;
                  const halfHeight = badgeHeight / 2;

                  const hasCustomBg = Boolean(edge.labelBg && edge.labelBg !== 'transparent');
                  const isTransparentBg = edge.labelBg === 'transparent';
                  const bgFill = isTransparentBg
                    ? 'transparent'
                    : edge.labelBg || (isDark ? '#222328' : '#FFFFFF');
                  const strokeColor = isSelected
                    ? selectedEdgeColor
                    : isTransparentBg
                    ? 'transparent'
                    : isDark
                    ? '#383940'
                    : '#E3E3DC';
                  const textFill = edge.labelColor
                    ? edge.labelColor
                    : hasCustomBg
                    ? (isDark && !['#ffffff', '#f1f5f9'].includes(edge.labelBg!.toLowerCase())
                        ? '#FFFFFF'
                        : '#1E293B')
                    : isDark
                    ? '#B0B1BB'
                    : '#666860';

                  const textStartY = -((lines.length - 1) * lineHeight) / 2 + 4;

                  return (
                    <g
                      data-testid={`edge-label-${edge.id}`}
                      data-edge-id={edge.id}
                      transform={`translate(${labelX}, ${labelY})`}
                      className={cn(
                        'pointer-events-auto select-none',
                        readOnly
                          ? (isPanning ? 'cursor-grabbing' : 'cursor-grab')
                          : activeTool === 'select'
                          ? 'cursor-grab active:cursor-grabbing'
                          : 'cursor-default',
                        isDraggingLabel && 'cursor-grabbing'
                      )}
                      onMouseDown={(e) => handleEdgeLabelMouseDown(e, edge, midPoint, p1, p2)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startConnectionEdit(edge);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeIds([edge.id]);
                        setSelectedNodeIds([]);
                        setSelectedStrokeIds([]);
                        setPrimarySelectedNodeId(null);
                      }}
                    >
                      <title>Drag to reposition along or near line · Double-click to edit text</title>
                      <rect
                        x={-halfWidth}
                        y={-halfHeight}
                        width={badgeWidth}
                        height={badgeHeight}
                        rx={6}
                        fill={bgFill}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 1.5 : 1}
                        className={cn(
                          'hover:stroke-primary transition-colors duration-150',
                          isDraggingLabel && 'stroke-primary shadow-md'
                        )}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startConnectionEdit(edge);
                        }}
                      />
                      <text
                        x={0}
                        y={textStartY}
                        fill={textFill}
                        fontSize={11}
                        fontWeight="500"
                        textAnchor="middle"
                        className="select-none font-mono pointer-events-none"
                      >
                        {lines.map((line, idx) => (
                          <tspan
                            key={idx}
                            x={0}
                            dy={idx === 0 ? 0 : lineHeight}
                          >
                            {line || ' '}
                          </tspan>
                        ))}
                      </text>
                      {/* Subtle drag position indicator dot when selected */}
                      {isSelected && (
                        <circle
                          cx={halfWidth - 4}
                          cy={0}
                          r={2}
                          fill={selectedEdgeColor}
                          opacity={0.7}
                        />
                      )}
                    </g>
                  );
                })()
              ) : null}
              {/* Multi-point Source Endpoint Label */}
              {edge.sourceLabel && (
                <g
                  data-testid={`edge-source-label-${edge.id}`}
                  transform={`translate(${geo.vertices.length >= 2 ? geo.vertices[0].x + (geo.vertices[1].x - geo.vertices[0].x) * 0.28 : p1.x}, ${geo.vertices.length >= 2 ? geo.vertices[0].y + (geo.vertices[1].y - geo.vertices[0].y) * 0.28 : p1.y})`}
                  className="pointer-events-none select-none"
                >
                  <rect
                    x="-16"
                    y="-8"
                    width="32"
                    height="16"
                    rx="3"
                    fill={isDark ? '#1A1A1E' : '#FFFFFF'}
                    fillOpacity="0.9"
                    stroke={edge.color || (isDark ? '#475569' : '#cbd5e1')}
                    strokeWidth="0.75"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fill={edge.labelColor || (isDark ? '#cbd5e1' : '#334155')}
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {edge.sourceLabel}
                  </text>
                </g>
              )}

              {/* Multi-point Target Endpoint Label */}
              {edge.targetLabel && (
                <g
                  data-testid={`edge-target-label-${edge.id}`}
                  transform={`translate(${geo.vertices.length >= 2 ? geo.vertices[geo.vertices.length - 1].x + (geo.vertices[geo.vertices.length - 2].x - geo.vertices[geo.vertices.length - 1].x) * 0.28 : p2.x}, ${geo.vertices.length >= 2 ? geo.vertices[geo.vertices.length - 1].y + (geo.vertices[geo.vertices.length - 2].y - geo.vertices[geo.vertices.length - 1].y) * 0.28 : p2.y})`}
                  className="pointer-events-none select-none"
                >
                  <rect
                    x="-16"
                    y="-8"
                    width="32"
                    height="16"
                    rx="3"
                    fill={isDark ? '#1A1A1E' : '#FFFFFF'}
                    fillOpacity="0.9"
                    stroke={edge.color || (isDark ? '#475569' : '#cbd5e1')}
                    strokeWidth="0.75"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fill={edge.labelColor || (isDark ? '#cbd5e1' : '#334155')}
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {edge.targetLabel}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Marquee Drag Box */}
        {marqueeBox && (
          <rect
            x={marqueeBox.x}
            y={marqueeBox.y}
            width={marqueeBox.width}
            height={marqueeBox.height}
            fill={isDark ? '#8B85FF18' : '#635BFF14'}
            stroke={isDark ? '#A5A0FF' : '#635BFF'}
            strokeWidth={1}
            strokeDasharray="4 4"
            rx={4}
          />
        )}

        {/* Rubberband Shape Drawing Preview */}
        {drawingShapeBox && (
          drawingShapeBox.tool === 'diamond' ? (
            <path
              d={getRoundedPolygonPath(diamondVertices(drawingShapeBox.width, drawingShapeBox.height))}
              transform={`translate(${drawingShapeBox.x}, ${drawingShapeBox.y})`}
              fill={`${activeColor}20`}
              stroke={activeColor}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          ) : drawingShapeBox.tool === 'circle' ? (
            <ellipse
              cx={drawingShapeBox.x + drawingShapeBox.width / 2}
              cy={drawingShapeBox.y + drawingShapeBox.height / 2}
              rx={drawingShapeBox.width / 2}
              ry={drawingShapeBox.height / 2}
              fill={`${activeColor}20`}
              stroke={activeColor}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          ) : drawingShapeBox.tool === 'triangle' ? (
            <path
              d={getRoundedPolygonPath(triangleVertices(drawingShapeBox.width, drawingShapeBox.height))}
              transform={`translate(${drawingShapeBox.x}, ${drawingShapeBox.y})`}
              fill={`${activeColor}20`}
              stroke={activeColor}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          ) : (
            <rect
              x={drawingShapeBox.x}
              y={drawingShapeBox.y}
              width={drawingShapeBox.width}
              height={drawingShapeBox.height}
              fill={`${activeColor}20`}
              stroke={activeColor}
              strokeWidth={2}
              strokeDasharray="5 5"
              rx={drawingShapeBox.tool === 'rectangle' ? 8 : 4}
            />
          )
        )}

        {/* Rubberband Line / Arrow Drawing Preview */}
        {drawingLine && (
          <line
            x1={drawingLine.x1}
            y1={drawingLine.y1}
            x2={drawingLine.x2}
            y2={drawingLine.y2}
            stroke={activeColor}
            strokeWidth={2}
            strokeDasharray="5 5"
            markerEnd={drawingLine.hasArrow ? arrowheadMarkerUrl('arrow') : undefined}
          />
        )}
      </svg>

      {/* Interactive HTML Nodes Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {nodes.map((node, index) => {
          const isSelected = selectedNodeIds.includes(node.id);
          const IconComponent = node.icon ? iconMap[node.icon] || Server : Server;

          return (
            <div
              key={node.id}
              data-node-id={node.id}
              className={cn(
                'absolute rounded-xl transition-shadow select-none group/node',
                // A boundary is a frame, not a plate. Its interior lets presses
                // through to whatever is painted behind it — connectors, ink,
                // marquee selection — and only its title bar and frame bands
                // grab. A box big enough to hold a diagram would otherwise
                // swallow every double-click meant for a line drawn inside it,
                // since the connector layer sits below this one.
                node.type === 'container' || node.type === 'frame' ? 'pointer-events-none' : 'pointer-events-auto',
                readOnly
                  ? (isPanning ? 'cursor-grabbing' : 'cursor-grab')
                  : activeTool === 'select'
                  ? 'cursor-pointer'
                  : undefined,
                isSelected && (isDark ? 'ring-2 ring-[#A5A0FF] shadow-2xl' : 'ring-2 ring-[#635BFF] shadow-2xl'),
                // Highlight the component an edge endpoint would snap onto
                (edgeDraft?.attachNodeId === node.id || lineSnapNodeId === node.id) &&
                  'ring-2 ring-emerald-400 shadow-2xl'
              )}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
                // The frame stays upright and the angle turns it, so everything
                // measured from `x`/`y`/`width`/`height` — a connector's anchor,
                // a marquee, an alignment guide — goes on measuring the box it
                // was placed in, and only the drawing is turned. The grips and
                // the ring are children, so they orbit with it.
                transform: rotationOf(node) ? `rotate(${rotationOf(node)}deg)` : undefined,
                transformOrigin: 'center',
                // Stacking comes from `paintOrder` (document order, with a box
                // kept behind its own contents); an explicit `node.zIndex`
                // still wins. The element being edited is lifted above the
                // rest so its text input is never hidden.
                zIndex:
                  nodeStackKey(node, paintOrder, index) +
                  (editingNodeId === node.id ? nodes.length + 1 : 0),
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onDoubleClick={(e) => {
                onNodeDoubleClick?.(node);
                // Where a title is opened for editing: the browser's own double
                // click, whole and after the pointer is up.
                if (readOnly || (!hasEditableLabel(node) && !isGeometricShape(node.type))) return;
                e.stopPropagation();
                startEditing(node.id, 'title', node.title || '');
              }}
              onContextMenu={(e) => {
                if (readOnly) return;
                e.preventDefault();
                e.stopPropagation();
                if (!selectedNodeIds.includes(node.id)) {
                  setSelectedNodeIds(e.altKey ? [node.id] : selectWholeGroups([node.id]));
                  setPrimarySelectedNodeId(node.id);
                  setSelectedEdgeIds([]);
                }
                setContextMenuPos({ x: e.clientX, y: e.clientY });
              }}
            >
              {/* A lock has to be visible, or an element that refuses to move
                  reads as the canvas being broken. It sits on the corner and
                  takes no pointer events of its own, so it neither hides the
                  element's own grasps nor becomes one. */}
              {isLocked(node) && (
                <div data-lock-badge={node.id} className="absolute -top-2 -right-2 z-10 pointer-events-none">
                  <LockPill />
                </div>
              )}

              {/* CONTAINER NODE */}
              {node.type === 'container' && (
                <div
                  className="relative w-full h-full rounded-2xl p-4 flex flex-col justify-between pointer-events-none"
                  style={{
                    borderColor: node.color || resolveNodeStroke('container', isDark),
                    borderWidth: node.strokeWidth || 2,
                    borderStyle: node.strokeStyle || 'dashed',
                    backgroundColor: resolveNodeFill(
                      'container',
                      isDark,
                      node.fill,
                      node.fillOpacity
                    ),
                  }}
                >
                  {/* Frame bands. The interior lets presses through to inner nodes,
                      while the entire perimeter frame (16px grab zone) and header bar
                      act as generous click-and-drag handles for selecting and moving the container. */}
                  <div className="absolute inset-x-0 -top-1.5 h-4 pointer-events-auto cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} />
                  <div className="absolute inset-x-0 -bottom-1.5 h-4 pointer-events-auto cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} />
                  <div className="absolute inset-y-0 -left-1.5 w-4 pointer-events-auto cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} />
                  <div className="absolute inset-y-0 -right-1.5 w-4 pointer-events-auto cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} />

                  {/* Header bar: full-width grab handle across the top padding of the container */}
                  <div
                    className={cn(
                      "flex items-start pointer-events-auto cursor-pointer py-1 px-1.5 -mx-1 -mt-1 rounded-lg hover:bg-primary/5 transition-colors",
                      node.textAlign === 'center'
                        ? 'justify-center'
                        : node.textAlign === 'right'
                        ? 'justify-end'
                        : 'justify-between'
                    )}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  >
                    <div className={cn(
                      "flex items-start gap-1.5 min-w-0 flex-1",
                      node.textAlign === 'center'
                        ? 'justify-center text-center'
                        : node.textAlign === 'right'
                        ? 'flex-row-reverse text-right'
                        : 'justify-start text-left'
                    )}>
                      <Layers className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        {editingNodeId === node.id && editingField === 'title' ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={saveEditing}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing();
                              if (e.key === 'Escape') setEditingNodeId(null);
                            }}
                            className="bg-transparent border-none text-xs font-semibold uppercase tracking-wider text-foreground outline-none w-full p-0 shadow-none ring-0"
                          />
                        ) : (
                          <span
                            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate block cursor-text hover:text-foreground"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEditing(node.id, 'title', node.title || '');
                            }}
                          >
                            {node.title || '(Untitled Container)'}
                          </span>
                        )}
                        {(node.subtitle || node.description) && (
                          <div
                            className="text-[10px] text-muted-foreground/80 truncate cursor-text normal-case tracking-normal font-normal mt-0.5"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEditing(node.id, 'subtitle', node.subtitle || node.description || '');
                            }}
                            title={node.description || node.subtitle}
                          >
                            {node.subtitle || node.description}
                          </div>
                        )}
                      </div>
                    </div>
                    {editingNodeId === node.id && editingField === 'badge' ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingValue}
                        placeholder="Badge"
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={saveEditing}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing();
                          if (e.key === 'Escape') setEditingNodeId(null);
                        }}
                        className="w-20 shrink-0 ml-2 px-2 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary border border-primary/40 font-medium outline-none"
                      />
                    ) : node.badge ? (
                      <div className="flex items-center gap-1 shrink-0 ml-2 group/badge">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium cursor-text"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEditing(node.id, 'badge', node.badge || '');
                          }}
                          title="Double-click to edit badge · Hover to remove"
                        >
                          {node.badge}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            title="Remove badge to let title take full width"
                            aria-label="Remove badge"
                            className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover/badge:opacity-100 hover:text-destructive hover:bg-destructive/10 text-muted-foreground transition-all cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              commitNodeStyle(node.id, { badge: undefined });
                            }}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      !readOnly && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(node.id, 'badge', '');
                          }}
                          className="shrink-0 ml-2 px-2 py-0.5 text-[10px] rounded-full border border-dashed border-border text-muted-foreground opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100 transition-opacity hover:border-primary/50 hover:text-primary cursor-pointer"
                          title="Add a badge"
                        >
                          + Badge
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* FRAME / ARTBOARD NODE */}
              {node.type === 'frame' && (
                <div
                  className="relative w-full h-full rounded-xl pointer-events-none"
                  style={{
                    borderColor: node.color || resolveNodeStroke('frame', isDark),
                    borderWidth: node.strokeWidth || 1.5,
                    borderStyle: node.strokeStyle || 'solid',
                    backgroundColor: resolveNodeFill(
                      'frame',
                      isDark,
                      node.fill,
                      node.fillOpacity ?? 0.04
                    ),
                  }}
                >
                  {/* Frame edge grab handles for moving */}
                  <div className="absolute inset-x-0 -top-1.5 h-4 pointer-events-auto cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} />
                  <div className="absolute inset-x-0 -bottom-1.5 h-4 pointer-events-auto cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} />
                  <div className="absolute inset-y-0 -left-1.5 w-4 pointer-events-auto cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} />
                  <div className="absolute inset-y-0 -right-1.5 w-4 pointer-events-auto cursor-pointer" onMouseDown={(e) => handleNodeMouseDown(e, node)} />

                  {/* Top Floating Frame Tag (Figma/Miro artboard style) */}
                  <div
                    className="absolute -top-7 left-0 pointer-events-auto cursor-pointer flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-background/95 backdrop-blur-xs border border-border/80 shadow-xs text-xs select-none hover:border-primary transition-colors"
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  >
                    <Frame className="w-3.5 h-3.5 text-primary shrink-0" />
                    {editingNodeId === node.id && editingField === 'title' ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={saveEditing}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing();
                          if (e.key === 'Escape') setEditingNodeId(null);
                        }}
                        className="bg-transparent border-none text-xs font-semibold text-foreground outline-none p-0 shadow-none ring-0 w-28"
                      />
                    ) : (
                      <span
                        className="font-semibold text-foreground hover:text-primary cursor-text truncate max-w-[200px]"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEditing(node.id, 'title', node.title || '');
                        }}
                      >
                        {node.title || '(Untitled Frame)'}
                      </span>
                    )}
                    <span
                      className="text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-foreground"
                      title="Double-click to match content"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleFitFrameToContent(node.id);
                      }}
                    >
                      {Math.round(node.width)} × {Math.round(node.height)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFitFrameToContent(node.id);
                      }}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      title="Match Content (Fit frame to enclosed items)"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* ERD TABLE NODE */}
              {node.type === 'table' && (
                <div
                  className="w-full h-full rounded-xl bg-card shadow-lg overflow-hidden flex flex-col"
                  style={{
                    borderColor: node.color || resolveNodeStroke('table', isDark),
                    borderWidth: node.strokeWidth || 1,
                    borderStyle: node.strokeStyle || 'solid',
                    backgroundColor: resolveNodeFill('table', isDark, node.fill, node.fillOpacity),
                  }}
                >
                  <div
                    className="px-3 py-2 border-b flex items-center justify-between font-mono text-xs font-semibold"
                    style={{
                      // The header strip is the table's own border token, so the
                      // whole node restyles together — a colour picked in the
                      // panel tints the header too, and Reset restores it.
                      backgroundColor: withOpacity(
                        node.color || resolveNodeStroke('table', isDark),
                        0.12
                      ),
                      borderColor: withOpacity(
                        node.color || resolveNodeStroke('table', isDark),
                        0.25
                      ),
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-foreground flex-1 min-w-0 mr-2">
                      <Database className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      {editingNodeId === node.id && editingField === 'title' ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing();
                            if (e.key === 'Escape') setEditingNodeId(null);
                          }}
                          className="bg-transparent border-none text-xs font-mono font-semibold text-foreground outline-none w-full p-0 shadow-none ring-0"
                        />
                      ) : (
                        <span
                          className="truncate cursor-text"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEditing(node.id, 'title', node.title || '');
                          }}
                        >
                          {node.title}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-sans font-medium shrink-0">TABLE</span>
                  </div>
                  <div className="p-2 space-y-1.5 overflow-y-auto flex-1 text-[11px] font-mono">
                    {node.fields?.map((f, i) => {
                      const rowOffset = Math.round(44 + i * 24 - node.height / 2);
                      return (
                        <div
                          key={i}
                          className="group relative flex items-center justify-between text-foreground/90 hover:bg-muted/40 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          {/* Row-Level Left Connection Port (Drag from / drop onto specific column) */}
                          {!readOnly && activeTool === 'select' && (
                            <div
                              data-testid={`erd-row-anchor-left-${i}`}
                              title={`Connect column "${f.name}" (Left)`}
                              className={cn(
                                'absolute -left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 bg-teal-500 shadow-xs cursor-crosshair transition-all hover:scale-150 z-20',
                                connectingSourceId
                                  ? 'opacity-90 scale-110'
                                  : 'opacity-0 group-hover:opacity-100'
                              )}
                              onMouseDown={(e) => handleAnchorMouseDown(e, node.id, 'left', rowOffset)}
                              onMouseUp={(e) => handleAnchorMouseUp(e, node.id, 'left', rowOffset)}
                            />
                          )}

                          <div className="flex items-center gap-1 min-w-0 flex-1 mr-1.5">
                            {/* Interactive PK / FK Badges */}
                            {!readOnly ? (
                              <div className="flex items-center gap-0.5 shrink-0">
                                {(f.pk || isSelected) && (
                                  <button
                                    type="button"
                                    title={f.pk ? 'Primary Key (Click to toggle)' : 'Set as Primary Key (PK)'}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleFieldFlag(node.id, i, 'pk');
                                    }}
                                    className={cn(
                                      'px-1 py-0 rounded text-[8px] font-bold leading-tight border transition-all cursor-pointer',
                                      f.pk
                                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50'
                                        : 'opacity-0 group-hover:opacity-75 hover:!opacity-100 text-muted-foreground border-border/60'
                                    )}
                                  >
                                    PK
                                  </button>
                                )}
                                {(f.fk || isSelected) && (
                                  <button
                                    type="button"
                                    title={f.fk ? 'Foreign Key (Click to toggle)' : 'Set as Foreign Key (FK)'}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleFieldFlag(node.id, i, 'fk');
                                    }}
                                    className={cn(
                                      'px-1 py-0 rounded text-[8px] font-bold leading-tight border transition-all cursor-pointer',
                                      f.fk
                                        ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/50'
                                        : 'opacity-0 group-hover:opacity-75 hover:!opacity-100 text-muted-foreground border-border/60'
                                    )}
                                  >
                                    FK
                                  </button>
                                )}
                              </div>
                            ) : (
                              <>
                                {f.pk && (
                                  <span className="px-1 py-0 rounded text-[8px] font-bold leading-tight bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50 shrink-0">
                                    PK
                                  </span>
                                )}
                                {f.fk && (
                                  <span className="px-1 py-0 rounded text-[8px] font-bold leading-tight bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/50 shrink-0">
                                    FK
                                  </span>
                                )}
                              </>
                            )}

                            {editingNodeId === node.id && editingField === 'field_name' && editingFieldIndex === i ? (
                              <input
                                type="text"
                                autoFocus
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={saveEditing}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditing();
                                  if (e.key === 'Escape') setEditingNodeId(null);
                                }}
                                className="bg-transparent border-none text-[11px] font-mono text-foreground outline-none w-full p-0 shadow-none ring-0"
                              />
                            ) : (
                              <span
                                className={cn(
                                  'truncate cursor-text',
                                  f.pk && 'font-semibold text-foreground'
                                )}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(node.id, 'field_name', f.name, i);
                                }}
                              >
                                {f.name}
                              </span>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            {editingNodeId === node.id && editingField === 'field_type' && editingFieldIndex === i ? (
                              <input
                                type="text"
                                autoFocus
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={saveEditing}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditing();
                                  if (e.key === 'Escape') setEditingNodeId(null);
                                }}
                                className="bg-transparent border-none text-[10px] font-mono text-muted-foreground outline-none w-20 text-right p-0 shadow-none ring-0"
                              />
                            ) : (
                              <span
                                className="text-muted-foreground text-[10px] hover:text-foreground cursor-text"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(node.id, 'field_type', f.type, i);
                                }}
                              >
                                {f.type}
                              </span>
                            )}

                            {!readOnly && (
                              <button
                                type="button"
                                aria-label={`Remove column ${f.name}`}
                                title={`Remove column "${f.name}"`}
                                className={cn(
                                  'w-4 h-4 shrink-0 flex items-center justify-center rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all',
                                  isSelected
                                    ? 'opacity-50 hover:opacity-100'
                                    : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                                )}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveField(node.id, i);
                                }}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>

                          {/* Row-Level Right Connection Port (Drag from / drop onto specific column) */}
                          {!readOnly && activeTool === 'select' && (
                            <div
                              data-testid={`erd-row-anchor-right-${i}`}
                              title={`Connect column "${f.name}" (Right)`}
                              className={cn(
                                'absolute -right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900 bg-teal-500 shadow-xs cursor-crosshair transition-all hover:scale-150 z-20',
                                connectingSourceId
                                  ? 'opacity-90 scale-110'
                                  : 'opacity-0 group-hover:opacity-100'
                              )}
                              onMouseDown={(e) => handleAnchorMouseDown(e, node.id, 'right', rowOffset)}
                              onMouseUp={(e) => handleAnchorMouseUp(e, node.id, 'right', rowOffset)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Column Quick Button at bottom of table */}
                  {!readOnly && (
                    <button
                      type="button"
                      className="w-full py-1 text-[10px] text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 border-t border-dashed border-teal-500/30 flex items-center justify-center gap-1 font-mono transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddField(node.id);
                      }}
                    >
                      <Plus className="w-2.5 h-2.5" />
                      Add Column
                    </button>
                  )}
                </div>
              )}

              {/* SERVICE CARD NODE */}
              {node.type === 'card' && (
                <div
                  className={cn(
                    "w-full h-full rounded-xl bg-card border shadow-md p-3 flex flex-col",
                    node.textVerticalAlign === 'top'
                      ? 'justify-start gap-1.5'
                      : node.textVerticalAlign === 'bottom'
                      ? 'justify-end gap-1.5'
                      : 'justify-between'
                  )}
                  style={{
                    borderColor: node.color || resolveNodeStroke('card', isDark),
                    borderWidth: node.strokeWidth || 1,
                    borderStyle: node.strokeStyle || 'solid',
                    backgroundColor: resolveNodeFill(
                      'card',
                      isDark,
                      node.fill,
                      node.fillOpacity
                    ),
                  }}
                >
                  <div className={cn(
                    "flex items-start gap-2",
                    node.textAlign === 'center'
                      ? 'justify-center text-center'
                      : node.textAlign === 'right'
                      ? 'justify-end text-right'
                      : 'justify-between text-left'
                  )}>
                    <div className={cn(
                      "flex items-start gap-2 min-w-0 flex-1",
                      node.textAlign === 'center'
                        ? 'justify-center'
                        : node.textAlign === 'right'
                        ? 'flex-row-reverse text-right'
                        : 'justify-start text-left'
                    )}>
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden p-0.5 mt-0.5"
                        // The icon chip is a faint wash of the card's own border
                        // token, so it follows the panel colour and Reset with it.
                        style={{
                          backgroundColor: withOpacity(
                            node.color || resolveNodeStroke('card', isDark),
                            0.14
                          ),
                        }}
                      >
                        {node.data?.techLogoId || node.data?.stencilId || (node as any).techLogoId || (node as any).stencilId ? (
                          <ZCanvasStencilGraphic
                            id={node.data?.techLogoId || node.data?.stencilId || (node as any).techLogoId || (node as any).stencilId}
                            width={22}
                            height={22}
                            isDark={isDark}
                            className="w-5 h-5 object-contain"
                            color={node.color}
                          />
                        ) : (
                          <IconComponent className="w-4 h-4 text-foreground/90" />
                        )}
                      </div>
                      <div className={cn(
                        "min-w-0 flex-1",
                        node.textAlign === 'center'
                          ? 'text-center'
                          : node.textAlign === 'right'
                          ? 'text-right'
                          : 'text-left'
                      )}>
                        {editingNodeId === node.id && editingField === 'title' ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={saveEditing}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing();
                              if (e.key === 'Escape') setEditingNodeId(null);
                            }}
                            className={cn(
                              "bg-transparent border-none font-medium text-xs text-foreground outline-none w-full p-0 shadow-none ring-0",
                              node.textAlign === 'center'
                                ? 'text-center'
                                : node.textAlign === 'right'
                                ? 'text-right'
                                : 'text-left'
                            )}
                            style={{
                              fontSize: node.fontSize ? `${node.fontSize}px` : undefined,
                              fontFamily: node.fontFamily === 'mono' ? 'var(--font-mono)' : node.fontFamily === 'serif' ? 'serif' : undefined,
                            }}
                          />
                        ) : (
                          <div
                            className={cn(
                              "font-medium text-xs text-foreground truncate cursor-text",
                              node.textAlign === 'center'
                                ? 'text-center'
                                : node.textAlign === 'right'
                                ? 'text-right'
                                : 'text-left'
                            )}
                            style={{
                              fontSize: node.fontSize ? `${node.fontSize}px` : undefined,
                              fontFamily: node.fontFamily === 'mono' ? 'var(--font-mono)' : node.fontFamily === 'serif' ? 'serif' : undefined,
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEditing(node.id, 'title', node.title || '');
                            }}
                          >
                            {node.title}
                          </div>
                        )}

                        {editingNodeId === node.id && editingField === 'subtitle' ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={saveEditing}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing();
                              if (e.key === 'Escape') setEditingNodeId(null);
                            }}
                            className={cn(
                              "bg-transparent border-none text-[10px] text-muted-foreground outline-none w-full mt-0.5 p-0 shadow-none ring-0",
                              node.textAlign === 'center'
                                ? 'text-center'
                                : node.textAlign === 'right'
                                ? 'text-right'
                                : 'text-left'
                            )}
                            style={{
                              fontFamily: node.fontFamily === 'mono' ? 'var(--font-mono)' : node.fontFamily === 'serif' ? 'serif' : undefined,
                            }}
                          />
                        ) : (
                          (node.subtitle || node.description) && (
                            <div
                              className={cn(
                                "text-[10px] text-muted-foreground truncate cursor-text",
                                node.textAlign === 'center'
                                  ? 'text-center'
                                  : node.textAlign === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              )}
                              style={{
                                fontFamily: node.fontFamily === 'mono' ? 'var(--font-mono)' : node.fontFamily === 'serif' ? 'serif' : undefined,
                              }}
                              title={node.description || node.subtitle}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                startEditing(node.id, 'subtitle', node.subtitle || node.description || '');
                              }}
                            >
                              {node.subtitle || node.description}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    {editingNodeId === node.id && editingField === 'badge' ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingValue}
                        placeholder="Badge"
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={saveEditing}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditing();
                          if (e.key === 'Escape') setEditingNodeId(null);
                        }}
                        className="w-16 shrink-0 px-1.5 py-0.5 text-[9px] rounded bg-muted text-foreground border border-primary/40 font-mono outline-none"
                      />
                    ) : node.badge ? (
                      <div className="flex items-center gap-0.5 shrink-0 group/badge">
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono shrink-0 cursor-text"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEditing(node.id, 'badge', node.badge || '');
                          }}
                          title="Double-click to edit badge · Hover to remove"
                        >
                          {node.badge}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            title="Remove badge to let title take full width"
                            aria-label="Remove badge"
                            className="w-3.5 h-3.5 rounded flex items-center justify-center opacity-0 group-hover/badge:opacity-100 hover:text-destructive hover:bg-destructive/10 text-muted-foreground transition-all cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              commitNodeStyle(node.id, { badge: undefined });
                            }}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      !readOnly && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(node.id, 'badge', '');
                          }}
                          className="shrink-0 px-1.5 py-0.5 text-[9px] rounded border border-dashed border-border text-muted-foreground font-mono opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100 transition-opacity hover:border-primary/50 hover:text-primary cursor-pointer"
                          title="Add a badge"
                        >
                          + Badge
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* RECTANGLE / DIAMOND / TEXT NODES */}
              {node.type === 'rectangle' && (
                <div
                  className={cn(
                    "w-full h-full flex p-2 text-xs font-medium text-foreground relative select-none",
                    node.textVerticalAlign === 'top'
                      ? 'items-start'
                      : node.textVerticalAlign === 'bottom'
                      ? 'items-end'
                      : 'items-center',
                    node.textAlign === 'left'
                      ? 'justify-start'
                      : node.textAlign === 'right'
                      ? 'justify-end'
                      : 'justify-center'
                  )}
                  onDoubleClick={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    startEditing(node.id, 'title', node.title || '');
                  }}
                >
                  {settings.stylePreset === 'sketch' || (node.roughness && node.roughness > 0) ? (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-xs"
                      viewBox={`0 0 ${node.width} ${node.height}`}
                    >
                      <path
                        d={getSketchRectPath(2, 2, node.width - 4, node.height - 4, node.seed || node.id, node.roughness || 1.8)}
                        fill={resolveNodeFill('rectangle', isDark, node.fill, node.fillOpacity)}
                        stroke={node.color || resolveNodeStroke('rectangle', isDark)}
                        strokeWidth={node.strokeWidth || 2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeDasharray={getStrokeDashArray(node.strokeStyle, node.strokeWidth || 2)}
                      />
                    </svg>
                  ) : (
                    // Matches the service card container: rounded-xl, card fill, soft shadow.
                    <div
                      className="absolute inset-0 w-full h-full rounded-xl bg-card shadow-md pointer-events-none"
                      style={{
                        borderColor: node.color || resolveNodeStroke('rectangle', isDark),
                        borderWidth: node.strokeWidth || 2,
                        borderStyle: node.strokeStyle || 'solid',
                        backgroundColor: resolveNodeFill(
                          'rectangle',
                          isDark,
                          node.fill,
                          node.fillOpacity
                        ),
                      }}
                    />
                  )}

                  <div
                    className={cn(
                      'relative z-10 w-full px-2 flex items-center min-h-[28px]',
                      node.textAlign === 'left'
                        ? 'justify-start text-left'
                        : node.textAlign === 'right'
                        ? 'justify-end text-right'
                        : 'justify-center text-center',
                      node.fontFamily === 'mono'
                        ? 'font-mono'
                        : node.fontFamily === 'serif'
                        ? 'font-serif'
                        : node.fontFamily === 'handwriting'
                        ? 'font-sans tracking-wide'
                        : 'font-sans'
                    )}
                    style={{
                      fontSize: node.fontSize ? `${node.fontSize}px` : '13px',
                      fontWeight: node.fontWeight || 500,
                      color: node.color || undefined,
                    }}
                  >
                    {editingNodeId === node.id && editingField === 'title' ? (
                      <AutoResizeTextarea
                        value={editingValue}
                        onChange={setEditingValue}
                        onSave={saveEditing}
                        onCancel={() => setEditingNodeId(null)}
                        className={cn(
                          node.textAlign === 'left'
                            ? 'text-left'
                            : node.textAlign === 'right'
                            ? 'text-right'
                            : 'text-center'
                        )}
                        style={{
                          fontSize: node.fontSize ? `${node.fontSize}px` : '13px',
                          fontWeight: node.fontWeight || 500,
                          color: node.color || undefined,
                        }}
                      />
                    ) : (
                      node.title && (
                        <div
                          className={cn(
                            'max-w-full w-full select-none whitespace-pre-wrap break-words leading-snug',
                            node.textAlign === 'left'
                              ? 'text-left'
                              : node.textAlign === 'right'
                              ? 'text-right'
                              : 'text-center'
                          )}
                        >
                          {node.title}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* CIRCLE / DIAMOND / TRIANGLE NODES */}
              {isSvgShapeType(node.type) && (
                <div
                  className={cn(
                    "relative w-full h-full flex select-none",
                    node.textVerticalAlign === 'top'
                      ? 'items-start pt-3'
                      : node.textVerticalAlign === 'bottom'
                      ? 'items-end pb-3'
                      : 'items-center',
                    node.textAlign === 'left'
                      ? 'justify-start'
                      : node.textAlign === 'right'
                      ? 'justify-end'
                      : 'justify-center'
                  )}
                  onDoubleClick={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    startEditing(node.id, 'title', node.title || '');
                  }}
                >
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md"
                    viewBox={`0 0 ${node.width} ${node.height}`}
                  >
                    <ZCanvasShapeGeometry
                      node={node}
                      isDark={isDark}
                      sketch={settings.stylePreset === 'sketch' || Boolean(node.roughness && node.roughness > 0)}
                    />
                  </svg>
                  <div
                    className={cn(
                      'relative z-10 px-3 w-full max-w-[85%] flex items-center min-h-[28px]',
                      node.textAlign === 'left'
                        ? 'justify-start text-left'
                        : node.textAlign === 'right'
                        ? 'justify-end text-right'
                        : 'justify-center text-center',
                      node.fontFamily === 'mono'
                        ? 'font-mono'
                        : node.fontFamily === 'serif'
                        ? 'font-serif'
                        : node.fontFamily === 'handwriting'
                        ? 'font-sans tracking-wide'
                        : 'font-sans'
                    )}
                    style={{
                      fontSize: node.fontSize ? `${node.fontSize}px` : '13px',
                      fontWeight: node.fontWeight || 500,
                      color: node.color || undefined,
                    }}
                  >
                    {editingNodeId === node.id && editingField === 'title' ? (
                      <AutoResizeTextarea
                        value={editingValue}
                        onChange={setEditingValue}
                        onSave={saveEditing}
                        onCancel={() => setEditingNodeId(null)}
                        className={cn(
                          node.textAlign === 'left'
                            ? 'text-left'
                            : node.textAlign === 'right'
                            ? 'text-right'
                            : 'text-center'
                        )}
                        style={{
                          fontSize: node.fontSize ? `${node.fontSize}px` : '13px',
                          fontWeight: node.fontWeight || 500,
                          color: node.color || undefined,
                        }}
                      />
                    ) : (
                      node.title && (
                        <div
                          className={cn(
                            'max-w-full w-full select-none whitespace-pre-wrap break-words leading-snug',
                            node.textAlign === 'left'
                              ? 'text-left'
                              : node.textAlign === 'right'
                              ? 'text-right'
                              : 'text-center'
                          )}
                        >
                          {node.title}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {node.type === 'text' && (
                <div
                  className={cn(
                    'w-full h-full flex p-1 cursor-text select-text rounded-md transition-colors',
                    node.textVerticalAlign === 'bottom'
                      ? 'items-end'
                      : node.textVerticalAlign === 'top'
                      ? 'items-start'
                      : 'items-center',
                    node.textAlign === 'center'
                      ? 'justify-center text-center'
                      : node.textAlign === 'right'
                      ? 'justify-end text-right'
                      : 'justify-start text-left',
                    node.fontFamily === 'mono'
                      ? 'font-mono'
                      : node.fontFamily === 'serif'
                      ? 'font-serif'
                      : node.fontFamily === 'handwriting'
                      ? 'font-sans tracking-wide'
                      : 'font-sans'
                  )}
                  style={{
                    backgroundColor:
                      node.fill && node.fill !== 'transparent'
                        ? resolveNodeFill('rectangle', isDark, node.fill, node.fillOpacity)
                        : undefined,
                    color: node.color || undefined,
                    fontSize: node.fontSize ? `${node.fontSize}px` : '15px',
                    fontWeight: node.fontWeight || 500,
                  }}
                  onDoubleClick={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    startEditing(node.id, 'title', node.title || '');
                  }}
                >
                  {editingNodeId === node.id && editingField === 'title' ? (
                    <AutoResizeTextarea
                      placeholder="Type text..."
                      value={editingValue}
                      onChange={setEditingValue}
                      onSave={saveEditing}
                      onCancel={() => setEditingNodeId(null)}
                      className={cn(
                        node.textAlign === 'center'
                          ? 'text-center'
                          : node.textAlign === 'right'
                          ? 'text-right'
                          : 'text-left'
                      )}
                      style={{
                        color: node.color || undefined,
                        fontSize: node.fontSize ? `${node.fontSize}px` : '15px',
                        fontWeight: node.fontWeight || 500,
                      }}
                    />
                  ) : (
                    <div
                      className={cn(
                        'select-text max-w-full w-full whitespace-pre-wrap break-words leading-snug',
                        node.textAlign === 'center'
                          ? 'text-center'
                          : node.textAlign === 'right'
                          ? 'text-right'
                          : 'text-left'
                      )}
                    >
                      {node.title || <span className="opacity-40 italic">Empty text</span>}
                    </div>
                  )}
                </div>
              )}

              {/* SVG VECTOR STENCIL / REAL DIAGRAM COMPONENT NODE */}
              {node.type === 'svg' && (
                <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-auto">
                  {(() => {
                    const rawSvg = node.data?.svgMarkup || node.data?.svg || node.data?.mermaidSvg;
                    if (rawSvg) {
                      return (
                        <div className="relative w-full h-full flex items-center justify-center p-3 select-none pointer-events-none overflow-hidden rounded-xl bg-card/85 border border-border/70 shadow-sm [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full">
                          {node.data?.isMermaid && (
                            <div className="absolute top-2 left-2.5 px-2 py-0.5 rounded-md bg-muted/90 backdrop-blur-xs border border-border/60 text-[10px] font-mono text-muted-foreground font-medium flex items-center gap-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
                              <span>{node.title || 'Mermaid'}</span>
                            </div>
                          )}
                          <div
                            className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                            dangerouslySetInnerHTML={{ __html: rawSvg }}
                          />
                        </div>
                      );
                    }

                    const stencilKey =
                      node.data?.techLogoId ||
                      node.data?.stencilId ||
                      node.data?.archId ||
                      (node as any).techLogoId ||
                      (node as any).stencilId ||
                      (node as any).archId ||
                      (node.icon?.startsWith('tech-') || node.icon?.startsWith('arch-') ? node.icon : undefined);

                    if (stencilKey) {
                      return (
                        <ZCanvasStencilGraphic
                          id={stencilKey}
                          width={node.width}
                          height={node.height}
                          isDark={isDark}
                          className="w-full h-full drop-shadow-xs"
                          color={node.color}
                        />
                      );
                    }

                    if (node.data?.svgPath) {
                      return (
                        <svg
                          viewBox={node.data.viewBox || '0 0 24 24'}
                          className="w-full h-full drop-shadow-xs"
                          style={{ overflow: 'visible' }}
                        >
                          <path
                            d={node.data.svgPath}
                            fill={node.data.color || (isDark ? '#f4f4f5' : '#18181b')}
                          />
                        </svg>
                      );
                    }

                    if (node.data?.elements) {
                      return (
                        <ZCanvasElementArrayGraphic
                          elements={node.data.elements}
                          isDark={isDark}
                          className="w-full h-full drop-shadow-xs"
                        />
                      );
                    }

                    // Fallback to auto-inferred stencil from title or id so the component is NEVER blank or empty
                    const inferred = node.title || node.id || 'arch-server';
                    return (
                      <ZCanvasStencilGraphic
                        id={inferred}
                        width={node.width}
                        height={node.height}
                        isDark={isDark}
                        className="w-full h-full drop-shadow-xs"
                        color={node.color}
                      />
                    );
                  })()}
                  {/* The name, when there is one (skip bottom floating label for Mermaid component, which has its own top badge) */}
                  {!node.data?.isMermaid && (node.title || (editingNodeId === node.id && editingField === 'title')) && (
                    <div
                      className="absolute -bottom-6.5 left-1/2 -translate-x-1/2 w-max max-w-[160px] text-center text-[11px] font-medium text-foreground select-none cursor-text px-1 leading-tight"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditing(node.id, 'title', node.title || '');
                      }}
                    >
                      {editingNodeId === node.id && editingField === 'title' ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing();
                            if (e.key === 'Escape') setEditingNodeId(null);
                          }}
                          className="bg-transparent border-none outline-none w-full text-center text-[11px] font-medium text-foreground p-0"
                        />
                      ) : (
                        node.title
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MAGNETIC ANCHORS (Center + Quartile anchors on each side) */}
              {!readOnly && (
                <>
                  {(['top', 'right', 'bottom', 'left'] as ZCanvasHandlePosition[]).flatMap((pos) => {
                    const isHorizontal = pos === 'top' || pos === 'bottom';
                    const span = isHorizontal ? node.width : node.height;
                    const ratios = span >= 90 ? [0.25, 0.5, 0.75] : [0.5];
                    const isHovered = isSelected || connectingSourceId !== null || hoveredNodeId === node.id;
                    const offset = isSelected && connectingSourceId === null ? '-18px' : '-6px';

                    return ratios.map((ratio) => {
                      const offsetVal = Math.round((ratio - 0.5) * span);
                      const isCenter = ratio === 0.5;
                      let style: React.CSSProperties = {};
                      if (pos === 'top') style = { top: offset, left: `${ratio * 100}%`, transform: 'translateX(-50%)' };
                      if (pos === 'right') style = { top: `${ratio * 100}%`, right: offset, transform: 'translateY(-50%)' };
                      if (pos === 'bottom') style = { bottom: offset, left: `${ratio * 100}%`, transform: 'translateX(-50%)' };
                      if (pos === 'left') style = { top: `${ratio * 100}%`, left: offset, transform: 'translateY(-50%)' };

                      return (
                        <div
                          key={`${pos}-${ratio}`}
                          data-anchor-handle={pos}
                          data-anchor-ratio={ratio}
                          data-node-id={node.id}
                          className={cn(
                            'absolute flex items-center justify-center z-25 group/anchor',
                            isHovered ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
                          )}
                          style={{
                            ...style,
                            width: isCenter ? '14px' : '10px',
                            height: isCenter ? '14px' : '10px',
                          }}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseDown={(e) => handleAnchorMouseDown(e, node.id, pos, offsetVal)}
                          onMouseUp={(e) => handleAnchorMouseUp(e, node.id, pos, offsetVal)}
                          title={`Connect from ${pos}${isCenter ? ' (center)' : ` (${Math.round(ratio * 100)}%)`}`}
                        >
                          {/* Generous invisible hit zone */}
                          <div className="absolute -inset-2 rounded-full" />
                          <div
                            className={cn(
                              'rounded-full border-2 border-white shadow-md pointer-events-none transition-all duration-150',
                              isCenter ? 'w-3.5 h-3.5 bg-blue-500' : 'w-2.5 h-2.5 bg-blue-400',
                              isHovered
                                ? 'opacity-95 scale-100 ring-2 ring-blue-500/30 group-hover/anchor:scale-125 group-hover/anchor:bg-blue-600 group-hover/anchor:ring-blue-500/50'
                                : 'opacity-0 scale-75'
                            )}
                          />
                        </div>
                      );
                    });
                  })}
                </>
              )}

              {/* 8-POINT RESIZE HANDLES (4 Corners + 4 Sides) */}
              {!readOnly && isSelected && selectedNodeIds.length === 1 && (
                <>
                  {/* NW Corner */}
                  <div
                    data-testid="resize-handle-nw"
                    className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-nwse-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleResizeMouseDown(e, node, 'nw')}
                    title="Resize NW (Hold Shift for precise horizontal/vertical)"
                  />
                  {/* Top Side (N) */}
                  <div
                    data-testid="resize-handle-n"
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-ns-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleResizeMouseDown(e, node, 'n')}
                    title="Resize Top (Vertical)"
                  />
                  {/* NE Corner */}
                  <div
                    data-testid="resize-handle-ne"
                    className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-nesw-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleResizeMouseDown(e, node, 'ne')}
                    title="Resize NE (Hold Shift for precise horizontal/vertical)"
                  />
                  {/* Right Side (E) */}
                  <div
                    data-testid="resize-handle-e"
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-ew-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleResizeMouseDown(e, node, 'e')}
                    title="Resize Right (Horizontal)"
                  />
                  {/* SE Corner */}
                  <div
                    data-testid="resize-handle-se"
                    className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-nwse-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleResizeMouseDown(e, node, 'se')}
                    title="Resize SE (Hold Shift for precise horizontal/vertical)"
                  />
                  {/* Bottom Side (S) */}
                  <div
                    data-testid="resize-handle-s"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-ns-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleResizeMouseDown(e, node, 's')}
                    title="Resize Bottom (Vertical)"
                  />
                  {/* SW Corner */}
                  <div
                    data-testid="resize-handle-sw"
                    className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-nesw-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleResizeMouseDown(e, node, 'sw')}
                    title="Resize SW (Hold Shift for precise horizontal/vertical)"
                  />
                  {/* Left Side (W) */}
                  <div
                    data-testid="resize-handle-w"
                    className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-sm cursor-ew-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleResizeMouseDown(e, node, 'w')}
                    title="Resize Left (Horizontal)"
                  />

                  {/* ROTATE HANDLE — above the top edge, so it is the grip the
                      eye reaches for first and the one furthest from every
                      resize corner. Being a child of the frame, it swings round
                      with the shape and so always sits above the edge the user
                      is looking at. Shift holds the turn to 15° steps. */}
                  <div
                    className="absolute -top-8 left-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-blue-600 text-blue-600 shadow-md cursor-grab active:cursor-grabbing z-20 pointer-events-auto"
                    style={{
                      // Counter-scaled so it is the same size on screen at any
                      // zoom, and counter-turned so its glyph stays upright: the
                      // grip orbits with the shape, the arrow on it does not.
                      transform: `translateX(-50%) rotate(${-rotationOf(node)}deg) scale(${
                        1 / viewport.zoom
                      })`,
                    }}
                    onMouseDown={(e) => handleRotateMouseDown(e, node)}
                    title="Drag to rotate · Shift for 15° steps"
                  >
                    <RotateCw className="w-3 h-3" />
                  </div>

                  {/* DRAW.IO DIRECTIONAL QUICK-CLONE & CONNECT ARROWS (N, E, S, W) */}
                  {selectedNodeIds.length === 1 &&
                    !isLocked(node) &&
                    !isBoundaryNode(node) &&
                    !draggingNodeId &&
                    !resizingNodeId &&
                    !rotatingNodeId &&
                    connectingSourceId === null && (
                      <>
                        <button
                          type="button"
                          data-testid="quick-clone-right"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleQuickCloneInDirection(e, node, 'right')}
                          className="absolute top-1/2 -right-9 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-500/15 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/40 flex items-center justify-center transition-all hover:scale-115 shadow-xs z-25 pointer-events-auto cursor-pointer"
                          title="Click to clone & connect right (Draw.io Quick Connect)"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid="quick-clone-bottom"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleQuickCloneInDirection(e, node, 'bottom')}
                          className="absolute -bottom-9 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-blue-500/15 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/40 flex items-center justify-center transition-all hover:scale-115 shadow-xs z-25 pointer-events-auto cursor-pointer"
                          title="Click to clone & connect down (Draw.io Quick Connect)"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid="quick-clone-left"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleQuickCloneInDirection(e, node, 'left')}
                          className="absolute top-1/2 -left-9 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-500/15 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/40 flex items-center justify-center transition-all hover:scale-115 shadow-xs z-25 pointer-events-auto cursor-pointer"
                          title="Click to clone & connect left (Draw.io Quick Connect)"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid="quick-clone-top"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleQuickCloneInDirection(e, node, 'top')}
                          className="absolute -top-14 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-blue-500/15 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/40 flex items-center justify-center transition-all hover:scale-115 shadow-xs z-25 pointer-events-auto cursor-pointer"
                          title="Click to clone & connect up (Draw.io Quick Connect)"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                </>
              )}
            </div>
          );
        })}

        {/* Locks on what has no box of its own.
            A shape wears its padlock on the corner of its wrapper, but a
            connector and a mark of ink are drawn by the canvas SVG underneath
            and have no wrapper to hang one on. They are badged here instead —
            in the layer that already carries the canvas transform — at the
            point on each a user would aim at: the middle of a connector, the
            far corner of a mark. Each badge is counter-scaled so it is the same
            size on screen at every zoom, and takes no pointer events, so it
            neither hides the element's own grasps nor becomes one. */}
        {edges.map((edge) => {
          if (!isLocked(edge)) return null;
          const geo = edgeGeometries.get(edge.id) ?? computeEdgeGeometry(edge, nodeMap, edgeStyle);
          if (!geo) return null;
          return (
            <LockBadge
              key={`lock-${edge.id}`}
              id={edge.id}
              at={{ x: geo.midPoint.x, y: geo.midPoint.y }}
              zoom={viewport.zoom}
              z={nodes.length + 2}
              offset="-50%, -150%"
            />
          );
        })}
        {strokes.map((stroke) => {
          if (!isLocked(stroke)) return null;
          const box = getStrokesBounds([stroke]);
          if (!box) return null;
          return (
            <LockBadge
              key={`lock-${stroke.id}`}
              id={stroke.id}
              at={{ x: box.x + box.width, y: box.y }}
              zoom={viewport.zoom}
              z={nodes.length + 2}
              offset="-50%, -50%"
            />
          );
        })}

        {/* Group Frames — the only thing a group ever draws.
            A group has no element of its own, so this is where it becomes
            visible: a dashed box around everything its members cover, drawn
            while one of those members is selected and gone as soon as the
            selection moves on. It takes no pointer events — the members inside
            it are what gets pressed, dragged and styled — and it sits above the
            ordinary elements so a boundary it encloses cannot hide it. */}
        {selectionFrames.map((frame) => {
          const members = nodes.filter((n) => groupIdsOf(n).includes(frame.id));
          const memberIds = members.map((m) => m.id);
          const isEntered = enteredGroupId === frame.id;
          const showResizeHandles = !readOnly && !isEntered && selectedNodeIds.length > 1;

          return (
            <div
              key={frame.id}
              data-group-frame={frame.id}
              className={cn(
                'absolute rounded-xl border transition-all pointer-events-none',
                isEntered
                  ? 'border-dashed border-blue-400/60 bg-blue-500/[0.02]'
                  : 'border-dashed border-primary/80 bg-primary/[0.03]'
              )}
              style={{
                left: `${frame.box.x}px`,
                top: `${frame.box.y}px`,
                width: `${frame.box.width}px`,
                height: `${frame.box.height}px`,
                zIndex: nodes.length + 1,
              }}
            >
              {/* Draw.io Group Header Pill */}
              <div
                className="absolute -top-7 left-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-card/95 border border-border shadow-xs text-foreground/80 pointer-events-auto select-none"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isEntered ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEnteredGroupId(null);
                      setSelectedNodeIds(memberIds);
                    }}
                    className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                    title="Click or press Esc to select whole group"
                  >
                    <span>Inside Group</span>
                    <span className="text-muted-foreground">· Click or Esc to select group</span>
                  </button>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      Group ({members.length}) · Double-click item to select
                    </span>
                    <button
                      type="button"
                      onClick={handleUngroupSelection}
                      className="ml-1 text-[10px] text-destructive hover:underline cursor-pointer"
                      title="Ungroup (Ctrl+Shift+G)"
                    >
                      Ungroup
                    </button>
                  </>
                )}
              </div>

              {/* 8 Collective Group Resize Handles */}
              {showResizeHandles && (
                <>
                  <div
                    data-testid="group-resize-handle-nw"
                    className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-nwse-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleGroupResizeMouseDown(e, 'nw', memberIds)}
                    title="Resize Group NW"
                  />
                  <div
                    data-testid="group-resize-handle-n"
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-ns-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleGroupResizeMouseDown(e, 'n', memberIds)}
                    title="Resize Group Top"
                  />
                  <div
                    data-testid="group-resize-handle-ne"
                    className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-nesw-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleGroupResizeMouseDown(e, 'ne', memberIds)}
                    title="Resize Group NE"
                  />
                  <div
                    data-testid="group-resize-handle-e"
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-ew-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleGroupResizeMouseDown(e, 'e', memberIds)}
                    title="Resize Group Right"
                  />
                  <div
                    data-testid="group-resize-handle-se"
                    className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-nwse-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleGroupResizeMouseDown(e, 'se', memberIds)}
                    title="Resize Group SE"
                  />
                  <div
                    data-testid="group-resize-handle-s"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-ns-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleGroupResizeMouseDown(e, 's', memberIds)}
                    title="Resize Group Bottom"
                  />
                  <div
                    data-testid="group-resize-handle-sw"
                    className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-nesw-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleGroupResizeMouseDown(e, 'sw', memberIds)}
                    title="Resize Group SW"
                  />
                  <div
                    data-testid="group-resize-handle-w"
                    className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-ew-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
                    onMouseDown={(e) => handleGroupResizeMouseDown(e, 'w', memberIds)}
                    title="Resize Group Left"
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Collective Multi-Selection Frame for multiple ungrouped nodes */}
        {multiSelectionBox && !readOnly && (
          <div
            data-testid="multi-selection-frame"
            className="absolute rounded-xl border border-dashed border-primary/60 pointer-events-none"
            style={{
              left: `${multiSelectionBox.x}px`,
              top: `${multiSelectionBox.y}px`,
              width: `${multiSelectionBox.width}px`,
              height: `${multiSelectionBox.height}px`,
              zIndex: nodes.length + 1,
            }}
          >
            {/* 8 Collective Multi-Selection Resize Handles */}
            <div
              data-testid="multi-resize-handle-nw"
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-nwse-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
              onMouseDown={(e) => handleGroupResizeMouseDown(e, 'nw', selectedNodeIds)}
              title="Resize Selection NW"
            />
            <div
              data-testid="multi-resize-handle-n"
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-ns-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
              onMouseDown={(e) => handleGroupResizeMouseDown(e, 'n', selectedNodeIds)}
              title="Resize Selection Top"
            />
            <div
              data-testid="multi-resize-handle-ne"
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-nesw-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
              onMouseDown={(e) => handleGroupResizeMouseDown(e, 'ne', selectedNodeIds)}
              title="Resize Selection NE"
            />
            <div
              data-testid="multi-resize-handle-e"
              className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-ew-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
              onMouseDown={(e) => handleGroupResizeMouseDown(e, 'e', selectedNodeIds)}
              title="Resize Selection Right"
            />
            <div
              data-testid="multi-resize-handle-se"
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-nwse-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
              onMouseDown={(e) => handleGroupResizeMouseDown(e, 'se', selectedNodeIds)}
              title="Resize Selection SE"
            />
            <div
              data-testid="multi-resize-handle-s"
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-ns-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
              onMouseDown={(e) => handleGroupResizeMouseDown(e, 's', selectedNodeIds)}
              title="Resize Selection Bottom"
            />
            <div
              data-testid="multi-resize-handle-sw"
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-nesw-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
              onMouseDown={(e) => handleGroupResizeMouseDown(e, 'sw', selectedNodeIds)}
              title="Resize Selection SW"
            />
            <div
              data-testid="multi-resize-handle-w"
              className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-sm cursor-ew-resize hover:scale-125 z-30 pointer-events-auto shadow-xs"
              onMouseDown={(e) => handleGroupResizeMouseDown(e, 'w', selectedNodeIds)}
              title="Resize Selection Left"
            />
          </div>
        )}
      </div>

      {/* Ink Selection Frame — the box around the picked ink and the corner
          grips that scale it. Drawn above the node layer, in the same overlay
          the connector handles use, and at a constant on-screen size so a grip
          is the same target at every zoom. Only the grips take the pointer: the
          frame is a description of the selection, not something to grab. */}
      {!readOnly &&
        activeTool === 'select' &&
        selectedInkBox &&
        (() => {
          const frameStroke = getEdgeColor('selected', isDark);
          const frameFill = isDark ? '#1A1A1E' : '#FFFFFF';
          const grip = 9 / viewport.zoom;
          const handles = [
            ['nw', selectedInkBox.x, selectedInkBox.y, 'nwse-resize'],
            ['n', selectedInkBox.x + selectedInkBox.width / 2, selectedInkBox.y, 'ns-resize'],
            ['ne', selectedInkBox.x + selectedInkBox.width, selectedInkBox.y, 'nesw-resize'],
            ['e', selectedInkBox.x + selectedInkBox.width, selectedInkBox.y + selectedInkBox.height / 2, 'ew-resize'],
            ['se', selectedInkBox.x + selectedInkBox.width, selectedInkBox.y + selectedInkBox.height, 'nwse-resize'],
            ['s', selectedInkBox.x + selectedInkBox.width / 2, selectedInkBox.y + selectedInkBox.height, 'ns-resize'],
            ['sw', selectedInkBox.x, selectedInkBox.y + selectedInkBox.height, 'nesw-resize'],
            ['w', selectedInkBox.x, selectedInkBox.y + selectedInkBox.height / 2, 'ew-resize'],
          ] as const;

          return (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              style={{
                transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`,
                transformOrigin: '0 0',
              }}
            >
              <rect
                x={selectedInkBox.x}
                y={selectedInkBox.y}
                width={selectedInkBox.width}
                height={selectedInkBox.height}
                fill="none"
                stroke={frameStroke}
                strokeWidth={1.5 / viewport.zoom}
                strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`}
              />
              {handles.map(([handle, cx, cy, cursor]) => (
                <rect
                  key={handle}
                  x={cx - grip / 2}
                  y={cy - grip / 2}
                  width={grip}
                  height={grip}
                  rx={1.5 / viewport.zoom}
                  fill={frameFill}
                  stroke={frameStroke}
                  strokeWidth={2 / viewport.zoom}
                  className="pointer-events-auto hover:opacity-80"
                  style={{ cursor }}
                  onMouseDown={(e) => handleStrokeResizeMouseDown(e, handle)}
                >
                  <title>Drag to resize ink — hold Shift for precise horizontal/vertical</title>
                </rect>
              ))}
            </svg>
          );
        })()}

      {/* Edge Endpoint Handles — rendered above the node layer so they stay grabbable
          even when an endpoint sits exactly on a node border */}
      {!readOnly &&
        activeTool === 'select' &&
        (() => {
          const selected = selectedEdgeId ? edges.find((ed) => ed.id === selectedEdgeId) : null;
          if (!selected) return null;

          const isDraggingThisLine = activeLineDrag?.edgeId === selected.id;
          const effectiveSelected = isDraggingThisLine
            ? { ...selected, stepOffset: activeLineDrag.offset }
            : selected;
          const geo = isDraggingThisLine
            ? computeEdgeGeometry(effectiveSelected, nodeMap, edgeStyle, multiPortOffsets.get(selected.id))
            : (edgeGeometries.get(selected.id) ?? computeEdgeGeometry(selected, nodeMap, edgeStyle));
          if (!geo) return null;

          const draft = edgeDraft?.edgeId === selected.id ? edgeDraft : null;
          const p1 = draft ? draft.p1 : geo.p1;
          const p2 = draft ? draft.p2 : geo.p2;
          const handleStroke = getEdgeColor('selected', isDark);
          const handleFill = isDark ? '#1A1A1E' : '#FFFFFF';
          // Keep the handles a constant on-screen size regardless of zoom
          const handleRadius = 6 / viewport.zoom;
          const handleStrokeWidth = 2 / viewport.zoom;

          return (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              style={{
                transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Draw.io Style Endpoint Handles */}
              <g
                className="group/endpoint-source cursor-move pointer-events-auto"
                onMouseDown={(e) => handleEdgeEndpointMouseDown(e, selected, 'source')}
              >
                {/* Generous invisible hit-target to prevent hover dropouts */}
                <circle
                  cx={p1.x}
                  cy={p1.y}
                  r={Math.max(handleRadius + 6 / viewport.zoom, 14 / viewport.zoom)}
                  fill="transparent"
                  className="cursor-move"
                />
                <circle
                  data-testid="edge-handle-source"
                  cx={p1.x}
                  cy={p1.y}
                  r={handleRadius}
                  fill={handleFill}
                  stroke={handleStroke}
                  strokeWidth={handleStrokeWidth}
                  className="transition-colors duration-150 group-hover/endpoint-source:stroke-blue-400 group-hover/endpoint-source:brightness-110 shadow-sm"
                  onMouseDown={(e) => handleEdgeEndpointMouseDown(e, selected, 'source')}
                >
                  <title>Draw.io Connection Point · Drag to reconnect to a shape or detach</title>
                </circle>
                {/* Draw.io connection anchor core indicator */}
                {selected.source && (
                  <circle
                    cx={p1.x}
                    cy={p1.y}
                    r={2.5 / viewport.zoom}
                    fill="#10B981"
                    className="pointer-events-none"
                  />
                )}
              </g>

              <g
                className="group/endpoint-target cursor-move pointer-events-auto"
                onMouseDown={(e) => handleEdgeEndpointMouseDown(e, selected, 'target')}
              >
                {/* Generous invisible hit-target to prevent hover dropouts */}
                <circle
                  cx={p2.x}
                  cy={p2.y}
                  r={Math.max(handleRadius + 6 / viewport.zoom, 14 / viewport.zoom)}
                  fill="transparent"
                  className="cursor-move"
                />
                <circle
                  data-testid="edge-handle-target"
                  cx={p2.x}
                  cy={p2.y}
                  r={handleRadius}
                  fill={handleFill}
                  stroke={handleStroke}
                  strokeWidth={handleStrokeWidth}
                  className="transition-colors duration-150 group-hover/endpoint-target:stroke-blue-400 group-hover/endpoint-target:brightness-110 shadow-sm"
                  onMouseDown={(e) => handleEdgeEndpointMouseDown(e, selected, 'target')}
                >
                  <title>Draw.io Connection Point · Drag to reconnect to a shape or detach</title>
                </circle>
                {/* Draw.io connection anchor core indicator */}
                {selected.target && (
                  <circle
                    cx={p2.x}
                    cy={p2.y}
                    r={2.5 / viewport.zoom}
                    fill="#10B981"
                    className="pointer-events-none"
                  />
                )}
              </g>

              {/* Draw.io Virtual Segment Midpoint Handles (drag any segment midpoint to insert a new bend/waypoint) */}
              {geo.segmentMidpoints.map((segMid) => {
                // Avoid overlapping the primary center position handle or existing waypoints
                const nearPrimaryMid =
                  Math.hypot(segMid.x - geo.midPoint.x, segMid.y - geo.midPoint.y) < 10;
                const nearExistingWaypoint = (selected.waypoints ?? []).some(
                  (w) => Math.hypot(segMid.x - w.x, segMid.y - w.y) < 10
                );
                if (nearPrimaryMid || nearExistingWaypoint) return null;

                return (
                  <g
                    key={`vmid-${segMid.index}`}
                    className="group/vmid cursor-crosshair pointer-events-auto"
                    onMouseDown={(e) =>
                      handleVirtualMidpointMouseDown(e, selected, segMid.index, segMid, geo)
                    }
                  >
                    <circle
                      cx={segMid.x}
                      cy={segMid.y}
                      r={12 / viewport.zoom}
                      fill="transparent"
                    />
                    <circle
                      data-testid={`edge-virtual-midpoint-${segMid.index}`}
                      cx={segMid.x}
                      cy={segMid.y}
                      r={4 / viewport.zoom}
                      fill={isDark ? '#38BDF8' : '#0284C7'}
                      stroke="#FFFFFF"
                      strokeWidth={1.5 / viewport.zoom}
                      opacity={0.6}
                      className="transition-all duration-150 group-hover/vmid:opacity-100 group-hover/vmid:scale-125"
                    >
                      <title>Draw.io Segment Handle · Drag to insert a new bend / waypoint</title>
                    </circle>
                  </g>
                );
              })}

              {/* Draw.io Custom Waypoint Handles (drag to move with orthogonal snapping · double-click to remove) */}
              {(selected.waypoints ?? []).map((wp, wpIdx) => (
                <g
                  key={`wp-${wpIdx}`}
                  className="group/custom-wp cursor-move pointer-events-auto"
                  onMouseDown={(e) => handleWaypointMouseDown(e, selected, wpIdx, geo)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    const remaining = (selected.waypoints ?? []).filter((_, idx) => idx !== wpIdx);
                    const updatedEdges = edges.map((ed) =>
                      ed.id === selected.id
                        ? { ...ed, waypoints: remaining.length > 0 ? remaining : undefined }
                        : ed
                    );
                    setEdges(updatedEdges);
                    commitState(nodes, updatedEdges, strokes);
                  }}
                >
                  <circle
                    cx={wp.x}
                    cy={wp.y}
                    r={14 / viewport.zoom}
                    fill="transparent"
                  />
                  <circle
                    data-testid={`edge-waypoint-${wpIdx}`}
                    cx={wp.x}
                    cy={wp.y}
                    r={5.5 / viewport.zoom}
                    fill="#FFFFFF"
                    stroke={isDark ? '#F59E0B' : '#D97706'}
                    strokeWidth={2 / viewport.zoom}
                    className="transition-colors duration-150 group-hover/custom-wp:stroke-amber-400 shadow-md"
                  >
                    <title>Draw.io Waypoint #{wpIdx + 1} · Drag to move (snaps orthogonally) · Double-click to delete</title>
                  </circle>
                  <circle
                    cx={wp.x}
                    cy={wp.y}
                    r={2.5 / viewport.zoom}
                    fill={isDark ? '#F59E0B' : '#D97706'}
                    className="pointer-events-none"
                  />
                </g>
              ))}

              {/* Draw.io Style Waypoint / Line Position Handle */}
              <g
                className={cn(
                  'group/waypoint pointer-events-auto',
                  selected.style === 'step'
                    ? (geo.sourcePos === 'left' || geo.sourcePos === 'right' ? 'cursor-ew-resize' : 'cursor-ns-resize')
                    : 'cursor-move'
                )}
                onMouseDown={(e) =>
                  selected.style === 'straight' || (selected.waypoints && selected.waypoints.length > 0)
                    ? handleVirtualMidpointMouseDown(
                        e,
                        selected,
                        Math.floor((selected.waypoints?.length ?? 0) / 2),
                        geo.midPoint,
                        geo
                      )
                    : handleLinePositionMouseDown(e, selected, geo)
                }
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  const resetEdges = edges.map((ed) =>
                    ed.id === selected.id ? { ...ed, stepOffset: 0, waypoints: undefined } : ed
                  );
                  setEdges(resetEdges);
                  commitState(nodes, resetEdges, strokes);
                }}
              >
                {/* Generous invisible hit-target to prevent hover dropouts */}
                <circle
                  cx={geo.midPoint.x}
                  cy={geo.midPoint.y}
                  r={14 / viewport.zoom}
                  fill="transparent"
                />
                <circle
                  data-testid="edge-handle-position"
                  cx={geo.midPoint.x}
                  cy={geo.midPoint.y}
                  r={5.5 / viewport.zoom}
                  fill="#FFFFFF"
                  stroke={isDark ? '#38BDF8' : '#0284C7'}
                  strokeWidth={2 / viewport.zoom}
                  className="transition-colors duration-150 group-hover/waypoint:stroke-sky-400 group-hover/waypoint:stroke-[2.5px] shadow-md"
                  onMouseDown={(e) =>
                    selected.style === 'straight' || (selected.waypoints && selected.waypoints.length > 0)
                      ? handleVirtualMidpointMouseDown(
                          e,
                          selected,
                          Math.floor((selected.waypoints?.length ?? 0) / 2),
                          geo.midPoint,
                          geo
                        )
                      : handleLinePositionMouseDown(e, selected, geo)
                  }
                >
                  <title>Draw.io Waypoint · Drag to adjust line position or add bend · Double-click to reset to center</title>
                </circle>
                <circle
                  cx={geo.midPoint.x}
                  cy={geo.midPoint.y}
                  r={2.5 / viewport.zoom}
                  fill={isDark ? '#38BDF8' : '#0284C7'}
                  className="pointer-events-none transition-colors duration-150 group-hover/waypoint:fill-sky-400"
                />
              </g>

              {/* Draw.io Active Drag Alignment Guideline and HUD */}
              {activeLineDrag?.edgeId === selected.id && (
                <g className="pointer-events-none select-none">
                  {/* Guideline */}
                  {(selected.style === 'step' || edgeStyle === 'step') && (
                    geo.sourcePos === 'left' || geo.sourcePos === 'right' ? (
                      <line
                        x1={geo.midPoint.x}
                        y1={Math.min(p1.y, p2.y) - 60}
                        x2={geo.midPoint.x}
                        y2={Math.max(p1.y, p2.y) + 60}
                        stroke={isDark ? '#38BDF8' : '#0284C7'}
                        strokeWidth={1.5 / viewport.zoom}
                        strokeDasharray={`${4 / viewport.zoom} ${3 / viewport.zoom}`}
                        opacity={0.8}
                      />
                    ) : (
                      <line
                        x1={Math.min(p1.x, p2.x) - 60}
                        y1={geo.midPoint.y}
                        x2={Math.max(p1.x, p2.x) + 60}
                        y2={geo.midPoint.y}
                        stroke={isDark ? '#38BDF8' : '#0284C7'}
                        strokeWidth={1.5 / viewport.zoom}
                        strokeDasharray={`${4 / viewport.zoom} ${3 / viewport.zoom}`}
                        opacity={0.8}
                      />
                    )
                  )}

                  {/* Draw.io Floating HUD Badge */}
                  <g transform={`translate(${geo.midPoint.x + 14 / viewport.zoom}, ${geo.midPoint.y - 18 / viewport.zoom})`}>
                    <rect
                      x={0}
                      y={-12 / viewport.zoom}
                      width={86 / viewport.zoom}
                      height={22 / viewport.zoom}
                      rx={5 / viewport.zoom}
                      fill={isDark ? '#0F172A' : '#1E293B'}
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={1 / viewport.zoom}
                      opacity={0.95}
                    />
                    <text
                      x={43 / viewport.zoom}
                      y={0}
                      fill="#FFFFFF"
                      fontSize={10 / viewport.zoom}
                      fontWeight="600"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-mono"
                    >
                      {activeLineDrag.isCenter ? 'Center (0)' : `${activeLineDrag.offset > 0 ? '+' : ''}${activeLineDrag.offset}px`}
                    </text>
                  </g>
                </g>
              )}

              {/* Draw.io Magnetic Snapping & Connection Points on Hovered Shape */}
              {draft?.attachNodeId && (() => {
                const attachNode = nodes.find((n) => n.id === draft.attachNodeId);
                if (!attachNode) return null;
                const w = attachNode.width;
                const h = attachNode.height;
                const nx = attachNode.x;
                const ny = attachNode.y;
                const movingPt = edgeDragRef.current?.mode === 'source' ? draft.p1 : draft.p2;

                const anchorPoints = [
                  // Cardinal Midpoints
                  { x: nx + w / 2, y: ny, side: 'top' },
                  { x: nx + w, y: ny + h / 2, side: 'right' },
                  { x: nx + w / 2, y: ny + h, side: 'bottom' },
                  { x: nx, y: ny + h / 2, side: 'left' },
                  // Quartiles
                  { x: nx + w * 0.25, y: ny, side: 'top' },
                  { x: nx + w * 0.75, y: ny, side: 'top' },
                  { x: nx + w * 0.25, y: ny + h, side: 'bottom' },
                  { x: nx + w * 0.75, y: ny + h, side: 'bottom' },
                  { x: nx, y: ny + h * 0.25, side: 'left' },
                  { x: nx, y: ny + h * 0.75, side: 'left' },
                  { x: nx + w, y: ny + h * 0.25, side: 'right' },
                  { x: nx + w, y: ny + h * 0.75, side: 'right' },
                ];

                return (
                  <g data-testid="drawio-magnetic-anchors" className="pointer-events-none select-none">
                    {/* Shape bounding magnetic outline */}
                    <rect
                      data-testid="drawio-shape-outline"
                      x={nx - 3}
                      y={ny - 3}
                      width={w + 6}
                      height={h + 6}
                      rx={8}
                      fill={isDark ? '#38BDF80d' : '#0284C70a'}
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={1.5 / viewport.zoom}
                      strokeDasharray={`${5 / viewport.zoom} ${4 / viewport.zoom}`}
                    />

                    {/* Shape Magnetic Anchor Dots */}
                    {anchorPoints.map((apt, idx) => (
                      <circle
                        key={idx}
                        cx={apt.x}
                        cy={apt.y}
                        r={3.5 / viewport.zoom}
                        fill="#FFFFFF"
                        stroke={isDark ? '#38BDF8' : '#0284C7'}
                        strokeWidth={1.5 / viewport.zoom}
                        opacity={0.85}
                      />
                    ))}

                    {/* Draw.io Active Anchor Target Reticle */}
                    <circle
                      data-testid="drawio-anchor-reticle"
                      cx={movingPt.x}
                      cy={movingPt.y}
                      r={8.5 / viewport.zoom}
                      fill={isDark ? '#38BDF833' : '#0284C733'}
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={2 / viewport.zoom}
                      className="animate-pulse"
                    />
                    <circle
                      cx={movingPt.x}
                      cy={movingPt.y}
                      r={3 / viewport.zoom}
                      fill={isDark ? '#38BDF8' : '#0284C7'}
                    />
                    <line
                      x1={movingPt.x - 6 / viewport.zoom}
                      y1={movingPt.y}
                      x2={movingPt.x + 6 / viewport.zoom}
                      y2={movingPt.y}
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={1.5 / viewport.zoom}
                    />
                    <line
                      x1={movingPt.x}
                      y1={movingPt.y - 6 / viewport.zoom}
                      x2={movingPt.x}
                      y2={movingPt.y + 6 / viewport.zoom}
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={1.5 / viewport.zoom}
                    />

                    {/* Tooltip near active reticle */}
                    <g transform={`translate(${movingPt.x + 12 / viewport.zoom}, ${movingPt.y + 12 / viewport.zoom})`}>
                      <rect
                        x={0}
                        y={0}
                        width={130 / viewport.zoom}
                        height={22 / viewport.zoom}
                        rx={4 / viewport.zoom}
                        fill={isDark ? '#0F172A' : '#1E293B'}
                        opacity={0.9}
                      />
                      <text
                        x={65 / viewport.zoom}
                        y={13 / viewport.zoom}
                        fill="#FFFFFF"
                        fontSize={9.5 / viewport.zoom}
                        fontWeight="500"
                        textAnchor="middle"
                        className="font-mono"
                      >
                        {`Attach: ${draft.attachHandle ?? 'point'} (${draft.attachOffset && draft.attachOffset !== 0 ? `${draft.attachOffset > 0 ? '+' : ''}${draft.attachOffset}px` : 'Center'})`}
                      </text>
                    </g>
                  </g>
                );
              })()}
            </svg>
          );
        })()}

      {/* Appearance panel for the selected element, or the
          freehand pen's own options while that tool is in hand. */}
      {styleTarget && !isPresentationMode && (
        <ZCanvasStylePanel
          target={styleTarget}
          onPreviewNode={(patch) => {
            if (styleTarget.kind === 'node') previewNodeStyle(styleTarget.node.id, patch);
          }}
          onCommitNode={(patch) => {
            if (styleTarget.kind === 'node') commitNodeStyle(styleTarget.node.id, patch);
          }}
          onPreviewEdge={(patch) => {
            if (styleTarget.kind === 'edge') previewEdgeStyle(styleTarget.edge.id, patch);
          }}
          onCommitEdge={(patch) => {
            if (styleTarget.kind === 'edge') commitEdgeStyle(styleTarget.edge.id, patch);
          }}
          onCommitRouting={commitEdgeRouting}
          onChangePen={updatePenStyle}
          onPreviewStroke={(patch) => {
            if (styleTarget.kind === 'stroke') previewStrokeStyle(styleTarget.stroke.id, patch);
          }}
          onCommitStroke={(patch) => {
            if (styleTarget.kind === 'stroke') commitStrokeStyle(styleTarget.stroke.id, patch);
          }}
          onReset={() => {
            if (styleTarget.kind === 'node') resetNodeStyle(styleTarget.node.id);
            else if (styleTarget.kind === 'edge') resetEdgeStyle(styleTarget.edge.id);
            else if (styleTarget.kind === 'stroke') resetStrokeStyle(styleTarget.stroke.id);
            else {
              // The pen's reset is its factory nib, not the document's theme.
              updatePenStyle(DEFAULT_PEN_STYLE);
            }
          }}
          onDeselect={() => {
            if (styleTarget.kind === 'pen') {
              // Nothing is selected to drop, so the close button puts the pen
              // away and hands the canvas back to the select tool.
              selectTool('select');
            } else {
              setEnteredGroupId(null);
              setSelectedNodeIds([]);
              setSelectedEdgeIds([]);
              setSelectedStrokeIds([]);
            }
          }}
          onAlign={handleAlignNodes}
          onDistribute={handleDistributeNodes}
          onMatchSize={handleMatchNodeSize}
          canGroup={canGroup(nodes, movable(selectedNodeIds))}
          canUngroup={isGrouped(nodes, movable(selectedNodeIds))}
          enteredGroupId={enteredGroupId}
          onGroup={handleGroupSelection}
          onUngroup={handleUngroupSelection}
          onExitGroup={() => {
            if (enteredGroupId) {
              const members = nodes.filter((n) => groupIdsOf(n).includes(enteredGroupId)).map((n) => n.id);
              setEnteredGroupId(null);
              setSelectedNodeIds(members);
            }
          }}
          selectedCount={selectedNodeIds.length}
        />
      )}

      {/* Context Menu */}
      <ZCanvasContextMenu
        position={contextMenuPos}
        onClose={() => setContextMenuPos(null)}
        selectedNodes={nodes.filter((n) => selectedNodeIds.includes(n.id))}
        selectedEdge={edges.find((e) => e.id === selectedEdgeId) || null}
        selectedStrokes={selectedStrokes}
        canPaste={getInternalClipboard() !== null}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteSelection}
        onReorder={handleReorder}
        onToggleLock={handleToggleLock}
        onAlign={handleAlignNodes}
        onSelectAll={handleSelectAll}
        onZoomIn={() => zoomByCenter(ZOOM_STEP)}
        onZoomOut={() => zoomByCenter(-ZOOM_STEP)}
        onZoomToFit={handleZoomToFit}
        onResetZoom={() => setViewport({ zoom: 1, panX: 40, panY: 40 })}
        onBeautifyLayout={handleBeautify}
        // The menu only offers what it can do: a group takes two elements, and
        // there is nothing to ungroup unless something is grouped.
        onGroup={canGroup(nodes, selectedNodeIds) ? handleGroupSelection : undefined}
        onUngroup={isGrouped(nodes, selectedNodeIds) ? handleUngroupSelection : undefined}
        onFrameSelection={selectedNodeIds.length > 0 ? handleFrameSelection : undefined}
        onFitFrameToContent={handleFitFrameToContent}
        onExportFrame={handleExportFrame}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleEdgeStyle={() => {
          if (selectedEdgeIds.length === 0) return;
          const primary = edges.find((e) => e.id === selectedEdgeId);
          if (!primary) return;
          const nextStyle: ZCanvasEdgeRouting =
            primary.style === 'step'
              ? 'bezier'
              : primary.style === 'bezier'
                ? 'straight'
                : 'step';
          const toggled = new Set(movable(selectedEdgeIds));
          if (toggled.size === 0) return;
          commitState(
            nodes,
            edges.map((e) => (toggled.has(e.id) ? { ...e, style: nextStyle } : e)),
            strokes
          );
          setEdgeStyle(nextStyle);
          onEdgeRoutingChange?.(nextStyle);
        }}
        onReverseEdgeDirection={() => {
          if (!selectedEdgeId) return;
          const edge = edges.find((e) => e.id === selectedEdgeId);
          if (!edge || edge.locked) return;
          commitState(
            nodes,
            edges.map((e) =>
              e.id === selectedEdgeId
                ? {
                    ...e,
                    source: e.target,
                    target: e.source,
                    sourceHandle: e.targetHandle,
                    targetHandle: e.sourceHandle,
                    sourceOffset: e.targetOffset,
                    targetOffset: e.sourceOffset,
                    sourcePoint: e.targetPoint,
                    targetPoint: e.sourcePoint,
                    startArrowhead: e.endArrowhead ?? 'arrow',
                    endArrowhead: e.startArrowhead ?? 'none',
                    waypoints: e.waypoints ? [...e.waypoints].reverse() : undefined,
                  }
                : e
            ),
            strokes
          );
        }}
        onResetEdgeLabel={() => {
          if (!selectedEdgeId) return;
          const edge = edges.find((e) => e.id === selectedEdgeId);
          if (!edge || edge.locked || !edge.labelOffset) return;
          commitState(
            nodes,
            edges.map((e) => (e.id === selectedEdgeId ? { ...e, labelOffset: { x: 0, y: 0 } } : e)),
            strokes
          );
        }}
        onResetLinePosition={() => {
          if (!selectedEdgeId) return;
          const edge = edges.find((e) => e.id === selectedEdgeId);
          if (!edge || edge.locked) return;
          commitState(
            nodes,
            edges.map((e) =>
              e.id === selectedEdgeId ? { ...e, stepOffset: 0, waypoints: undefined } : e
            ),
            strokes
          );
        }}
        onResetEdgeAnchors={() => {
          if (!selectedEdgeId) return;
          const edge = edges.find((e) => e.id === selectedEdgeId);
          if (!edge || edge.locked) return;
          commitState(
            nodes,
            edges.map((e) => (e.id === selectedEdgeId ? { ...e, sourceOffset: undefined, targetOffset: undefined } : e)),
            strokes
          );
        }}
        onDetachEdge={() => {
          if (!selectedEdgeId) return;
          const edge = edges.find((e) => e.id === selectedEdgeId);
          if (!edge || edge.locked) return;
          const geo = edgeGeometries.get(edge.id) ?? computeEdgeGeometry(edge, nodeMap, edgeStyle);
          if (!geo) return;
          commitState(
            nodes,
            edges.map((e) =>
              e.id === selectedEdgeId
                ? {
                    ...e,
                    source: '',
                    target: '',
                    sourceHandle: undefined,
                    targetHandle: undefined,
                    sourceOffset: undefined,
                    targetOffset: undefined,
                    sourcePoint: geo.p1,
                    targetPoint: geo.p2,
                  }
                : e
            ),
            strokes
          );
        }}
        onStartEdit={() => {
          if (selectedNodeIds.length === 1) {
            const n = nodes.find((node) => node.id === selectedNodeIds[0]);
            if (n && (hasEditableLabel(n) || isGeometricShape(n.type))) {
              startEditing(n.id, 'title', n.title || '');
            }
          } else if (selectedEdgeId) {
            const ed = edges.find((e) => e.id === selectedEdgeId);
            if (ed) startConnectionEdit(ed);
          }
        }}
        onAddField={handleAddField}
        onToggleBadge={(nodeId) => {
          const target = nodes.find((n) => n.id === nodeId);
          if (!target || isLockedNode(nodeId)) return;
          if (target.badge) {
            commitNodeStyle(nodeId, { badge: undefined });
          } else {
            startEditing(nodeId, 'badge', '');
          }
        }}
        onRotate={handleRotateSelection}
      />

      {/* Keyboard Shortcuts Dialog */}
      <ZCanvasShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />

      {/* Canvas Settings Dialog */}
      <ZCanvasSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetViewport={() => {
          setViewport({ zoom: 1, panX: 40, panY: 40 });
        }}
        onZoomToFit={handleZoomToFit}
        onClearCanvas={handleClearCanvas}
        onAlignNodes={handleAlignNodes}
        onDistributeNodes={handleDistributeNodes}
        hasSelection={selectedNodeIds.length >= 2}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
      />

      {/* Quick Connect Shape Picker (Draw.io / Eraser wire drop on blank space) */}
      {quickConnectState && (
        <QuickConnectPicker
          position={quickConnectState.pt}
          zoom={viewport.zoom}
          onSelect={handleQuickConnectSelect}
          onClose={() => setQuickConnectState(null)}
        />
      )}

      {/* Multi-Page Workbook Sheet Tabs (Draw.io style) */}
      {!isPresentationMode && (
        <ZCanvasSheetTabs
          pages={pages}
          activePageId={activePageId}
          onSelectPage={handleSelectPage}
          onAddPage={handleAddPage}
          onRenamePage={handleRenamePage}
          onDuplicatePage={handleDuplicatePage}
          onDeletePage={handleDeletePage}
          readOnly={readOnly}
        />
      )}

      {/* Interactive Presentation Mode Dock */}
      {isPresentationMode && (
        <ZCanvasPresentationDock
          pages={pages}
          activePageId={activePageId}
          onSelectPage={handleSelectPage}
          isLaserActive={activeTool === 'laser'}
          onToggleLaser={() => setActiveTool((prev) => (prev === 'laser' ? 'select' : 'laser'))}
          onExitPresentation={() => {
            setIsPresentationMode(false);
            if (activeTool === 'laser') setActiveTool('select');
          }}
        />
      )}

      {/* Interactive Fading Neon Laser Pointer Trail */}
      {laserTrail.length > 0 && (
        <svg
          data-testid="zcanvas-laser-overlay"
          className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-visible"
        >
          <defs>
            <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {laserTrail.map((pt, i) => {
            if (i === 0) return null;
            const prev = laserTrail[i - 1];
            const age = Date.now() - pt.time;
            const opacity = Math.max(0, 1 - age / 1000);
            return (
              <line
                key={i}
                x1={prev.x}
                y1={prev.y}
                x2={pt.x}
                y2={pt.y}
                stroke="#ff2a6d"
                strokeWidth={Math.max(2, 5 * opacity)}
                strokeLinecap="round"
                strokeOpacity={opacity}
                filter="url(#laser-glow)"
              />
            );
          })}
          {laserTrail.length > 0 && (() => {
            const head = laserTrail[laserTrail.length - 1];
            return (
              <g filter="url(#laser-glow)">
                <circle cx={head.x} cy={head.y} r={7} fill="#ff124f" opacity={0.6} />
                <circle cx={head.x} cy={head.y} r={4.5} fill="#ff2a6d" />
                <circle cx={head.x} cy={head.y} r={2} fill="#ffffff" />
              </g>
            );
          })()}
        </svg>
      )}
    </div>
  );
}
