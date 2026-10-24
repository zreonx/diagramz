import { z } from 'zod';
import type { ZCanvasDrawingStroke } from './schema';

/**
 * ZCanvas Style Presets
 */
export const ZCanvasStylePresetSchema = z.enum([
  'clean',       // Crisp borders, precise geometry, clean minimal
  'sketch',      // Rough hand-drawn borders & lines (deterministic rough-svg)
  'soft',        // Smooth rounded corners, soft pastel fills
  'technical',   // High-contrast, monospace, precise orthogonal lines
]);
export type ZCanvasStylePreset = z.infer<typeof ZCanvasStylePresetSchema>;

/**
 * Freehand Drawing Presets
 */
export const ZCanvasStrokePresetSchema = z.enum([
  'precise',     // Crisp, high smoothing, low roughness
  'natural',     // Subtle hand-drawn variation, moderate smoothing
  'sketch',      // Noticeable hand-drawn roughness
  'marker',      // Thick strokes, rounded edges
]);
export type ZCanvasStrokePreset = z.infer<typeof ZCanvasStrokePresetSchema>;

/**
 * Line / Connector Arrowheads
 */
export const ZCanvasArrowheadTypeSchema = z.enum([
  'none',
  'arrow',
  'barbs',
  'architectural',
  'triangle',
  'circle',
  'diamond',
]);
export type ZCanvasArrowheadType = z.infer<typeof ZCanvasArrowheadTypeSchema>;

/**
 * Shared Appearance & Style Properties Model
 */
export const ZCanvasAppearancePropertiesSchema = z.object({
  // Stroke / Border properties
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeOpacity: z.number().min(0).max(1).optional(),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  
  // Fill properties
  fillColor: z.string().optional(),
  fillOpacity: z.number().min(0).max(1).optional(),
  
  // Hand-drawn / Sketch properties
  roughness: z.number().min(0).max(5).optional(),   // Hand-drawn imperfection level
  smoothing: z.number().min(0).max(1).optional(),   // Jitter reduction level
  seed: z.union([z.number(), z.string()]).optional(), // Deterministic seed
  
  // Geometry & Shadows
  cornerRadius: z.number().optional(),
  shadow: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
  
  // Arrowheads for lines/connectors
  startArrowhead: ZCanvasArrowheadTypeSchema.optional(),
  endArrowhead: ZCanvasArrowheadTypeSchema.optional(),
  
  // Typography overrides
  fontFamily: z.enum(['sans', 'mono', 'serif', 'handwriting']).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  textColor: z.string().optional(),
});
export type ZCanvasAppearanceProperties = z.infer<typeof ZCanvasAppearancePropertiesSchema>;

export type ZCanvasStrokeStyle = NonNullable<ZCanvasAppearanceProperties['strokeStyle']>;

/**
 * Organic hand-drawn sloppiness levels:
 * - 'architectural' (roughness: 0) — clean, precise straight geometry
 * - 'artist'        (roughness: 1.4) — subtle organic hand-drawn variation
 * - 'cartoonist'   (roughness: 2.5) — expressive, highly imperfect hand-drawn lines
 */
export const ZCanvasSloppinessSchema = z.enum([
  'architectural',
  'artist',
  'cartoonist',
]);
export type ZCanvasSloppiness = z.infer<typeof ZCanvasSloppinessSchema>;

export const SLOPPINESS_LEVELS: Record<
  ZCanvasSloppiness,
  { roughness: number; label: string; description: string }
> = {
  architectural: { roughness: 0, label: 'Architectural', description: 'Clean, precise & straight lines' },
  artist: { roughness: 1.4, label: 'Artist', description: 'Organic subtle hand-drawn sketch' },
  cartoonist: { roughness: 2.5, label: 'Cartoonist', description: 'Expressive and loose imperfect lines' },
};

/** Convert a roughness float value to the closest matching sloppiness preset. */
export function roughnessToSloppiness(roughness?: number): ZCanvasSloppiness {
  if (roughness === undefined || roughness <= 0.2) return 'architectural';
  if (roughness <= 1.8) return 'artist';
  return 'cartoonist';
}

/**
 * SVG `stroke-dasharray` pattern for a border/line stroke style, scaled by the
 * stroke width so dashes stay proportional as a border gets thicker. Returns
 * `undefined` for a solid stroke.
 *
 * HTML borders use the CSS `border-style` instead; this is for SVG geometry
 * (shapes, connectors and exports) where no native dash style exists.
 */
