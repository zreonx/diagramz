import type { ZCanvasDrawingStroke, ZCanvasPoint } from '../../core/schema';
import { getStrokeDashArray, type ZCanvasStrokeStyle } from '../../core/style-models';
import { getCatmullRomPath } from '../../geometry';
import { createSeededRandom, stringToSeed } from '../sketch/rough-svg';

/**
 * Ink — turning the raw pointer trail the pen collects into something that
 * looks drawn by a hand rather than plotted by a machine.
 *
 * Three things separate a drawn line from a plotted one, and all three are
 * modelled here:
 *
 *  1. **The trail is noisy.** A pointer reports its position every frame, and
 *     consecutive samples are a few pixels apart with a little tremor on top.
 *     Catmull-Rom through that raw trail is a shaky line. Streamlining averages
 *     each sample against its neighbours along the trail, which is what makes
 *     handwriting feel like a nib following the hand rather than a needle
 *     bolted to it — and, because the average is symmetric, the line still goes
 *     where the hand went.
 *  2. **A nib is a fixed width.** A pen that thins at its tips is a brush, and
 *     the presets ship blunt: tapering a 3px nib over the last stretch of every
 *     letter blobs handwriting. The taper survives as an option, because a
 *     document written with a tapered nib must go on rendering as one.
 *  3. **A hand is not exact.** Sloppiness wanders the line off the path the
 *     hand took, so a stroke looks drawn rather than traced — and the wander is
 *     seeded from the stroke's own id, so it is identical on every repaint
 *     instead of boiling.
 *
 * Everything here is pure: points in, geometry out. The canvas and the SVG/PNG
 * exporters both go through `resolveInkRender`, so what is exported is what was
 * drawn.
 */

/** Samples closer together than this are the pointer resting, not a movement. */
const MIN_SAMPLE_DISTANCE = 0.75;

/**
 * A hard ceiling on the trail. Only reachable by a stroke drawn for minutes on
 * end; it keeps one runaway gesture from producing a path the browser refuses
 * to paint.
 */
const MAX_SAMPLES = 2000;

/** How many points a round cap — or a dot — is sampled with. */
const CAP_STEPS = 12;

/**
 * No edge of an outline is painted longer than this. Short edges are what let a
 * polygon stand in for a curve: at this length the chord sits a fraction of a
 * pixel inside the curve, well under what any display can show.
 */
const MAX_OUTLINE_SEGMENT = 8;

/**
 * How the nib is described to the renderer. `taper` is 0 for a blunt nib that
 * starts and ends at full width, and 1 for a nib that thins to a point.
 */
export interface InkGeometry {
  /** Nib width in canvas pixels — the widest the stroke gets. */
  width: number;
  /** 0..1. How far along the trail each sample is averaged over, in tenths of
   * the smoother's maximum reach. Removes tremor without lagging the line. */
  smoothing: number;
  /** 0..5. How far the line wanders from the path the hand actually took. */
  roughness: number;
  /** 0..1. How much the stroke thins at each end. */
  taper: number;
}

/** A stroke, as far as its appearance is concerned. */
export type InkStroke = Pick<
  ZCanvasDrawingStroke,
  'id' | 'points' | 'color' | 'width' | 'smoothing' | 'roughness' | 'strokeStyle' | 'taper'
>;

