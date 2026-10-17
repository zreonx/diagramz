/**
 * Measuring the box a stencil's artwork actually paints in.
 *
 * Artwork is authored on a grid — architecture fragments on a 0..100 square, a
 * tech logo on a 24×24 one — and the caller scales that grid into a node. The
 * grid is not the drawing, though: `arch-cloud-disk` paints between 18.75 and
 * 81.25 of its square, so two fifths of the node it lands in is margin. Worse,
 * the margin is a fraction of the grid, so it grows with every resize.
 *
 * A stencil that knows the box it paints in can say so, and everything
 * downstream gets it right for free: the canvas scales the tight box onto the
 * node, the tile stops showing a shrunken glyph, and a drop can take the
 * artwork's own aspect ratio instead of the grid's.
 *
 * Reading that box back out of the markup is what this module does. It is a
 * pure function of the string — no DOM, no canvas, no font — so the exporter
 * (Node) and the canvas (browser) measure identically, which is the same
 * bargain {@link StencilDefinition.render} already makes.
 */

import type { StencilViewBox } from './types';

/** A rectangle being accumulated, in the artwork's own coordinates. */
interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A point in the artwork's own coordinates. */
interface Point {
  x: number;
  y: number;
}

function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function includePoint(bounds: Bounds, x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < bounds.minX) bounds.minX = x;
  if (y < bounds.minY) bounds.minY = y;
  if (x > bounds.maxX) bounds.maxX = x;
  if (y > bounds.maxY) bounds.maxY = y;
}

/** Whether nothing has been included, or only a degenerate point has. */
function isEmpty(bounds: Bounds): boolean {
  return !(bounds.maxX >= bounds.minX) || !(bounds.maxY >= bounds.minY);
}

/**
 * Tags, opening or closing, with their attribute text and their self-closing
 * slash.
 *
 * The attribute half matches quoted runs before bare characters so a `>` inside
 * a colour or a path cannot end the tag early. Comments and the XML declaration
 * never match: neither draws anything.
 */
const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

/** Shapes and references: children can never be nested inside them. */
const LEAF_ELEMENTS = new Set([
  'rect',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'path',
  'image',
  'use',
  'stop',
]);

/**
 * Elements that hold a definition rather than a drawing.
 *
 * Nothing inside one is painted until something references it, so measuring
 * their contents would put the box around ink that never reaches the screen —
 * which is how a fragment ends up with padding again. A drawing assembled from
 * `<use>` is the one thing this misses, and it measures as nothing rather than
 * wrongly, which leaves the caller on its default box.
 */
const HIDDEN_ELEMENTS = new Set([
  'defs',
  'symbol',
  'clippath',
  'mask',
  'pattern',
  'marker',
  'lineargradient',
  'radialgradient',
  'filter',
]);

/** One attribute, in either quoting style. */
const ATTRIBUTE_RE = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Every number in an attribute value, commas and whitespace included. */
const NUMBER_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/** Attributes of one element, keyed by their lower-cased name. */
function readAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  ATTRIBUTE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE_RE.exec(source)) !== null) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? '');
  }
  return attributes;
}

/** The numbers of an attribute value, in order. */
function readNumbers(value: string | undefined): number[] {
  if (!value) return [];
  const found: number[] = [];
  NUMBER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NUMBER_RE.exec(value)) !== null) {
    const parsed = Number(match[0]);
    if (Number.isFinite(parsed)) found.push(parsed);
  }
  return found;
}

