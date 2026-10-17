import type { ZCanvasBox, ZCanvasDrawingStroke, ZCanvasPoint } from '../core/schema';

/**
 * A freehand stroke treated as an *element* rather than as a decoration.
 *
 * Ink is stored as the polyline the hand traced plus the nib it was drawn with,
 * so everything a selection needs — where the mark is, whether a press landed
 * on it, and how to move or scale it — can be answered from the stroke itself.
 * None of this resolves the ink outline: hit-testing against the painted
 * outline would make a stroke harder to grab the sloppier it was drawn, which
 * is the opposite of what a selection handle is for.
 *
 * The bounds do allow for the ink's *spread*, though, so the box a user sees is
 * the box the mark actually occupies: half a nib on each side, plus however far
 * the sloppiness wanders off the traced path.
 */

/**
 * How far outside the ink a press still counts as landing on it, in canvas
 * pixels. A mark is thin and a pointer is not, so some slack is what makes a
 * stroke feel grabbable rather than something to be aimed at.
 */
export const STROKE_HIT_SLACK = 6;

/** Distance from a point to the segment `a`–`b`. */
function distanceToSegment(point: ZCanvasPoint, a: ZCanvasPoint, b: ZCanvasPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  // A degenerate segment — a tap, or two samples on top of each other — is a
  // point, and the perpendicular projection onto it is undefined.
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);

  // Where along the segment the perpendicular lands, clamped to its ends so a
  // point past the end measures to the end rather than to the infinite line.
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
  );

  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * How far the painted ink can reach from the traced path: half the nib, plus
 * the wander the sloppiness adds.
 */
export function strokeInkMargin(stroke: Pick<ZCanvasDrawingStroke, 'width' | 'roughness'>): number {
  const nib = Math.max(stroke.width, 1) / 2;
  const wander = Math.max(stroke.roughness ?? 0, 0) * 0.7;
  return nib + wander;
}

/** The box the ink of one stroke occupies, the nib's spread included. */
export function getStrokeBounds(
  stroke: Pick<ZCanvasDrawingStroke, 'points' | 'width' | 'roughness'>
): ZCanvasBox {
  if (stroke.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of stroke.points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  const margin = strokeInkMargin(stroke);

  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
  };
}

/**
 * The box enclosing every stroke given, or `null` when there is nothing to
 * enclose — an empty selection has no box, rather than a box at the origin.
 */
export function getStrokesBounds(
  strokes: Array<Pick<ZCanvasDrawingStroke, 'points' | 'width' | 'roughness'>>
): ZCanvasBox | null {
  let box: ZCanvasBox | null = null;

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    const next = getStrokeBounds(stroke);
    box = box
      ? {
          x: Math.min(box.x, next.x),
          y: Math.min(box.y, next.y),
          width: Math.max(box.x + box.width, next.x + next.width) - Math.min(box.x, next.x),
          height: Math.max(box.y + box.height, next.y + next.height) - Math.min(box.y, next.y),
        }
      : next;
  }

  return box;
}

/**
 * Whether a press lands on the stroke.
 *
 * Measured against every segment of the traced path, so a stroke is grabbable
 * along its whole length rather than only near the samples the pointer happened
 * to report.
 */
export function isPointOnStroke(
  stroke: Pick<ZCanvasDrawingStroke, 'points' | 'width' | 'roughness'>,
  point: ZCanvasPoint,
  slack = STROKE_HIT_SLACK
): boolean {
  if (stroke.points.length === 0) return false;

  const reach = strokeInkMargin(stroke) + slack;
  const points = stroke.points;

  if (points.length === 1) {
    return Math.hypot(point.x - points[0].x, point.y - points[0].y) <= reach;
  }

  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(point, points[i - 1], points[i]) <= reach) return true;
  }

  return false;
}

/**
 * The stroke a press lands on, topmost first.
 *
 * Strokes are painted in array order, so the last one drawn is the one on top —
 * and the one a press should reach, exactly as it would for nodes.
 */
export function findStrokeAt(
  strokes: ZCanvasDrawingStroke[],
  point: ZCanvasPoint,
  slack = STROKE_HIT_SLACK
): ZCanvasDrawingStroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (isPointOnStroke(strokes[i], point, slack)) return strokes[i];
  }
  return null;
}

/** The same ink, moved. */
export function translateStroke<T extends ZCanvasDrawingStroke>(stroke: T, dx: number, dy: number): T {
  if (dx === 0 && dy === 0) return stroke;
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  };
}

/**
 * The same ink, scaled from one box into another.
 *
 * The nib does not scale with the geometry. A nib is a physical pen: a stroke
 * dragged out to twice its size was still drawn with the pen the user chose, and
 * silently thickening it would make a resize quietly restyle the ink. The nib
 * is the style panel's business.
 *
 * A box with no width or height cannot say what "twice as wide" means, so that
 * axis is left alone rather than multiplied by infinity.
 */
export function resizeStroke<T extends ZCanvasDrawingStroke>(
  stroke: T,
  from: ZCanvasBox,
  to: ZCanvasBox
): T {
  const scaleX = from.width > 0 ? to.width / from.width : 1;
  const scaleY = from.height > 0 ? to.height / from.height : 1;

  return {
    ...stroke,
    points: stroke.points.map((point) => ({
      x: to.x + (point.x - from.x) * scaleX,
      y: to.y + (point.y - from.y) * scaleY,
    })),
  };
}