/** The paint an ink stroke resolves to, in terms both renderers understand. */
export interface InkRender {
  /** The geometry to paint, or `''` for nothing at all. */
  d: string;
  /** The colour when the ink is a filled, tapered body; `none` when stroked. */
  fill: string;
  /** The colour when the ink is a stroked centreline; `none` when filled. */
  stroke: string;
  /** Nib width for a stroked centreline; 0 for filled ink. */
  strokeWidth: number;
  /** Dash pattern, when the nib is not solid. */
  strokeDasharray?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Distance between two points. */
function distance(a: ZCanvasPoint, b: ZCanvasPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Rounds to a tenth of a pixel: enough for smooth ink, small in a document. */
function quantise(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Drops samples the pointer did not really move for.
 *
 * A pointer resting still still reports new positions, and every one of them
 * would otherwise become a document point and two outline vertices.
 */
export function cleanPoints(
  points: ZCanvasPoint[],
  minDistance = MIN_SAMPLE_DISTANCE
): ZCanvasPoint[] {
  const kept: ZCanvasPoint[] = [];

  for (const point of points) {
    const previous = kept[kept.length - 1];
    if (!previous || distance(previous, point) >= minDistance) {
      kept.push({ x: point.x, y: point.y });
    }
  }

  // The stroke must end where the pointer was released, so the final position
  // always survives — otherwise a stroke ending in a tiny flick stops short of
  // the hand.
  const last = points[points.length - 1];
  if (last && kept.length > 0) {
    const tail = kept[kept.length - 1];
    if (tail.x !== last.x || tail.y !== last.y) {
      if (kept.length === 1) kept.push({ x: last.x, y: last.y });
      else kept[kept.length - 1] = { x: last.x, y: last.y };
    }
  }

  return kept;
}

/**
 * The longest stretch of trail, in canvas pixels, that smoothing will average
 * over at full strength. A window measured in pixels — rather than in samples —
 * is what makes a stroke look the same whether the pointer reported every 2px
 * or every 12px.
 */
const SMOOTHING_REACH = 10;

/** Below this the window holds nothing but the sample itself. */
const MIN_SMOOTHING_REACH = 0.5;

/**
 * Takes the tremor out of the trail without moving the line off the path the
 * hand took.
 *
 * Each sample is replaced by a Gaussian-weighted average of the samples within
 * `reach` pixels of it, measured along the trail. Averaging *neighbours* rather
 * than easing "towards" the newest sample is the whole point: a causal filter
 * can only ever lag, so a corner drawn at speed gets cut and a curve gets
 * systematically pulled off to one side. A symmetric window instead removes
 * what is faster than the hand (tremor) and leaves what the hand actually drew,
 * and it does the same thing at any pointer sampling rate.
 *
 * `smoothing` is how far, in tenths of `SMOOTHING_REACH` pixels, the average
 * reaches: 0 leaves the trail untouched, 0.7 averages a 7px window either side.
 * Both ends stay anchored exactly — a stroke has to begin and end under the
 * pointer, and an averaged endpoint would pull the stroke short of the hand.
 */
export function streamlinePoints(points: ZCanvasPoint[], smoothing: number): ZCanvasPoint[] {
  if (points.length < 3) return points.map((p) => ({ x: p.x, y: p.y }));

  const reach = clamp(smoothing, 0, 1) * SMOOTHING_REACH;
  if (reach < MIN_SMOOTHING_REACH) return points.map((p) => ({ x: p.x, y: p.y }));

  // Cumulative arc length: the window is a distance along the stroke, and a
  // sample's distance from another is measured the same way the nib travelled.
  const arc = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    arc[i] = arc[i - 1] + distance(points[i - 1], points[i]);
  }

  // σ = reach / 2, so a sample at the edge of the window still carries e^-2
  // (14%) of full weight: the trail fades in and out of the average instead of
  // meeting it at a seam.
  const sigma = reach / 2;
  const denominator = 2 * sigma * sigma;

  const out: ZCanvasPoint[] = [{ x: points[0].x, y: points[0].y }];

  for (let i = 1; i < points.length - 1; i++) {
    let weight = 0;
    let x = 0;
    let y = 0;

    // Arc length only grows, so the window is one run of samples: walk outwards
    // from the sample in both directions and stop at the reach. Typical ink has
    // a handful of samples in the window, not the whole trail.
    for (let j = i; j >= 0; j--) {
      const offset = arc[i] - arc[j];
      if (offset > reach) break;
      const w = Math.exp(-(offset * offset) / denominator);
      weight += w;
      x += points[j].x * w;
      y += points[j].y * w;
    }
    for (let j = i + 1; j < points.length; j++) {
      const offset = arc[j] - arc[i];
      if (offset > reach) break;
      const w = Math.exp(-(offset * offset) / denominator);
      weight += w;
      x += points[j].x * w;
      y += points[j].y * w;
    }

    out.push({ x: x / weight, y: y / weight });
  }

  const last = points[points.length - 1];
  out.push({ x: last.x, y: last.y });

  return out;
}

/**
 * Wanders the line off the exact path the hand took.
 *
 * The wander is a *walk*, not noise: each sample nudges the previous offset a
 * little further, so the line meanders the way graphite does. Independent
 * per-sample offsets would instead buzz — a hand-drawn line at 60 samples a
 * second has no room for that, and it reads as static rather than as texture.
 *
 * The offset is drawn from a seeded generator, so a stroke wanders the same way
 * on every repaint; a stroke that re-randomised itself each frame would visibly
 * boil. Both ends stay anchored: a stroke has to begin and end where the hand
 * did.
 */
export function roughenPoints(
  points: ZCanvasPoint[],
  roughness: number,
  seed: number | string
): ZCanvasPoint[] {
  if (roughness <= 0.05 || points.length < 3) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  const rand = createSeededRandom(typeof seed === 'string' ? stringToSeed(seed) : seed);
  // Scaled like the rough-shape outlines: 2.5 — the expressive "cartoonist"
  // level — reads as a line drawn by hand rather than by a plotter.
  const reach = roughness * 0.7;
  const step = reach * 0.3;

  let offsetX = 0;
  let offsetY = 0;
  const out: ZCanvasPoint[] = [];

  for (let index = 0; index < points.length; index++) {
    const point = points[index];

    if (index === 0 || index === points.length - 1) {
      out.push({ x: point.x, y: point.y });
      continue;
    }

    offsetX = clamp(offsetX + (rand() - 0.5) * step, -reach / 2, reach / 2);
    offsetY = clamp(offsetY + (rand() - 0.5) * step, -reach / 2, reach / 2);
    out.push({ x: point.x + offsetX, y: point.y + offsetY });
  }

  return out;
}

/** The full length of a trail, in canvas pixels. */
function trailLength(points: ZCanvasPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/**
 * The nib's radius at each point: full width through the body, thinning to the
 * tips so the stroke looks like it was laid down and lifted off.
 *
 * The taper scales with the stroke's own length, so a short flick does not
 * become all tip and no body.
 */
export function inkRadii(points: ZCanvasPoint[], geometry: InkGeometry): number[] {
  const base = Math.max(0.35, geometry.width / 2);
  const taper = clamp(geometry.taper, 0, 1);
  const total = trailLength(points);
  const taperLength = Math.min(24, total * 0.28);
  // Even a fully tapered nib keeps a little width, so the outline never closes
  // to a point it cannot be filled through.
  const tipWidth = 1 - taper * 0.8;

  const radii: number[] = [];
  let travelled = 0;

  for (let i = 0; i < points.length; i++) {
    if (i > 0) travelled += distance(points[i - 1], points[i]);

    let factor = 1;
    if (taperLength > 0.01) {
      const ease = (progress: number) => {
        const t = clamp(progress, 0, 1);
        return tipWidth + (1 - tipWidth) * t;
      };
      factor = Math.min(ease(travelled / taperLength), ease((total - travelled) / taperLength));
    }

    radii.push(base * factor);
  }

  return radii;
}

/**
 * The closed outline of a stroke: down one side, round the far cap, back up the
 * other, round the near cap.
 *
 * Both caps sweep the same way round — behind the direction of travel at the
 * start, ahead of it at the end — which is what makes them round rather than a
 * pair of folds.
 */
export function getInkOutline(points: ZCanvasPoint[], radii: number[]): ZCanvasPoint[] {
  if (points.length === 0) return [];
  // A tap of the pen is a dot, at full width: there is no body to taper to.
  if (points.length === 1) return arc(points[0], Math.max(0.35, radii[0]), 0, Math.PI * 2, 24).slice(0, -1);

  const normals = getNormals(points);
  const left: ZCanvasPoint[] = [];
  const right: ZCanvasPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    left.push({
      x: points[i].x + normals[i].x * radii[i],
      y: points[i].y + normals[i].y * radii[i],
    });
    right.push({
      x: points[i].x - normals[i].x * radii[i],
      y: points[i].y - normals[i].y * radii[i],
    });
  }

  const last = points.length - 1;
  const startAngle = Math.atan2(normals[0].y, normals[0].x);
  const endAngle = Math.atan2(normals[last].y, normals[last].x);

  // Forward along the left, round the front, back along the right, round the
  // back. The caps are sliced to drop the vertices the sides already supply.
  return [
    ...left,
    ...arc(points[last], radii[last], endAngle, endAngle - Math.PI, CAP_STEPS).slice(1, -1),
    ...right.reverse(),
    ...arc(points[0], radii[0], startAngle + Math.PI, startAngle, CAP_STEPS).slice(1, -1),
  ];
}

/**
 * A unit normal per point — the direction the nib's width is laid out along.
 *
 * A point's normal comes from the direction the line enters and leaves it, so a
 * corner does not fold: the width on the inside of the turn is carried round
 * with it.
 */
function getNormals(points: ZCanvasPoint[]): ZCanvasPoint[] {
  const normals: ZCanvasPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const previous = points[i - 1] ?? points[i];
    const next = points[i + 1] ?? points[i];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy);

    if (length < 1e-6) {
      // A doubled-back or stationary point: reuse the previous normal rather
      // than dividing by zero.
      normals.push(normals[normals.length - 1] ?? { x: 0, y: -1 });
    } else {
      normals.push({ x: -dy / length, y: dx / length });
    }
  }

