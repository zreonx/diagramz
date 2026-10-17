import type { ZCanvasDrawingStroke, ZCanvasEdge, ZCanvasNode } from '../core/schema';
import { isLocked } from '../core/locking';
import { translateStroke } from './stroke-element';
import { isBoundaryNode, encloses } from '../core/boundaries';

/**
 * Moving everything that is selected, as one gesture.
 *
 * A selection is not one kind of thing. A sweep across a diagram catches
 * shapes, the connectors drawn between them and whatever was inked over them
 * all at once, and every gesture that follows a sweep — a drag, a nudge — is a
 * statement about the whole of it. A gesture that only understood one kind left
 * the rest behind, which reads as the arrow not being selected at all.
 *
 * The move is measured from a snapshot taken at the press rather than from the
 * live document. That is what keeps the elements on the pointer: the delta is
 * always read against where they started, so a slow drag cannot accumulate
 * rounding drift and slide away from the cursor. It is the same rule the ink
 * drag already follows.
 *
 * Connectors are the one kind that is only sometimes free to move. An attached
 * connector is drawn between whatever it is anchored to, so it has no position
 * of its own to add a delta to and it follows the shapes instead. A connector
 * carrying its own two endpoints is geometry in its own right and travels with
 * the rest.
 *
 * A lock is honoured here rather than at each gesture, because here is where a
 * gesture is told what it may move. Taking a locked element into the snapshot
 * and then remembering not to translate it is the shape of mistake this avoids:
 * a drag, a nudge and the boundary's own carry all build their snapshot through
 * this one function, so a locked element stays still in all three at once.
 */

/** A document's three kinds of element, as the gestures that move them see it. */
export interface ZCanvasDragDocument {
  nodes: ZCanvasNode[];
  edges: ZCanvasEdge[];
  strokes: ZCanvasDrawingStroke[];
}

/** Which elements a gesture is acting on. */
export interface ZCanvasDragSelection {
  nodeIds: string[];
  edgeIds?: string[];
  strokeIds?: string[];
}

/** The geometry a drag was started from, for every element it will move. */
export interface ZCanvasDragSnapshot {
  nodes: Map<string, ZCanvasNode>;
  edges: Map<string, ZCanvasEdge>;
  strokes: Map<string, ZCanvasDrawingStroke>;
}

/**
 * Takes the snapshot a drag is measured from.
 *
 * Only selected elements are kept, so an element the selection does not hold is
 * one the gesture leaves alone — the snapshot is the selection in the form the
 * move needs, not a second opinion about what is selected.
 *
 * A locked element is not kept either, which is what makes it stay where it is
 * while the rest of the selection travels. It is not dropped from the selection
 * itself: it stays highlighted and still answers a click, because the menu that
 * unlocks it is reached by clicking it.
 */
export function beginSelectionDrag(
  doc: ZCanvasDragDocument,
  selection: ZCanvasDragSelection
): ZCanvasDragSnapshot {
  const nodeIds = new Set(selection.nodeIds);
  const edgeIds = new Set(selection.edgeIds ?? []);
  const strokeIds = new Set(selection.strokeIds ?? []);

  const snapshot: ZCanvasDragSnapshot = {
    nodes: new Map(),
    edges: new Map(),
    strokes: new Map(),
  };

  for (const node of doc.nodes) {
    if (nodeIds.has(node.id) && !isLocked(node)) snapshot.nodes.set(node.id, node);
  }

  // When a container or frame moves, all components and shapes inside it
  // (explicit children, geometrically enclosed shapes, or shapes grouped with the container)
  // move with it synchronously, without requiring them to be selected in the UI.
  // This eliminates lagging and unwanted multi-selection highlights/handles.
  const boundaryNodes = Array.from(snapshot.nodes.values()).filter(isBoundaryNode);
  if (boundaryNodes.length > 0) {
    const queue = [...boundaryNodes];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      const parentGroups = new Set(parent.groupIds ?? []);

      for (const node of doc.nodes) {
        if (snapshot.nodes.has(node.id) || isLocked(node)) continue;

        const isExplicitChild = node.parentId === parent.id;
        const isEnclosed = encloses(parent, node);
        const isGroupMember = parentGroups.size > 0 && (node.groupIds ?? []).some((g) => parentGroups.has(g));

        if (isExplicitChild || isEnclosed || isGroupMember) {
          snapshot.nodes.set(node.id, node);
          if (isBoundaryNode(node)) {
            queue.push(node);
          }
        }
      }
    }

    // Also carry free connectors whose endpoints are both enclosed in the moving boundary
    for (const edge of doc.edges) {
      if (snapshot.edges.has(edge.id) || isLocked(edge)) continue;
      if (isFreeConnector(edge)) {
        for (const b of boundaryNodes) {
          const p1 = edge.sourcePoint!;
          const p2 = edge.targetPoint!;
          if (
            p1.x >= b.x && p1.x <= b.x + b.width &&
            p1.y >= b.y && p1.y <= b.y + b.height &&
            p2.x >= b.x && p2.x <= b.x + b.width &&
            p2.y >= b.y && p2.y <= b.y + b.height
          ) {
            snapshot.edges.set(edge.id, edge);
            break;
          }
        }
      }
    }
  }

  for (const edge of doc.edges) {
    if (edgeIds.has(edge.id) && !isLocked(edge)) snapshot.edges.set(edge.id, edge);
  }
  for (const stroke of doc.strokes) {
    if (strokeIds.has(stroke.id) && !isLocked(stroke)) snapshot.strokes.set(stroke.id, stroke);
  }

  return snapshot;
}

