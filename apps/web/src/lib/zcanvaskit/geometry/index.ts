import type {
  ZCanvasPoint,
  ZCanvasBox,
  ZCanvasHandlePosition,
  ZCanvasEdgeRouting,
} from '../core/schema';
import { boxCenter, rotatePoint, rotationOf } from '../core/rotation';

/**
 * A box that knows how its element is turned.
 *
 * Anchors are resolved from the box a node occupies, so a connector attached to
 * a turned node has to be told the angle as well as the frame. That is why the
 * node map these functions take is typed as this and not as a plain box: the
 * canvas hands over the nodes themselves, and an upright element simply has no
 * angle to report.
 */
export type ZCanvasOrientedBox = ZCanvasBox & { rotation?: number };

export const HANDLE_POSITIONS: ZCanvasHandlePosition[] = ['top', 'right', 'bottom', 'left'];

/**
 * The point on a box an edge attaches to.
 *
 * With an angle, the point is taken to the middle of the edge the shape is
 * actually showing rather than the middle of the edge of the box it was placed
 * in, so a connector meets a turned shape where the eye says it should.
 */
export function getHandlePoint(
  box: ZCanvasBox,
  position: ZCanvasHandlePosition,
  rotation = 0,
  offset = 0
): ZCanvasPoint {
  switch (position) {
    case 'top':
      return turnedPoint({ x: box.x + box.width / 2 + offset, y: box.y }, box, rotation);
    case 'right':
      return turnedPoint({ x: box.x + box.width, y: box.y + box.height / 2 + offset }, box, rotation);
    case 'bottom':
      return turnedPoint({ x: box.x + box.width / 2 + offset, y: box.y + box.height }, box, rotation);
    case 'left':
      return turnedPoint({ x: box.x, y: box.y + box.height / 2 + offset }, box, rotation);
  }
}

function turnedPoint(point: ZCanvasPoint, box: ZCanvasBox, rotation: number): ZCanvasPoint {
  return rotation ? rotatePoint(point, boxCenter(box), rotation) : point;
}

/**
 * The pair of anchors on two turned shapes that are closest together.
 *
 * Sixteen pairs is few enough to simply measure, which is worth more than a
 * cleverer rule here: the answer has to be right for any two angles, and any
 * shortcut through the trig would be a rule the next person has to re-derive.
 */
function nearestHandlePair(
  source: ZCanvasBox,
  target: ZCanvasBox,
  sourceRotation: number,
  targetRotation: number
): { sourcePos: ZCanvasHandlePosition; targetPos: ZCanvasHandlePosition } | null {
  let best: { sourcePos: ZCanvasHandlePosition; targetPos: ZCanvasHandlePosition } | null = null;
  let shortest = Infinity;

  for (const sourcePos of HANDLE_POSITIONS) {
    const from = getHandlePoint(source, sourcePos, sourceRotation);
    for (const targetPos of HANDLE_POSITIONS) {
      const to = getHandlePoint(target, targetPos, targetRotation);
      const distanceSq = (to.x - from.x) ** 2 + (to.y - from.y) ** 2;
      if (distanceSq < shortest) {
        shortest = distanceSq;
        best = { sourcePos, targetPos };
      }
    }
  }

  return best;
}

export function getOptimalHandlePair(
  source: ZCanvasBox,
  target: ZCanvasBox,
  sourceRotation = 0,
  targetRotation = 0
): { sourcePos: ZCanvasHandlePosition; targetPos: ZCanvasHandlePosition } {
  // Two upright shapes are read off their frames, which is the rule a
  // left-to-right diagram has always been drawn by. A turned shape has no
  // upright frame to read that from — the handle it calls `right` may be the
  // one pointing west — so when either end is turned, the pair is the two
  // anchors that are actually nearest each other.
  if (sourceRotation || targetRotation) {
    const nearest = nearestHandlePair(source, target, sourceRotation, targetRotation);
    if (nearest) return nearest;
  }

  const dx = target.x - source.x;
  const dy = target.y - source.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourcePos: 'right', targetPos: 'left' }
      : { sourcePos: 'left', targetPos: 'right' };
  } else {
    return dy >= 0
      ? { sourcePos: 'bottom', targetPos: 'top' }
      : { sourcePos: 'top', targetPos: 'bottom' };
  }
}

/** Returns the handle position whose anchor point is closest to `point`. */export function getNearestHandle(
  box: ZCanvasBox,
  point: ZCanvasPoint,
  rotation = 0
): ZCanvasHandlePosition {
  let nearest: ZCanvasHandlePosition = HANDLE_POSITIONS[0];
  let nearestDistanceSq = Infinity;

  for (const position of HANDLE_POSITIONS) {
    const anchor = getHandlePoint(box, position, rotation);
    const dx = anchor.x - point.x;
    const dy = anchor.y - point.y;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearest = position;
    }
  }

  return nearest;
}

/**
 * Resolves the closest side of a shape and the offset along that side from its midpoint
 * for an arbitrary point in canvas coordinates.
 *
 * Automatically handles rotated shapes by calculating in the shape's local space,
 * and snaps magnetically to center (0) or 25%/75% quartile positions when close.
 */