  return normals;
}

/** Samples an arc of `centre` at `radius`, both ends included. */
function arc(
  centre: ZCanvasPoint,
  radius: number,
  from: number,
  to: number,
  steps: number
): ZCanvasPoint[] {
  const points: ZCanvasPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = from + ((to - from) * i) / steps;
    points.push({
      x: centre.x + Math.cos(angle) * radius,
      y: centre.y + Math.sin(angle) * radius,
    });
  }

  return points;
}

/**
 * The path for an outline: a closed polygon, straight from vertex to vertex.
 *
 * Deliberately *not* a spline. A Catmull-Rom through an outline looks tempting
 * and is wrong here: an outline's vertices are not evenly spaced — the sides
 * run for tens of pixels between samples while a round cap contributes a dozen
 * vertices a fraction of a pixel apart — and a spline's tangent estimate,
 * `(next - previous) / 6`, blows up across that imbalance. Measured on a
 * two-point stroke it flung a control point eight pixels past a two-pixel cap.
 *
 * Straight edges have no such failure mode. What makes them read as curves is
 * spacing: every edge is split until it is at most `MAX_OUTLINE_SEGMENT` long,
 * which puts the chord within a tenth of a pixel of the curve it stands in for.
 * The sides do not need splitting — the trail already arrives every few pixels,
 * and even a fast stroke's 50px hops come back smooth once split.
 */
