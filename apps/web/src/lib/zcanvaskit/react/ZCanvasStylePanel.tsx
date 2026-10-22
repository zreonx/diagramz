'use client';

import React from 'react';
import {
  Eraser,
  RotateCcw,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ZCanvasDrawingStroke, ZCanvasEdge, ZCanvasEdgeRouting, ZCanvasNode, ZCanvasNodeType } from '../core/schema';
import {
  NODE_DEFAULT_APPEARANCE,
  PEN_MIN_OPACITY,
  ZCanvasFillKind,
  ZCanvasPenStyle,
  ZCanvasSloppiness,
  ZCanvasStrokePreset,
  getStrokeDashArray,
  penStrokeWidth,
  strokeToPenStyle,
} from '../core/style-models';

export type ZCanvasNodeStylePatch = Partial<
  Pick<
    ZCanvasNode,
    | 'color'
    | 'fill'
    | 'strokeWidth'
    | 'strokeStyle'
    | 'fillOpacity'
    | 'roughness'
    | 'fontSize'
    | 'fontFamily'
    | 'fontWeight'
    | 'textAlign'
    | 'textVerticalAlign'
    | 'badge'
    | 'description'
    | 'subtitle'
  >
>;

export type ZCanvasEdgeStylePatch = Partial<
  Pick<
    ZCanvasEdge,
    | 'color'
    | 'strokeWidth'
    | 'strokeStyle'
    | 'lineCap'
    | 'opacity'
    | 'startArrowhead'
    | 'endArrowhead'
    | 'style'
    | 'roughness'
    | 'label'
    | 'labelOffset'
    | 'labelBg'
    | 'labelColor'
    | 'sourceOffset'
    | 'targetOffset'
    | 'stepOffset'
    | 'sourcePoint'
    | 'targetPoint'
    | 'source'
    | 'target'
    | 'sourceHandle'
    | 'targetHandle'
  >
>;

export type ZCanvasPenStylePatch = Partial<ZCanvasPenStyle>;

/** Selected element the panel is editing. Exactly one element at a time. */
export type ZCanvasStyleTarget =
  | { kind: 'node'; node: ZCanvasNode }
  | { kind: 'edge'; edge: ZCanvasEdge }
  /**
   * A freehand stroke picked on the canvas. Ink carries the same four
   * appearance choices the pen does — colour, nib, dash and opacity — but here
   * they restyle the mark in hand instead of the nib that draws the next one.
   */
  | { kind: 'stroke'; stroke: ZCanvasDrawingStroke }
  /**
   * The freehand pen. Not an element: the panel is configuring what the tool
   * will draw, so these edits land on the pen, never on existing ink.
   */
  | { kind: 'pen'; pen: ZCanvasPenStyle };

export interface ZCanvasStylePanelProps {
  target: ZCanvasStyleTarget;
  /** Live edit while a control is being dragged (no undo entry yet). */
  onPreviewNode: (patch: ZCanvasNodeStylePatch) => void;
  /** Final value for a control — records one undo step for the whole gesture. */
  onCommitNode: (patch: ZCanvasNodeStylePatch) => void;
  onPreviewEdge: (patch: ZCanvasEdgeStylePatch) => void;
  onCommitEdge: (patch: ZCanvasEdgeStylePatch) => void;
  /**
   * Sets connector routing, either on the edited connector alone or on every
   * connector on the canvas.
   */
  onCommitRouting: (style: ZCanvasEdgeRouting, scope: ZCanvasRoutingScope) => void;
  /** Edits the pen's tool settings. Nothing here touches the document. */
  onChangePen: (patch: ZCanvasPenStylePatch) => void;
  /** Live restyle of the ink in hand, while a control is being dragged. */
  onPreviewStroke: (patch: ZCanvasPenStylePatch) => void;
  /** Final value for the ink in hand — one undo step for the whole gesture. */
  onCommitStroke: (patch: ZCanvasPenStylePatch) => void;
  /** Clears every appearance override back to the theme defaults. */
  onReset: () => void;
  onDeselect: () => void;
  /** Alignment and distribution handlers for canvas elements */
  onAlign?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute?: (direction: 'horizontal' | 'vertical') => void;
  selectedCount?: number;
}

/** Border / stroke swatches, ordered dark → light like a classic palette. */
export const STROKE_PALETTE = [
  '#0F172A',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#635BFF',
  '#8B5CF6',
  '#EC4899',
];

/** Fill / background swatches, plus an explicit "no fill" chip. */
export const BACKGROUND_PALETTE = [
  '#FFFFFF',
  '#F1F5F9',
  '#FEE2E2',
  '#FEF3C7',
  '#D1FAE5',
  '#DBEAFE',
  '#EDE9FE',
  '#FCE7F3',
];

const STROKE_WIDTH_OPTIONS = [1, 2, 3, 4, 6];

/**
 * The pen's nibs. A nib is a stroke preset, not a bare width: its width,
 * smoothing and roughness travel together, and the same presets are offered in
 * the canvas settings dialog — so the two controls cannot disagree.
 */
