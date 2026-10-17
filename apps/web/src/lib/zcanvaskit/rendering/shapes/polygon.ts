import type { ZCanvasPoint } from '../../core/schema';

/**
 * The angular shapes — diamond and triangle — and the slight rounding that
 * keeps them in the same visual family as the rectangle.
 *
 * A rectangle in this library is drawn as a rounded box (a 12px radius on the
 * canvas card, `rx="12"` in an export). Diamond and triangle vertices are hard
 * corners, which made the three shapes look like they came from different
 * libraries. Rounding every corner of a polygon by the same radius puts them
 * back together.
 *
 * The vertices themselves live here too, so the canvas and the SVG exporter
 * draw the *same* outline: two copies of a shape's coordinates drift apart the
 * moment either is nudged.
 */

/** The margin a shape keeps from its node box, so its stroke stays inside. */
export const SHAPE_INSET = 2;

/**
 * The corner radius every shape is rounded by, matching the rectangle's 12px.
 * Corners are clamped per shape (see {@link roundPolygonCorners}), so a small
 * shape rounds less rather than turning into a blob.
 */
export const DEFAULT_CORNER_RADIUS = 12;

/** A corner of a polygon: the vertex and the two points it rounds between. */
export interface RoundedCorner {
  /** The sharp vertex the corner replaces. */
  vertex: ZCanvasPoint;
  /** Where the incoming edge stops curving and runs straight. */
  entry: ZCanvasPoint;
  /** Where the outgoing edge leaves the corner. */
  exit: ZCanvasPoint;
  /** How far back from the vertex the rounding starts. */
  radius: number;
}

function distance(a: ZCanvasPoint, b: ZCanvasPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * The four points of a diamond, clockwise from the top.
 *
 * The vertical extent is spent on the two long edges, so a diamond is inset on
 * every side by the same amount.
 */
export function diamondVertices(
  width: number,
  height: number,
  inset = SHAPE_INSET
): ZCanvasPoint[] {
  return [
    { x: width / 2, y: inset },
    { x: width - inset, y: height / 2 },
    { x: width / 2, y: height - inset },
    { x: inset, y: height / 2 },
  ];
}

/** The three points of an isosceles triangle, clockwise from the apex. */
export function triangleVertices(
  width: number,
  height: number,
  inset = SHAPE_INSET
): ZCanvasPoint[] {
  return [
    { x: width / 2, y: inset },
    { x: width - inset, y: height - inset },
    { x: inset, y: height - inset },
  ];
}

/**
 * Rounds each vertex by up to `radius`, measured back along both edges.
 *
 * A corner can never take more than half of either edge it sits on, so two
 * adjacent corners can meet at an edge's midpoint but never cross it — the
 * shape stays a simple, fillable polygon instead of folding through itself.
 * A degenerate edge (a duplicated vertex) takes no rounding at all, which
 * keeps the arithmetic finite.
 */
export function roundPolygonCorners(vertices: ZCanvasPoint[], radius: number): RoundedCorner[] {
  const count = vertices.length;

  return vertices.map((vertex, index) => {
    const previous = vertices[(index - 1 + count) % count];
    const next = vertices[(index + 1) % count];
    const inLength = distance(previous, vertex);
    const outLength = distance(vertex, next);
    const amount = Math.max(0, Math.min(radius, inLength / 2, outLength / 2));

    if (amount <= 0) {
      return {
        vertex: { x: vertex.x, y: vertex.y },
        entry: { x: vertex.x, y: vertex.y },
        exit: { x: vertex.x, y: vertex.y },
        radius: 0,
      };
    }

    return {
      vertex: { x: vertex.x, y: vertex.y },
      entry: {
        x: vertex.x + ((previous.x - vertex.x) / inLength) * amount,
        y: vertex.y + ((previous.y - vertex.y) / inLength) * amount,
      },
      exit: {
        x: vertex.x + ((next.x - vertex.x) / outLength) * amount,
        y: vertex.y + ((next.y - vertex.y) / outLength) * amount,
      },
      radius: amount,
    };
  });
}

/**
 * The path for a polygon with every corner rounded.
 *
 * Each corner is a quadratic whose control point is the vertex it replaces:
 * the curve is pulled towards the sharp corner but never reaches it, which is
 * exactly the soft-but-still-pointed look of a rounded rectangle. Corners that
 * could not be rounded are emitted as plain vertices, so a shape too small to
 * round is still drawn correctly — and a corner that eats its whole edge leaves
 * no straight run behind it, so no zero-length segment is written out.
 */
export function getRoundedPolygonPath(
  vertices: ZCanvasPoint[],
  radius = DEFAULT_CORNER_RADIUS
): string {
  if (vertices.length < 3) return '';

  const corners = roundPolygonCorners(vertices, radius);
  const round = (value: number) => Math.round(value * 100) / 100;
  // Points are compared as they will be *written*, so rounding to hundredths
  // cannot leave two identical coordinates in the path either.
  const at = (point: ZCanvasPoint) => `${round(point.x)} ${round(point.y)}`;

  // Start at the first corner's exit, so the loop below can walk the rest of
  // the corners in order and close back onto the first one.
  const start = at(corners[0].exit);
  const segments: string[] = [];
  let cursor = start;

  for (const corner of [...corners.slice(1), corners[0]]) {
    const entry = at(corner.entry);
    if (entry !== cursor) {
      segments.push(`L ${entry}`);
      cursor = entry;
    }

    if (corner.radius > 0) {
      const exit = at(corner.exit);
      segments.push(`Q ${at(corner.vertex)} ${exit}`);
      cursor = exit;
    }
  }

  // A line landing back on the start point is what the `Z` already means, so a
  // shape with no rounding ends on its last vertex rather than repeating it.
  if (segments[segments.length - 1] === `L ${start}`) segments.pop();

  return `M ${start}${segments.map((segment) => ` ${segment}`).join('')} Z`;
}