/** A number attribute, or the fallback when it is absent or unusable. */
function readNumber(attributes: Map<string, string>, name: string, fallback = 0): number {
  const value = attributes.get(name);
  if (value === undefined) return fallback;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Paint a wrapping element passes down.
 *
 * `stroke` and `stroke-width` are presentation attributes, so they are inherited
 * by every descendant that does not state its own — `<g stroke="#000"
 * stroke-width="2">` paints its children. Measuring a fragment without that
 * would put its box inside its ink, and the box is used to scale the artwork, so
 * the stroke would be cropped rather than merely unaccounted for.
 */
interface PaintFrame {
  stroke?: string;
  strokeWidth?: string;
}

/** What an element at the top of the document inherits: nothing. */
const NO_PAINT: PaintFrame = {};

/** What an element hands to its children: its own paint over what it inherited. */
function childFrame(frame: PaintFrame, attributes: Map<string, string>): PaintFrame {
  const stroke = attributes.get('stroke');
  const strokeWidth = attributes.get('stroke-width');
  if (stroke === undefined && strokeWidth === undefined) return frame;
  return {
    stroke: stroke ?? frame.stroke,
    strokeWidth: strokeWidth ?? frame.strokeWidth,
  };
}

/**
 * How far a stroked element reaches beyond its own geometry.
 *
 * A stroke straddles the outline it follows, so half of it lies outside; a
 * round or square cap reaches the same half-width past an endpoint, and a round
 * join keeps a corner inside that too. That outer half is the bound worth
 * measuring — and it is what a person means by how big the drawing is, since an
 * unexpanded outline stops a hair short of the ink at every edge.
 *
 * `stroke-width` defaults to 1 wherever a stroke paint is set, which is SVG's
 * own rule, so an element that left the attribute out is not measured as bare —
 * and `stroke="none"` is the only way to say an element has no stroke at all,
 * both for the element itself and for a frame it inherits.
 */
function strokePadding(attributes: Map<string, string>, frame: PaintFrame): number {
  const stroke = attributes.get('stroke') ?? frame.stroke;
  if (stroke === undefined || stroke.trim() === 'none') return 0;

  const declared = attributes.get('stroke-width') ?? frame.strokeWidth;
  const parsed = declared === undefined ? NaN : Number(declared.trim());
  const width = Number.isFinite(parsed) ? parsed : 1;
  return width > 0 ? width / 2 : 0;
}

// ─── paths ──────────────────────────────────────────────────────────────────

/**
 * The extrema of one cubic segment, as parameters strictly inside (0, 1).
 *
 * `B'(t) = 3(1-t)²(p1-p0) + 6(1-t)t(p2-p1) + 3t²(p3-p2)` is a quadratic in `t`,
 * and a cubic is furthest from the line between its endpoints where that
 * quadratic is zero. So the box of a curve is its endpoints plus these points —
 * not the box of its control points, which is what a curve that overshoots
 * would otherwise be measured by.
 */
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
  const b = 6 * (p0 - 2 * p1 + p2);
  const c = 3 * (p1 - p0);
  const roots: number[] = [];

  const keep = (t: number) => {
    if (Number.isFinite(t) && t > 0 && t < 1) roots.push(t);
  };

  if (Math.abs(a) < 1e-12) {
    // A straight run: at most one interior extremum, and usually none.
    if (Math.abs(b) > 1e-12) keep(-c / b);
    return roots;
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return roots;

  const root = Math.sqrt(discriminant);
  keep((-b + root) / (2 * a));
  keep((-b - root) / (2 * a));
  return roots;
}

/** One coordinate of a cubic at `t`. */
function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** One coordinate of a quadratic at `t`. */
function quadraticAt(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/** Adds a cubic segment's extent to `bounds`, extrema included. */
function includeCubic(bounds: Bounds, p0: Point, p1: Point, p2: Point, p3: Point): void {
  includePoint(bounds, p0.x, p0.y);
  includePoint(bounds, p3.x, p3.y);

  for (const t of cubicExtrema(p0.x, p1.x, p2.x, p3.x)) {
    includePoint(bounds, cubicAt(p0.x, p1.x, p2.x, p3.x, t), cubicAt(p0.y, p1.y, p2.y, p3.y, t));
  }
  for (const t of cubicExtrema(p0.y, p1.y, p2.y, p3.y)) {
    includePoint(bounds, cubicAt(p0.x, p1.x, p2.x, p3.x, t), cubicAt(p0.y, p1.y, p2.y, p3.y, t));
  }
}

/** The parameters strictly inside (0, 1) where one axis of a quadratic turns. */
function quadraticExtrema(p0: number, p1: number, p2: number): number[] {
  const denominator = p0 - 2 * p1 + p2;
  if (Math.abs(denominator) < 1e-12) return [];
  const t = (p0 - p1) / denominator;
  return t > 0 && t < 1 ? [t] : [];
}

/** Adds a quadratic segment's extent to `bounds`, its single extremum included. */
function includeQuadratic(bounds: Bounds, p0: Point, p1: Point, p2: Point): void {
  includePoint(bounds, p0.x, p0.y);
  includePoint(bounds, p2.x, p2.y);

  for (const t of [...quadraticExtrema(p0.x, p1.x, p2.x), ...quadraticExtrema(p0.y, p1.y, p2.y)]) {
    includePoint(bounds, quadraticAt(p0.x, p1.x, p2.x, t), quadraticAt(p0.y, p1.y, p2.y, t));
  }
}

/**
 * Adds an elliptical arc's extent to `bounds`.
 *
 * SVG states an arc by its endpoints, so the curve's own extremes are written
 * down nowhere and have to be recovered: the endpoint form is converted to a
 * centre, two radii and two angles (SVG 1.1, F.6.5), and the four points where
 * an ellipse is furthest along an axis — its cardinal angles — are tested for
 * lying inside the swept span. An arc that reaches none of them is bounded by
 * its endpoints, which are included first.
 */
function includeArc(
  bounds: Bounds,
  from: Point,
  to: Point,
  rx: number,
  ry: number,
  rotationDegrees: number,
  largeArc: boolean,
  sweep: boolean
): void {
  includePoint(bounds, from.x, from.y);
  includePoint(bounds, to.x, to.y);

  let radiusX = Math.abs(rx);
  let radiusY = Math.abs(ry);
  // A zero radius is the grammar's way of writing a straight line.
  if (radiusX === 0 || radiusY === 0) return;

  const phi = (rotationDegrees * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const startX = cosPhi * dx + sinPhi * dy;
  const startY = -sinPhi * dx + cosPhi * dy;

  // Radii too small to span the endpoints are scaled up until they just do,
  // which is what a renderer does with them.
  const lambda = (startX * startX) / (radiusX * radiusX) + (startY * startY) / (radiusY * radiusY);
  if (lambda > 1) {
    const grow = Math.sqrt(lambda);
    radiusX *= grow;
    radiusY *= grow;
  }

  const squared = radiusX * radiusX * startY * startY + radiusY * radiusY * startX * startX;
  const numerator =
    radiusX * radiusX * radiusY * radiusY - radiusX * radiusX * startY * startY - radiusY * radiusY * startX * startX;
  const factor = squared === 0 ? 0 : Math.sqrt(Math.max(0, numerator / squared));
  const sign = largeArc === sweep ? -1 : 1;

  const centreX = sign * factor * ((radiusX * startY) / radiusY);
  const centreY = sign * factor * (-(radiusY * startX) / radiusX);

  const cx = cosPhi * centreX - sinPhi * centreY + (from.x + to.x) / 2;
  const cy = sinPhi * centreX + cosPhi * centreY + (from.y + to.y) / 2;

  const startAngle = Math.atan2((startY - centreY) / radiusY, (startX - centreX) / radiusX);
  const endAngle = Math.atan2((-startY - centreY) / radiusY, (-startX - centreX) / radiusX);

  let swept = endAngle - startAngle;
  if (!sweep && swept > 0) swept -= 2 * Math.PI;
  if (sweep && swept < 0) swept += 2 * Math.PI;

  for (let quadrant = 0; quadrant < 4; quadrant += 1) {
    const angle = (quadrant * Math.PI) / 2;
    // How far into the sweep this cardinal angle lies, counted from the start
    // and wrapped into one turn.
    let progress = (angle - startAngle) % (2 * Math.PI);
    if (progress < 0) progress += 2 * Math.PI;

    const within = swept >= 0 ? progress <= swept : progress >= 2 * Math.PI + swept;
    if (!within) continue;

    includePoint(
      bounds,
      cx + radiusX * Math.cos(angle) * cosPhi - radiusY * Math.sin(angle) * sinPhi,
      cy + radiusX * Math.cos(angle) * sinPhi + radiusY * Math.sin(angle) * cosPhi
    );
  }
}

/**
 * A cursor over one `d` attribute.
 *
 * Positional rather than split-and-count: an arc's two flags may be written
 * without separators (`a5 5 0 0110 10` is legal path data), so they are read
 * one character at a time while every other parameter is read as a number.
 */
interface PathScanner {
  readCommand(): string | null;
  readNumber(): number;
  readFlag(): boolean;
  done(): boolean;
}

function createPathScanner(d: string): PathScanner {
  let index = 0;

  const skipSeparators = () => {
    while (index < d.length && (d[index] === ',' || /\s/.test(d[index]))) index += 1;
  };

  const readNumber = (): number => {
    skipSeparators();
    const start = index;
    if (d[index] === '+' || d[index] === '-') index += 1;
    while (index < d.length && d[index] >= '0' && d[index] <= '9') index += 1;
    if (d[index] === '.') {
      index += 1;
      while (index < d.length && d[index] >= '0' && d[index] <= '9') index += 1;
    }
    if (d[index] === 'e' || d[index] === 'E') {
      const beforeExponent = index;
      index += 1;
      if (d[index] === '+' || d[index] === '-') index += 1;
      if (d[index] >= '0' && d[index] <= '9') {
        while (index < d.length && d[index] >= '0' && d[index] <= '9') index += 1;
      } else {
        // Not an exponent after all: put back what was only guessed at.
        index = beforeExponent;
      }
    }
    const parsed = Number(d.slice(start, index));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    done() {
      skipSeparators();
      return index >= d.length;
    },

    readCommand() {
      skipSeparators();
      const character = d[index];
      if (character && /[a-zA-Z]/.test(character)) {
        index += 1;
        return character;
      }
      return null;
    },

    readNumber,

    readFlag() {
      skipSeparators();
      const character = d[index];
      if (character === '0' || character === '1') {
        index += 1;
        return character === '1';
      }
      // A flag written as a longer number is still unambiguous at its leading
      // digit; anything else is malformed, and reading it as a number would
      // silently swallow the parameter after it.
      return readNumber() !== 0;
    },
  };
}

/**
 * The box a `d` attribute draws in.
 *
 * Written out rather than approximated because a stencil's whole box can be
 * decided by one bulging curve, and because this has to agree with what a
 * renderer paints. Every command in the SVG path grammar is understood, in both
 * its absolute and relative form, including the smooth continuations whose
 * control point is reflected from the previous segment.
 *
 * @throws if the data holds a command the grammar does not have — a typo in an
 * artwork fragment, which is worth failing loudly on rather than measuring
 * wrongly and shipping a stencil that is cropped or off-centre.
 */
function pathBounds(d: string): Bounds {
  const bounds = emptyBounds();
  const scanner = createPathScanner(d);

  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };
  /** The last cubic control point, for the reflection a following `S` makes. */
  let lastCubicControl: Point | null = null;
  /** The last quadratic control point, for the reflection a following `T` makes. */
  let lastQuadraticControl: Point | null = null;
  let command = '';

  while (!scanner.done()) {
    const read = scanner.readCommand();
    if (read) command = read;
    else if (!command) throw new Error(`Path data starts without a command: ${d}`);

    const upper = command.toUpperCase();
    const relative = command !== upper;
    const point = (x: number, y: number): Point =>
      relative ? { x: current.x + x, y: current.y + y } : { x, y };

    // A smooth continuation reflects the previous control point, or falls back
    // to the current point when the previous segment was of another kind —
    // which is what the grammar prescribes.
    const reflect = (control: Point | null): Point =>
      control ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y } : current;

    switch (upper) {
      case 'M': {
        const next = point(scanner.readNumber(), scanner.readNumber());
        current = next;
        subpathStart = next;
        includePoint(bounds, next.x, next.y);
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }

      case 'L': {
        const next = point(scanner.readNumber(), scanner.readNumber());
        includePoint(bounds, next.x, next.y);
        current = next;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }

      case 'H': {
        const x = point(scanner.readNumber(), 0).x;
        includePoint(bounds, x, current.y);
        current = { x, y: current.y };
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }

      case 'V': {
        const y = point(0, scanner.readNumber()).y;
        includePoint(bounds, current.x, y);
        current = { x: current.x, y };
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }

      case 'C': {
        const control1 = point(scanner.readNumber(), scanner.readNumber());
        const control2 = point(scanner.readNumber(), scanner.readNumber());
        const end = point(scanner.readNumber(), scanner.readNumber());
        includeCubic(bounds, current, control1, control2, end);
        lastCubicControl = control2;
        lastQuadraticControl = null;
        current = end;
        break;
      }

      case 'S': {
        const control2 = point(scanner.readNumber(), scanner.readNumber());
        const end = point(scanner.readNumber(), scanner.readNumber());
        includeCubic(bounds, current, reflect(lastCubicControl), control2, end);
        lastCubicControl = control2;
        lastQuadraticControl = null;
        current = end;
        break;
      }

      case 'Q': {
        const control = point(scanner.readNumber(), scanner.readNumber());
        const end = point(scanner.readNumber(), scanner.readNumber());
        includeQuadratic(bounds, current, control, end);
        lastQuadraticControl = control;
        lastCubicControl = null;
        current = end;
        break;
      }

      case 'T': {
        const end = point(scanner.readNumber(), scanner.readNumber());
        const control = reflect(lastQuadraticControl);
        includeQuadratic(bounds, current, control, end);
        lastQuadraticControl = control;
        lastCubicControl = null;
        current = end;
        break;
      }

      case 'A': {
        const rx = scanner.readNumber();
        const ry = scanner.readNumber();
        const rotation = scanner.readNumber();
        const largeArc = scanner.readFlag();
        const sweep = scanner.readFlag();
        const end = point(scanner.readNumber(), scanner.readNumber());
        includeArc(bounds, current, end, rx, ry, rotation, largeArc, sweep);
        current = end;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }

      case 'Z': {
        includePoint(bounds, subpathStart.x, subpathStart.y);
        current = subpathStart;
        lastCubicControl = null;
        lastQuadraticControl = null;
        break;
      }

      default:
        throw new Error(`Unsupported path command "${command}" in: ${d}`);
    }

    // After a moveto, parameters that follow without a new command letter are
    // linetos. Rewriting it here rather than on the way in is what keeps the
    // move itself a move: the first pair of an `M` sets the subpath's start.
    if (upper === 'M') command = command === 'M' ? 'L' : 'l';
  }

  return bounds;
}

/**
 * The box a `<text>` element covers.
 *
 * An approximation, and the only one in this module: without a font there is no
 * exact answer, so a glyph is taken as 0.6 of the font size wide and the em box
 * as the font size tall, honouring `text-anchor` and `dominant-baseline`. That
 * is close enough for a view box — no built-in stencil's box is decided by its
 * text, which `builtin.test.mjs` asserts — and treating text as measuring
 * nothing would be worse: a fragment whose label reached past its frame would
 * then be scaled until the label ran off the node.
 */
function textBounds(attributes: Map<string, string>, content: string): Bounds {
  const bounds = emptyBounds();
  const x = readNumber(attributes, 'x');
  const y = readNumber(attributes, 'y');
  const size = readNumber(attributes, 'font-size', 16);

  const anchor = (attributes.get('text-anchor') ?? 'start').trim();
  const baseline = (attributes.get('dominant-baseline') ?? 'auto').trim();

  const width = content.trim().length * size * 0.6;
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  // `middle` centres the em box on the baseline coordinate; the default puts
  // the baseline there, so the box sits mostly above it.
  const top = baseline === 'middle' || baseline === 'central' ? y - size / 2 : y - size * 0.8;

  includePoint(bounds, left, top);
  includePoint(bounds, left + width, top + size);
  return bounds;
}

/** The geometry of one basic shape, before its stroke is added. */
function shapeBounds(
  tag: string,
  attributes: Map<string, string>,
  content: string
): Bounds | null {
  const bounds = emptyBounds();

  switch (tag) {
    case 'rect': {
      const x = readNumber(attributes, 'x');
      const y = readNumber(attributes, 'y');
      const width = readNumber(attributes, 'width');
      const height = readNumber(attributes, 'height');
      // `rx`/`ry` round the corners inwards and never past these four points.
      includePoint(bounds, x, y);
      includePoint(bounds, x + width, y + height);
      return bounds;
    }

    case 'circle': {
      const cx = readNumber(attributes, 'cx');
      const cy = readNumber(attributes, 'cy');
      const r = readNumber(attributes, 'r');
      includePoint(bounds, cx - r, cy - r);
      includePoint(bounds, cx + r, cy + r);
      return bounds;
    }

    case 'ellipse': {
      const cx = readNumber(attributes, 'cx');
      const cy = readNumber(attributes, 'cy');
      const rx = readNumber(attributes, 'rx');
      const ry = readNumber(attributes, 'ry');
      includePoint(bounds, cx - rx, cy - ry);
      includePoint(bounds, cx + rx, cy + ry);
      return bounds;
    }

    case 'line': {
      includePoint(bounds, readNumber(attributes, 'x1'), readNumber(attributes, 'y1'));
      includePoint(bounds, readNumber(attributes, 'x2'), readNumber(attributes, 'y2'));
      return bounds;
    }

    case 'polygon':
    case 'polyline': {
      const numbers = readNumbers(attributes.get('points'));
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        includePoint(bounds, numbers[i], numbers[i + 1]);
      }
      return bounds;
    }

    case 'path': {
      const d = attributes.get('d');
      return d ? pathBounds(d) : null;
    }

    case 'text': {
      return textBounds(attributes, content);
    }

    default:
      // `g`, `defs`, `title`, `desc`, `style`, `use`, and anything else the
      // fragments might grow: none of them is a shape, and a group carries no
      // geometry of its own.
      return null;
  }
}