export function getStrokeDashArray(
  style: ZCanvasStrokeStyle | undefined,
  width = 2
): string | undefined {
  if (style === 'dashed') return `${Math.max(4, width * 3)} ${Math.max(3, width * 2)}`;
  if (style === 'dotted') return `${Math.max(1, width)} ${Math.max(2, width * 2)}`;
  return undefined;
}

/**
 * Returns `color` with its alpha replaced by `opacity` (0..1).
 *
 * Accepts `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` and `transparent`.
 * Unparseable colours (named CSS colours, gradients, `var(--x)`) are returned
 * unchanged, because guessing would silently change the user's colour.
 *
 * `undefined` passes straight through so callers can forward it to a style
 * property. Opacity is clamped to 0..1. `#rgb` expands to its full hex form and
 * `#rrggbbaa` has its alpha *replaced* rather than multiplied. The output is
 * always `rgba(r, g, b, a)` with `a` rounded to three decimals, except an
 * opaque `#rrggbb` — the common no-op — which is returned byte-identical so
 * snapshots and diffs stay clean.
 */
export function withOpacity(color: string, opacity: number): string;
export function withOpacity(color: string | undefined, opacity: number): string | undefined;
export function withOpacity(color: string | undefined, opacity: number): string | undefined {
  if (color === undefined) return undefined;

  // Already fully transparent: the caller's intent is "no fill", so the
  // requested opacity must not make it visible.
  if (color === 'transparent') return 'rgba(0, 0, 0, 0)';

  const clamped = Math.min(1, Math.max(0, opacity));
  const alpha = Math.round(clamped * 1000) / 1000;

  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(color);
  if (hex) {
    const digits = hex[1];
    const expanded =
      digits.length === 3
        ? digits
            .split('')
            .map((digit) => digit + digit)
            .join('')
        : digits;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);

    // An opaque 6-digit hex is the common no-op: keep it byte-identical. A
    // 3-digit shorthand is *not* the identity case — it still gains its alpha.
    if (digits.length === 6 && clamped >= 1) return color;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const rgb = /^rgba?\(\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)\s*(?:,\s*([^,\s]+)\s*)?\)$/.exec(
    color
  );
  if (rgb) {
    // Channels are re-emitted verbatim so a percentage or fractional channel
    // survives the round-trip untouched.
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }

  return color;
}

/**
 * The alpha a colour carries in its own encoding, or `undefined` when it is
 * fully opaque. `#rrggbbaa` and `rgba()` report their alpha; `#rgb`, `#rrggbb`,
 * `rgb()` and named colours are opaque.
 */
export function colorAlpha(color: string): number | undefined {
  if (color === 'transparent') return 0;

  const hex = /^#([0-9a-fA-F]{8})$/.exec(color);
  if (hex) return parseInt(hex[1].slice(6, 8), 16) / 255;

  const rgba = /^rgba\(\s*[^,\s]+\s*,\s*[^,\s]+\s*,\s*[^,\s]+\s*,\s*([^,\s]+)\s*\)$/.exec(color);
  if (rgba) {
    const alpha = Number(rgba[1]);
    return Number.isFinite(alpha) ? alpha : undefined;
  }

  return undefined;
}

/**
 * The colour of newly drawn ink and connectors. Shapes and components take
 * their colour from the theme instead, so this only covers freehand strokes and
 * fresh edges, both of which the user can recolour afterwards in the style
 * panel.
 */
export const DEFAULT_DRAW_COLOR = '#635BFF';

/** Node kinds that carry a themed default appearance. */
export type ZCanvasFillKind =
  | 'card'
  | 'table'
  | 'container'
  | 'frame'
  | 'rectangle'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'cylinder'
  | 'cloud'
  | 'document'
  | 'parallelogram'
  | 'hexagon'
  | 'subroutine'
  | 'text'
  | 'svg';

/** A semantic diagram colour family. */
export type ZCanvasColorFamily =
  | 'neutral'
  | 'blue'
  | 'violet'
  | 'teal'
  | 'green'
  | 'amber'
  | 'rose';

/**
 * Semantic diagram colours from the Diagramz design system. Shapes never
 * hardcode raw hex values — they name a family and read the token for the
 * current theme, so light and dark stay in step.
 */
export const DIAGRAM_COLORS: Record<
  ZCanvasColorFamily,
  {
    light: { background: string; border: string; text: string };
    dark: { background: string; border: string; text: string };
  }
