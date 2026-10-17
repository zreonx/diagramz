import type { ZCanvasBox, ZCanvasNode, ZCanvasPoint } from './schema';
import { boxCenter, rotatePoint } from './rotation';

/**
 * Boundaries, as the canvas understands them.
 *
 * A boundary is a `container` node — the VPC box the component tools place, the
 * group box a template draws. Being drawn on top of one does not make a shape
 * its child: an ungrouped box and the shapes sitting on it are two elements
 * layered, and the box travels alone. Membership is recorded, never geometric.
 * What records it is a group name shared with the box, which `grouping.ts`
 * reads, or the `parentId` an older editor wrote, which {@link childIdsOf}
 * reads here.
 *
 * These rules sit here rather than in the canvas so they can be exercised
 * without one, and so that the press which picks a boundary and the paint order
 * which stacks it cannot disagree about what "inside" means.
 */

export interface ZCanvasFramePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  icon?: string;
}

export const FRAME_PRESETS: ZCanvasFramePreset[] = [
  { id: 'desktop', name: 'Desktop (1440 × 900)', width: 1440, height: 900 },
  { id: 'laptop', name: 'Laptop (1280 × 800)', width: 1280, height: 800 },
  { id: 'tablet', name: 'Tablet (834 × 1194)', width: 834, height: 1194 },
  { id: 'mobile', name: 'Mobile (390 × 844)', width: 390, height: 844 },
  { id: 'presentation', name: 'Slide 16:9 (1920 × 1080)', width: 1920, height: 1080 },
  { id: 'a4', name: 'A4 Document (1240 × 1754)', width: 1240, height: 1754 },
  { id: 'square', name: 'Square (1080 × 1080)', width: 1080, height: 1080 },
];

/**
 * Whether `node` sits entirely within `container`.
 *
 * Geometry, and only geometry. It answers where a box is painted — a boundary
 * sits beneath the shapes it covers, so a line drawn across it stays visible
 * and reachable — and nothing else. A shape covered by a box is not for that
 * reason a child of it.
 */
export function encloses(container: ZCanvasNode, node: ZCanvasNode): boolean {
  return (
    node.x >= container.x &&
    node.y >= container.y &&
    node.x + node.width <= container.x + container.width &&
    node.y + node.height <= container.y + container.height
  );
}

/**
 * The nodes a boundary carries when it moves, as the document recorded them.
 *
 * `parentId` is the membership an editor wrote when it gave every group a box
 * of its own. Nothing here writes it any more — a group is a shared name now
 * (`groupIds`), and picking any member of one picks the rest through
 * `expandSelection` — but a document that carries a `parentId` means it, and
 * ungrouping already treats it as a group relationship. So a box still carries
 * what the file says it holds.
 *
 * Where a shape merely is, on the other hand, records nothing: an ungrouped box
 * moves on its own and leaves the shapes inside it where they are.
 */
export function childIdsOf(container: ZCanvasNode, nodes: ZCanvasNode[]): string[] {
  return nodes
    .filter((node) => node.id !== container.id && node.parentId === container.id)
    .map((node) => node.id);
}

/**
 * Whether a node acts as a grouping boundary or artboard frame.
 */
export function isBoundaryNode(node: ZCanvasNode): boolean {
  return node.type === 'container' || node.type === 'frame';
}

/**
 * The innermost boundary a point falls inside, or none.
 *
 * A press on a boundary's body reaches the canvas rather than the box, because
 * the box is deliberately transparent to presses: a plate large enough to hold
 * a diagram would otherwise swallow every click meant for a line drawn inside
 * it. A press therefore has to be turned back into the box the user meant, and
 * the box meant is the smallest one the point is inside — so nested boundaries
 * resolve to the one being pointed at rather than to everything around it.
 */
export function boundaryAtPoint(nodes: ZCanvasNode[], point: ZCanvasPoint): ZCanvasNode | null {
  let innermost: ZCanvasNode | null = null;

  for (const node of nodes) {
    if (!isBoundaryNode(node)) continue;
    if (point.x < node.x || point.x > node.x + node.width) continue;
    if (point.y < node.y || point.y > node.y + node.height) continue;

    if (innermost === null || node.width * node.height < innermost.width * innermost.height) {
      innermost = node;
    }
  }

  return innermost;
}

/**
 * Shortest Euclidean distance from `point` to the 4 perimeter edges of `box`.
 * Takes `rotation` into account by projecting into local unrotated space.
 */
export function distanceToBoxPerimeter(box: ZCanvasBox, point: ZCanvasPoint, rotation = 0): number {
  const localPt = rotation ? rotatePoint(point, boxCenter(box), -rotation) : point;

  const minX = box.x;
  const maxX = box.x + box.width;
  const minY = box.y;
  const maxY = box.y + box.height;

  const clampedX = Math.max(minX, Math.min(maxX, localPt.x));
  const clampedY = Math.max(minY, Math.min(maxY, localPt.y));

  const distTop = Math.hypot(localPt.x - clampedX, localPt.y - minY);
  const distBottom = Math.hypot(localPt.x - clampedX, localPt.y - maxY);
  const distLeft = Math.hypot(localPt.x - minX, localPt.y - clampedY);
  const distRight = Math.hypot(localPt.x - maxX, localPt.y - clampedY);

  return Math.min(distTop, distBottom, distLeft, distRight);
}