const PEN_NIB_OPTIONS: Array<{
  value: ZCanvasStrokePreset;
  label: string;
  title: string;
}> = [
  { value: 'precise', label: 'Precise', title: 'Precise: fine, clean line' },
  { value: 'natural', label: 'Natural', title: 'Natural: balanced everyday pen' },
  { value: 'sketch', label: 'Sketchy', title: 'Sketchy: thin, hand-drawn line' },
  { value: 'marker', label: 'Marker', title: 'Marker: bold, round nib' },
];

const STROKE_STYLE_OPTIONS: Array<{
  value: NonNullable<ZCanvasNode['strokeStyle']>;
  label: React.ReactNode;
  title: string;
}> = [
  {
    value: 'solid',
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Solid line',
  },
  {
    value: 'dashed',
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 3.5" />
      </svg>
    ),
    title: 'Dashed line',
  },
  {
    value: 'dotted',
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1.5 3.5" />
      </svg>
    ),
    title: 'Dotted line',
  },
];

/**
 * How far the pen wanders from the path the hand took.
 */
const PEN_SLOPPINESS_OPTIONS: Array<{
  value: ZCanvasSloppiness;
  label: React.ReactNode;
  title: string;
}> = [
  {
    value: 'architectural',
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Clean: an exact, unbroken line',
  },
  {
    value: 'artist',
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <path d="M2 13 Q 7 8, 12 12 T 22 11" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Pencil: a subtle wander, like graphite',
  },
  {
    value: 'cartoonist',
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <path d="M2 14 C 5 7, 7 17, 10 11 C 13 5, 15 18, 18 10 C 20 6, 21 15, 22 12" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Sketchy: a loose, expressive wander',
  },
];

const ARROWHEAD_OPTIONS: Array<{
  value: NonNullable<ZCanvasEdge['endArrowhead']>;
  label: string;
}> = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'barbs', label: 'Barbs' },
];