> = {
  neutral: {
    light: { background: '#F1F1ED', border: '#C9C9C0', text: '#202124' },
    dark: { background: '#32333A', border: '#4A4B54', text: '#ECECF0' },
  },
  blue: {
    light: { background: '#E8F1FF', border: '#9ABCF5', text: '#244B8A' },
    dark: { background: '#202E45', border: '#3E5F91', text: '#BBD4FF' },
  },
  violet: {
    light: { background: '#EEEDFF', border: '#B9B3FF', text: '#5148A8' },
    dark: { background: '#302E4B', border: '#625BA8', text: '#D1CCFF' },
  },
  teal: {
    light: { background: '#E1F5F1', border: '#8CCFC2', text: '#17685B' },
    dark: { background: '#1D3735', border: '#397D72', text: '#A8E5D9' },
  },
  green: {
    light: { background: '#E8F5E8', border: '#A4D0A2', text: '#28612D' },
    dark: { background: '#243828', border: '#4D8052', text: '#BDE8BE' },
  },
  amber: {
    light: { background: '#FFF3D8', border: '#E8C779', text: '#7A5110' },
    dark: { background: '#403321', border: '#8D6D35', text: '#F6D99A' },
  },
  rose: {
    light: { background: '#FCE8EC', border: '#E6A5B2', text: '#8C3045' },
    dark: { background: '#42272F', border: '#8D4D5D', text: '#F4BBC7' },
  },
};

/**
 * The default appearance of each node kind, as a colour family plus how
 * see-through its background sits over the canvas.
 *
 * This is the single source of truth for "what a freshly created shape looks
 * like" and "what Reset restores": a node with no per-node overrides renders
 * from these tokens, and `resetNodeStyle` simply deletes the overrides — so
 * creation and reset can never drift apart.
 */
export const NODE_DEFAULT_APPEARANCE: Record<
  ZCanvasFillKind,
  { family: ZCanvasColorFamily; fillAlpha: number }
> = {
  card: { family: 'blue', fillAlpha: 0.5 },
  table: { family: 'teal', fillAlpha: 0.5 },
  container: { family: 'violet', fillAlpha: 0.3 },
  frame: { family: 'neutral', fillAlpha: 0.04 },
  rectangle: { family: 'blue', fillAlpha: 0.5 },
  circle: { family: 'blue', fillAlpha: 0.5 },
  diamond: { family: 'amber', fillAlpha: 0.5 },
  triangle: { family: 'green', fillAlpha: 0.5 },
  cylinder: { family: 'teal', fillAlpha: 0.5 },
  cloud: { family: 'blue', fillAlpha: 0.25 },
  document: { family: 'amber', fillAlpha: 0.5 },
  parallelogram: { family: 'blue', fillAlpha: 0.5 },
  hexagon: { family: 'violet', fillAlpha: 0.5 },
  subroutine: { family: 'teal', fillAlpha: 0.5 },
  text: { family: 'neutral', fillAlpha: 1 },
  svg: { family: 'neutral', fillAlpha: 0 },
};

/** The semantic tokens for a node kind in the current theme. */
export function nodeDefaultTokens(
  kind: ZCanvasFillKind,
  isDark: boolean
): { background: string; border: string; text: string } {
  const { family } = NODE_DEFAULT_APPEARANCE[kind];
  return DIAGRAM_COLORS[family][isDark ? 'dark' : 'light'];
}

/** The themed border colour for a node kind. */
export function resolveNodeStroke(kind: ZCanvasFillKind, isDark: boolean): string {
  return nodeDefaultTokens(kind, isDark).border;
}

/**
 * Drops any alpha a colour carries in its own encoding, so it can be paired
 * with a separately stated opacity without the two multiplying. `#rrggbbaa`
 * loses its last byte, `rgba()` becomes `rgb()`; everything else is already
 * opaque and passes through unchanged.
 */
