import { encloses, isBoundaryNode, distanceToBoxPerimeter } from './boundaries';
import { boxCenter, rotatePoint, rotationOf } from './rotation';
import type { ZCanvasNode, ZCanvasPoint } from './schema';

/**
 * Which element is on top, and which element a press therefore meets first.
 *
 * Document order is the source of truth for stacking. Two rules refine it:
 *
 * - A box never covers its own contents. A container that fully encloses an
 *   element is pulled behind it, however the document happens to be ordered, so
 *   bringing a boundary forward can neither bury the components it holds nor
 *   swallow the press that would start editing their text. Containers stay
 *   interchangeable with each other.
 * - An explicit `node.zIndex` overrides both, for documents that carry their
 *   own stacking.
 *
 * The same ranking answers both questions — what is painted where, and what a
 * point resolves to — because they are the same question. A press that resolved
 * against document order while the renderer resolved against this would let an
 * element be picked through the thing drawn over it, which is the defect a
 * boundary enclosing its contents used to have.
 */

/**
 * A dense 1..n stacking rank per node id, derived from document order.
 *
 * Dense rather than sparse so that every element gets a stacking context of its
 * own: a shape's grips and selection handles stay bonded to it instead of
 * escaping over its neighbours.
 */
export function paintOrderRanks(nodes: ZCanvasNode[]): Map<string, number> {
  const rank = nodes.map((node, index) => {
    if (!isBoundaryNode(node)) return index;

    // Sit just below the earliest element this box encloses.
    let earliest = index;
    nodes.forEach((other, otherIndex) => {
      if (isBoundaryNode(other)) return;
      // The same `encloses` the press that picks a boundary is decided by, so
      // the two cannot come to different conclusions about what a box holds.
      if (encloses(node, other)) earliest = Math.min(earliest, otherIndex);
    });
    return earliest;
  });

  const positions = nodes.map((_, index) => index);
  positions.sort((a, b) => {
    if (rank[a] !== rank[b]) return rank[a] - rank[b];
    // On a tie the enclosed box goes underneath the element it holds.
    const boxA = isBoundaryNode(nodes[a]) ? 0 : 1;
    const boxB = isBoundaryNode(nodes[b]) ? 0 : 1;
    return boxA - boxB || a - b;
  });

  const z = new Map<string, number>();
  positions.forEach((nodeIndex, position) => {
    z.set(nodes[nodeIndex].id, position + 1);
  });
  return z;
}

/**
 * The stacking key one node is drawn — and resolved — at.
 *
 * The renderer writes it straight onto the element and the hit test compares it,
 * so the two cannot come to different conclusions about which of two overlapping
 * elements is the upper one. `index` is the node's place in the document, which
 * is what an element with no rank yet falls back to.
 */
export function nodeStackKey(
  node: ZCanvasNode,
  ranks: Map<string, number>,
  index: number
): number {
  return node.zIndex ?? ranks.get(node.id) ?? index + 1;
}

/** Whether `point` falls inside a node's box. */
function containsPoint(node: ZCanvasNode, point: ZCanvasPoint): boolean {
  return (
    point.x >= node.x &&
    point.x <= node.x + node.width &&
    point.y >= node.y &&
    point.y <= node.y + node.height
  );
}

/**
 * The topmost node whose box contains `point`, by the order they are painted.
 *
 * Walks every node rather than taking the last match in document order, because
 * document order is only half of the ranking: a boundary enclosing a shape sits
 * behind it, so a press on the shape must reach the shape even when the
 * boundary comes later in the document.
 *
 * Two elements that share a stacking key are broken by document order, which is
 * the tie-break the renderer itself gets for free from the order it emits them.
 */
export function topmostNodeAt(
  nodes: ZCanvasNode[],
  point: ZCanvasPoint,
  ranks: Map<string, number>
): ZCanvasNode | null {
  let best: ZCanvasNode | null = null;
  let bestKey = -Infinity;

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (!containsPoint(node, point)) continue;

    const key = nodeStackKey(node, ranks, index);
    // `>=` rather than `>` so that equal keys are settled by document order the
    // same way the renderer settles them.
    if (key >= bestKey) {
      bestKey = key;
      best = node;
    }
  }

  return best;
}

export interface FindConnectableNodeOptions {
  /**
   * Whether boundary nodes (containers, VPCs, frames) are eligible as targets.
   * Defaults to `true` (requiring the point to be within `boundaryThreshold` of perimeter).
   * When `false`, boundary nodes are completely ignored (ideal for freeform line/arrow drawing).
   */
  allowBoundary?: boolean;
  /**
   * Distance in canvas units from the perimeter border of a container within which a connection snaps.
   * Defaults to 14.
   */
  boundaryThreshold?: number;
  /**
   * Extra margin in canvas units around shape bounds or container borders to consider a hit.
   * Useful for anchor hover detection and connection snapping. Defaults to 0.
   */
  padding?: number;
}

/**
 * The topmost node at `point` that is eligible for line connection or endpoint snapping.
 *
 * For regular shapes and components, matches if `point` falls inside the node (plus optional padding).
 * For boundary nodes (containers, VPCs, frames), the interior is deliberately transparent
 * so that lines drawn or moved inside a container never erroneously hijack or auto-route
 * to the container's line points.
 * A boundary node only matches if `allowBoundary` is true AND `point` is within
 * `boundaryThreshold` of the container's perimeter border (e.g. dropping a line directly
 * on the container's edge).
 */
export function findConnectableNodeAt(
  nodes: ZCanvasNode[],
  point: ZCanvasPoint,
  ranks: Map<string, number>,
  options?: FindConnectableNodeOptions
): ZCanvasNode | null {
  const allowBoundary = options?.allowBoundary ?? true;
  const padding = options?.padding ?? 0;
  const boundaryThreshold = (options?.boundaryThreshold ?? 14) + padding;

  let best: ZCanvasNode | null = null;
  let bestKey = -Infinity;

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const isBoundary = isBoundaryNode(node);

    if (isBoundary) {
      if (!allowBoundary) continue;
      const dist = distanceToBoxPerimeter(node, point, rotationOf(node));
      if (dist > boundaryThreshold) continue;
    } else {
      const rot = rotationOf(node);
      const localPt = rot ? rotatePoint(point, boxCenter(node), -rot) : point;
      if (padding > 0) {
        if (
          localPt.x < node.x - padding ||
          localPt.x > node.x + node.width + padding ||
          localPt.y < node.y - padding ||
          localPt.y > node.y + node.height + padding
        ) {
          continue;
        }
      } else {
        if (!containsPoint(node, localPt)) continue;
      }
    }

    const key = nodeStackKey(node, ranks, index);
    if (key >= bestKey) {
      bestKey = key;
      best = node;
    }
  }

  return best;
}