const SLOPPINESS_OPTIONS: Array<{
  value: number;
  label: React.ReactNode;
  title: string;
}> = [
  {
    value: 0,
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Architectural: Precise and crisp lines',
  },
  {
    value: 1.4,
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <path d="M2 13 Q 7 8, 12 12 T 22 11" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Artist: Organic hand-drawn variation',
  },
  {
    value: 2.5,
    label: (
      <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
        <path d="M2 14 C 5 7, 7 17, 10 11 C 13 5, 15 18, 18 10 C 20 6, 21 15, 22 12" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Cartoonist: Playful sketch sloppiness',
  },
];

const FONT_FAMILY_OPTIONS: Array<{
  value: NonNullable<ZCanvasNode['fontFamily']>;
  label: string;
  fontClass: string;
}> = [
  { value: 'sans', label: 'Sans', fontClass: 'font-sans' },
  { value: 'mono', label: 'Mono', fontClass: 'font-mono' },
  { value: 'serif', label: 'Serif', fontClass: 'font-serif' },
  { value: 'handwriting', label: 'Draw', fontClass: 'font-sans tracking-wide' },
];

const TEXT_ALIGN_OPTIONS: Array<{
  value: NonNullable<ZCanvasNode['textAlign']>;
  label: React.ReactNode;
  title: string;
}> = [
  { value: 'left', label: <AlignLeft className="w-3.5 h-3.5 mx-auto" />, title: 'Align Left' },
  { value: 'center', label: <AlignCenter className="w-3.5 h-3.5 mx-auto" />, title: 'Align Center' },
  { value: 'right', label: <AlignRight className="w-3.5 h-3.5 mx-auto" />, title: 'Align Right' },
];

const TEXT_VERTICAL_ALIGN_OPTIONS: Array<{
  value: NonNullable<ZCanvasNode['textVerticalAlign']>;
  label: React.ReactNode;
  title: string;
}> = [
  { value: 'top', label: <AlignStartVertical className="w-3.5 h-3.5 mx-auto" />, title: 'Align Top' },
  { value: 'middle', label: <AlignCenterVertical className="w-3.5 h-3.5 mx-auto" />, title: 'Align Middle' },
  { value: 'bottom', label: <AlignEndVertical className="w-3.5 h-3.5 mx-auto" />, title: 'Align Bottom' },
];

const ROUTING_OPTIONS: Array<{
  value: ZCanvasEdgeRouting;
  label: string;
  title: string;
}> = [
  { value: 'step', label: 'Step', title: 'Orthogonal right-angle routing' },
  { value: 'bezier', label: 'Curve', title: 'Smooth curved routing' },
];

/** What a routing change applies to. */
export type ZCanvasRoutingScope = 'single' | 'all';

const NODE_TYPE_LABELS: Partial<Record<ZCanvasNodeType, string>> = {
  card: 'Component',
  table: 'Table',
  container: 'Container',
  frame: 'Frame',
  rectangle: 'Rectangle',
  circle: 'Circle',
  diamond: 'Diamond',
  triangle: 'Triangle',
  cylinder: 'Database',
  cloud: 'Cloud',
  text: 'Text',
  svg: 'Component',
};

export function ZCanvasStylePanel({
  target,
  onPreviewNode,
  onCommitNode,
  onPreviewEdge,
  onCommitEdge,
  onCommitRouting,
  onChangePen,
  onPreviewStroke,
  onCommitStroke,
  onReset,
  onDeselect,
  onAlign,
  onDistribute,
  selectedCount,
}: ZCanvasStylePanelProps) {
  const title =
    target.kind === 'node'
      ? NODE_TYPE_LABELS[target.node.type] ?? 'Shape'
      : target.kind === 'edge'
      ? 'Connector'
      : target.kind === 'stroke'
      ? 'Ink'
      : 'Freehand Pen';

  // Routing scope is panel state, not document state: it says whether the next
  // routing press lands on this connector or on all of them.
  const [routingScope, setRoutingScope] = React.useState<ZCanvasRoutingScope>('single');

  return (
    <div
      role="group"
      data-testid="style-panel"
      aria-label={target.kind === 'pen' ? 'Freehand pen options' : `${title} style`}
      className="absolute top-20 right-4 z-30 w-64 max-h-[calc(100%-6rem)] overflow-y-auto no-scrollbar rounded-2xl border border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl p-3 text-xs animate-in fade-in-50 slide-in-from-right-2 duration-150"
      // The canvas listens for pointer gestures on the root element; keep every
      // interaction inside the panel from reaching it. A release is deliberately
      // not among them: it belongs to whatever press is already being dragged,
      // and a drag that is let go over the panel is a drag that has ended, so
      // swallowing it would leave the component stuck to the pointer until the
      // next click. With no drag in flight there is nothing for it to disturb —
      // the canvas handler does nothing but clear two pieces of state it has
      // already cleared.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-0.5 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Reset to default appearance"
            aria-label="Reset to default appearance"
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={onReset}
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            title={target.kind === 'pen' ? 'Done — back to the select tool' : 'Deselect'}
            aria-label={target.kind === 'pen' ? 'Done drawing' : 'Deselect'}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={onDeselect}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {target.kind === 'node' ? (
        <NodeSections
          node={target.node}
          onPreview={onPreviewNode}
          onCommit={onCommitNode}
          onAlign={onAlign}
          onDistribute={onDistribute}
          selectedCount={selectedCount}
        />
      ) : target.kind === 'edge' ? (
        <EdgeSections
          edge={target.edge}
          onPreview={onPreviewEdge}
          onCommit={onCommitEdge}
          routingScope={routingScope}
          onRoutingScopeChange={setRoutingScope}
          onCommitRouting={onCommitRouting}
        />
      ) : target.kind === 'stroke' ? (
        <PenSections
          pen={strokeToPenStyle(target.stroke)}
          onPreview={onPreviewStroke}
          onCommit={onCommitStroke}
          scope="element"
        />
      ) : (
        <PenSections pen={target.pen} onPreview={onChangePen} scope="tool" />
      )}
    </div>
  );
}

/**
 * The ink sections: colour, nib, dash pattern and opacity (ink is an open path,
 * so there is nothing to fill).
 *
 * The same sections serve both cases ink appears in. `scope` names which one:
 * the pen's own settings, which apply to the next stroke drawn, or a stroke
 * already on the canvas, which they restyle in place. Only the closing note
 * differs — the controls genuinely are the same ones.
 */
function PenSections({
  pen,
  onPreview,
  onCommit,
  scope = 'tool',
}: {
  pen: ZCanvasPenStyle;
  /** Applied as the control moves — a drag, or a press on a chip. */
  onPreview: (patch: ZCanvasPenStylePatch) => void;
  /**
   * The value the control settles on. Defaults to `onPreview`, which is right
   * for the pen's own settings: those are tool state, so there is no undo step
   * to fold a gesture into.
   */
  onCommit?: (patch: ZCanvasPenStylePatch) => void;
  scope?: 'tool' | 'element' | string;
}) {
  const editingInk = scope === 'element';
  const change = onCommit ?? onPreview;

  return (
    <>
      <Row label="Stroke">
        <Palette
          colors={STROKE_PALETTE}
          value={pen.color}
          clearable={false}
          onPreview={(color) => onPreview({ color })}
          onCommit={(color) => change({ color })}
        />
      </Row>

      <Row
        label="Ink"
        hint={
          editingInk
            ? 'The nib this ink was drawn with. Picking another redraws the mark with it.'
            : 'The nib the pen draws with. Its width comes from the preset.'
        }
      >
        {/* Previews rather than numbers: the chip is drawn with the nib it
            selects, so the choice reads without translating "6" into a width. */}
        <div className="flex items-center gap-1">
          {PEN_NIB_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={pen.preset === option.value}
              aria-label={option.title}
              title={option.title}
              className={cn(
                'h-6 flex-1 rounded-md border flex items-center justify-center transition-colors',
                pen.preset === option.value
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border/70 text-foreground/80 hover:bg-muted'
              )}
              onClick={() => change({ preset: option.value })}
            >
              <InkPreview
                width={penStrokeWidth({ preset: option.value })}
                strokeStyle="solid"
                pen={pen}
              />
            </button>
          ))}
        </div>
      </Row>

      <Row label="Stroke style">
        <div className="flex items-center gap-1">
          {STROKE_STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={pen.strokeStyle === option.value}
              aria-label={option.title}
              title={option.title}
              className={cn(
                'h-6 flex-1 rounded-md border flex items-center justify-center transition-colors',
                pen.strokeStyle === option.value
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border/70 text-foreground/80 hover:bg-muted'
              )}
              onClick={() => change({ strokeStyle: option.value })}
            >
              <InkPreview
                width={penStrokeWidth(pen)}
                strokeStyle={option.value}
                pen={pen}
              />
            </button>
          ))}
        </div>
      </Row>

      <Row
        label="Sloppiness"
        hint={
          editingInk
            ? 'How far this line wanders from the path the hand took.'
            : 'How far the line wanders from the path your hand took.'
        }
      >
        <div className="flex items-center gap-1">
          {PEN_SLOPPINESS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={pen.sloppiness === option.value}
              aria-label={option.title}
              title={option.title}
              className={cn(
                'h-6 flex-1 rounded-md border text-[10px] transition-colors',
                pen.sloppiness === option.value
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border/70 text-foreground/80 hover:bg-muted'
              )}
              onClick={() => change({ sloppiness: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Row>

      <Row
        label={`Opacity · ${Math.round(pen.opacity * 100)}%`}
        hint={
          editingInk
            ? 'How opaque the ink is. 10% is the faintest a stroke can be made.'
            : 'How opaque the ink is. 10% is the faintest the pen will draw.'
        }
      >
        <Slider
          min={PEN_MIN_OPACITY}
          value={pen.opacity}
          onPreview={(opacity) => onPreview({ opacity })}
          onCommit={(opacity) => change({ opacity })}
        />
      </Row>

      <p className="px-0.5 pt-0.5 text-[10px] leading-snug text-muted-foreground">
        {editingInk
          ? 'These restyle the stroke in hand. The shape of the line is kept — only its colour, nib, dash and opacity change.'
          : 'These apply to the strokes you draw next. Ink already on the canvas keeps the appearance it was drawn with.'}
      </p>
    </>
  );
}

/**
 * A sample of the pen's own ink: a short line at the given nib width and dash
 * pattern, in the pen's colour and opacity.
 */
function InkPreview({
  width,
  strokeStyle,
  pen,
}: {
  width: number;
  strokeStyle: NonNullable<ZCanvasPenStyle['strokeStyle']>;
  pen: ZCanvasPenStyle;
}) {
  // The preview is a fixed 22px wide, so a wide nib cannot be shown at true
  // scale without the chips jumping; clamp it to what fits the chip.
  const drawn = Math.min(width, 7);
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden className="overflow-visible">
      <line
        x1="1"
        y1="5"
        x2="21"
        y2="5"
        stroke={pen.color}
        strokeWidth={drawn}
        strokeLinecap="round"
        strokeDasharray={getStrokeDashArray(strokeStyle, drawn)}
        opacity={pen.opacity}
      />
    </svg>
  );
}

function NodeSections({
  node,
  onPreview,
  onCommit,
  onAlign,
  onDistribute,
  selectedCount = 1,
}: {
  node: ZCanvasNode;
  onPreview: (patch: ZCanvasNodeStylePatch) => void;
  onCommit: (patch: ZCanvasNodeStylePatch) => void;
  onAlign?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute?: (direction: 'horizontal' | 'vertical') => void;
  selectedCount?: number;
}) {
  const isText = node.type === 'text';
  const strokeWidth = node.strokeWidth ?? 2;
  const strokeStyle = node.strokeStyle ?? 'solid';

  // The slider must show the alpha actually painted, which for an unstyled
  // component is the themed default's own alpha rather than a full 100%.
  const themedAlpha = NODE_DEFAULT_APPEARANCE[node.type as ZCanvasFillKind]?.fillAlpha ?? 1;
  const fillOpacity = node.fillOpacity ?? (node.fill ? 1 : themedAlpha);

  return (
    <>
      <Row label={isText ? 'Text colour' : 'Stroke'}>
        <Palette
          colors={STROKE_PALETTE}
          value={node.color}
          onPreview={(color) => onPreview({ color })}
          onCommit={(color) => onCommit({ color })}
        />
      </Row>

      <Row label={isText ? 'Text background' : 'Background'}>
        <Palette
          colors={BACKGROUND_PALETTE}
          value={node.fill}
          onPreview={(fill) => onPreview({ fill })}
          onCommit={(fill) => onCommit({ fill })}
        />
      </Row>

      <Row
        label={`Background opacity · ${Math.round(fillOpacity * 100)}%`}
        hint={isText ? "How much of the background fill shows through." : "How much of the fill shows through the shape."}
      >
        <Slider
          value={fillOpacity}
          onPreview={(value) => onPreview({ fillOpacity: value })}
          onCommit={(value) => onCommit({ fillOpacity: value })}
        />
      </Row>

      {!isText && (
        <>
          <Row label="Stroke width">
            <Segmented
              options={STROKE_WIDTH_OPTIONS.map((width) => ({
                value: width,
                label: <StrokeWidthIcon width={width} />,
                title: `${width}px`,
              }))}
              value={strokeWidth}
              onChange={(width) => onCommit({ strokeWidth: width })}
            />
          </Row>

          <Row label="Stroke style">
            <Segmented
              options={STROKE_STYLE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                title: option.title,
              }))}
              value={strokeStyle}
              onChange={(style) => onCommit({ strokeStyle: style })}
            />
          </Row>

          <Row label="Sloppiness" hint="Architectural precision vs hand-drawn sketch style.">
            <Segmented
              options={SLOPPINESS_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                title: option.title,
              }))}
              value={node.roughness ?? 0}
              onChange={(roughness) => onCommit({ roughness })}
            />
          </Row>
        </>
      )}

      {/* Typography Controls for Text and Shape Labels */}
      <Row label="Font size">
        <DynamicFontSizePicker
          value={node.fontSize ?? (isText ? 16 : 12)}
          onChange={(fontSize) => onCommit({ fontSize })}
        />
      </Row>

      <Row label="Font family">
        <Segmented
          options={FONT_FAMILY_OPTIONS.map((fam) => ({
            value: fam.value,
            label: <span className={fam.fontClass}>{fam.label}</span>,
            title: fam.label,
          }))}
          value={node.fontFamily ?? 'sans'}
          onChange={(fontFamily) => onCommit({ fontFamily })}
        />
      </Row>

      <Row label="Text alignment">
        <Segmented
          options={TEXT_ALIGN_OPTIONS.map((align) => ({
            value: align.value,
            label: align.label,
            title: align.title,
          }))}
          value={node.textAlign ?? (isText ? 'left' : 'center')}
          onChange={(textAlign) => onCommit({ textAlign })}
        />
      </Row>

      <Row label="Text position">
        <Segmented
          options={TEXT_VERTICAL_ALIGN_OPTIONS.map((valign) => ({
            value: valign.value,
            label: valign.label,
            title: valign.title,
          }))}
          value={node.textVerticalAlign ?? 'middle'}
          onChange={(textVerticalAlign) => onCommit({ textVerticalAlign })}
        />
      </Row>

      {/* Optional Badge & Description for Cards and Containers */}
      {(node.type === 'card' || node.type === 'container') && (
        <>
          <Row
            label="Badge (optional)"
            hint="Category badge pill. Leave blank or click Remove to show the full title and description without badge overflow."
          >
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="text"
                placeholder={node.type === 'container' ? 'e.g. VPC, Security (optional)' : 'e.g. Service, API (optional)'}
                value={node.badge || ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  onCommit({ badge: val.length > 0 ? e.target.value : undefined });
                }}
                className="h-7 px-2 text-xs flex-1 rounded-md border border-input bg-background text-foreground font-mono placeholder:text-muted-foreground/40 outline-none focus:border-primary transition-colors"
              />
              {node.badge && (
                <button
                  type="button"
                  onClick={() => onCommit({ badge: undefined })}
                  title="Remove badge to let title and description take full width"
                  className="h-7 px-2 text-[11px] rounded-md border border-input bg-muted/40 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </Row>

          <Row
            label="Description"
            hint="Subtitle or secondary description displayed alongside the title."
          >
            <input
              type="text"
              placeholder={node.type === 'container' ? 'e.g. 10.0.0.0/16 - Primary Region VPC' : 'e.g. Node.js / Express microservice'}
              value={node.description || node.subtitle || ''}
              onChange={(e) => {
                const text = e.target.value;
                onCommit({
                  description: text.trim().length > 0 ? text : undefined,
                  subtitle: text.trim().length > 0 ? text : undefined,
                });
              }}
              className="h-7 px-2 text-xs w-full rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary transition-colors"
            />
          </Row>
        </>
      )}

      {/* Alignment & Distribution Operations */}
      {onAlign && (
        <div className="pt-2.5 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Align Elements</span>
            {selectedCount > 1 && (
              <span className="text-[9px] font-mono px-1 rounded bg-primary/10 text-primary">
                {selectedCount} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1">
            <button
              type="button"
              onClick={() => onAlign('left')}
              title="Align Left"
              className="h-7 rounded flex items-center justify-center bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('center')}
              title="Align Center Horizontally"
              className="h-7 rounded flex items-center justify-center bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('right')}
              title="Align Right"
              className="h-7 rounded flex items-center justify-center bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('top')}
              title="Align Top"
              className="h-7 rounded flex items-center justify-center bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <AlignStartVertical className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('middle')}
              title="Align Middle Vertically"
              className="h-7 rounded flex items-center justify-center bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <AlignCenterVertical className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('bottom')}
              title="Align Bottom"
              className="h-7 rounded flex items-center justify-center bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <AlignEndVertical className="w-3.5 h-3.5" />
            </button>
          </div>
          {onDistribute && (
            <div className="grid grid-cols-2 gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => onDistribute('horizontal')}
                title="Distribute Horizontally"
                className="h-7 px-2 text-[10px] rounded flex items-center justify-center gap-1.5 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <AlignHorizontalDistributeCenter className="w-3 h-3" />
                <span>Distribute H</span>
              </button>
              <button
                type="button"
                onClick={() => onDistribute('vertical')}
                title="Distribute Vertically"
                className="h-7 px-2 text-[10px] rounded flex items-center justify-center gap-1.5 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <AlignVerticalDistributeCenter className="w-3 h-3" />
                <span>Distribute V</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function EdgeSections({
  edge,
  onPreview,
  onCommit,
  routingScope,
  onRoutingScopeChange,
  onCommitRouting,
}: {
  edge: ZCanvasEdge;
  onPreview: (patch: ZCanvasEdgeStylePatch) => void;
  onCommit: (patch: ZCanvasEdgeStylePatch) => void;
  routingScope: ZCanvasRoutingScope;
  onRoutingScopeChange: (scope: ZCanvasRoutingScope) => void;
  onCommitRouting: (style: ZCanvasEdgeRouting, scope: ZCanvasRoutingScope) => void;
}) {
  const strokeWidth = edge.strokeWidth ?? 2;
  const strokeStyle = edge.strokeStyle ?? 'solid';
  const opacity = edge.opacity ?? 1;
  // An unset end arrowhead defaults to an arrow; an unset start to none.
  const startArrow = edge.startArrowhead ?? 'none';
  const endArrow = edge.endArrowhead ?? 'arrow';

  return (
    <>
      <Row label="Stroke">
        <Palette
          colors={STROKE_PALETTE}
          value={edge.color}
          onPreview={(color) => onPreview({ color })}
          onCommit={(color) => onCommit({ color })}
        />
      </Row>

      <Row label="Stroke width">
        <Segmented
          options={STROKE_WIDTH_OPTIONS.map((width) => ({
            value: width,
            label: <StrokeWidthIcon width={width} />,
            title: `${width}px`,
          }))}
          value={strokeWidth}
          onChange={(width) => onCommit({ strokeWidth: width })}
        />
      </Row>

      <Row label="Stroke style">
        <Segmented
          options={STROKE_STYLE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            title: option.title,
          }))}
          value={strokeStyle}
          onChange={(style) => onCommit({ strokeStyle: style })}
        />
      </Row>

      <Row label="Text background" hint="Background colour of the line text badge.">
        <Palette
          colors={BACKGROUND_PALETTE}
          value={edge.labelBg}
          onPreview={(labelBg) => onPreview({ labelBg })}
          onCommit={(labelBg) => onCommit({ labelBg })}
        />
      </Row>

      <Row label="Text colour" hint="Text colour of the line text.">
        <Palette
          colors={STROKE_PALETTE}
          value={edge.labelColor}
          onPreview={(labelColor) => onPreview({ labelColor })}
          onCommit={(labelColor) => onCommit({ labelColor })}
        />
      </Row>

      <Row label="Label text" hint="Text shown on the connector line.">
        <textarea
          rows={2}
          value={edge.label || ''}
          placeholder="Add text to line (Enter for new line)..."
          onChange={(e) => onCommit({ label: e.target.value })}
          className="w-full text-xs font-mono p-1.5 rounded-md border border-input bg-background text-foreground shadow-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </Row>

      <Row
        label="Routing"
        hint={
          routingScope === 'all'
            ? 'Applies to every connector on the canvas.'
            : 'Applies to this connector only.'
        }
      >
        <Segmented
          options={ROUTING_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            title: option.title,
          }))}
          value={edge.style === 'straight' ? 'step' : (edge.style ?? 'step')}
          onChange={(style) => onCommitRouting(style, routingScope)}
        />
        <div className="mt-2 flex items-center justify-between px-0.5">
          <span className="text-[10px] text-muted-foreground select-none">
            Apply to all connectors
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={routingScope === 'all'}
            title={routingScope === 'all' ? 'Applying to all connectors' : 'Applying to this connector only'}
            onClick={() => onRoutingScopeChange(routingScope === 'all' ? 'single' : 'all')}
            className={cn(
              'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              routingScope === 'all' ? 'bg-primary' : 'bg-muted-foreground/25'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-3 w-3 rounded-full bg-background shadow-xs ring-0 transition-transform duration-150 mt-0.5 ml-0.5',
                routingScope === 'all' ? 'translate-x-3 bg-primary-foreground' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </Row>

      <Row label="Start head">
        <ArrowheadPicker
          value={startArrow}
          onChange={(value) => onCommit({ startArrowhead: value })}
        />
      </Row>

      <Row label="End head">
        <ArrowheadPicker
          value={endArrow}
          onChange={(value) => onCommit({ endArrowhead: value })}
        />
      </Row>

      <Row
        label={`Opacity · ${Math.round(opacity * 100)}%`}
        hint="Fades the connector and its label."
      >
        <Slider
          value={opacity}
          onPreview={(value) => onPreview({ opacity: value })}
          onCommit={(value) => onCommit({ opacity: value })}
        />
      </Row>

      <Row label="Sloppiness" hint="Architectural precision vs hand-drawn sketch lines.">
        <Segmented
          options={SLOPPINESS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            title: option.title,
          }))}
          value={edge.roughness ?? 0}
          onChange={(roughness) => onCommit({ roughness })}
        />
      </Row>

      {Boolean(edge.label && edge.labelOffset && (edge.labelOffset.x !== 0 || edge.labelOffset.y !== 0)) && (
        <Row label="Label position">
          <button
            type="button"
            className="h-7 px-2.5 text-xs w-full flex items-center justify-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium transition-colors"
            onClick={() => onCommit({ labelOffset: { x: 0, y: 0 } })}
            title="Reset label position back to center of line"
          >
            <RotateCcw className="w-3 h-3 text-muted-foreground" />
            <span>Reset Label to Center</span>
          </button>
        </Row>
      )}

      {Boolean(edge.stepOffset && edge.stepOffset !== 0) && (
        <Row label="Line position">
          <button
            type="button"
            className="h-7 px-2.5 text-xs w-full flex items-center justify-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium transition-colors"
            onClick={() => onCommit({ stepOffset: 0 })}
            title="Reset line bend position back to center"
          >
            <RotateCcw className="w-3 h-3 text-muted-foreground" />
            <span>Reset Line to Center</span>
          </button>
        </Row>
      )}

      {Boolean((edge.sourceOffset && edge.sourceOffset !== 0) || (edge.targetOffset && edge.targetOffset !== 0)) && (
        <Row label="Shape anchors">
          <button
            type="button"
            className="h-7 px-2.5 text-xs w-full flex items-center justify-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium transition-colors"
            onClick={() => onCommit({ sourceOffset: undefined, targetOffset: undefined })}
            title="Reset line attachments to shape side centers"
          >
            <RotateCcw className="w-3 h-3 text-muted-foreground" />
            <span>Reset Anchors to Center</span>
          </button>
        </Row>
      )}

      <p className="px-0.5 pt-0.5 text-[10px] leading-snug text-muted-foreground">
        Tip: Drag line midpoint or line body to adjust bend position. Drag endpoints to connect anywhere along shapes.
      </p>
    </>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5" data-testid={`row-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <div className="px-0.5 mb-1 text-[10px] text-muted-foreground" title={hint}>
        {label}
      </div>
      {children}
    </div>
  );
}