export function outlineToPath(outline: ZCanvasPoint[]): string {
  if (outline.length < 3) return '';

  const round = (value: number) => Math.round(value * 100) / 100;
  const densified = subdivideOutline(outline);

  let d = `M ${round(densified[0].x)} ${round(densified[0].y)}`;
  for (let i = 1; i < densified.length; i++) {
    d += ` L ${round(densified[i].x)} ${round(densified[i].y)}`;
  }

  return `${d} Z`;
}

/** Splits any edge longer than `maxSegment` so the outline reads as a curve. */
export function subdivideOutline(
  outline: ZCanvasPoint[],
  maxSegment = MAX_OUTLINE_SEGMENT
): ZCanvasPoint[] {
  if (outline.length < 2) return outline;

  const dense: ZCanvasPoint[] = [];

  for (let i = 0; i < outline.length; i++) {
    const from = outline[i];
    const to = outline[(i + 1) % outline.length];
    const steps = Math.max(1, Math.ceil(distance(from, to) / maxSegment));

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      dense.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
  }

  return dense;
}

/**
 * The trail as it should be drawn: cleaned, smoothed, wobbled and quantised to
 * the precision a document needs.
 */
export function inkPoints(
  points: ZCanvasPoint[],
  geometry: InkGeometry,
  seed: number | string
): ZCanvasPoint[] {
  const cleaned = cleanPoints(points).slice(0, MAX_SAMPLES);
  const smoothed = streamlinePoints(cleaned, geometry.smoothing);
  const roughened = roughenPoints(smoothed, geometry.roughness, seed);

  return roughened.map((point) => ({ x: quantise(point.x), y: quantise(point.y) }));
}

/**
 * What to paint for a stroke.
 *
 * Solid ink is a filled body — the shape a nib leaves; the presets draw it at a
 * constant width, with `taper` available for a brush-like nib. A dashed or
 * dotted nib is the *centreline* stroked with its dash pattern instead, because
 * a dash pattern describes a line, and there is no meaningful way to dash a
 * shape.
 */
export function resolveInkRender(stroke: InkStroke): InkRender {
  const none: InkRender = { d: '', fill: 'none', stroke: 'none', strokeWidth: 0 };
  if (stroke.points.length === 0) return none;

  const geometry: InkGeometry = {
    width: stroke.width,
    smoothing: stroke.smoothing ?? 0,
    roughness: stroke.roughness ?? 0,
    taper: stroke.taper ?? 0,
  };
  const points = inkPoints(stroke.points, geometry, stroke.id);
  if (points.length === 0) return none;

  const dashArray = getStrokeDashArray(
    stroke.strokeStyle as ZCanvasStrokeStyle | undefined,
    stroke.width
  );

  if (dashArray) {
    // A tap of a dashed nib is a single dash-shaped mark, not nothing at all.
    const d = points.length === 1 ? dotPath(points[0], stroke.width / 2) : getCatmullRomPath(points);
    return {
      d,
      fill: 'none',
      stroke: stroke.color,
      strokeWidth: stroke.width,
      strokeDasharray: dashArray,
    };
  }

  return {
    d: outlineToPath(getInkOutline(points, inkRadii(points, geometry))),
    fill: stroke.color,
    stroke: 'none',
    strokeWidth: 0,
  };
}

/** A round mark, for a tap of a nib that is drawn as a stroked line. */
function dotPath(centre: ZCanvasPoint, radius: number): string {
  const r = Math.max(0.35, radius);
  return (
    `M ${centre.x - r} ${centre.y} ` +
    `A ${r} ${r} 0 1 0 ${centre.x + r} ${centre.y} ` +
    `A ${r} ${r} 0 1 0 ${centre.x - r} ${centre.y} Z`
  );
}