function stripAlpha(color: string): string {
  const hex = /^#([0-9a-fA-F]{8})$/.exec(color);
  if (hex) return `#${hex[1].slice(0, 6)}`;

  const rgba = /^rgba\(\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*[^,\s]+\s*\)$/.exec(color);
  if (rgba) return `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;

  return color;
}

/**
 * The background a node is painted with, as a colour and an opacity stated
 * separately. A user-set opacity always wins over the colour's own alpha and
 * over the default's own alpha.
 *
 * SVG cannot express `rgba()` in every renderer, so an exporter needs the two
 * halves apart to emit `fill` and `fill-opacity`; HTML takes the joined form
 * from `resolveNodeFill`. Both read this one function, so the canvas and an
 * export can never disagree about what colour a node is.
 */
export function resolveNodeFillParts(
  kind: ZCanvasFillKind,
  isDark: boolean,
  fill: string | undefined,
  fillOpacity: number | undefined
): { color: string; opacity: number } {
  if (fill === undefined) {
    const { fillAlpha } = NODE_DEFAULT_APPEARANCE[kind];
    return {
      color: nodeDefaultTokens(kind, isDark).background,
      opacity: fillOpacity ?? fillAlpha,
    };
  }

  // A fill may carry its own alpha — a legacy document stored tints as
  // `#rrggbbaa`. Honour that rather than treating every fill as opaque, which
  // would paint a solid saturated bar where a translucent wash belongs.
  return {
    color: stripAlpha(fill),
    opacity: fillOpacity ?? colorAlpha(fill) ?? 1,
  };
}

/**
 * The CSS background for a node: the user's fill at the user's opacity, or the
 * themed default tint when no fill has been chosen.
 */
export function resolveNodeFill(
  kind: ZCanvasFillKind,
  isDark: boolean,
  fill: string | undefined,
  fillOpacity: number | undefined
): string {
  const { color, opacity } = resolveNodeFillParts(kind, isDark, fill, fillOpacity);
  return withOpacity(color, opacity);
}

/**
 * Pre-defined Freehand Nib Presets.
 *
 * Each preset describes the *nib* — how wide it is, how closely it follows the
 * pointer, and how much it thins at the ends of a stroke. How far the line
 * wanders from the path the hand took is not the nib's business: that is the
 * pen's sloppiness, chosen separately.
 *
 * `smoothing` is the distance, in tenths of the smoother's maximum reach in
 * canvas pixels, that each sample is averaged over — so 0.8 is an 8px window.
 * Measured in pixels rather than in samples, a nib tracks the hand the same way
 * whatever rate the pointer reports at. The nibs sit at 6–9px because that is
 * where a window stops paying: an 8px window takes 60–90% of a shaky hand's
 * tremor out at the sampling rates a mouse and a stylus actually produce, while
 * pulling even a tight 8px letter loop off its path by about a pixel. Past
 * ~14px the loops visibly squash.
 *
 * Every nib is blunt (`taper: 0`). A tapered nib is a brush: it thins the last
 * stretch of every mark, so at handwriting sizes — a 3px nib, a 40px letter —
 * more than half of each letter is thinned, and the writing reads as blobby
 * rather than as written. Freehand drawing is blunt for the same reason.
 */
export const STROKE_PRESETS: Record<
  ZCanvasStrokePreset,
  { width: number; smoothing: number; taper: number }
> = {
  precise: { width: 2, smoothing: 0.9, taper: 0 },
  natural: { width: 3, smoothing: 0.8, taper: 0 },
  sketch: { width: 2.5, smoothing: 0.6, taper: 0 },
  marker: { width: 6, smoothing: 0.8, taper: 0 },
};

/**
 * What the freehand pen will draw next.
 *
 * These are *tool* settings, not document state: a stroke copies them at the
 * moment it is drawn. Restyling the pen therefore never rewrites ink that is
 * already on the canvas.
 */
export interface ZCanvasPenStyle {
  /** Ink colour. */
  color: string;
  /** Nib character: width, how closely it tracks, and how it tapers. */
  preset: ZCanvasStrokePreset;
  /** How far the line wanders off the path the hand took. */
  sloppiness: ZCanvasSloppiness;
  /** Dash pattern of the ink. */
  strokeStyle: ZCanvasStrokeStyle;
  /** Ink alpha, 0..1. */
  opacity: number;
}

/**
 * The pen as it arrives: a mid-weight solid line in the library's drawing
 * colour, drawn cleanly.
 */
export const DEFAULT_PEN_STYLE: ZCanvasPenStyle = {
  color: DEFAULT_DRAW_COLOR,
  preset: 'natural',
  sloppiness: 'architectural',
  strokeStyle: 'solid',
  opacity: 1,
};

/** The nib width a pen style draws with, in canvas pixels. */
export function penStrokeWidth(style: Pick<ZCanvasPenStyle, 'preset'>): number {
  return (STROKE_PRESETS[style.preset] ?? STROKE_PRESETS.natural).width;
}