/**
 * The box `markup` paints in, with every element's stroke included.
 *
 * Returns `null` for a fragment that draws no shape at all, which the caller
 * reads as "this stencil does not say" — the same state as one that never
 * declared a view box.
 */
export function measureArtwork(markup: string): StencilViewBox | null {
  const bounds = emptyBounds();
  let measured = false;

  // The paint each open element is handing down, and whether it is on a shelf
  // rather than on the page. An element is measured against the frame it
  // inherited and then extends it for its own children, which is why the frame
  // is advanced after the shape, not before.
  let paint: PaintFrame = NO_PAINT;
  let hidden = false;
  const open: { paint: PaintFrame; hidden: boolean }[] = [];

  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(markup)) !== null) {
    const tag = match[2].toLowerCase();

    if (match[1] === '/') {
      // Tolerant of an unbalanced close: art is hand-written, and stacking the
      // wrong frame would move a box silently, so an empty stack keeps the one
      // in hand rather than resetting to nothing.
      const previous = open.pop();
      if (previous) {
        paint = previous.paint;
        hidden = previous.hidden;
      }
      continue;
    }

    const attributes = readAttributes(match[3] ?? '');

    // A label is the one element whose extent depends on what it says, so its
    // content is read out of the document rather than out of its attributes.
    const content =
      tag === 'text'
        ? markup.slice(
            match.index + match[0].length,
            (() => {
              const close = markup.indexOf('</text>', match.index + match[0].length);
              return close === -1 ? match.index + match[0].length : close;
            })()
          )
        : '';

    const shape = hidden ? null : shapeBounds(tag, attributes, content);
    if (shape && !isEmpty(shape)) {
      const padding = strokePadding(attributes, paint);
      includePoint(bounds, shape.minX - padding, shape.minY - padding);
      includePoint(bounds, shape.maxX + padding, shape.maxY + padding);
      measured = true;
    }

    if (match[4] !== '/' && !LEAF_ELEMENTS.has(tag)) {
      open.push({ paint, hidden });
      paint = childFrame(paint, attributes);
      if (HIDDEN_ELEMENTS.has(tag)) hidden = true;
    }
  }

  if (!measured || isEmpty(bounds)) return null;

  // Two decimals: enough that no visible edge moves — a hundredth of the
  // authored square is a fraction of a pixel at any real size — and few enough
  // that the numbers read as authored rather than as floating-point noise.
  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    x: round(bounds.minX),
    y: round(bounds.minY),
    width: round(bounds.maxX - bounds.minX),
    height: round(bounds.maxY - bounds.minY),
  };
}
