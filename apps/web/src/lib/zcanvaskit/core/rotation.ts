/**
 * Turning an element on the canvas.
 *
 * A node's `rotation` is degrees clockwise about its own centre, and that one
 * convention is what the whole engine reads: the HTML node layer draws the
 * frame with a CSS `rotate`, a connector resolves its anchors through
 * {@link rotatePoint}, and the exporter writes the same angle into the SVG it
 * produces.
 *
 * Nothing ever stores a turned frame as a box. `x`, `y`, `width` and `height`
 * remain the upright box the element was placed in, and the angle is what turns
 * it — which is what lets a resize, an alignment guide, a marquee and a
 * snapping rule all go on measuring boxes the way they always have.
 */
import type { ZCanvasBox, ZCanvasPoint } from './schema';

/** How far a rotate gesture moves when Shift is held, in degrees. */
export const ROTATION_SNAP_DEGREES = 15;

/** The step the menu's rotate items move by: a quarter turn. */
export const QUARTER_TURN_DEGREES = 90;

/**
 * The angle of an element, which is upright when it has none.
 *
 * Takes anything shaped like `{ rotation?: number }` rather than a node, so the
 * same reading serves a node, an edge's box and a resize in flight.
 */
export function rotationOf(element: { rotation?: number }): number {
  return element.rotation ?? 0;
}

/** An angle folded into `[0, 360)`, so a turn is stored the same however it was made. */
export function normalizeRotation(degrees: number): number {
  const folded = degrees % 360;
  // `-0` is a number JavaScript produces freely (`-360 % 360`, `Math.round(-0.4) * 15`)
  // and it is not an angle: it is `===` to zero but stored differently, so a
  // shape turned all the way round would carry an angle that reads as neither.
  if (folded === 0) return 0;
  return folded < 0 ? folded + 360 : folded;
}

/** Rounds an angle to the nearest multiple of `step`, folded into `[0, 360)`. */
export function snapRotation(degrees: number, step: number = ROTATION_SNAP_DEGREES): number {
  return normalizeRotation(Math.round(degrees / step) * step);
}

/** The centre of a box — the point every turn is taken about. */
export function boxCenter(box: ZCanvasBox): ZCanvasPoint {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The box's corners, clockwise from the top-left: `nw`, `ne`, `se`, `sw`. */
export function boxCorners(box: ZCanvasBox): ZCanvasPoint[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
}

/**
 * A point turned about an origin, clockwise on screen.
 *
 * Screen y grows downwards, which is why the usual counter-clockwise rotation
 * matrix is written with `+sin` in the second row: an angle that turns the
 * picture the way a clock does on screen is the one the document stores.
 */
export function rotatePoint(
  point: ZCanvasPoint,
  origin: ZCanvasPoint,
  degrees: number
): ZCanvasPoint {
  if (!degrees) return { ...point };

  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;

  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * The upright box a turned box covers.
 *
 * What a turned element occupies on the canvas is the corners of its frame
 * swept round its centre, so the box that holds all four is the one to measure
 * it by — the box it is *drawn* from would leave the corners it has swung
 * outside it, and everything that measures elements at a glance (the export
 * bounds, the minimap, a group frame) would clip them.
 */
export function rotatedBounds(box: ZCanvasBox & { rotation?: number }): ZCanvasBox {
  const rotation = rotationOf(box);
  if (!rotation) return { x: box.x, y: box.y, width: box.width, height: box.height };

  const centre = boxCenter(box);
  const corners = boxCorners(box).map((corner) => rotatePoint(corner, centre, rotation));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/**
 * How far a pointer has swung around `origin`, in degrees, from `from` to `to`.
 *
 * The shortest way round: a drag that crosses the ±180° seam has to keep
 * turning the way the pointer is going rather than jumping the long way back,
 * which is exactly what a bare subtraction of the two angles would do.
 */
export function rotationDelta(
  from: ZCanvasPoint,
  to: ZCanvasPoint,
  origin: ZCanvasPoint
): number {
  const bearing = (point: ZCanvasPoint) =>
    (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI;

  let delta = bearing(to) - bearing(from);
  while (delta > 180) delta -= 360;
  while (delta <= -180) delta += 360;

  return delta;
}