/** Whether `edge` has both of its endpoints free to be moved. */
export function isFreeConnector(edge: ZCanvasEdge): boolean {
  return Boolean(edge.sourcePoint && edge.targetPoint);
}

/**
 * Whether a snapshot holds anything a move could actually shift.
 *
 * An attached connector is held without being movable: it is in the selection,
 * but where it runs is decided by the shapes it is anchored to. A gesture whose
 * selection is only that would write the document back to itself, which is not
 * a move — it records an undo step that undoes nothing.
 */
export function isDragSnapshotMovable(snapshot: ZCanvasDragSnapshot): boolean {
  if (snapshot.nodes.size > 0 || snapshot.strokes.size > 0) return true;

  for (const edge of snapshot.edges.values()) {
    if (isFreeConnector(edge)) return true;
  }

  return false;
}

/**
 * The document after every element in the snapshot has moved by `dx`, `dy`.
 *
 * Positions are taken from the snapshot and everything else from the document,
 * so a change made to an element during the drag — a style preview, say — is
 * carried through rather than reverted by the move.
 */
export function translateSelection(
  snapshot: ZCanvasDragSnapshot,
  doc: ZCanvasDragDocument,
  dx: number,
  dy: number
): ZCanvasDragDocument {
  if (dx === 0 && dy === 0) return doc;

  return {
    nodes: doc.nodes.map((node) => {
      const origin = snapshot.nodes.get(node.id);
      return origin ? { ...node, x: origin.x + dx, y: origin.y + dy } : node;
    }),
    edges: doc.edges.map((edge) => {
      const origin = snapshot.edges.get(edge.id);
      // An attached connector has no endpoint of its own to shift: where it
      // starts and ends is decided by the shapes it is anchored to, which have
      // moved themselves. Only a connector carrying both of its own points is
      // geometry the drag can translate.
      if (!origin || !isFreeConnector(origin)) return edge;

      return {
        ...edge,
        sourcePoint: {
          x: origin.sourcePoint!.x + dx,
          y: origin.sourcePoint!.y + dy,
        },
        targetPoint: {
          x: origin.targetPoint!.x + dx,
          y: origin.targetPoint!.y + dy,
        },
      };
    }),
    strokes: doc.strokes.map((stroke) => {
      const origin = snapshot.strokes.get(stroke.id);
      return origin ? translateStroke(origin, dx, dy) : stroke;
    }),
  };
}

/**
 * The boxes of everything in the snapshot, as one box.
 *
 * A drag of a multi-selection has to know how far it has come to snap the whole
 * group against its neighbours, and the shapes alone do not describe where the
 * selection is when it is ink or a lone connector.
 */
export function dragSnapshotBounds(snapshot: ZCanvasDragSnapshot): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const add = (x: number, y: number, width = 0, height = 0) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + width > maxX) maxX = x + width;
    if (y + height > maxY) maxY = y + height;
  };

  for (const node of snapshot.nodes.values()) add(node.x, node.y, node.width, node.height);
  for (const stroke of snapshot.strokes.values()) {
    for (const point of stroke.points) add(point.x, point.y);
  }
  for (const edge of snapshot.edges.values()) {
    if (!isFreeConnector(edge)) continue;
    add(edge.sourcePoint!.x, edge.sourcePoint!.y);
    add(edge.targetPoint!.x, edge.targetPoint!.y);
  }

  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