export function getNearestSideAndOffset(
  box: ZCanvasOrientedBox,
  point: ZCanvasPoint
): { side: ZCanvasHandlePosition; offset: number; point: ZCanvasPoint } {
  const rotation = rotationOf(box);
  const localPt = rotation ? rotatePoint(point, boxCenter(box), -rotation) : point;

  // Distances to the 4 borders of the unrotated box
  const distTop = Math.abs(localPt.y - box.y);
  const distBottom = Math.abs(localPt.y - (box.y + box.height));
  const distLeft = Math.abs(localPt.x - box.x);
  const distRight = Math.abs(localPt.x - (box.x + box.width));

  const minDist = Math.min(distTop, distBottom, distLeft, distRight);
  let side: ZCanvasHandlePosition = 'right';
  let rawOffset = 0;

  if (minDist === distTop) {
    side = 'top';
    rawOffset = localPt.x - (box.x + box.width / 2);
    const maxOffset = Math.max(0, box.width / 2 - 8);
    rawOffset = Math.max(-maxOffset, Math.min(maxOffset, rawOffset));
    // Magnetic snap to center if within 10px
    if (Math.abs(rawOffset) < 10) rawOffset = 0;
    // Magnetic snap to 25% / 75% quartile marks if within 6px
    const quarter = box.width * 0.25;
    if (Math.abs(rawOffset - quarter) < 6) rawOffset = Math.round(quarter);
    if (Math.abs(rawOffset - (-quarter)) < 6) rawOffset = Math.round(-quarter);
  } else if (minDist === distBottom) {
    side = 'bottom';
    rawOffset = localPt.x - (box.x + box.width / 2);
    const maxOffset = Math.max(0, box.width / 2 - 8);
    rawOffset = Math.max(-maxOffset, Math.min(maxOffset, rawOffset));
    if (Math.abs(rawOffset) < 10) rawOffset = 0;
    const quarter = box.width * 0.25;
    if (Math.abs(rawOffset - quarter) < 6) rawOffset = Math.round(quarter);
    if (Math.abs(rawOffset - (-quarter)) < 6) rawOffset = Math.round(-quarter);
  } else if (minDist === distLeft) {
    side = 'left';
    rawOffset = localPt.y - (box.y + box.height / 2);
    const maxOffset = Math.max(0, box.height / 2 - 8);
    rawOffset = Math.max(-maxOffset, Math.min(maxOffset, rawOffset));
    if (Math.abs(rawOffset) < 10) rawOffset = 0;
    const quarter = box.height * 0.25;
    if (Math.abs(rawOffset - quarter) < 6) rawOffset = Math.round(quarter);
    if (Math.abs(rawOffset - (-quarter)) < 6) rawOffset = Math.round(-quarter);
  } else {
    side = 'right';
    rawOffset = localPt.y - (box.y + box.height / 2);
    const maxOffset = Math.max(0, box.height / 2 - 8);
    rawOffset = Math.max(-maxOffset, Math.min(maxOffset, rawOffset));
    if (Math.abs(rawOffset) < 10) rawOffset = 0;
    const quarter = box.height * 0.25;
    if (Math.abs(rawOffset - quarter) < 6) rawOffset = Math.round(quarter);
    if (Math.abs(rawOffset - (-quarter)) < 6) rawOffset = Math.round(-quarter);
  }

  const roundedOffset = Math.round(rawOffset);
  const snapPt = getHandlePoint(box, side, rotation, roundedOffset);

  return {
    side,
    offset: roundedOffset,
    point: snapPt,
  };
}

/**
 * The two control points of the smooth route between two anchors.
 *
 * Each one is pushed out along its own handle's direction by the same amount,
 * so a handle facing away from the other end bows the curve outwards. How far
 * is what decides where the curve actually goes, which is why this is its own
 * function: the drawn path and the box a marquee tests it by have to be
 * computed from one set of numbers, not two that happen to agree.
 */
export function bezierControlPoints(
  p1: ZCanvasPoint,
  p2: ZCanvasPoint,
  sourcePos: ZCanvasHandlePosition = 'right',
  targetPos: ZCanvasHandlePosition = 'left'
): { c1: ZCanvasPoint; c2: ZCanvasPoint } {
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);

  const c1 = { x: p1.x, y: p1.y };
  const c2 = { x: p2.x, y: p2.y };

  const curvature = Math.max(40, (dx + dy) * 0.35);

  if (sourcePos === 'right') c1.x += curvature;
  else if (sourcePos === 'left') c1.x -= curvature;
  else if (sourcePos === 'bottom') c1.y += curvature;
  else if (sourcePos === 'top') c1.y -= curvature;

  if (targetPos === 'left') c2.x -= curvature;
  else if (targetPos === 'right') c2.x += curvature;
  else if (targetPos === 'top') c2.y -= curvature;
  else if (targetPos === 'bottom') c2.y += curvature;

  return { c1, c2 };
}