/** Colour swatches plus a native picker for anything off-palette. */
function Palette({
  colors,
  value,
  clearable = true,
  onPreview,
  onCommit,
}: {
  colors: string[];
  value: string | undefined;
  /**
   * Whether to offer the "clear" chip. Off for the pen: transparent ink is
   * invisible ink, which reads as a broken tool rather than a choice.
   */
  clearable?: boolean;
  onPreview: (color: string) => void;
  onCommit: (color: string) => void;
}) {
  const normalized = (value || '').toLowerCase();
  const isCustom = Boolean(value) && !colors.some((c) => c.toLowerCase() === normalized);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((color) => {
        const isActive = normalized === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            aria-label={`Colour ${color}`}
            aria-pressed={isActive}
            title={color}
            className={cn(
              'w-5 h-5 rounded-md border transition-transform hover:scale-110',
              isActive
                ? 'ring-2 ring-primary ring-offset-1 ring-offset-card border-transparent'
                : 'border-border/70'
            )}
            style={{ backgroundColor: color }}
            onClick={() => onCommit(color)}
          />
        );
      })}

      <label
        className={cn(
          'relative w-5 h-5 rounded-md border overflow-hidden cursor-pointer transition-transform hover:scale-110',
          isCustom
            ? 'ring-2 ring-primary ring-offset-1 ring-offset-card border-transparent'
            : 'border-border/70'
        )}
        title="Custom colour"
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'conic-gradient(#EF4444, #F59E0B, #10B981, #3B82F6, #8B5CF6, #EF4444)',
          }}
        />
        <input
          type="color"
          aria-label="Custom colour"
          value={value || '#635BFF'}
          onChange={(e) => onPreview(e.target.value)}
          onBlur={() => onCommit(value || '#635BFF')}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>

      {clearable && value && (
        <button
          type="button"
          aria-label="Clear colour"
          title="Clear colour"
          className="w-5 h-5 flex items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => onCommit('transparent')}
        >
          <Eraser className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={isActive}
            title={option.title}
            className={cn(
              'h-6 flex-1 rounded-md border text-[10px] transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border/70 text-foreground/80 hover:bg-muted'
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Arrowhead picker: a live SVG preview per variant, since a glyph reads far
 * faster than the word for "triangle" or "diamond".
 */
function ArrowheadPicker({
  value,
  onChange,
}: {
  value: NonNullable<ZCanvasEdge['endArrowhead']>;
  onChange: (value: NonNullable<ZCanvasEdge['endArrowhead']>) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {ARROWHEAD_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={isActive}
            title={option.label}
            className={cn(
              'h-7 rounded-md border flex items-center justify-center transition-colors',
              isActive
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-border/70 hover:bg-muted text-foreground/80'
            )}
            onClick={() => onChange(option.value)}
          >
            <ArrowheadGlyph type={option.value} />
          </button>
        );
      })}
    </div>
  );
}

function ArrowheadGlyph({ type }: { type: NonNullable<ZCanvasEdge['endArrowhead']> }) {
  const stroke = 'currentColor';
  return (
    <svg
      width="24"
      height="14"
      viewBox="0 0 24 14"
      aria-hidden
      className="shrink-0"
    >
      <line x1="2" y1="7" x2="22" y2="7" stroke={stroke} strokeWidth="1.3" />
      {type === 'barbs' && (
        <path
          d="M 15 3.5 L 21 7 L 15 10.5"
          fill="none"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {type === 'architectural' && (
        <line
          x1="16"
          y1="11.5"
          x2="21.5"
          y2="2.5"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      {type === 'arrow' && <path d="M 14 3 L 22 7 L 14 11 z" fill={stroke} />}
      {type === 'triangle' && <path d="M 14 2 L 22 7 L 14 12 z" fill={stroke} />}
      {type === 'circle' && <circle cx="18" cy="7" r="3" fill={stroke} />}
      {type === 'diamond' && <path d="M 18 3 L 22 7 L 18 11 L 14 7 z" fill={stroke} />}
    </svg>
  );
}

export function StrokeWidthIcon({ width }: { width: number }) {
  const iconStrokeWidth = Math.min(5.5, Math.max(1.2, width * 1.1));
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-3.5 mx-auto" fill="none" stroke="currentColor">
      <line x1="3" y1="12" x2="21" y2="12" strokeWidth={iconStrokeWidth} strokeLinecap="round" />
    </svg>
  );
}

/**
 * Dynamic font size adjuster offering direct numerical input,
 * fine-grained -/+ stepper buttons, and common quick presets.
 */
function DynamicFontSizePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (fontSize: number) => void;
}) {
  const currentSize = Math.round(value || 16);
  const [inputValue, setInputValue] = React.useState<string>(String(currentSize));

  React.useEffect(() => {
    setInputValue(String(currentSize));
  }, [currentSize]);

  const handleStep = (delta: number) => {
    const next = Math.max(8, Math.min(120, currentSize + delta));
    setInputValue(String(next));
    onChange(next);
  };

  const handleBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= 8 && parsed <= 120) {
      onChange(parsed);
    } else {
      setInputValue(String(currentSize));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleStep(e.shiftKey ? 4 : 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleStep(e.shiftKey ? -4 : -1);
    }
  };

  const PRESETS = [12, 14, 16, 20, 24, 32];

  return (
    <div className="space-y-1.5">
      {/* Dynamic stepper & direct numerical input */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleStep(-2)}
          title="Decrease font size (-2px)"
          className="h-6 w-6 flex items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-semibold cursor-pointer transition-colors"
        >
          -
        </button>

        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setInputValue(val);
              const num = parseInt(val, 10);
              if (!isNaN(num) && num >= 8 && num <= 120) {
                onChange(num);
              }
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-6 px-1.5 pr-5 text-center text-xs font-medium rounded-md border border-border/70 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
          <span className="absolute right-1.5 text-[9px] text-muted-foreground pointer-events-none">px</span>
        </div>

        <button
          type="button"
          onClick={() => handleStep(2)}
          title="Increase font size (+2px)"
          className="h-6 w-6 flex items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-semibold cursor-pointer transition-colors"
        >
          +
        </button>
      </div>

      {/* Quick preset chips */}
      <div className="grid grid-cols-6 gap-1">
        {PRESETS.map((size) => {
          const isActive = currentSize === size;
          return (
            <button
              key={size}
              type="button"
              onClick={() => onChange(size)}
              title={`${size}px`}
              className={cn(
                'h-5 rounded text-[10px] font-medium border transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/70'
              )}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Opacity slider. Previews continuously, records one undo step on release. */
function Slider({
  value,
  min = 0,
  onPreview,
  onCommit,
}: {
  value: number;
  /** Lower bound, 0..1. The pen stops above zero so ink never vanishes. */
  min?: number;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const floor = Math.round(min * 100);
  return (
    <div className="flex items-center gap-2 px-0.5">
      <input
        type="range"
        min={floor}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        aria-label="Opacity"
        aria-valuetext={`${Math.round(value * 100)}%`}
        // `value` is already the live previewed value, so releasing the handle
        // simply commits it and closes the undo step opened by `onPreview`.
        onChange={(e) => onPreview(Number(e.target.value) / 100)}
        onPointerUp={() => onCommit(value)}
        onKeyUp={() => onCommit(value)}
        onBlur={() => onCommit(value)}
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
    </div>
  );
}

export default ZCanvasStylePanel;