/**
 * The whole nib a pen style draws with, as the ink renderer wants it: width,
 * smoothing and taper from the preset, roughness from the sloppiness level.
 *
 * One function, so the panel's previews and the ink that lands on the canvas
 * are describing the same pen.
 */
export function penInkGeometry(
  style: Pick<ZCanvasPenStyle, 'preset' | 'sloppiness'>
): { width: number; smoothing: number; roughness: number; taper: number } {
  const nib = STROKE_PRESETS[style.preset] ?? STROKE_PRESETS.natural;
  const roughness = SLOPPINESS_LEVELS[style.sloppiness] ?? SLOPPINESS_LEVELS.architectural;

  return {
    width: nib.width,
    smoothing: nib.smoothing,
    taper: nib.taper,
    roughness: roughness.roughness,
  };
}

/**
 * The nib a stroke of a given width looks like it was drawn with.
 *
 * Ink written before the nib's name was stored — or written by another editor —
 * still has a width, and the width is the visible half of a nib. Matching it to
 * the nearest preset lets the panel show which chip is in effect instead of
 * leaving the whole row unpressed.
 */
function presetForWidth(width: number | undefined): ZCanvasStrokePreset {
  if (!width) return 'natural';

  let best: ZCanvasStrokePreset = 'natural';
  let bestDistance = Infinity;

  for (const preset of ZCanvasStrokePresetSchema.options) {
    const distance = Math.abs(STROKE_PRESETS[preset].width - width);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = preset;
    }
  }

  return best;
}

/** A stroke, as the pen settings that would draw it again. */
export function strokeToPenStyle(
  stroke: Pick<
    ZCanvasDrawingStroke,
    'color' | 'width' | 'roughness' | 'strokeStyle' | 'opacity' | 'preset'
  >
): ZCanvasPenStyle {
  const preset = ZCanvasStrokePresetSchema.safeParse(stroke.preset).success
    ? (stroke.preset as ZCanvasStrokePreset)
    : presetForWidth(stroke.width);

  return {
    color: stroke.color,
    preset,
    sloppiness: roughnessToSloppiness(stroke.roughness),
    strokeStyle: stroke.strokeStyle ?? 'solid',
    opacity: stroke.opacity ?? 1,
  };
}

/**
 * A pen-style patch applied to ink that is already on the canvas.
 *
 * A patch that names a nib or a sloppiness level rewrites the whole nib —
 * width, tracking, taper and wander — because those four are what a nib *is*,
 * and letting a user pick a marker and keep a fine pen's width would describe a
 * nib that does not exist. A patch that only names a colour, a dash or an
 * opacity leaves the geometry exactly as it was drawn, so restyling ink never
 * quietly redraws it.
 */
export function applyPenStyleToStroke<T extends ZCanvasDrawingStroke>(
  stroke: T,
  patch: Partial<ZCanvasPenStyle>
): T {
  const next: ZCanvasPenStyle = { ...strokeToPenStyle(stroke), ...patch };
  const redrawsNib = patch.preset !== undefined || patch.sloppiness !== undefined;

  return {
    ...stroke,
    color: next.color,
    opacity: next.opacity,
    strokeStyle: next.strokeStyle,
    ...(redrawsNib
      ? { preset: next.preset, ...penInkGeometry(next) }
      : null),
  };
}

/**
 * The faintest ink the pen will draw. Not zero: invisible ink reads as a
 * broken pen rather than as a deliberate 0% opacity.
 */
export const PEN_MIN_OPACITY = 0.1;

/**
 * Document & Canvas Style Theme Families
 */
export const STYLE_FAMILY_DEFAULTS: Record<
  ZCanvasStylePreset,
  {
    roughness: number;
    cornerRadius: number;
    fontFamily: 'sans' | 'mono' | 'serif' | 'handwriting';
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    shadow: boolean;
  }
> = {
  clean: {
    roughness: 0,
    cornerRadius: 8,
    fontFamily: 'sans',
    strokeStyle: 'solid',
    shadow: false,
  },
  sketch: {
    roughness: 1.6,
    cornerRadius: 4,
    fontFamily: 'handwriting',
    strokeStyle: 'solid',
    shadow: false,
  },
  soft: {
    roughness: 0,
    cornerRadius: 16,
    fontFamily: 'sans',
    strokeStyle: 'solid',
    shadow: true,
  },
  technical: {
    roughness: 0,
    cornerRadius: 2,
    fontFamily: 'mono',
    strokeStyle: 'solid',
    shadow: false,
  },
};