export function computeSmoothBezierPath(
  p1: ZCanvasPoint,
  p2: ZCanvasPoint,
  sourcePos: ZCanvasHandlePosition = 'right',
  targetPos: ZCanvasHandlePosition = 'left',
  stepOffset = 0
): { pathD: string; midPoint: ZCanvasPoint } {
  const { c1, c2 } = bezierControlPoints(p1, p2, sourcePos, targetPos);

  if (stepOffset !== 0) {
    if (sourcePos === 'left' || sourcePos === 'right') {
      c1.y += stepOffset;
      c2.y += stepOffset;
    } else {
      c1.x += stepOffset;
      c2.x += stepOffset;
    }
  }

  const pathD = `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  const midPoint = {
    x: (p1.x + p2.x) / 2 + (sourcePos === 'top' || sourcePos === 'bottom' ? stepOffset * 0.5 : 0),
    y: (p1.y + p2.y) / 2 + (sourcePos === 'left' || sourcePos === 'right' ? stepOffset * 0.5 : 0),
  };

  return { pathD, midPoint };
}

/**
 * The box a set of points spans.
 *
 * Used for the box an edge occupies, where the points handed in are the ones
 * that bound the path rather than its endpoints alone. A degenerate span — a
 * perfectly horizontal connector — keeps a zero height rather than being grown
 * to some minimum: the box is a description of where the path is, and a marquee
 * that does not reach the line should not catch it.
 */
function spansBox(points: ZCanvasPoint[]): ZCanvasBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function computeOrthogonalStepPath(
  p1: ZCanvasPoint,
  p2: ZCanvasPoint,
  sourcePos: ZCanvasHandlePosition = 'right',
  targetPos: ZCanvasHandlePosition = 'left',
  stepOffset = 0
): { pathD: string; midPoint: ZCanvasPoint } {
  const midX = (p1.x + p2.x) / 2 + (sourcePos === 'left' || sourcePos === 'right' ? stepOffset : 0);
  const midY = (p1.y + p2.y) / 2 + (sourcePos === 'top' || sourcePos === 'bottom' ? stepOffset : 0);

  let pathD = '';
  if (sourcePos === 'left' || sourcePos === 'right') {
    pathD = `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`;
  } else {
    pathD = `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`;
  }

  return {
    pathD,
    midPoint: { x: midX, y: midY },
  };
}

export interface EdgeGeometryInput {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: ZCanvasHandlePosition;
  targetHandle?: ZCanvasHandlePosition;
  sourcePoint?: ZCanvasPoint;
  targetPoint?: ZCanvasPoint;
  sourceOffset?: number;
  targetOffset?: number;
  stepOffset?: number;
  style?: ZCanvasEdgeRouting;
  label?: string;
  labelOffset?: { x: number; y: number };
}

export interface EdgeGeometry {
  p1: ZCanvasPoint;
  p2: ZCanvasPoint;
  sourcePos: ZCanvasHandlePosition;
  targetPos: ZCanvasHandlePosition;
  pathD: string;
  midPoint: ZCanvasPoint;
  /**
   * The box the drawn path is contained in.
   *
   * A marquee sweeps connectors by this box the way it sweeps shapes by theirs.
   * It is exact for the routes that stay between their endpoints — a straight
   * line, and an orthogonal one, which only ever turns at a point between them —
   * and for the smooth cubic it is the hull of the four control points, which a
   * cubic never leaves and which is recomputed from the same numbers that drew
   * it, so the two cannot drift apart. It can therefore over-reach by the
   * curve's slack, but it can never miss the path.
   */
  bounds: ZCanvasBox;
}

/**
 * Calculates balanced perpendicular port offsets when multiple connectors attach
 * to the same side of a node (just like Draw.io port fan-out), preventing
 * completely overlapping lines.
 */
export function computeMultiConnectionOffsets(
  edges: EdgeGeometryInput[],
  nodeMap: Map<string, ZCanvasOrientedBox>
): Map<string, { sourceOffset: number; targetOffset: number }> {
  const result = new Map<string, { sourceOffset: number; targetOffset: number }>();
  const portGroups = new Map<string, Array<{ edgeId: string; isSource: boolean; otherId?: string }>>();

  for (const edge of edges) {
    const edgeId = edge.id || `${edge.source}-${edge.target}-${Math.random()}`;
    result.set(edgeId, { sourceOffset: 0, targetOffset: 0 });

    if (edge.source && !edge.sourcePoint && nodeMap.has(edge.source)) {
      const srcNode = nodeMap.get(edge.source)!;
      const tgtNode = edge.target ? nodeMap.get(edge.target) : undefined;
      const optimal = tgtNode
        ? getOptimalHandlePair(srcNode, tgtNode, rotationOf(srcNode), rotationOf(tgtNode))
        : { sourcePos: 'right' as ZCanvasHandlePosition, targetPos: 'left' as ZCanvasHandlePosition };
      const sourcePos = edge.sourceHandle || optimal.sourcePos;
      const key = `${edge.source}:${sourcePos}`;
      let group = portGroups.get(key);
      if (!group) {
        group = [];
        portGroups.set(key, group);
      }
      group.push({ edgeId, isSource: true, otherId: edge.target });
    }

    if (edge.target && !edge.targetPoint && nodeMap.has(edge.target)) {
      const tgtNode = nodeMap.get(edge.target)!;
      const srcNode = edge.source ? nodeMap.get(edge.source) : undefined;
      const optimal = srcNode
        ? getOptimalHandlePair(srcNode, tgtNode, rotationOf(srcNode), rotationOf(tgtNode))
        : { sourcePos: 'right' as ZCanvasHandlePosition, targetPos: 'left' as ZCanvasHandlePosition };
      const targetPos = edge.targetHandle || optimal.targetPos;
      const key = `${edge.target}:${targetPos}`;
      let group = portGroups.get(key);
      if (!group) {
        group = [];
        portGroups.set(key, group);
      }
      group.push({ edgeId, isSource: false, otherId: edge.source });
    }
  }

  const SPACING = 20;
  for (const [key, group] of portGroups.entries()) {
    if (group.length <= 1) continue;
    const [nodeId, handle] = key.split(':');
    const node = nodeMap.get(nodeId);
    const isHorizHandle = handle === 'left' || handle === 'right';

    // Sort edges geometrically by the position of their destination/source
    // so lines radiating from or entering the same side never cross each other!
    group.sort((a, b) => {
      const nodeA = nodeMap.get((a as any).otherId);
      const nodeB = nodeMap.get((b as any).otherId);
      if (nodeA && nodeB) {
        if (isHorizHandle) {
          const yA = nodeA.y + nodeA.height / 2;
          const yB = nodeB.y + nodeB.height / 2;
          if (Math.abs(yA - yB) > 2) return yA - yB;
        } else {
          const xA = nodeA.x + nodeA.width / 2;
          const xB = nodeB.x + nodeB.width / 2;
          if (Math.abs(xA - xB) > 2) return xA - xB;
        }
      }
      if (a.isSource !== b.isSource) return a.isSource ? -1 : 1;
      return a.edgeId.localeCompare(b.edgeId);
    });

    const maxSpan = node
      ? (handle === 'top' || handle === 'bottom' ? node.width : node.height) * 0.7
      : 80;
    const count = group.length;
    const step = Math.min(SPACING, maxSpan / (count + 1));
    const startOffset = -((count - 1) * step) / 2;

    group.forEach((item, index) => {
      const offset = Math.round(startOffset + index * step);
      const current = result.get(item.edgeId) || { sourceOffset: 0, targetOffset: 0 };
      if (item.isSource) {
        current.sourceOffset = offset;
      } else {
        current.targetOffset = offset;
      }
      result.set(item.edgeId, current);
    });
  }

  return result;
}

/**
 * Resolves a single, canonical path geometry for an edge.
 *
 * Handles three shapes:
 *  - fully freeform (both explicit points) -> a straight line
 *  - fully connected (both ends resolve to nodes) -> optimal/handle-based routing
 *  - mixed (one explicit point, one node) -> the attached end snaps to the
 *    handle nearest the free point
 *
 * Returns `null` when the geometry cannot be resolved; callers should skip
 * such edges.
 */
export function computeEdgeGeometry(
  edge: EdgeGeometryInput,
  nodeMap: Map<string, ZCanvasOrientedBox>,
  defaultRouting: 'bezier' | 'step' = 'bezier',
  portOffsets?: { sourceOffset?: number; targetOffset?: number }
): EdgeGeometry | null {
  const srcNode = edge.source ? nodeMap.get(edge.source) : undefined;
  const tgtNode = edge.target ? nodeMap.get(edge.target) : undefined;
  const srcRotation = srcNode ? rotationOf(srcNode) : 0;
  const tgtRotation = tgtNode ? rotationOf(tgtNode) : 0;

  const resolvedSourceOffset = edge.sourceOffset ?? portOffsets?.sourceOffset ?? 0;
  const resolvedTargetOffset = edge.targetOffset ?? portOffsets?.targetOffset ?? 0;
  const stepOffset = edge.stepOffset || 0;

  /**
   * Routes between two resolved anchors, and reports what bounds the result.
   *
   * `points` is what the path is boxed by: its two ends for the routes that
   * stay between them, plus the control points for the cubic, which is free to
   * bow past either end.
   */
  const route = (
    p1: ZCanvasPoint,
    p2: ZCanvasPoint,
    sourcePos: ZCanvasHandlePosition,
    targetPos: ZCanvasHandlePosition
  ): { pathD: string; midPoint: ZCanvasPoint; points: ZCanvasPoint[] } => {
    if (edge.style === 'step' || defaultRouting === 'step') {
      return { ...computeOrthogonalStepPath(p1, p2, sourcePos, targetPos, stepOffset), points: [p1, p2] };
    }

    const { c1, c2 } = bezierControlPoints(p1, p2, sourcePos, targetPos);
    return {
      ...computeSmoothBezierPath(p1, p2, sourcePos, targetPos, stepOffset),
      points: [p1, c1, c2, p2],
    };
  };

  // A. Fully freeform: an independent line or arrow.
  if (edge.sourcePoint && edge.targetPoint) {
    const p1 = edge.sourcePoint;
    const p2 = edge.targetPoint;
    if (edge.style === 'step') {
      const sourcePos = edge.sourceHandle || (p1.x <= p2.x ? 'right' : 'left');
      const targetPos = edge.targetHandle || (p1.x <= p2.x ? 'left' : 'right');
      const res = computeOrthogonalStepPath(p1, p2, sourcePos, targetPos, stepOffset);
      return {
        p1,
        p2,
        sourcePos,
        targetPos,
        pathD: res.pathD,
        midPoint: res.midPoint,
        bounds: spansBox([p1, p2, res.midPoint]),
      };
    }
    if (edge.style === 'bezier') {
      const sourcePos = edge.sourceHandle || (p1.x <= p2.x ? 'right' : 'left');
      const targetPos = edge.targetHandle || (p1.x <= p2.x ? 'left' : 'right');
      const { c1, c2 } = bezierControlPoints(p1, p2, sourcePos, targetPos);
      const res = computeSmoothBezierPath(p1, p2, sourcePos, targetPos, stepOffset);
      return {
        p1,
        p2,
        sourcePos,
        targetPos,
        pathD: res.pathD,
        midPoint: res.midPoint,
        bounds: spansBox([p1, c1, c2, p2]),
      };
    }
    return {
      p1,
      p2,
      sourcePos: 'right',
      targetPos: 'left',
      pathD: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
      midPoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      bounds: spansBox([p1, p2]),
    };
  }

  // B. Both endpoints are attached to nodes.
  if (!edge.sourcePoint && !edge.targetPoint && srcNode && tgtNode) {
    const optimal = getOptimalHandlePair(srcNode, tgtNode, srcRotation, tgtRotation);
    const sourcePos = edge.sourceHandle || optimal.sourcePos;
    const targetPos = edge.targetHandle || optimal.targetPos;
    const p1 = getHandlePoint(srcNode, sourcePos, srcRotation, resolvedSourceOffset);
    const p2 = getHandlePoint(tgtNode, targetPos, tgtRotation, resolvedTargetOffset);
    const res = route(p1, p2, sourcePos, targetPos);

    return {
      p1,
      p2,
      sourcePos,
      targetPos,
      pathD: res.pathD,
      midPoint: res.midPoint,
      bounds: spansBox(res.points),
    };
  }

  // C. Mixed / half-attached: resolve each endpoint independently.
  let p1: ZCanvasPoint | null = edge.sourcePoint ?? null;
  let p2: ZCanvasPoint | null = edge.targetPoint ?? null;
  let sourcePos: ZCanvasHandlePosition | null = edge.sourceHandle ?? null;
  let targetPos: ZCanvasHandlePosition | null = edge.targetHandle ?? null;

  if (!p1 && srcNode && p2) {
    sourcePos = sourcePos ?? getNearestHandle(srcNode, p2, srcRotation);
    p1 = getHandlePoint(srcNode, sourcePos, srcRotation, resolvedSourceOffset);
  }
  if (!p2 && tgtNode && p1) {
    targetPos = targetPos ?? getNearestHandle(tgtNode, p1, tgtRotation);
    p2 = getHandlePoint(tgtNode, targetPos, tgtRotation, resolvedTargetOffset);
  }

  // Fall back to the fully-connected resolution when both nodes exist.
  if ((!p1 || !p2) && srcNode && tgtNode) {
    const optimal = getOptimalHandlePair(srcNode, tgtNode, srcRotation, tgtRotation);
    sourcePos = sourcePos ?? optimal.sourcePos;
    targetPos = targetPos ?? optimal.targetPos;
    p1 = p1 ?? getHandlePoint(srcNode, sourcePos, srcRotation, resolvedSourceOffset);
    p2 = p2 ?? getHandlePoint(tgtNode, targetPos, tgtRotation, resolvedTargetOffset);
  }

  if (!p1 || !p2) return null;

  const resolvedSourcePos = sourcePos ?? 'right';
  const resolvedTargetPos = targetPos ?? 'left';
  const res = route(p1, p2, resolvedSourcePos, resolvedTargetPos);

  return {
    p1,
    p2,
    sourcePos: resolvedSourcePos,
    targetPos: resolvedTargetPos,
    pathD: res.pathD,
    midPoint: res.midPoint,
    bounds: spansBox(res.points),
  };
}

/**
 * Whether a marquee box catches a connector.
 *
 * The swath of canvas a connector occupies is the box its routed path is
 * contained in, not the box its two ends span: a smooth route bows out past
 * them, so measuring the ends alone would leave the bend of a curve uncaught.
 * An edge whose ends cannot be resolved is not drawn, so it is not there to be
 * caught either.
 *
 * This lives beside the routing rather than in the canvas so that it can be
 * exercised without one.
 */
export function edgeIntersectsBox(
  edge: EdgeGeometryInput,
  box: ZCanvasBox,
  nodeMap: Map<string, ZCanvasOrientedBox>,
  defaultRouting: 'bezier' | 'step' = 'bezier'
): boolean {
  const geo = computeEdgeGeometry(edge, nodeMap, defaultRouting);
  return geo !== null && doBoxesIntersect(box, geo.bounds);
}

export function getCatmullRomPath(points: ZCanvasPoint[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

export function snapToGrid(val: number, gridSize = 8): number {
  return Math.round(val / gridSize) * gridSize;
}

export function doBoxesIntersect(b1: ZCanvasBox, b2: ZCanvasBox): boolean {
  return !(
    b2.x > b1.x + b1.width ||
    b2.x + b2.width < b1.x ||
    b2.y > b1.y + b1.height ||
    b2.y + b2.height < b1.y
  );
}

/** The smallest a dragged box may be squeezed to before it stops shrinking. */
export const MIN_RESIZE_SIZE = 8;

/** One of the corner or side grips, named the way the canvas's handles are. */
export type ZCanvasResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

export interface ZCanvasResizeOptions {
  /** Floor on both axes, unless one of the two below overrides it. */
  minSize?: number;
  /** Floor on the horizontal axis alone. */
  minWidth?: number;
  /** Floor on the vertical axis alone. */
  minHeight?: number;
  /**
   * Keep the box at the ratio it began the drag with, driven by whichever axis
   * the pointer travelled further along.
   */
  uniform?: boolean;
  /**
   * Enforce a specific target aspect ratio (width / height, e.g. 1 for perfect shapes
   * like squares, circles, and regular diamonds).
   */
  aspectRatio?: number;
  /**
   * Rounds the finished box onto the canvas grid — the canvas's own snap, so a
   * resize lands where a drag and a nudge land. Omitted, the result is exact.
   */
  snap?: (value: number) => number;
}

/**
 * The box a drag on one of its handles produces.
 *
 * `handle` names the corner being held (`nw`, `se`, …) as the HTML node handles
 * do, so a corner moves both of its edges and dragging one edge leaves the
 * other three sides where they were. The opposite corner stays anchored: that
 * is what makes a resize feel like pulling the shape rather than moving it.
 *
 * A box cannot be dragged inside out. Held at its minimum on the axis being
 * squeezed, the anchored corner stops moving instead of the box flipping
 * through itself — which would mirror the contents.
 *
 * With `uniform`, both axes take the scale of whichever one moved further, and
 * the anchored corner is re-derived, so the aspect ratio survives the drag.
 *
 * A `rotation` on the box is honoured by measuring the drag along the box's own
 * axes rather than the canvas's: the corner being held still follows the
 * pointer, and the opposite corner still does not move, however the shape is
 * turned. Upright, those axes are the canvas's, so nothing about the ordinary
 * case changes.
 */
export function resizeBoxFromHandle(
  box: ZCanvasBox & { rotation?: number },
  handle: string,
  dx: number,
  dy: number,
  options: ZCanvasResizeOptions = {}
): ZCanvasBox {
  const minWidth = options.minWidth ?? options.minSize ?? MIN_RESIZE_SIZE;
  const minHeight = options.minHeight ?? options.minSize ?? MIN_RESIZE_SIZE;
  const rotation = rotationOf(box);

  // The box's own axes, in canvas space. Upright they are the canvas's own, so
  // the projections below leave the long-standing result untouched.
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const alongX = dx * cos + dy * sin;
  const alongY = dx * -sin + dy * cos;

  const holdsWest = handle.includes('w');
  const holdsEast = handle.includes('e');
  const holdsNorth = handle.includes('n');
  const holdsSouth = handle.includes('s');

  // How far the drag pushes each side it holds. A grip on the west or north
  // side grows the box as the pointer travels the other way.
  const grewX = holdsWest ? -alongX : holdsEast ? alongX : 0;
  const grewY = holdsNorth ? -alongY : holdsSouth ? alongY : 0;

  let width = holdsWest || holdsEast ? Math.max(minWidth, box.width + grewX) : box.width;
  let height = holdsNorth || holdsSouth ? Math.max(minHeight, box.height + grewY) : box.height;

  // Which axis the drag actually drove, as a scale of the box it started from.
  const scaleX = box.width > 0 ? width / box.width : 1;
  const scaleY = box.height > 0 ? height / box.height : 1;
  const drivenByWidth = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1);

  if (options.aspectRatio !== undefined) {
    const ratio = options.aspectRatio;
    const isCorner = (holdsWest || holdsEast) && (holdsNorth || holdsSouth);
    if (isCorner) {
      if (drivenByWidth) {
        width = Math.max(minWidth, width);
        height = Math.max(minHeight, Math.round(width / ratio));
      } else {
        height = Math.max(minHeight, height);
        width = Math.max(minWidth, Math.round(height * ratio));
      }
    } else if (holdsWest || holdsEast) {
      width = Math.max(minWidth, width);
      height = Math.max(minHeight, Math.round(width / ratio));
    } else {
      height = Math.max(minHeight, height);
      width = Math.max(minWidth, Math.round(height * ratio));
    }

    if (options.snap && rotation === 0) {
      if (drivenByWidth || !(holdsNorth || holdsSouth)) {
        width = Math.max(minWidth, options.snap(width));
        height = Math.max(minHeight, Math.round(width / ratio));
      } else {
        height = Math.max(minHeight, options.snap(height));
        width = Math.max(minWidth, Math.round(height * ratio));
      }
    }
  } else if (options.uniform) {
    const scale = drivenByWidth ? scaleX : scaleY;
    width = Math.max(minWidth, box.width * scale);
    height = Math.max(minHeight, box.height * scale);

    // Snapping both axes of a box that holds a ratio would let the ratio drift
    // by a fraction of the grid, which is the one thing `uniform` is holding.
    // So the axis the drag drove is rounded and the other is derived from it.
    if (options.snap && rotation === 0) {
      const ratio = box.height > 0 ? box.width / box.height : 1;
      if (drivenByWidth) {
        width = Math.max(minWidth, options.snap(width));
        height = Math.max(minHeight, Math.round(width / ratio));
      } else {
        height = Math.max(minHeight, options.snap(height));
        width = Math.max(minWidth, Math.round(height * ratio));
      }
    }
  }

  const centre = boxCenter(box);

  // The corner opposite the one being held. It is the point the resize is
  // anchored to, and laying the new box back onto it — along the box's own axes
  // — is what keeps a turned shape from swinging as it is pulled.
  const heldX = holdsEast ? box.width / 2 : holdsWest ? -box.width / 2 : 0;
  const heldY = holdsSouth ? box.height / 2 : holdsNorth ? -box.height / 2 : 0;
  const anchor = {
    x: centre.x - (cos * heldX - sin * heldY),
    y: centre.y - (sin * heldX + cos * heldY),
  };

  // The new centre, measured from the anchor in the box's own frame: whichever
  // half of each axis the handle holds reaches out from the anchor, and the
  // rest of the box stays where it was.
  const localX = holdsEast
    ? width / 2
    : holdsWest
      ? -width / 2
      : (centre.x - anchor.x) * cos + (centre.y - anchor.y) * sin;
  const localY = holdsSouth
    ? height / 2
    : holdsNorth
      ? -height / 2
      : (centre.x - anchor.x) * -sin + (centre.y - anchor.y) * cos;

  const nextCentre = {
    x: anchor.x + cos * localX - sin * localY,
    y: anchor.y + sin * localX + cos * localY,
  };
  const result = {
    x: nextCentre.x - width / 2,
    y: nextCentre.y - height / 2,
    width,
    height,
  };

  // A box is snapped as a box only while it is upright. Rounding the frame a
  // turned one is drawn from would slide the corner the pointer is holding away
  // from the pointer, which is the one thing the anchoring above exists to
  // prevent.
  if (!options.snap || rotation !== 0) return result;

  return {
    x: options.snap(result.x),
    y: options.snap(result.y),
    width: options.uniform ? width : options.snap(width),
    height: options.uniform ? height : options.snap(height),
  };
}

export interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  coordinate: number;
}

export function calculateAlignmentGuides(
  targetBox: ZCanvasBox,
  otherBoxes: ZCanvasBox[],
  tolerance = 6
): {
  snappedX: number;
  snappedY: number;
  guides: AlignmentGuide[];
} {
  let snappedX = targetBox.x;
  let snappedY = targetBox.y;
  const guides: AlignmentGuide[] = [];

  const targetCenterX = targetBox.x + targetBox.width / 2;
  const targetCenterY = targetBox.y + targetBox.height / 2;

  for (const box of otherBoxes) {
    const boxCenterX = box.x + box.width / 2;
    const boxCenterY = box.y + box.height / 2;

    // Vertical alignment (X axis)
    if (Math.abs(targetBox.x - box.x) < tolerance) {
      snappedX = box.x;
      guides.push({ type: 'vertical', coordinate: box.x });
    } else if (Math.abs(targetCenterX - boxCenterX) < tolerance) {
      snappedX = boxCenterX - targetBox.width / 2;
      guides.push({ type: 'vertical', coordinate: boxCenterX });
    } else if (Math.abs(targetBox.x + targetBox.width - (box.x + box.width)) < tolerance) {
      snappedX = box.x + box.width - targetBox.width;
      guides.push({ type: 'vertical', coordinate: box.x + box.width });
    }

    // Horizontal alignment (Y axis)
    if (Math.abs(targetBox.y - box.y) < tolerance) {
      snappedY = box.y;
      guides.push({ type: 'horizontal', coordinate: box.y });
    } else if (Math.abs(targetCenterY - boxCenterY) < tolerance) {
      snappedY = boxCenterY - targetBox.height / 2;
      guides.push({ type: 'horizontal', coordinate: boxCenterY });
    } else if (Math.abs(targetBox.y + targetBox.height - (box.y + box.height)) < tolerance) {
      snappedY = box.y + box.height - targetBox.height;
      guides.push({ type: 'horizontal', coordinate: box.y + box.height });
    }
  }

  return { snappedX, snappedY, guides };
}

/**
 * Resolves non-colliding screen positions for connector text labels.
 *
 * Prevents overlapping/colliding labels for:
 * 1. Bidirectional or parallel edges connecting the same pair of nodes (e.g. Request/Response).
 * 2. Edges whose labels geometrically collide on the canvas.
 * 3. Respects explicit user-dragged manual `labelOffset` while adjusting neighboring auto labels around them.
 */
export function resolveEdgeLabelPositions(
  edges: readonly EdgeGeometryInput[],
  nodeMap: Map<string, ZCanvasOrientedBox>,
  defaultRouting: 'bezier' | 'step' = 'bezier',
  edgeGeometries?: Map<string, EdgeGeometry | null>
): Map<string, ZCanvasPoint> {
  const positions = new Map<string, ZCanvasPoint>();
  const labeledEdges = edges.filter((e) => Boolean(e.label));
  if (labeledEdges.length === 0) return positions;

  // 1. Group edges by node endpoints to detect multi-edges or bidirectional pairs
  const pairGroups = new Map<string, EdgeGeometryInput[]>();
  for (const edge of labeledEdges) {
    if (edge.source && edge.target && !edge.sourcePoint && !edge.targetPoint) {
      const pairKey = [edge.source, edge.target].sort().join(':::');
      let group = pairGroups.get(pairKey);
      if (!group) {
        group = [];
        pairGroups.set(pairKey, group);
      }
      group.push(edge);
    }
  }

  // 2. Compute initial label anchor positions
  for (const edge of labeledEdges) {
    const geo =
      edgeGeometries?.get(edge.id ?? '') ??
      computeEdgeGeometry(edge, nodeMap, (edge.style as any) ?? defaultRouting);
    if (!geo) continue;

    const edgeId = edge.id ?? '';

    // If the edge carries an explicit manual offset (e.g. user dragged it), respect it
    if (edge.labelOffset && (edge.labelOffset.x !== 0 || edge.labelOffset.y !== 0)) {
      positions.set(edgeId, {
        x: geo.midPoint.x + edge.labelOffset.x,
        y: geo.midPoint.y + edge.labelOffset.y,
      });
      continue;
    }

    let baseX = geo.midPoint.x;
    let baseY = geo.midPoint.y;

    // Check if this edge is part of a bidirectional or multi-edge pair without manual offset
    const pairKey = edge.source && edge.target ? [edge.source, edge.target].sort().join(':::') : null;
    const pairGroup = pairKey ? pairGroups.get(pairKey) : null;

    if (pairGroup && pairGroup.length > 1) {
      const idx = pairGroup.findIndex((e) => e.id === edge.id);
      const count = pairGroup.length;

      // Normal vector perpendicular to the line chord
      const dx = geo.p2.x - geo.p1.x;
      const dy = geo.p2.y - geo.p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const tx = dx / len;
      const ty = dy / len;

      // Offset along normal: alternate sides or distribute
      const normStep = 24;
      const normOffset = (idx - (count - 1) / 2) * normStep;

      // Also stagger slightly along tangent (parallel) to prevent overlap on steep angles
      const tangStep = 18;
      const tangOffset = (idx - (count - 1) / 2) * tangStep;

      baseX += nx * normOffset + tx * tangOffset;
      baseY += ny * normOffset + ty * tangOffset;
    }

    positions.set(edgeId, { x: Math.round(baseX), y: Math.round(baseY) });
  }

  // 3. Collision resolution pass across all labeled edges on the canvas
  for (let pass = 0; pass < 5; pass++) {
    let hadCollision = false;

    for (let i = 0; i < labeledEdges.length; i++) {
      const e1 = labeledEdges[i];
      const p1 = positions.get(e1.id ?? '');
      if (!p1) continue;
      const lines1 = (e1.label || '').split('\n');
      const maxL1 = Math.max(...lines1.map((l) => l.length), 0);
      const w1 = Math.max(50, maxL1 * 8.4 + 20);
      const h1 = Math.max(26, lines1.length * 16 + 10);

      for (let j = i + 1; j < labeledEdges.length; j++) {
        const e2 = labeledEdges[j];
        const p2 = positions.get(e2.id ?? '');
        if (!p2) continue;
        const lines2 = (e2.label || '').split('\n');
        const maxL2 = Math.max(...lines2.map((l) => l.length), 0);
        const w2 = Math.max(50, maxL2 * 8.4 + 20);
        const h2 = Math.max(26, lines2.length * 16 + 10);

        const minDistanceX = (w1 + w2) / 2 + 8;
        const minDistanceY = (h1 + h2) / 2 + 6;
        const diffX = p2.x - p1.x;
        const diffY = p2.y - p1.y;

        const overlapX = minDistanceX - Math.abs(diffX);
        const overlapY = minDistanceY - Math.abs(diffY);

        if (overlapX > 0 && overlapY > 0) {
          hadCollision = true;

          const isManual1 = Boolean(e1.labelOffset && (e1.labelOffset.x !== 0 || e1.labelOffset.y !== 0));
          const isManual2 = Boolean(e2.labelOffset && (e2.labelOffset.x !== 0 || e2.labelOffset.y !== 0));

          if (overlapY <= overlapX) {
            const shiftY = overlapY / 2 + 2;
            const signY = diffY >= 0 ? 1 : -1;

            if (!isManual1 && !isManual2) {
              p1.y -= signY * shiftY;
              p2.y += signY * shiftY;
            } else if (!isManual1) {
              p1.y -= signY * (overlapY + 4);
            } else if (!isManual2) {
              p2.y += signY * (overlapY + 4);
            }
          } else {
            const shiftX = overlapX / 2 + 4;
            const signX = diffX >= 0 ? 1 : -1;

            if (!isManual1 && !isManual2) {
              p1.x -= signX * shiftX;
              p2.x += signX * shiftX;
            } else if (!isManual1) {
              p1.x -= signX * (overlapX + 4);
            } else if (!isManual2) {
              p2.x += signX * (overlapX + 4);
            }
          }
        }
      }
    }

    if (!hadCollision) break;
  }

  return positions;
}

// Freehand ink as a selectable, movable, resizable element.
export * from './stroke-element';

// Moving a whole selection — shapes, connectors and ink — as one gesture.
export * from './selection-drag';

export { distanceToBoxPerimeter } from '../core/boundaries';
